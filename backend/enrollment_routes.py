"""
Enrollment API Routes with Blocking Rules and Re-enrollment
Implements comprehensive enrollment management system
"""
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from shared_deps import get_current_user, db, logger
from logging_middleware import log_with_correlation, ErrorResponse, ErrorCodes
from enrollment_rules import enrollment_engine, reenrollment_manager, idempotency_manager
from safe_mongo_operations import safe_update_one, safe_find_one_and_update, MongoUpdateError

enrollment_router = APIRouter(prefix="/enrollments", tags=["Enrollment Management"])

# Pydantic Models
class EnrollmentValidationRequest(BaseModel):
    student_id: str = Field(..., description="Student identifier")
    academic_period: str = Field(..., description="Academic period (e.g., 2025-I)")
    course_ids: List[str] = Field(..., description="List of course IDs to validate")

class EnrollmentCommitRequest(BaseModel):
    student_id: str = Field(..., description="Student identifier")
    academic_period: str = Field(..., description="Academic period")
    course_ids: List[str] = Field(..., description="List of course IDs to enroll")
    section_preferences: Optional[Dict[str, str]] = Field(default={}, description="Course ID to Section ID mapping")

class ReEnrollmentRequest(BaseModel):
    student_id: str = Field(..., description="Student identifier")
    course_id: str = Field(..., description="Course ID for re-enrollment")
    section_id: str = Field(..., description="Section ID")
    academic_period: str = Field(..., description="Academic period")

class EnrollmentResponse(BaseModel):
    success: bool
    message: str
    enrollment_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class ValidationResponse(BaseModel):
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    suggestions: List[Dict[str, Any]] = []
    conflicts: List[Dict[str, Any]] = []

@enrollment_router.post("/validate", response_model=ValidationResponse)
async def validate_enrollment(
    request: EnrollmentValidationRequest,
    current_user = Depends(get_current_user)
):
    """
    Validate enrollment with comprehensive blocking rules
    
    Returns 409 if validation fails with conflicts
    Returns 200 if validation passes
    """
    correlation_id = log_with_correlation("enrollment_validation_start", {
        "student_id": request.student_id,
        "course_count": len(request.course_ids),
        "academic_period": request.academic_period,
        "user_id": current_user.get("id")
    })
    
    try:
        # Permission check - students can only validate their own enrollment
        if current_user.get("role") == "STUDENT" and current_user.get("id") != request.student_id:
            raise HTTPException(
                status_code=403,
                detail="No autorizado para validar matrícula de otro estudiante"
            )
        
        # Run comprehensive validation
        validation_result = await enrollment_engine.validate_enrollment(
            request.student_id,
            request.course_ids,
            request.academic_period
        )
        
        response = ValidationResponse(
            valid=validation_result.valid,
            errors=validation_result.errors,
            warnings=validation_result.warnings,
            suggestions=validation_result.suggestions,
            conflicts=validation_result.conflicts
        )
        
        # Return 409 for conflicts, 200 for success
        status_code = 409 if not validation_result.valid else 200
        
        log_with_correlation("enrollment_validation_complete", {
            "valid": validation_result.valid,
            "error_count": len(validation_result.errors),
            "warning_count": len(validation_result.warnings),
            "suggestion_count": len(validation_result.suggestions)
        }, correlation_id)
        
        if status_code == 409:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Conflictos detectados en la matrícula",
                    "errors": validation_result.errors,
                    "warnings": validation_result.warnings,
                    "suggestions": validation_result.suggestions,
                    "conflicts": validation_result.conflicts
                }
            )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        log_with_correlation("enrollment_validation_error", {
            "error": str(e)
        }, correlation_id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error en validación de matrícula: {str(e)}"
        )

@enrollment_router.post("/commit", response_model=EnrollmentResponse)
async def commit_enrollment(
    request: EnrollmentCommitRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user = Depends(get_current_user)
):
    """
    Commit enrollment after successful validation
    Implements idempotency with Idempotency-Key header
    """
    correlation_id = log_with_correlation("enrollment_commit_start", {
        "student_id": request.student_id,
        "course_count": len(request.course_ids),
        "academic_period": request.academic_period,
        "idempotency_key": idempotency_key,
        "user_id": current_user.get("id")
    })
    
    try:
        # Permission check
        if current_user.get("role") == "STUDENT" and current_user.get("id") != request.student_id:
            raise HTTPException(
                status_code=403,
                detail="No autorizado para matricular a otro estudiante"
            )
        
        # Idempotency check
        if idempotency_key:
            existing_operation = await idempotency_manager.check_idempotency(idempotency_key)
            if existing_operation:
                log_with_correlation("enrollment_idempotency_hit", {
                    "idempotency_key": idempotency_key
                }, correlation_id)
                
                return EnrollmentResponse(
                    success=True,
                    message="Operación ya procesada (idempotencia)",
                    enrollment_id=existing_operation["result"].get("enrollment_id"),
                    data=existing_operation["result"]
                )
        
        # Re-validate before commit (security measure)
        validation_result = await enrollment_engine.validate_enrollment(
            request.student_id,
            request.course_ids,
            request.academic_period
        )
        
        if not validation_result.valid:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Validación falló al confirmar matrícula",
                    "errors": validation_result.errors
                }
            )
        
        # Process enrollment
        enrollment_results = []
        enrollment_ids = []
        
        for course_id in request.course_ids:
            # Determine section (from preferences or auto-assign)
            section_id = request.section_preferences.get(course_id)
            
            if not section_id:
                # Auto-assign to section with availability
                section_id = await _find_available_section(course_id, request.academic_period)
                if not section_id:
                    raise HTTPException(
                        status_code=409,
                        detail=f"No hay secciones disponibles para el curso {course_id}"
                    )
            
            # Create enrollment record
            enrollment_id = str(uuid.uuid4())
            enrollment_data = {
                "id": enrollment_id,
                "student_id": request.student_id,
                "course_id": course_id,
                "section_id": section_id,
                "academic_period": request.academic_period,
                "enrollment_type": "REGULAR",
                "status": "ENROLLED",
                "enrolled_at": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.enrollments.insert_one(enrollment_data)
            
            # Update section enrollment count
            await safe_update_one(
                db.sections,
                {"id": section_id},
                {"$inc": {"current_enrollment": 1}}
            )
            
            enrollment_results.append({
                "course_id": course_id,
                "section_id": section_id,
                "enrollment_id": enrollment_id,
                "status": "SUCCESS"
            })
            enrollment_ids.append(enrollment_id)
        
        # Create response
        operation_result = {
            "enrollment_ids": enrollment_ids,
            "enrollments": enrollment_results,
            "student_id": request.student_id,
            "academic_period": request.academic_period,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Record idempotency
        if idempotency_key:
            await idempotency_manager.record_operation(idempotency_key, operation_result)
        
        log_with_correlation("enrollment_commit_complete", {
            "enrollment_ids": enrollment_ids,
            "course_count": len(request.course_ids)
        }, correlation_id)
        
        return EnrollmentResponse(
            success=True,
            message="Matrícula realizada exitosamente",
            enrollment_id=enrollment_ids[0] if enrollment_ids else None,
            data=operation_result
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_with_correlation("enrollment_commit_error", {
            "error": str(e)
        }, correlation_id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error confirmando matrícula: {str(e)}"
        )

@enrollment_router.post("/re-enroll", response_model=EnrollmentResponse)
async def re_enroll_student(
    request: ReEnrollmentRequest,
    current_user = Depends(get_current_user)
):
    """
    Re-enroll student in a previously failed course
    Maintains attempt tracking and validates eligibility
    """
    correlation_id = log_with_correlation("re_enrollment_start", {
        "student_id": request.student_id,
        "course_id": request.course_id,
        "section_id": request.section_id,
        "academic_period": request.academic_period,
        "user_id": current_user.get("id")
    })
    
    try:
        # Permission check
        if current_user.get("role") == "STUDENT" and current_user.get("id") != request.student_id:
            raise HTTPException(
                status_code=403,
                detail="No autorizado para re-matricular a otro estudiante"
            )
        
        # Process re-enrollment
        result = await reenrollment_manager.process_reenrollment(
            request.student_id,
            request.course_id,
            request.section_id,
            request.academic_period
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=409,
                detail=result["message"]
            )
        
        log_with_correlation("re_enrollment_complete", {
            "enrollment_id": result["enrollment_id"],
            "attempt": result["attempt"]
        }, correlation_id)
        
        return EnrollmentResponse(
            success=True,
            message=result["message"],
            enrollment_id=result["enrollment_id"],
            data={
                "attempt_number": result["attempt"],
                "enrollment_type": "RE_ENROLLMENT"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_with_correlation("re_enrollment_error", {
            "error": str(e)
        }, correlation_id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error en re-matrícula: {str(e)}"
        )

@enrollment_router.get("/suggestions/{student_id}")
async def get_enrollment_suggestions(
    student_id: str,
    academic_period: str,
    current_user = Depends(get_current_user)
):
    """
    Get enrollment suggestions for alternative sections/courses
    Used when conflicts are detected
    """
    try:
        # Permission check
        if current_user.get("role") == "STUDENT" and current_user.get("id") != student_id:
            raise HTTPException(
                status_code=403,
                detail="No autorizado para ver sugerencias de otro estudiante"
            )
        
        # Get student's current enrollments and preferences
        current_enrollments = await db.enrollments.find({
            "student_id": student_id,
            "academic_period": academic_period,
            "status": {"$in": ["ENROLLED", "COMPLETED"]}
        }).to_list(length=None)
        
        enrolled_course_ids = [e["course_id"] for e in current_enrollments]
        
        # Get available courses not yet enrolled
        available_courses = await db.courses.find({
            "id": {"$nin": enrolled_course_ids},
            "status": "ACTIVE"
        }).to_list(length=None)
        
        # Filter by prerequisites and other rules
        suggested_courses = []
        for course in available_courses:
            # Quick validation check
            validation_result = await enrollment_engine.validate_enrollment(
                student_id,
                [course["id"]],
                academic_period
            )
            
            if validation_result.valid:
                # Get available sections
                sections = await db.sections.find({
                    "course_id": course["id"],
                    "academic_period": academic_period,
                    "status": "ACTIVE"
                }).to_list(length=None)
                
                available_sections = []
                for section in sections:
                    current_enrollment = await db.enrollments.count_documents({
                        "section_id": section["id"],
                        "status": {"$in": ["ENROLLED", "COMPLETED"]}
                    })
                    
                    max_capacity = section.get("max_capacity", 30)
                    if current_enrollment < max_capacity:
                        available_sections.append({
                            "section_id": section["id"],
                            "section_code": section.get("code", ""),
                            "schedule": section.get("schedule", {}),
                            "teacher": section.get("teacher_name", ""),
                            "available_slots": max_capacity - current_enrollment
                        })
                
                if available_sections:
                    suggested_courses.append({
                        "course_id": course["id"],
                        "course_name": course["name"],
                        "course_code": course["code"],
                        "credits": course.get("credits", 0),
                        "description": course.get("description", ""),
                        "available_sections": available_sections
                    })
        
        return {
            "student_id": student_id,
            "academic_period": academic_period,
            "suggested_courses": suggested_courses,
            "total_suggestions": len(suggested_courses)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting enrollment suggestions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo sugerencias: {str(e)}"
        )

@enrollment_router.get("/history/{student_id}")
async def get_enrollment_history(
    student_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get complete enrollment history for a student
    Includes re-enrollment attempts and outcomes
    """
    try:
        # Permission check
        if current_user.get("role") == "STUDENT" and current_user.get("id") != student_id:
            raise HTTPException(
                status_code=403,
                detail="No autorizado para ver historial de otro estudiante"
            )
        
        # Get all enrollments
        enrollments = await db.enrollments.find({
            "student_id": student_id
        }).sort("created_at", -1).to_list(length=None)
        
        # Enrich with course and grade information
        enriched_history = []
        for enrollment in enrollments:
            # Get course information
            course = await db.courses.find_one({"id": enrollment["course_id"]})
            
            # Get final grade if available
            grade_record = await db.student_grades.find_one({
                "student_id": student_id,
                "course_id": enrollment["course_id"],
                "enrollment_id": enrollment["id"]
            })
            
            # Get section information
            section = await db.sections.find_one({"id": enrollment["section_id"]})
            
            enriched_enrollment = {
                "enrollment_id": enrollment["id"],
                "course_id": enrollment["course_id"],
                "course_name": course.get("name", "") if course else "",
                "course_code": course.get("code", "") if course else "",
                "credits": course.get("credits", 0) if course else 0,
                "academic_period": enrollment["academic_period"],
                "enrollment_type": enrollment.get("enrollment_type", "REGULAR"),
                "attempt_number": enrollment.get("attempt_number", 1),
                "status": enrollment["status"],
                "section_code": section.get("code", "") if section else "",
                "teacher": section.get("teacher_name", "") if section else "",
                "final_grade": grade_record.get("final_grade") if grade_record else None,
                "grade_letter": self._convert_grade_to_letter(grade_record.get("final_grade")) if grade_record else None,
                "enrolled_at": enrollment.get("enrolled_at"),
                "completed_at": grade_record.get("completed_at") if grade_record else None
            }
            
            enriched_history.append(enriched_enrollment)
        
        # Group by course to show re-enrollment attempts
        course_history = {}
        for enrollment in enriched_history:
            course_id = enrollment["course_id"]
            if course_id not in course_history:
                course_history[course_id] = {
                    "course_id": course_id,
                    "course_name": enrollment["course_name"],
                    "course_code": enrollment["course_code"],
                    "credits": enrollment["credits"],
                    "attempts": []
                }
            
            course_history[course_id]["attempts"].append(enrollment)
        
        return {
            "student_id": student_id,
            "enrollment_history": list(course_history.values()),
            "total_enrollments": len(enrollments)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting enrollment history: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo historial: {str(e)}"
        )

@enrollment_router.get("/certificate/{enrollment_id}")
async def generate_enrollment_certificate(
    enrollment_id: str,
    current_user = Depends(get_current_user)
):
    """
    Generate enrollment certificate PDF
    """
    try:
        # Get enrollment information
        enrollment = await db.enrollments.find_one({"id": enrollment_id})
        if not enrollment:
            raise HTTPException(status_code=404, detail="Matrícula no encontrada")
        
        # Permission check
        if (current_user.get("role") == "STUDENT" and 
            current_user.get("id") != enrollment["student_id"]):
            raise HTTPException(
                status_code=403,
                detail="No autorizado para ver certificado de otro estudiante"
            )
        
        # Return task for PDF generation (polling pattern)
        task_id = f"cert-{enrollment_id}-{datetime.now().timestamp()}"
        
        return {
            "taskId": task_id,
            "statusUrl": f"/api/tasks/{task_id}",
            "message": "Generación de certificado iniciada"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating enrollment certificate: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generando certificado: {str(e)}"
        )

# Helper functions
async def _find_available_section(course_id: str, academic_period: str) -> Optional[str]:
    """Find an available section for a course"""
    try:
        sections = await db.sections.find({
            "course_id": course_id,
            "academic_period": academic_period,
            "status": "ACTIVE"
        }).to_list(length=None)
        
        for section in sections:
            current_enrollment = await db.enrollments.count_documents({
                "section_id": section["id"],
                "status": {"$in": ["ENROLLED", "COMPLETED"]}
            })
            
            max_capacity = section.get("max_capacity", 30)
            if current_enrollment < max_capacity:
                return section["id"]
        
        return None
        
    except Exception:
        return None

def _convert_grade_to_letter(numeric_grade: Optional[float]) -> Optional[str]:
    """Convert numeric grade to letter grade"""
    if numeric_grade is None:
        return None
    
    if numeric_grade >= 18:
        return "AD"
    elif numeric_grade >= 14:
        return "A"
    elif numeric_grade >= 11:
        return "B"
    else:
        return "C"