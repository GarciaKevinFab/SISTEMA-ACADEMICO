from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import uuid
import json

from shared_deps import get_current_user, db, logger
from logging_middleware import get_correlation_id, log_with_correlation, ErrorResponse, ErrorCodes
from safe_mongo_operations import safe_update_one, safe_update_many, safe_find_one_and_update, MongoUpdateError

minedu_router = APIRouter(prefix="/minedu", tags=["MINEDU Integration"])

class MineduIntegrationStatus:
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    RETRYING = "RETRYING"

class MineduDataType:
    ENROLLMENT = "ENROLLMENT"
    GRADES = "GRADES"
    STUDENTS = "STUDENTS"
    TEACHERS = "TEACHERS"

# MINEDU Integration Models
class MineduExportRecord:
    def __init__(self, record_id: str, data_type: str, record_data: dict, status: str = MineduIntegrationStatus.PENDING):
        self.id = str(uuid.uuid4())
        self.record_id = record_id
        self.data_type = data_type
        self.record_data = record_data
        self.status = status
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)
        self.attempts = 0
        self.max_attempts = 3
        self.last_error = None
        self.minedu_response = None

@minedu_router.get("/dashboard/stats")
async def get_minedu_dashboard_stats(current_user = Depends(get_current_user)):
    """Get MINEDU integration dashboard statistics"""
    try:
        if current_user['role'] not in ['ADMIN', 'REGISTRAR']:
            raise HTTPException(status_code=403, detail="No autorizado")
        
        # Get export statistics
        pending_exports = await db.minedu_exports.count_documents({"status": MineduIntegrationStatus.PENDING})
        completed_exports = await db.minedu_exports.count_documents({"status": MineduIntegrationStatus.COMPLETED})
        failed_exports = await db.minedu_exports.count_documents({"status": MineduIntegrationStatus.FAILED})
        
        # Get data type breakdown
        enrollment_exports = await db.minedu_exports.count_documents({"data_type": MineduDataType.ENROLLMENT})
        grades_exports = await db.minedu_exports.count_documents({"data_type": MineduDataType.GRADES})
        students_exports = await db.minedu_exports.count_documents({"data_type": MineduDataType.STUDENTS})
        
        # Get recent export activity
        recent_exports = await db.minedu_exports.find({}).sort("created_at", -1).limit(10).to_list(10)
        
        return {
            "stats": {
                "pending_exports": pending_exports,
                "completed_exports": completed_exports,
                "failed_exports": failed_exports,
                "total_exports": pending_exports + completed_exports + failed_exports,
                "success_rate": round((completed_exports / max(1, completed_exports + failed_exports)) * 100, 2)
            },
            "data_breakdown": {
                "enrollment_exports": enrollment_exports,
                "grades_exports": grades_exports,
                "students_exports": students_exports
            },
            "recent_activity": recent_exports
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching MINEDU dashboard stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener estadísticas MINEDU")

@minedu_router.post("/export/enrollments")
async def export_enrollments_to_minedu(
    academic_year: int,
    academic_period: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """Export enrollment data to MINEDU"""
    try:
        if current_user['role'] not in ['ADMIN', 'REGISTRAR']:
            raise HTTPException(status_code=403, detail="No autorizado")
        
        # Get enrollments for the specified period
        enrollments = await db.enrollments.find({
            "academic_year": academic_year,
            "academic_period": academic_period,
            "status": "ACTIVE"
        }).to_list(length=None)
        
        if not enrollments:
            raise HTTPException(status_code=404, detail="No se encontraron matrículas para el período especificado")
        
        # Create export batch
        batch_id = str(uuid.uuid4())
        export_records = []
        
        for enrollment in enrollments:
            # Get student and course data
            student = await db.students.find_one({"id": enrollment['student_id']})
            course = await db.courses.find_one({"id": enrollment['course_id']})
            
            if student and course:
                # Format data for MINEDU SIA/SIAGIE
                minedu_data = {
                    "batch_id": batch_id,
                    "enrollment_id": enrollment['id'],
                    "student_data": {
                        "student_code": student['student_code'],
                        "document_type": student['document_type'],
                        "document_number": student['document_number'],
                        "first_name": student['first_name'],
                        "last_name": student['last_name'],
                        "second_last_name": student.get('second_last_name'),
                        "birth_date": student['birth_date'],
                        "gender": student['gender'],
                        "program": student['program']
                    },
                    "course_data": {
                        "course_code": course['code'],
                        "course_name": course['name'],
                        "credits": course['credits'],
                        "semester": course['semester']
                    },
                    "enrollment_data": {
                        "academic_year": enrollment['academic_year'],
                        "academic_period": enrollment['academic_period'],
                        "enrollment_date": enrollment['enrollment_date'],
                        "status": enrollment['status']
                    }
                }
                
                # Create export record
                export_record = MineduExportRecord(
                    record_id=enrollment['id'],
                    data_type=MineduDataType.ENROLLMENT,
                    record_data=minedu_data
                )
                
                export_records.append(export_record.__dict__)
        
        # Save export records to database
        if export_records:
            # Convert datetime objects to strings for MongoDB
            for record in export_records:
                if isinstance(record.get('created_at'), datetime):
                    record['created_at'] = record['created_at'].isoformat()
                if isinstance(record.get('updated_at'), datetime):
                    record['updated_at'] = record['updated_at'].isoformat()
            
            await db.minedu_exports.insert_many(export_records)
            
            # Process exports in background
            background_tasks.add_task(process_minedu_exports, batch_id)
            
            logger.info(f"MINEDU enrollment export initiated: {len(export_records)} records, batch {batch_id}")
            
            return {
                "message": f"Exportación iniciada: {len(export_records)} matrículas",
                "batch_id": batch_id,
                "total_records": len(export_records)
            }
        else:
            raise HTTPException(status_code=404, detail="No se pudieron preparar datos para exportación")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting enrollments to MINEDU: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al exportar matrículas a MINEDU")

@minedu_router.post("/export/grades")
async def export_grades_to_minedu(
    academic_year: int,
    academic_period: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """Export grades data to MINEDU"""
    try:
        if current_user['role'] not in ['ADMIN', 'REGISTRAR']:
            raise HTTPException(status_code=403, detail="No autorizado")
        
        # Get enrollments with grades for the specified period
        enrollments = await db.enrollments.find({
            "academic_year": academic_year,
            "academic_period": academic_period,
            "numerical_grade": {"$exists": True, "$ne": None},
            "grade_status": {"$in": ["APPROVED", "FAILED"]}
        }).to_list(length=None)
        
        if not enrollments:
            raise HTTPException(status_code=404, detail="No se encontraron calificaciones para el período especificado")
        
        # Create export batch
        batch_id = str(uuid.uuid4())
        export_records = []
        
        for enrollment in enrollments:
            # Get student and course data 
            student = await db.students.find_one({"id": enrollment['student_id']})
            course = await db.courses.find_one({"id": enrollment['course_id']})
            
            if student and course:
                # Format data for MINEDU
                minedu_data = {
                    "batch_id": batch_id,
                    "enrollment_id": enrollment['id'],
                    "student_data": {
                        "student_code": student['student_code'],
                        "document_number": student['document_number'],
                        "full_name": f"{student['first_name']} {student['last_name']} {student.get('second_last_name', '')}"
                    },
                    "course_data": {
                        "course_code": course['code'],
                        "course_name": course['name'],
                        "credits": course['credits']
                    },
                    "grade_data": {
                        "academic_year": enrollment['academic_year'],
                        "academic_period": enrollment['academic_period'],
                        "numerical_grade": enrollment['numerical_grade'],
                        "literal_grade": enrollment['literal_grade'],
                        "grade_status": enrollment['grade_status'],
                        "attendance_percentage": enrollment.get('attendance_percentage', 0)
                    }
                }
                
                # Create export record
                export_record = MineduExportRecord(
                    record_id=enrollment['id'],
                    data_type=MineduDataType.GRADES,
                    record_data=minedu_data
                )
                
                export_records.append(export_record.__dict__)
        
        # Save export records to database
        if export_records:
            # Convert datetime objects to strings for MongoDB
            for record in export_records:
                if isinstance(record.get('created_at'), datetime):
                    record['created_at'] = record['created_at'].isoformat()
                if isinstance(record.get('updated_at'), datetime):
                    record['updated_at'] = record['updated_at'].isoformat()
            
            await db.minedu_exports.insert_many(export_records)
            
            # Process exports in background
            background_tasks.add_task(process_minedu_exports, batch_id)
            
            logger.info(f"MINEDU grades export initiated: {len(export_records)} records, batch {batch_id}")
            
            return {
                "message": f"Exportación de notas iniciada: {len(export_records)} registros",
                "batch_id": batch_id,
                "total_records": len(export_records)
            }
        else:
            raise HTTPException(status_code=404, detail="No se pudieron preparar datos de calificaciones para exportación")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting grades to MINEDU: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al exportar calificaciones a MINEDU")

@minedu_router.get("/exports")
async def get_minedu_exports(
    status: Optional[str] = None,
    data_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user = Depends(get_current_user)
):
    """Get MINEDU export records"""
    try:
        if current_user['role'] not in ['ADMIN', 'REGISTRAR']:
            raise HTTPException(status_code=403, detail="No autorizado")
        
        # Build query
        query = {}
        if status:
            query["status"] = status
        if data_type:
            query["data_type"] = data_type
        
        # Get exports
        exports_cursor = db.minedu_exports.find(query).sort("created_at", -1).skip(skip).limit(limit)
        exports = await exports_cursor.to_list(length=limit)
        
        # Parse dates back from strings
        for export in exports:
            if isinstance(export.get('created_at'), str):
                export['created_at'] = datetime.fromisoformat(export['created_at'])
            if isinstance(export.get('updated_at'), str):
                export['updated_at'] = datetime.fromisoformat(export['updated_at'])
        
        total = await db.minedu_exports.count_documents(query)
        
        return {
            "exports": exports,
            "total": total,
            "skip": skip,
            "limit": limit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching MINEDU exports: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener exportaciones MINEDU")

@minedu_router.post("/exports/{export_id}/retry")
async def retry_minedu_export(
    export_id: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """Retry failed MINEDU export"""
    try:
        if current_user['role'] not in ['ADMIN', 'REGISTRAR']:
            raise HTTPException(status_code=403, detail="No autorizado")
        
        # Get export record
        export_record = await db.minedu_exports.find_one({"id": export_id})
        if not export_record:
            raise HTTPException(status_code=404, detail="Registro de exportación no encontrado")
        
        if export_record['status'] not in [MineduIntegrationStatus.FAILED]:
            raise HTTPException(status_code=400, detail="Solo se pueden reintentar exportaciones fallidas")
        
        if export_record['attempts'] >= export_record.get('max_attempts', 3):
            raise HTTPException(status_code=400, detail="Se ha alcanzado el máximo número de intentos")
        
        # Update status to retrying
        await safe_update_one(
            db.minedu_exports,
            {"id": export_id},
            {
                "$set": {
                    "status": MineduIntegrationStatus.RETRYING,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Process retry in background
        background_tasks.add_task(process_single_minedu_export, export_id)
        
        return {"message": "Reintento de exportación iniciado"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrying MINEDU export: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al reintentar exportación MINEDU")

@minedu_router.get("/validation/data-integrity")
async def validate_data_integrity(current_user = Depends(get_current_user)):
    """Validate data integrity before MINEDU export"""
    try:
        if current_user['role'] not in ['ADMIN', 'REGISTRAR']:
            raise HTTPException(status_code=403, detail="No autorizado")
        
        validation_results = {
            "valid": True,
            "errors": [],
            "warnings": [],
            "stats": {}
        }
        
        # Validate students data
        students_without_document = await db.students.count_documents({
            "$or": [
                {"document_number": {"$exists": False}},
                {"document_number": ""},
                {"document_number": None}
            ]
        })
        
        if students_without_document > 0:
            validation_results["errors"].append(f"{students_without_document} estudiantes sin número de documento")
            validation_results["valid"] = False
        
        # Validate courses data
        courses_without_code = await db.courses.count_documents({
            "$or": [
                {"code": {"$exists": False}},
                {"code": ""},
                {"code": None}
            ]
        })
        
        if courses_without_code > 0:
            validation_results["errors"].append(f"{courses_without_code} cursos sin código")
            validation_results["valid"] = False
        
        # Validate enrollments
        enrollments_without_grades = await db.enrollments.count_documents({
            "status": "ACTIVE",
            "$or": [
                {"numerical_grade": {"$exists": False}},
                {"numerical_grade": None}
            ]
        })
        
        if enrollments_without_grades > 0:
            validation_results["warnings"].append(f"{enrollments_without_grades} matrículas activas sin calificaciones")
        
        # Get statistics
        validation_results["stats"] = {
            "total_students": await db.students.count_documents({}),
            "total_courses": await db.courses.count_documents({}),
            "total_enrollments": await db.enrollments.count_documents({}),
            "active_enrollments": await db.enrollments.count_documents({"status": "ACTIVE"}),
            "completed_grades": await db.enrollments.count_documents({
                "numerical_grade": {"$exists": True, "$ne": None}
            })
        }
        
        return validation_results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating data integrity: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al validar integridad de datos")

# Background task functions
async def process_minedu_exports(batch_id: str):
    """Process MINEDU exports in background"""
    try:
        logger.info(f"Processing MINEDU exports for batch {batch_id}")
        
        # Get all pending exports for this batch
        exports = await db.minedu_exports.find({
            "record_data.batch_id": batch_id,
            "status": MineduIntegrationStatus.PENDING
        }).to_list(length=None)
        
        for export_record in exports:
            await process_single_minedu_export(export_record['id'])
        
        logger.info(f"Completed processing MINEDU exports for batch {batch_id}")
        
    except Exception as e:
        logger.error(f"Error processing MINEDU exports batch {batch_id}: {str(e)}")

async def process_single_minedu_export(export_id: str):
    """Process a single MINEDU export"""
    try:
        # Get export record
        export_record = await db.minedu_exports.find_one({"id": export_id})
        if not export_record:
            return
        
        # Update status to processing
        await safe_update_one(
            db.minedu_exports,
            {"id": export_id},
            {
                "$set": {
                    "status": MineduIntegrationStatus.PROCESSING,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$inc": {"attempts": 1}
            }
        )
        
        # Simulate MINEDU API call (in real implementation, this would call actual MINEDU endpoints)
        success = await simulate_minedu_api_call(export_record)
        
        if success:
            # Update status to completed
            await safe_update_one(
                db.minedu_exports,
                {"id": export_id},
                {
                    "$set": {
                        "status": MineduIntegrationStatus.COMPLETED,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "minedu_response": {"status": "success", "message": "Data exported successfully"}
                    }
                }
            )
            logger.info(f"MINEDU export {export_id} completed successfully")
        else:
            # Update status to failed
            await db.await safe_update_one(minedu_exports, 
                {"id": export_id},
                {
                    "$set": {
                        "status": MineduIntegrationStatus.FAILED,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "last_error": "MINEDU API error (simulated)",
                        "minedu_response": {"status": "error", "message": "Export failed"}
                    }
                }
            )
            logger.error(f"MINEDU export {export_id} failed")
        
    except Exception as e:
        logger.error(f"Error processing single MINEDU export {export_id}: {str(e)}")
        
        # Update status to failed
        await db.await safe_update_one(minedu_exports, 
            {"id": export_id},
            {
                "$set": {
                    "status": MineduIntegrationStatus.FAILED,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "last_error": str(e)
                }
            }
        )

async def simulate_minedu_api_call(export_record: dict) -> bool:
    """Simulate MINEDU API call - in production this would be actual integration"""
    try:
        # Simulate processing delay
        import asyncio
        await asyncio.sleep(1)
        
        # Simulate 90% success rate
        import random
        return random.random() > 0.1
        
    except Exception:
        return False