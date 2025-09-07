"""
MINEDU Integration Producer
Manages outbox pattern with idempotency for MINEDU data submission
"""
import uuid
import asyncio
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import orjson
from motor.motor_asyncio import AsyncIOMotorClient
import logging

logger = logging.getLogger(__name__)

class OutboxStatus(Enum):
    PENDING = "PENDING"
    SENDING = "SENDING" 
    SENT = "SENT"
    ACKED = "ACKED"
    RETRY = "RETRY"
    FAILED = "FAILED"

class EntityType(Enum):
    ENROLLMENT = "enrollment"
    GRADE = "grade"
    CERTIFICATE = "certificate"

@dataclass
class OutboxEvent:
    """Outbox event with idempotent key"""
    id: str
    entity_type: EntityType
    entity_id: str
    period_id: str
    version: int
    payload: Dict[str, Any]
    status: OutboxStatus
    retry_count: int = 0
    max_retries: int = 5
    created_at: datetime = None
    updated_at: datetime = None
    sent_at: Optional[datetime] = None
    acked_at: Optional[datetime] = None
    error_message: Optional[str] = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc)
        if self.updated_at is None:
            self.updated_at = datetime.now(timezone.utc)

class MINEDUProducer:
    """MINEDU Integration Producer with Outbox Pattern"""
    
    def __init__(self, db: AsyncIOMotorClient):
        self.db = db
        self.outbox_collection = db.minedu_outbox
        self.queue_collection = db.minedu_queue
        
    async def create_outbox_event(
        self,
        entity_type: EntityType,
        entity_id: str,
        period_id: str,
        payload: Dict[str, Any],
        version: int = 1
    ) -> str:
        """Create outbox event with idempotent key"""
        # Idempotent key: (entity_type, entity_id, period_id, version)
        idempotent_key = f"{entity_type.value}:{entity_id}:{period_id}:{version}"
        
        # Check if event already exists
        existing = await self.outbox_collection.find_one({
            "idempotent_key": idempotent_key
        })
        
        if existing:
            logger.info(f"Event already exists with key: {idempotent_key}")
            return existing["id"]
        
        event_id = str(uuid.uuid4())
        event = OutboxEvent(
            id=event_id,
            entity_type=entity_type,
            entity_id=entity_id,
            period_id=period_id,
            version=version,
            payload=payload,
            status=OutboxStatus.PENDING
        )
        
        # Store in outbox
        event_doc = {
            "id": event.id,
            "idempotent_key": idempotent_key,
            "entity_type": event.entity_type.value,
            "entity_id": event.entity_id,
            "period_id": event.period_id,
            "version": event.version,
            "payload": event.payload,
            "status": event.status.value,
            "retry_count": event.retry_count,
            "max_retries": event.max_retries,
            "created_at": event.created_at.isoformat(),
            "updated_at": event.updated_at.isoformat(),
            "sent_at": None,
            "acked_at": None,
            "error_message": None
        }
        
        await self.outbox_collection.insert_one(event_doc)
        logger.info(f"Created outbox event: {event_id} with key: {idempotent_key}")
        
        # Add to processing queue
        await self._enqueue_event(event_id)
        
        return event_id

    async def _enqueue_event(self, event_id: str):
        """Add event to processing queue"""
        queue_item = {
            "event_id": event_id,
            "queued_at": datetime.now(timezone.utc).isoformat(),
            "processed": False
        }
        
        await self.queue_collection.insert_one(queue_item)
        logger.info(f"Enqueued event: {event_id}")

    async def update_event_status(
        self,
        event_id: str,
        status: OutboxStatus,
        error_message: Optional[str] = None
    ):
        """Update event status"""
        update_data = {
            "$set": {
                "status": status.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
        
        if status == OutboxStatus.SENT:
            update_data["$set"]["sent_at"] = datetime.now(timezone.utc).isoformat()
        elif status == OutboxStatus.ACKED:
            update_data["$set"]["acked_at"] = datetime.now(timezone.utc).isoformat()
        elif status == OutboxStatus.RETRY or status == OutboxStatus.FAILED:
            update_data["$inc"] = {"retry_count": 1}
            if error_message:
                update_data["$set"]["error_message"] = error_message

        await self.outbox_collection.update_one(
            {"id": event_id},
            update_data
        )
        
        logger.info(f"Updated event {event_id} to status: {status.value}")

    async def get_pending_events(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get pending events for processing"""
        cursor = self.outbox_collection.find({
            "status": {"$in": ["PENDING", "RETRY"]},
            "retry_count": {"$lt": 5}
        }).limit(limit).sort("created_at", 1)
        
        events = await cursor.to_list(length=None)
        return events

    async def get_event_stats(self) -> Dict[str, int]:
        """Get event statistics"""
        pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ]
        
        cursor = self.outbox_collection.aggregate(pipeline)
        stats_list = await cursor.to_list(length=None)
        
        stats = {
            "PENDING": 0,
            "SENDING": 0,
            "SENT": 0,
            "ACKED": 0,
            "RETRY": 0,
            "FAILED": 0
        }
        
        for stat in stats_list:
            stats[stat["_id"]] = stat["count"]
            
        return stats

    async def create_enrollment_event(
        self,
        student_id: str,
        course_id: str,
        period_id: str,
        enrollment_data: Dict[str, Any]
    ) -> str:
        """Create enrollment event for MINEDU"""
        payload = {
            "tipo": "matricula",
            "estudiante_id": student_id,
            "curso_id": course_id,
            "periodo_id": period_id,
            "fecha_matricula": enrollment_data.get("enrollment_date"),
            "estado": enrollment_data.get("status", "ACTIVE"),
            "creditos": enrollment_data.get("credits", 0)
        }
        
        return await self.create_outbox_event(
            EntityType.ENROLLMENT,
            f"{student_id}:{course_id}",
            period_id,
            payload
        )

    async def create_grade_event(
        self,
        student_id: str,
        course_id: str,
        period_id: str,
        grade_data: Dict[str, Any]
    ) -> str:
        """Create grade event for MINEDU"""
        payload = {
            "tipo": "calificacion",
            "estudiante_id": student_id,
            "curso_id": course_id,
            "periodo_id": period_id,
            "nota_numerica": grade_data.get("numerical_grade"),
            "nota_literal": grade_data.get("literal_grade"),
            "estado": grade_data.get("status"),
            "fecha_evaluacion": grade_data.get("evaluation_date")
        }
        
        return await self.create_outbox_event(
            EntityType.GRADE,
            f"{student_id}:{course_id}",
            period_id,
            payload
        )

    async def create_certificate_event(
        self,
        student_id: str,
        certificate_type: str,
        period_id: str,
        certificate_data: Dict[str, Any]
    ) -> str:
        """Create certificate event for MINEDU"""
        payload = {
            "tipo": "certificado",
            "estudiante_id": student_id,
            "tipo_certificado": certificate_type,
            "periodo_id": period_id,
            "fecha_emision": certificate_data.get("issued_date"),
            "numero_certificado": certificate_data.get("certificate_number"),
            "estado": certificate_data.get("status", "ISSUED")
        }
        
        return await self.create_outbox_event(
            EntityType.CERTIFICATE,
            f"{student_id}:{certificate_type}",
            period_id,
            payload
        )