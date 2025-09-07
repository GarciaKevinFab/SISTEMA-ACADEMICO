"""
MINEDU Reconciliation Job
Compares local data with MINEDU remote data to find discrepancies
"""
import asyncio
import csv
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Set
from motor.motor_asyncio import AsyncIOMotorClient
from integration.minedu.outbox_repo import OutboxRepository
import aiohttp
import os

logger = logging.getLogger(__name__)

class MINEDUReconciler:
    """Reconciles local data with MINEDU SIA/SIAGIE systems"""
    
    def __init__(self, db: AsyncIOMotorClient, minedu_api_url: str = "https://sia.minedu.gob.pe/api"):
        self.db = db
        self.outbox_repo = OutboxRepository(db)
        self.minedu_api_url = minedu_api_url
        self.discrepancies = []
        
    async def reconcile_period(self, period_id: str) -> Dict[str, Any]:
        """Reconcile all data for a specific period"""
        logger.info(f"Starting reconciliation for period: {period_id}")
        
        start_time = datetime.now(timezone.utc)
        
        # Get local data
        local_enrollments = await self._get_local_enrollments(period_id)
        local_grades = await self._get_local_grades(period_id)
        local_certificates = await self._get_local_certificates(period_id)
        
        # Get remote data from MINEDU
        remote_enrollments = await self._get_remote_enrollments(period_id)
        remote_grades = await self._get_remote_grades(period_id)
        remote_certificates = await self._get_remote_certificates(period_id)
        
        # Compare data
        enrollment_discrepancies = self._compare_enrollments(local_enrollments, remote_enrollments)
        grade_discrepancies = self._compare_grades(local_grades, remote_grades)
        certificate_discrepancies = self._compare_certificates(local_certificates, remote_certificates)
        
        # Consolidate results
        result = {
            "period_id": period_id,
            "reconciled_at": start_time.isoformat(),
            "duration_seconds": (datetime.now(timezone.utc) - start_time).total_seconds(),
            "summary": {
                "local_enrollments": len(local_enrollments),
                "remote_enrollments": len(remote_enrollments),
                "local_grades": len(local_grades),
                "remote_grades": len(remote_grades),
                "local_certificates": len(local_certificates),
                "remote_certificates": len(remote_certificates),
                "total_discrepancies": len(enrollment_discrepancies) + len(grade_discrepancies) + len(certificate_discrepancies)
            },
            "discrepancies": {
                "enrollments": enrollment_discrepancies,
                "grades": grade_discrepancies,
                "certificates": certificate_discrepancies
            }
        }
        
        # Store reconciliation result
        await self._store_reconciliation_result(result)
        
        # Generate CSV report if there are discrepancies
        if result["summary"]["total_discrepancies"] > 0:
            await self._generate_discrepancy_csv(result)
        
        # Auto-reprocess discrepancies if enabled
        reprocessed = await self._auto_reprocess_discrepancies(result)
        result["reprocessed_count"] = reprocessed
        
        logger.info(f"Reconciliation completed for period {period_id}: {result['summary']['total_discrepancies']} discrepancies found")
        
        return result
    
    async def _get_local_enrollments(self, period_id: str) -> List[Dict[str, Any]]:
        """Get local enrollment data"""
        cursor = self.db.enrollments.find({
            "period_id": period_id,
            "status": {"$in": ["ACTIVE", "COMPLETED"]}
        })
        return await cursor.to_list(length=None)
    
    async def _get_local_grades(self, period_id: str) -> List[Dict[str, Any]]:
        """Get local grade data"""
        cursor = self.db.grades.find({
            "period_id": period_id,
            "status": {"$ne": "DRAFT"}
        })
        return await cursor.to_list(length=None)
    
    async def _get_local_certificates(self, period_id: str) -> List[Dict[str, Any]]:
        """Get local certificate data"""
        cursor = self.db.certificates.find({
            "period_id": period_id,
            "status": "ISSUED"
        })
        return await cursor.to_list(length=None)
    
    async def _get_remote_enrollments(self, period_id: str) -> List[Dict[str, Any]]:
        """Get remote enrollment data from MINEDU"""
        return await self._fetch_from_minedu(f"matriculas/periodo/{period_id}")
    
    async def _get_remote_grades(self, period_id: str) -> List[Dict[str, Any]]:
        """Get remote grade data from MINEDU"""
        return await self._fetch_from_minedu(f"calificaciones/periodo/{period_id}")
    
    async def _get_remote_certificates(self, period_id: str) -> List[Dict[str, Any]]:
        """Get remote certificate data from MINEDU"""
        return await self._fetch_from_minedu(f"certificados/periodo/{period_id}")
    
    async def _fetch_from_minedu(self, endpoint: str) -> List[Dict[str, Any]]:
        """Fetch data from MINEDU API"""
        try:
            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(
                    f"{self.minedu_api_url}/{endpoint}",
                    headers={
                        "Authorization": "Bearer MINEDU_API_TOKEN",
                        "X-Institution-Code": "IESPP_GUSTAVO_ALLENDE"
                    }
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("data", [])
                    elif response.status == 404:
                        # No data found - not an error
                        return []
                    else:
                        logger.error(f"Error fetching from MINEDU {endpoint}: {response.status}")
                        return []
        except Exception as e:
            logger.error(f"Exception fetching from MINEDU {endpoint}: {e}")
            return []
    
    def _compare_enrollments(self, local: List[Dict], remote: List[Dict]) -> List[Dict[str, Any]]:
        """Compare local and remote enrollments"""
        discrepancies = []
        
        # Create lookup sets
        local_keys = {f"{e['student_id']}:{e['course_id']}" for e in local}
        remote_keys = {f"{e['estudiante_id']}:{e['curso_id']}" for e in remote}
        
        # Find missing in remote
        missing_in_remote = local_keys - remote_keys
        for key in missing_in_remote:
            student_id, course_id = key.split(":")
            discrepancies.append({
                "type": "MISSING_IN_REMOTE",
                "entity_type": "enrollment",
                "entity_key": key,
                "student_id": student_id,
                "course_id": course_id,
                "description": f"Enrollment {key} exists locally but not in MINEDU"
            })
        
        # Find missing in local
        missing_in_local = remote_keys - local_keys
        for key in missing_in_local:
            student_id, course_id = key.split(":")
            discrepancies.append({
                "type": "MISSING_IN_LOCAL",
                "entity_type": "enrollment",
                "entity_key": key,
                "student_id": student_id,
                "course_id": course_id,
                "description": f"Enrollment {key} exists in MINEDU but not locally"
            })
        
        # Compare common records for data differences
        common_keys = local_keys & remote_keys
        local_dict = {f"{e['student_id']}:{e['course_id']}": e for e in local}
        remote_dict = {f"{e['estudiante_id']}:{e['curso_id']}": e for e in remote}
        
        for key in common_keys:
            local_record = local_dict[key]
            remote_record = remote_dict[key]
            
            # Compare key fields
            if local_record.get("status") != remote_record.get("estado"):
                discrepancies.append({
                    "type": "DATA_MISMATCH",
                    "entity_type": "enrollment",
                    "entity_key": key,
                    "field": "status",
                    "local_value": local_record.get("status"),
                    "remote_value": remote_record.get("estado"),
                    "description": f"Status mismatch for enrollment {key}"
                })
        
        return discrepancies
    
    def _compare_grades(self, local: List[Dict], remote: List[Dict]) -> List[Dict[str, Any]]:
        """Compare local and remote grades"""
        discrepancies = []
        
        # Create lookup dictionaries
        local_dict = {f"{g['student_id']}:{g['course_id']}": g for g in local}
        remote_dict = {f"{g['estudiante_id']}:{g['curso_id']}": g for g in remote}
        
        local_keys = set(local_dict.keys())
        remote_keys = set(remote_dict.keys())
        
        # Find missing grades
        missing_in_remote = local_keys - remote_keys
        for key in missing_in_remote:
            discrepancies.append({
                "type": "MISSING_IN_REMOTE",
                "entity_type": "grade",
                "entity_key": key,
                "description": f"Grade {key} exists locally but not in MINEDU"
            })
        
        missing_in_local = remote_keys - local_keys
        for key in missing_in_local:
            discrepancies.append({
                "type": "MISSING_IN_LOCAL",
                "entity_type": "grade",
                "entity_key": key,
                "description": f"Grade {key} exists in MINEDU but not locally"
            })
        
        # Compare grade values
        common_keys = local_keys & remote_keys
        for key in common_keys:
            local_grade = local_dict[key]
            remote_grade = remote_dict[key]
            
            # Compare numerical grade
            local_num = local_grade.get("numerical_grade")
            remote_num = remote_grade.get("nota_numerica")
            
            if local_num != remote_num:
                discrepancies.append({
                    "type": "DATA_MISMATCH",
                    "entity_type": "grade",
                    "entity_key": key,
                    "field": "numerical_grade",
                    "local_value": local_num,
                    "remote_value": remote_num,
                    "description": f"Numerical grade mismatch for {key}"
                })
        
        return discrepancies
    
    def _compare_certificates(self, local: List[Dict], remote: List[Dict]) -> List[Dict[str, Any]]:
        """Compare local and remote certificates"""
        discrepancies = []
        
        # Create lookup sets by certificate number
        local_certs = {c.get("certificate_number"): c for c in local if c.get("certificate_number")}
        remote_certs = {c.get("numero_certificado"): c for c in remote if c.get("numero_certificado")}
        
        local_keys = set(local_certs.keys())
        remote_keys = set(remote_certs.keys())
        
        # Find missing certificates
        missing_in_remote = local_keys - remote_keys
        for cert_num in missing_in_remote:
            discrepancies.append({
                "type": "MISSING_IN_REMOTE",
                "entity_type": "certificate",
                "entity_key": cert_num,
                "description": f"Certificate {cert_num} exists locally but not in MINEDU"
            })
        
        missing_in_local = remote_keys - local_keys
        for cert_num in missing_in_local:
            discrepancies.append({
                "type": "MISSING_IN_LOCAL",
                "entity_type": "certificate",
                "entity_key": cert_num,
                "description": f"Certificate {cert_num} exists in MINEDU but not locally"
            })
        
        return discrepancies
    
    async def _store_reconciliation_result(self, result: Dict[str, Any]):
        """Store reconciliation result in database"""
        await self.db.minedu_reconciliation.insert_one(result)
    
    async def _generate_discrepancy_csv(self, result: Dict[str, Any]):
        """Generate CSV report of discrepancies"""
        period_id = result["period_id"]
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"/app/reports/minedu/discrepancies_{period_id}_{timestamp}.csv"
        
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['type', 'entity_type', 'entity_key', 'field', 'local_value', 'remote_value', 'description']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            
            # Write all discrepancies
            for category in ['enrollments', 'grades', 'certificates']:
                for discrepancy in result['discrepancies'][category]:
                    writer.writerow({
                        'type': discrepancy.get('type', ''),
                        'entity_type': discrepancy.get('entity_type', ''),
                        'entity_key': discrepancy.get('entity_key', ''),
                        'field': discrepancy.get('field', ''),
                        'local_value': discrepancy.get('local_value', ''),
                        'remote_value': discrepancy.get('remote_value', ''),
                        'description': discrepancy.get('description', '')
                    })
        
        logger.info(f"Generated discrepancy CSV: {filename}")
    
    async def _auto_reprocess_discrepancies(self, result: Dict[str, Any]) -> int:
        """Auto-reprocess discrepancies that can be resolved"""
        reprocessed = 0
        
        for category in ['enrollments', 'grades', 'certificates']:
            for discrepancy in result['discrepancies'][category]:
                if discrepancy['type'] == 'MISSING_IN_REMOTE':
                    # Try to reprocess the event
                    success = await self._reprocess_missing_entity(discrepancy)
                    if success:
                        reprocessed += 1
        
        return reprocessed
    
    async def _reprocess_missing_entity(self, discrepancy: Dict[str, Any]) -> bool:
        """Reprocess a missing entity"""
        entity_type = discrepancy['entity_type']
        entity_key = discrepancy['entity_key']
        
        # Find related outbox events
        events = await self.outbox_repo.find_by_status("ACKED")
        
        for event in events:
            if (event.get('entity_type') == entity_type and 
                entity_key in str(event.get('entity_id', ''))):
                
                # Reset to PENDING for reprocessing
                success = await self.outbox_repo.update_status(
                    event['id'],
                    'PENDING',
                    {'retry_count': 0, 'error_message': 'Reprocessing due to reconciliation discrepancy'}
                )
                
                if success:
                    logger.info(f"Reprocessed event {event['id']} for discrepancy {entity_key}")
                    return True
        
        return False
    
    async def get_reconciliation_history(self, period_id: str = None, limit: int = 10) -> List[Dict[str, Any]]:
        """Get reconciliation history"""
        query = {}
        if period_id:
            query["period_id"] = period_id
        
        cursor = self.db.minedu_reconciliation.find(query).sort("reconciled_at", -1).limit(limit)
        return await cursor.to_list(length=None)

# CLI functionality for running reconciliation
async def main():
    """Main function for running reconciliation job"""
    import os
    from motor.motor_asyncio import AsyncIOMotorClient
    
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Connect to MongoDB
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017/universidad")
    client = AsyncIOMotorClient(mongo_url)
    db = client.get_default_database()
    
    # Create reconciler
    reconciler = MINEDUReconciler(db)
    
    # Get period from command line or use current
    import sys
    period_id = sys.argv[1] if len(sys.argv) > 1 else "2024-02"
    
    # Run reconciliation
    result = await reconciler.reconcile_period(period_id)
    
    print(f"Reconciliation completed for period {period_id}")
    print(f"Total discrepancies: {result['summary']['total_discrepancies']}")
    print(f"Reprocessed: {result['reprocessed_count']}")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(main())