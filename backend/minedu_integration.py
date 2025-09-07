# MINEDU SIA/SIAGIE Integration Module

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from models import *
from academic_models import *
import asyncio
import httpx
import uuid
import json
import os

# MINEDU Integration Router
minedu_router = APIRouter(prefix="/minedu", tags=["MINEDU Integration"])

# MINEDU API Configuration
MINEDU_API_BASE = os.getenv("MINEDU_API_BASE", "https://api.minedu.gob.pe/siagie/v1")
MINEDU_API_KEY = os.getenv("MINEDU_API_KEY", "test-key")
INSTITUTION_CODE = os.getenv("INSTITUTION_CODE", "IESPP123")

class MINEDUIntegrationService:
    def __init__(self):
        self.base_url = MINEDU_API_BASE
        self.api_key = MINEDU_API_KEY
        self.institution_code = INSTITUTION_CODE
        self.timeout = 30
        self.max_retries = 3
        
    async def make_request(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """Make authenticated request to MINEDU API"""
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-Institution-Code": self.institution_code
        }
        
        url = f"{self.base_url}/{endpoint}"
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                if method.upper() == "GET":
                    response = await client.get(url, headers=headers)
                elif method.upper() == "POST":
                    response = await client.post(url, json=data, headers=headers)
                elif method.upper() == "PUT":
                    response = await client.put(url, json=data, headers=headers)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                response.raise_for_status()
                return response.json()
                
            except httpx.TimeoutException:
                raise HTTPException(status_code=408, detail="MINEDU API timeout")
            except httpx.HTTPStatusError as e:
                raise HTTPException(
                    status_code=e.response.status_code, 
                    detail=f"MINEDU API error: {e.response.text}"
                )
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Integration error: {str(e)}")
    
    async def sync_student(self, student_id: str) -> Dict:
        """Sync student data with MINEDU SIA"""
        
        # Get student data
        student = await db.students.find_one({"id": student_id})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Prepare MINEDU format
        minedu_student = {
            "codigo_alumno": student["student_code"],
            "nombres": student["first_name"],
            "apellido_paterno": student["last_name"],
            "apellido_materno": student.get("second_last_name", ""),
            "fecha_nacimiento": student["birth_date"],
            "genero": student["gender"],
            "tipo_documento": student["document_type"],
            "numero_documento": student["document_number"],
            "correo_electronico": student.get("email"),
            "telefono": student.get("phone"),
            "direccion": student["address"],
            "distrito": student["district"],
            "provincia": student["province"],
            "departamento": student["department"],
            "programa_estudios": student["program"],
            "año_ingreso": student["entry_year"],
            "estado": student["status"],
            "tiene_discapacidad": student["has_disability"],
            "descripcion_discapacidad": student.get("disability_description")
        }
        
        # Check if student already exists in MINEDU
        existing_sync = await db.siagie_sync.find_one({
            "local_record_id": student_id,
            "record_type": "STUDENT"
        })
        
        if existing_sync and existing_sync.get("siagie_id"):
            # Update existing student
            endpoint = f"estudiantes/{existing_sync['siagie_id']}"
            response = await self.make_request("PUT", endpoint, minedu_student)
            sync_status = "COMPLETED"
        else:
            # Create new student
            endpoint = "estudiantes"
            response = await self.make_request("POST", endpoint, minedu_student)
            sync_status = "COMPLETED"
        
        # Update sync record
        sync_record = {
            "record_type": "STUDENT",
            "local_record_id": student_id,
            "siagie_id": response.get("id"),
            "sync_status": sync_status,
            "last_sync_attempt": datetime.now(timezone.utc).isoformat(),
            "sync_response": response,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if existing_sync:
            await db.siagie_sync.update_one(
                {"id": existing_sync["id"]},
                {"$set": sync_record}
            )
        else:
            sync_record["id"] = str(uuid.uuid4())
            sync_record["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.siagie_sync.insert_one(sync_record)
        
        return response
    
    async def sync_enrollment(self, enrollment_id: str) -> Dict:
        """Sync enrollment data with MINEDU"""
        
        # Get enrollment with related data
        enrollment = await db.enrollments.find_one({"id": enrollment_id})
        if not enrollment:
            raise HTTPException(status_code=404, detail="Enrollment not found")
        
        student = await db.students.find_one({"id": enrollment["student_id"]})
        course = await db.courses.find_one({"id": enrollment["course_id"]})
        
        if not student or not course:
            raise HTTPException(status_code=400, detail="Related student or course not found")
        
        # Ensure student is synced first
        student_sync = await db.siagie_sync.find_one({
            "local_record_id": enrollment["student_id"],
            "record_type": "STUDENT"
        })
        
        if not student_sync or not student_sync.get("siagie_id"):
            await self.sync_student(enrollment["student_id"])
            student_sync = await db.siagie_sync.find_one({
                "local_record_id": enrollment["student_id"],
                "record_type": "STUDENT"
            })
        
        # Prepare MINEDU enrollment format
        minedu_enrollment = {
            "id_estudiante": student_sync["siagie_id"],
            "codigo_curso": course["code"],
            "nombre_curso": course["name"],
            "creditos": course["credits"],
            "semestre": course["semester"],
            "año_academico": enrollment["academic_year"],
            "periodo_academico": enrollment["academic_period"],
            "fecha_matricula": enrollment["enrollment_date"],
            "estado": enrollment["status"],
            "nota_numerica": enrollment.get("numerical_grade"),
            "nota_literal": enrollment.get("literal_grade"),
            "estado_calificacion": enrollment.get("grade_status"),
            "porcentaje_asistencia": enrollment.get("attendance_percentage", 0)
        }
        
        # Sync enrollment
        endpoint = "matriculas"
        response = await self.make_request("POST", endpoint, minedu_enrollment)
        
        # Update sync record
        sync_record = SIAGIESync(
            record_type="ENROLLMENT",
            local_record_id=enrollment_id,
            siagie_id=response.get("id"),
            sync_status="COMPLETED",
            last_sync_attempt=datetime.now(timezone.utc),
            sync_response=response
        )
        
        sync_doc = prepare_for_mongo(sync_record.dict())
        await db.siagie_sync.insert_one(sync_doc)
        
        return response
    
    async def sync_grades_batch(self, academic_year: int, academic_period: str) -> Dict:
        """Sync grades for academic period in batch"""
        
        # Create batch record
        batch = SIAGIEBatch(
            batch_type="GRADES",
            academic_period_id=f"{academic_year}-{academic_period}",
            created_by="SYSTEM"
        )
        
        batch_doc = prepare_for_mongo(batch.dict())
        await db.siagie_batches.insert_one(batch_doc)
        
        # Get all enrollments with final grades
        enrollments = await db.enrollments.find({
            "academic_year": academic_year,
            "academic_period": academic_period,
            "grade_status": {"$in": ["APPROVED", "FAILED"]},
            "numerical_grade": {"$exists": True, "$ne": None}
        }).to_list(10000)
        
        batch.total_records = len(enrollments)
        successful = 0
        failed = 0
        
        # Update batch status
        await db.siagie_batches.update_one(
            {"id": batch.id},
            {
                "$set": {
                    "total_records": batch.total_records,
                    "batch_status": "PROCESSING",
                    "started_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Process enrollments
        for enrollment in enrollments:
            try:
                # Get related data
                student = await db.students.find_one({"id": enrollment["student_id"]})
                course = await db.courses.find_one({"id": enrollment["course_id"]})
                
                if not student or not course:
                    failed += 1
                    continue
                
                # Check student sync
                student_sync = await db.siagie_sync.find_one({
                    "local_record_id": enrollment["student_id"],
                    "record_type": "STUDENT"
                })
                
                if not student_sync or not student_sync.get("siagie_id"):
                    failed += 1
                    continue
                
                # Prepare grade data
                grade_data = {
                    "id_estudiante": student_sync["siagie_id"],
                    "codigo_curso": course["code"],
                    "año_academico": academic_year,
                    "periodo_academico": academic_period,
                    "nota_numerica": enrollment["numerical_grade"],
                    "nota_literal": enrollment["literal_grade"],
                    "estado": enrollment["grade_status"],
                    "fecha_calificacion": enrollment.get("updated_at")
                }
                
                # Send to MINEDU
                response = await self.make_request("POST", "calificaciones", grade_data)
                
                # Update sync record
                grade_sync = SIAGIESync(
                    record_type="GRADE",
                    local_record_id=enrollment["id"],
                    siagie_id=response.get("id"),
                    sync_status="COMPLETED",
                    last_sync_attempt=datetime.now(timezone.utc),
                    sync_response=response
                )
                
                grade_sync_doc = prepare_for_mongo(grade_sync.dict())
                await db.siagie_sync.insert_one(grade_sync_doc)
                
                successful += 1
                
            except Exception as e:
                failed += 1
                
                # Log failed sync
                failed_sync = SIAGIESync(
                    record_type="GRADE",
                    local_record_id=enrollment["id"],
                    sync_status="FAILED",
                    last_sync_attempt=datetime.now(timezone.utc),
                    error_message=str(e)
                )
                
                failed_sync_doc = prepare_for_mongo(failed_sync.dict())
                await db.siagie_sync.insert_one(failed_sync_doc)
        
        # Update batch completion
        await db.siagie_batches.update_one(
            {"id": batch.id},
            {
                "$set": {
                    "processed_records": successful + failed,
                    "successful_records": successful,
                    "failed_records": failed,
                    "batch_status": "COMPLETED",
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "batch_id": batch.id,
            "total_records": batch.total_records,
            "successful": successful,
            "failed": failed,
            "status": "COMPLETED"
        }

# Initialize service
minedu_service = MINEDUIntegrationService()

# ====================================================================================================
# MINEDU INTEGRATION API ENDPOINTS
# ====================================================================================================

@minedu_router.post("/sync/student/{student_id}")
async def sync_student_to_minedu(
    student_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REGISTRAR]))
):
    """Sync individual student to MINEDU SIA"""
    
    try:
        result = await minedu_service.sync_student(student_id)
        
        await log_audit_trail(
            db, "siagie_sync", student_id, "SYNC_STUDENT",
            None, {"sync_status": "COMPLETED"}, current_user.id
        )
        
        return {
            "status": "success",
            "message": "Student synced successfully",
            "minedu_response": result
        }
        
    except Exception as e:
        await log_audit_trail(
            db, "siagie_sync", student_id, "SYNC_STUDENT_FAILED",
            None, {"error": str(e)}, current_user.id
        )
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

@minedu_router.post("/sync/enrollment/{enrollment_id}")
async def sync_enrollment_to_minedu(
    enrollment_id: str,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REGISTRAR]))
):
    """Sync individual enrollment to MINEDU"""
    
    try:
        result = await minedu_service.sync_enrollment(enrollment_id)
        
        return {
            "status": "success",
            "message": "Enrollment synced successfully",
            "minedu_response": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

@minedu_router.post("/sync/grades/batch")
async def sync_grades_batch(
    academic_year: int,
    academic_period: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REGISTRAR]))
):
    """Sync grades for academic period in batch"""
    
    # Run sync in background
    background_tasks.add_task(
        minedu_service.sync_grades_batch,
        academic_year,
        academic_period
    )
    
    return {
        "status": "accepted",
        "message": "Batch grade sync started in background",
        "academic_year": academic_year,
        "academic_period": academic_period
    }

@minedu_router.get("/sync/status")
async def get_sync_status(
    record_type: Optional[str] = None,
    sync_status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REGISTRAR]))
):
    """Get synchronization status"""
    
    filter_query = {}
    if record_type:
        filter_query["record_type"] = record_type
    if sync_status:
        filter_query["sync_status"] = sync_status
    
    sync_records = await db.siagie_sync.find(filter_query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.siagie_sync.count_documents(filter_query)
    
    return {
        "sync_records": [SIAGIESync(**record) for record in sync_records],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@minedu_router.get("/sync/batches")
async def get_sync_batches(
    batch_type: Optional[str] = None,
    batch_status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REGISTRAR]))
):
    """Get batch synchronization history"""
    
    filter_query = {}
    if batch_type:
        filter_query["batch_type"] = batch_type
    if batch_status:
        filter_query["batch_status"] = batch_status
    
    batches = await db.siagie_batches.find(filter_query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.siagie_batches.count_documents(filter_query)
    
    return {
        "batches": [SIAGIEBatch(**batch) for batch in batches],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@minedu_router.post("/sync/reconcile")
async def reconcile_sync_data(
    record_type: str,
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Reconcile sync data with MINEDU"""
    
    # Get all failed syncs for retry
    failed_syncs = await db.siagie_sync.find({
        "record_type": record_type,
        "sync_status": "FAILED",
        "retry_count": {"$lt": 3}
    }).to_list(1000)
    
    reconciled = 0
    still_failed = 0
    
    for sync_record in failed_syncs:
        try:
            if record_type == "STUDENT":
                await minedu_service.sync_student(sync_record["local_record_id"])
            elif record_type == "ENROLLMENT":
                await minedu_service.sync_enrollment(sync_record["local_record_id"])
            
            reconciled += 1
            
        except Exception as e:
            # Increment retry count
            await db.siagie_sync.update_one(
                {"id": sync_record["id"]},
                {
                    "$inc": {"retry_count": 1},
                    "$set": {
                        "last_sync_attempt": datetime.now(timezone.utc).isoformat(),
                        "error_message": str(e)
                    }
                }
            )
            still_failed += 1
    
    return {
        "status": "completed",
        "reconciled": reconciled,
        "still_failed": still_failed,
        "total_processed": len(failed_syncs)
    }

@minedu_router.get("/sync/report")
async def get_sync_report(
    academic_year: Optional[int] = None,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REGISTRAR]))
):
    """Generate comprehensive sync report"""
    
    # Get sync statistics
    total_students = await db.students.count_documents({"is_active": True})
    synced_students = await db.siagie_sync.count_documents({
        "record_type": "STUDENT",
        "sync_status": "COMPLETED"
    })
    
    total_enrollments = await db.enrollments.count_documents(
        {"academic_year": academic_year} if academic_year else {}
    )
    synced_enrollments = await db.siagie_sync.count_documents({
        "record_type": "ENROLLMENT",
        "sync_status": "COMPLETED",
        **({"sync_response.año_academico": academic_year} if academic_year else {})
    })
    
    failed_syncs = await db.siagie_sync.count_documents({"sync_status": "FAILED"})
    
    # Get recent batches
    recent_batches = await db.siagie_batches.find().sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "report_generated_at": datetime.now(timezone.utc).isoformat(),
        "academic_year": academic_year,
        "students": {
            "total": total_students,
            "synced": synced_students,
            "sync_percentage": round((synced_students / total_students) * 100, 2) if total_students > 0 else 0
        },
        "enrollments": {
            "total": total_enrollments,
            "synced": synced_enrollments,
            "sync_percentage": round((synced_enrollments / total_enrollments) * 100, 2) if total_enrollments > 0 else 0
        },
        "failed_syncs": failed_syncs,
        "recent_batches": [SIAGIEBatch(**batch) for batch in recent_batches]
    }