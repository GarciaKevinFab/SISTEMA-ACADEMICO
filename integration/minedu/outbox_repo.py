"""
MINEDU Outbox Repository
Repository pattern for outbox operations with safe MongoDB updates
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from safe_mongo_operations import safe_update_one
import logging

logger = logging.getLogger(__name__)

class OutboxRepository:
    """Repository for outbox operations with safe MongoDB updates"""
    
    def __init__(self, db: AsyncIOMotorClient):
        self.db = db
        self.collection = db.minedu_outbox
        
    async def find_by_idempotent_key(self, idempotent_key: str) -> Optional[Dict[str, Any]]:
        """Find event by idempotent key"""
        return await self.collection.find_one({"idempotent_key": idempotent_key})
    
    async def find_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Find event by ID"""
        return await self.collection.find_one({"id": event_id})
    
    async def create(self, event_data: Dict[str, Any]) -> str:
        """Create new outbox event"""
        result = await self.collection.insert_one(event_data)
        return str(result.inserted_id)
    
    async def update_status(
        self,
        event_id: str,
        status: str,
        additional_fields: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Update event status using safe MongoDB operations"""
        update_data = {
            "$set": {
                "status": status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
        
        if additional_fields:
            update_data["$set"].update(additional_fields)
            
        # Handle increment operations
        if "retry_count" in (additional_fields or {}):
            update_data["$inc"] = {"retry_count": 1}
            del update_data["$set"]["retry_count"]
        
        try:
            result = await safe_update_one(
                self.collection,
                {"id": event_id},
                update_data
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating event status {event_id}: {e}")
            return False
    
    async def find_pending_events(
        self,
        limit: int = 100,
        entity_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Find pending events for processing"""
        query = {
            "status": {"$in": ["PENDING", "RETRY"]},
            "retry_count": {"$lt": 5}
        }
        
        if entity_type:
            query["entity_type"] = entity_type
            
        cursor = self.collection.find(query).limit(limit).sort("created_at", 1)
        return await cursor.to_list(length=None)
    
    async def find_by_status(self, status: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Find events by status"""
        cursor = self.collection.find({"status": status}).limit(limit)
        return await cursor.to_list(length=None)
    
    async def find_by_period(
        self,
        period_id: str,
        entity_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Find events by period"""
        query = {"period_id": period_id}
        if entity_type:
            query["entity_type"] = entity_type
            
        cursor = self.collection.find(query)
        return await cursor.to_list(length=None)
    
    async def get_stats_by_status(self) -> Dict[str, int]:
        """Get event count statistics by status"""
        pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ]
        
        cursor = self.collection.aggregate(pipeline)
        stats_list = await cursor.to_list(length=None)
        
        stats = {}
        for stat in stats_list:
            stats[stat["_id"]] = stat["count"]
            
        return stats
    
    async def get_stats_by_entity_type(self) -> Dict[str, int]:
        """Get event count statistics by entity type"""
        pipeline = [
            {"$group": {
                "_id": "$entity_type",
                "count": {"$sum": 1}
            }}
        ]
        
        cursor = self.collection.aggregate(pipeline)
        stats_list = await cursor.to_list(length=None)
        
        stats = {}
        for stat in stats_list:
            stats[stat["_id"]] = stat["count"]
            
        return stats
    
    async def get_period_summary(self, period_id: str) -> Dict[str, Any]:
        """Get summary statistics for a specific period"""
        pipeline = [
            {"$match": {"period_id": period_id}},
            {"$group": {
                "_id": {
                    "entity_type": "$entity_type",
                    "status": "$status"
                },
                "count": {"$sum": 1}
            }}
        ]
        
        cursor = self.collection.aggregate(pipeline)
        results = await cursor.to_list(length=None)
        
        summary = {
            "period_id": period_id,
            "entity_types": {},
            "total_events": 0
        }
        
        for result in results:
            entity_type = result["_id"]["entity_type"]
            status = result["_id"]["status"]
            count = result["count"]
            
            if entity_type not in summary["entity_types"]:
                summary["entity_types"][entity_type] = {}
            
            summary["entity_types"][entity_type][status] = count
            summary["total_events"] += count
        
        return summary
    
    async def cleanup_old_events(self, days_old: int = 30) -> int:
        """Cleanup events older than specified days (only ACKED events)"""
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
        
        result = await self.collection.delete_many({
            "status": "ACKED",
            "acked_at": {"$lt": cutoff_date.isoformat()}
        })
        
        logger.info(f"Cleaned up {result.deleted_count} old events")
        return result.deleted_count
    
    async def reset_stuck_events(self, hours_stuck: int = 2) -> int:
        """Reset events stuck in SENDING status"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours_stuck)
        
        update_result = await self.collection.update_many(
            {
                "status": "SENDING",
                "updated_at": {"$lt": cutoff_time.isoformat()}
            },
            {
                "$set": {
                    "status": "RETRY",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        logger.info(f"Reset {update_result.modified_count} stuck events")
        return update_result.modified_count
    
    async def get_failed_events_summary(self) -> List[Dict[str, Any]]:
        """Get summary of failed events for manual review"""
        pipeline = [
            {"$match": {"status": "FAILED"}},
            {"$group": {
                "_id": {
                    "entity_type": "$entity_type",
                    "error_message": "$error_message"
                },
                "count": {"$sum": 1},
                "first_occurrence": {"$min": "$created_at"},
                "last_occurrence": {"$max": "$updated_at"},
                "sample_event_id": {"$first": "$id"}
            }},
            {"$sort": {"count": -1}}
        ]
        
        cursor = self.collection.aggregate(pipeline)
        return await cursor.to_list(length=None)
    
    async def bulk_reprocess_by_criteria(
        self,
        criteria: Dict[str, Any],
        limit: int = 100
    ) -> int:
        """Bulk reprocess events matching criteria"""
        events = await self.collection.find(criteria).limit(limit).to_list(length=None)
        
        reprocessed = 0
        for event in events:
            success = await self.update_status(
                event["id"],
                "PENDING",
                {"retry_count": 0, "error_message": None}
            )
            if success:
                reprocessed += 1
        
        logger.info(f"Bulk reprocessed {reprocessed} events")
        return reprocessed
    
    async def create_indexes(self):
        """Create necessary indexes for performance"""
        indexes = [
            ("idempotent_key", 1),  # Unique index for idempotency
            ("status", 1),
            ("entity_type", 1),
            ("period_id", 1),
            ("created_at", 1),
            ("updated_at", 1),
            ([("status", 1), ("retry_count", 1)], None)  # Compound index
        ]
        
        for index in indexes:
            if isinstance(index, tuple) and len(index) == 2:
                if isinstance(index[0], list):
                    # Compound index
                    await self.collection.create_index(index[0])
                else:
                    # Simple index
                    await self.collection.create_index(index[0])
            else:
                await self.collection.create_index(index)
        
        # Unique index for idempotent key
        await self.collection.create_index("idempotent_key", unique=True)
        
        logger.info("Created outbox indexes")