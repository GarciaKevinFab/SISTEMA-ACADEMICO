"""
MINEDU Integration Worker
Processes outbox events with exponential backoff and circuit breaker
"""
import asyncio
import time
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone, timedelta
import aiohttp
from motor.motor_asyncio import AsyncIOMotorClient
from .producer import MINEDUProducer, OutboxStatus

logger = logging.getLogger(__name__)

class CircuitBreakerState:
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"

class CircuitBreaker:
    """Circuit breaker for MINEDU API calls"""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitBreakerState.CLOSED

    def can_execute(self) -> bool:
        if self.state == CircuitBreakerState.CLOSED:
            return True
        
        if self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitBreakerState.HALF_OPEN
                return True
            return False
        
        # HALF_OPEN state
        return True

    def on_success(self):
        self.failure_count = 0
        self.state = CircuitBreakerState.CLOSED

    def on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitBreakerState.OPEN

    def _should_attempt_reset(self) -> bool:
        return (
            self.last_failure_time and
            time.time() - self.last_failure_time >= self.recovery_timeout
        )

class MINEDUWorker:
    """Worker for processing MINEDU integration events"""
    
    def __init__(self, db: AsyncIOMotorClient, minedu_api_url: str = "https://sia.minedu.gob.pe/api"):
        self.db = db
        self.producer = MINEDUProducer(db)
        self.minedu_api_url = minedu_api_url
        self.circuit_breaker = CircuitBreaker()
        self.max_retry_delay = 300  # 5 minutes
        self.base_delay = 1  # 1 second
        
    async def process_events(self, batch_size: int = 10):
        """Process pending events in batches"""
        while True:
            try:
                events = await self.producer.get_pending_events(batch_size)
                
                if not events:
                    await asyncio.sleep(5)  # Wait before next check
                    continue
                
                logger.info(f"Processing {len(events)} events")
                
                for event in events:
                    await self._process_single_event(event)
                    
            except Exception as e:
                logger.error(f"Error in event processing loop: {e}")
                await asyncio.sleep(10)

    async def _process_single_event(self, event: Dict[str, Any]):
        """Process a single event"""
        event_id = event["id"]
        
        try:
            # Check circuit breaker
            if not self.circuit_breaker.can_execute():
                logger.warning(f"Circuit breaker open, skipping event {event_id}")
                return
            
            # Update status to SENDING
            await self.producer.update_event_status(event_id, OutboxStatus.SENDING)
            
            # Send to MINEDU
            success = await self._send_to_minedu(event)
            
            if success:
                await self.producer.update_event_status(event_id, OutboxStatus.SENT)
                self.circuit_breaker.on_success()
                
                # Simulate ACK (in real implementation, this would come from MINEDU webhook)
                await asyncio.sleep(1)
                await self.producer.update_event_status(event_id, OutboxStatus.ACKED)
                
            else:
                await self._handle_failure(event)
                
        except Exception as e:
            logger.error(f"Error processing event {event_id}: {e}")
            await self._handle_failure(event, str(e))

    async def _send_to_minedu(self, event: Dict[str, Any]) -> bool:
        """Send event to MINEDU API"""
        endpoint = self._get_endpoint_for_event(event)
        payload = event["payload"]
        
        timeout = aiohttp.ClientTimeout(total=30)  # 30 second timeout
        
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self.minedu_api_url}/{endpoint}",
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": "Bearer MINEDU_API_TOKEN",  # From env
                        "X-Institution-Code": "IESPP_GUSTAVO_ALLENDE"
                    }
                ) as response:
                    
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"Successfully sent event {event['id']} to MINEDU: {result}")
                        return True
                    elif response.status >= 400 and response.status < 500:
                        # Client error - don't retry
                        error_text = await response.text()
                        logger.error(f"Client error sending event {event['id']}: {response.status} - {error_text}")
                        return False
                    else:
                        # Server error - retry
                        error_text = await response.text()
                        logger.error(f"Server error sending event {event['id']}: {response.status} - {error_text}")
                        return False
                        
        except asyncio.TimeoutError:
            logger.error(f"Timeout sending event {event['id']} to MINEDU")
            return False
        except Exception as e:
            logger.error(f"Exception sending event {event['id']} to MINEDU: {e}")
            return False

    def _get_endpoint_for_event(self, event: Dict[str, Any]) -> str:
        """Get MINEDU API endpoint for event type"""
        entity_type = event["entity_type"]
        
        endpoints = {
            "enrollment": "matriculas",
            "grade": "calificaciones", 
            "certificate": "certificados"
        }
        
        return endpoints.get(entity_type, "unknown")

    async def _handle_failure(self, event: Dict[str, Any], error_message: str = None):
        """Handle event processing failure"""
        event_id = event["id"]
        retry_count = event.get("retry_count", 0)
        max_retries = event.get("max_retries", 5)
        
        self.circuit_breaker.on_failure()
        
        if retry_count >= max_retries:
            # Move to dead letter
            await self.producer.update_event_status(
                event_id, 
                OutboxStatus.FAILED, 
                error_message or "Max retries exceeded"
            )
            
            # Add to dead letter queue
            await self._add_to_dead_letter(event)
            
        else:
            # Schedule retry with exponential backoff
            delay = min(self.base_delay * (2 ** retry_count), self.max_retry_delay)
            
            await self.producer.update_event_status(
                event_id,
                OutboxStatus.RETRY,
                error_message or "Retrying after failure"
            )
            
            logger.info(f"Scheduling retry for event {event_id} in {delay} seconds")
            await asyncio.sleep(delay)

    async def _add_to_dead_letter(self, event: Dict[str, Any]):
        """Add failed event to dead letter queue"""
        dead_letter_doc = {
            "original_event_id": event["id"],
            "entity_type": event["entity_type"],
            "entity_id": event["entity_id"],
            "period_id": event["period_id"],
            "payload": event["payload"],
            "retry_count": event.get("retry_count", 0),
            "last_error": event.get("error_message"),
            "failed_at": datetime.now(timezone.utc).isoformat(),
            "requires_manual_review": True
        }
        
        await self.db.minedu_dead_letter.insert_one(dead_letter_doc)
        logger.error(f"Added event {event['id']} to dead letter queue")

    async def get_processing_stats(self) -> Dict[str, Any]:
        """Get processing statistics"""
        stats = await self.producer.get_event_stats()
        
        # Add dead letter count
        dead_letter_count = await self.db.minedu_dead_letter.count_documents({})
        stats["DEAD_LETTER"] = dead_letter_count
        
        # Add circuit breaker status
        stats["CIRCUIT_BREAKER"] = {
            "state": self.circuit_breaker.state,
            "failure_count": self.circuit_breaker.failure_count
        }
        
        return stats

    async def reprocess_failed_events(self, limit: int = 10):
        """Reprocess failed events (admin operation)"""
        failed_events = await self.producer.outbox_collection.find({
            "status": "FAILED"
        }).limit(limit).to_list(length=None)
        
        reprocessed = 0
        for event in failed_events:
            # Reset status to PENDING
            await self.producer.update_event_status(
                event["id"],
                OutboxStatus.PENDING,
                "Manual reprocessing"
            )
            
            # Reset retry count
            await self.producer.outbox_collection.update_one(
                {"id": event["id"]},
                {"$set": {"retry_count": 0}}
            )
            
            reprocessed += 1
        
        logger.info(f"Reprocessed {reprocessed} failed events")
        return reprocessed