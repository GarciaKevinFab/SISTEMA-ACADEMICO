"""
Grades Management API Routes
Complete grading system with immutable closures and official actas
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from shared_deps import get_current_user, db, logger
from logging_middleware import log_with_correlation, ErrorResponse, ErrorCodes
from grades_system import grades_system, GradeStatus

grades_router = APIRouter(prefix="/grades", tags=["Grades Management"])

# Pydantic Models
class StudentGradeInput(BaseModel):
    student_id: str = Field(..., description="Student identifier")
    grades: Dict[str, float] = Field(..., description="Period grades (PARCIAL_1, PARCIAL_2, PARCIAL_3, FINAL)")

class SectionGradesInput(BaseModel):
    section_id: str = Field(..., description="Section identifier")
    student_grades: List[StudentGradeInput] = Field(..., description="All student grades")

class GradeSubmissionRequest(BaseModel):
    section_id: str = Field(..., description="Section identifier")
    force_submit: bool = Field(default=False, description="Force submit even with incomplete grades")

class GradeClosureRequest(BaseModel):
    section_id: str = Field(..., description="Section identifier")

class GradeReopenRequest(BaseModel):
    section_id: str = Field(..., description="Section identifier")
    reason: str = Field(..., description="Reason for reopening")

class ActaGenerationRequest(BaseModel):
    section_id: str = Field(..., description="Section identifier")
    include_qr: bool = Field(default=True, description="Include QR verification code")

class GradeResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

@grades_router.post("/save", response_model=GradeResponse)
async def save_section_grades(
    request: SectionGradesInput,
    current_user = Depends(get_current_user)
):
    """
    Save grades for all students in a section (DRAFT status)
    Teachers can save individual or batch grades
    """
    correlation_id = log_with_correlation("grades_save_start", {
        "section_id": request.section_id,
        "student_count": len(request.student_grades),
        "user_id": current_user.get("id"),
        "user_role": current_user.get("role")
    })
    
    try:
        # Permission check - only teachers assigned to section can save grades
        if current_user.get("role") not in ["TEACHER", "ADMIN_ACADEMIC", "REGISTRAR"]:
            raise HTTPException(
                status_code=403,
                detail="Solo docentes pueden guardar calificaciones"
            )
        
        # Validate section assignment for teachers
        if current_user.get("role") == "TEACHER":
            section = await db.sections.find_one({"id": request.section_id})
            if not section or section.get("teacher_id") != current_user.get("id"):
                raise HTTPException(
                    status_code=403,
                    detail="No está asignado a esta sección"
                )
        
        # Check if grades are not immutable (closed)
        section = await db.sections.find_one({"id": request.section_id})
        if section and section.get("grades_status") == GradeStatus.CLOSED.value:
            raise HTTPException(
                status_code=409,
                detail="No se pueden modificar calificaciones cerradas"
            )
        
        # Save each student's grades
        saved_results = []
        errors = []
        
        for student_grade in request.student_grades:
            result = await grades_system.save_student_grades(
                request.section_id,
                student_grade.student_id,
                student_grade.grades,
                current_user.get("id")
            )
            
            if result["success"]:
                saved_results.append({
                    "student_id": student_grade.student_id,
                    "final_grade": result["final_grade"]
                })
            else:
                errors.append({
                    "student_id": student_grade.student_id,
                    "error": result["message"]
                })
        
        log_with_correlation("grades_save_complete", {
            "saved_count": len(saved_results),
            "error_count": len(errors)
        }, correlation_id)
        
        return GradeResponse(
            success=len(errors) == 0,
            message=f"Calificaciones guardadas: {len(saved_results)} estudiantes" + 
                   (f", {len(errors)} errores" if errors else ""),
            data={
                "saved_grades": saved_results,
                "errors": errors,
                "section_id": request.section_id,
                "status": "DRAFT"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_with_correlation("grades_save_error", {
            "error": str(e)
        }, correlation_id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error guardando calificaciones: {str(e)}"
        )

@grades_router.post("/submit", response_model=GradeResponse)
async def submit_section_grades(
    request: GradeSubmissionRequest,
    current_user = Depends(get_current_user)
):
    """
    Submit section grades (SUBMITTED status)
    Validates completeness before submission
    """
    correlation_id = log_with_correlation("grades_submit_start", {
        "section_id": request.section_id,
        "force_submit": request.force_submit,
        "user_id": current_user.get("id")
    })
    
    try:
        # Permission check
        if current_user.get("role") not in ["TEACHER", "ADMIN_ACADEMIC", "REGISTRAR"]:
            raise HTTPException(
                status_code=403,
                detail="Solo docentes pueden enviar calificaciones"
            )
        
        # Validate section assignment for teachers
        if current_user.get("role") == "TEACHER":
            section = await db.sections.find_one({"id": request.section_id})
            if not section or section.get("teacher_id") != current_user.get("id"):
                raise HTTPException(
                    status_code=403,
                    detail="No está asignado a esta sección"
                )
        
        # Submit grades
        result = await grades_system.submit_section_grades(
            request.section_id,
            current_user.get("id"),
            request.force_submit
        )
        
        if not result["success"]:
            # Return 409 for incomplete grades
            if "incompletas" in result["message"]:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": result["message"],
                        "incomplete_students": result.get("incomplete_students", [])
                    }
                )
            else:
                raise HTTPException(status_code=400, detail=result["message"])
        
        log_with_correlation("grades_submit_complete", {
            "students_affected": result.get("students_affected", 0)
        }, correlation_id)
        
        return GradeResponse(
            success=True,
            message=result["message"],
            data={
                "section_id": request.section_id,
                "status": result["status"],
                "students_affected": result.get("students_affected", 0)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_with_correlation("grades_submit_error", {
            "error": str(e)
        }, correlation_id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error enviando calificaciones: {str(e)}"
        )

@grades_router.post("/close", response_model=GradeResponse)
async def close_section_grades(
    request: GradeClosureRequest,
    current_user = Depends(get_current_user)
):
    """
    Close section grades (CLOSED status - IMMUTABLE)
    Only REGISTRAR or ADMIN_ACADEMIC can close grades
    """
    correlation_id = log_with_correlation("grades_close_start", {
        "section_id": request.section_id,
        "user_id": current_user.get("id"),
        "user_role": current_user.get("role")
    })
    
    try:
        # Strict permission check
        if current_user.get("role") not in ["REGISTRAR", "ADMIN_ACADEMIC"]:
            raise HTTPException(
                status_code=403,
                detail="Solo REGISTRAR o ADMIN_ACADEMIC pueden cerrar actas"
            )
        
        # Close grades
        result = await grades_system.close_section_grades(
            request.section_id,
            current_user.get("id"),
            current_user.get("role")
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        
        log_with_correlation("grades_close_complete", {
            "closure_id": result.get("closure_id")
        }, correlation_id)
        
        return GradeResponse(
            success=True,
            message=result["message"],
            data={
                "section_id": request.section_id,
                "closure_id": result.get("closure_id"),
                "status": result["status"]
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_with_correlation("grades_close_error", {
            "error": str(e)
        }, correlation_id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error cerrando acta: {str(e)}"
        )

@grades_router.post("/reopen", response_model=GradeResponse)
async def reopen_section_grades(
    request: GradeReopenRequest,
    current_user = Depends(get_current_user)
):
    """
    Reopen closed grades (REGISTRAR/ADMIN_ACADEMIC only)
    Requires justification reason
    """
    correlation_id = log_with_correlation("grades_reopen_start", {
        "section_id": request.section_id,
        "reason": request.reason,
        "user_id": current_user.get("id"),
        "user_role": current_user.get("role")
    })
    
    try:
        # Strict permission check
        if current_user.get("role") not in ["REGISTRAR", "ADMIN_ACADEMIC"]:
            raise HTTPException(
                status_code=403,
                detail="Solo REGISTRAR o ADMIN_ACADEMIC pueden reabrir actas"
            )
        
        # Reopen grades
        result = await grades_system.reopen_section_grades(
            request.section_id,
            current_user.get("id"),
            current_user.get("role"),
            request.reason
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        
        log_with_correlation("grades_reopen_complete", {
            "reason": request.reason
        }, correlation_id)
        
        return GradeResponse(
            success=True,
            message=result["message"],
            data={
                "section_id": request.section_id,
                "status": result["status"],
                "reason": result["reason"]
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_with_correlation("grades_reopen_error", {
            "error": str(e)
        }, correlation_id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error reabriendo acta: {str(e)}"
        )

@grades_router.get("/section/{section_id}")
async def get_section_grades(
    section_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get all grades for a section
    Shows grade conversion and final calculations
    """
    try:
        # Permission check
        if current_user.get("role") == "STUDENT":
            # Students can only see their own grades
            student_grades = await db.student_grades.find({
                "section_id": section_id,
                "student_id": current_user.get("id")
            }).to_list(length=None)
            
            if not student_grades:
                return {"message": "No hay calificaciones disponibles"}
            
            return {
                "section_id": section_id,
                "student_grades": student_grades,
                "view_type": "student_only"
            }
        
        # Teachers and admins see all grades
        grade_records = await db.student_grades.find({
            "section_id": section_id
        }).to_list(length=None)
        
        # Get section information
        section = await db.sections.find_one({"id": section_id})
        
        # Enrich with student information
        enriched_grades = []
        for grade_record in grade_records:
            student = await db.students.find_one({"id": grade_record["student_id"]})
            
            enriched_grade = {
                **grade_record,
                "student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip() if student else "Estudiante",
                "student_code": student.get("student_code", "") if student else "",
                "conversion_info": {
                    "numeric_to_letter": grades_system.convert_numeric_to_letter(
                        grade_record.get("final_numeric_grade", 0)
                    ),
                    "is_passing": grade_record.get("is_passing", False)
                }
            }
            enriched_grades.append(enriched_grade)
        
        # Sort by student name
        enriched_grades.sort(key=lambda x: x["student_name"])
        
        return {
            "section_id": section_id,
            "section_info": {
                "course_name": section.get("course_name", "") if section else "",
                "section_code": section.get("code", "") if section else "",
                "teacher_name": section.get("teacher_name", "") if section else "",
                "academic_period": section.get("academic_period", "") if section else "",
                "grades_status": section.get("grades_status", "") if section else ""
            },
            "student_grades": enriched_grades,
            "grade_statistics": {
                "total_students": len(enriched_grades),
                "passing_students": sum(1 for g in enriched_grades if g.get("is_passing", False)),
                "average_grade": sum(g.get("final_numeric_grade", 0) for g in enriched_grades) / len(enriched_grades) if enriched_grades else 0
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting section grades: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo calificaciones: {str(e)}"
        )

@grades_router.post("/acta/generate", response_model=GradeResponse)
async def generate_official_acta(
    request: ActaGenerationRequest,
    current_user = Depends(get_current_user)
):
    """
    Generate official acta PDF with QR verification
    Returns task ID for polling
    """
    correlation_id = log_with_correlation("acta_generation_start", {
        "section_id": request.section_id,
        "include_qr": request.include_qr,
        "user_id": current_user.get("id")
    })
    
    try:
        # Permission check
        if current_user.get("role") not in ["TEACHER", "ADMIN_ACADEMIC", "REGISTRAR"]:
            raise HTTPException(
                status_code=403,
                detail="No autorizado para generar actas"
            )
        
        # Generate acta
        result = await grades_system.generate_official_acta_pdf(
            request.section_id,
            request.include_qr
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        
        log_with_correlation("acta_generation_complete", {
            "acta_id": result.get("acta_id"),
            "task_id": result.get("taskId")
        }, correlation_id)
        
        return GradeResponse(
            success=True,
            message=result["message"],
            data={
                "acta_id": result.get("acta_id"),
                "taskId": result.get("taskId"),
                "statusUrl": result.get("statusUrl"),
                "verification_url": result.get("verification_url")
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_with_correlation("acta_generation_error", {
            "error": str(e)
        }, correlation_id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error generando acta: {str(e)}"
        )

@grades_router.get("/acta/verify/{acta_id}")
async def verify_acta_qr(acta_id: str):
    """
    Verify acta QR code (PUBLIC endpoint - no authentication required)
    Returns only non-sensitive verification data
    """
    try:
        result = await grades_system.verify_acta_qr(acta_id)
        
        if not result["valid"]:
            raise HTTPException(status_code=404, detail=result["message"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Acta verification error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error en verificación de acta"
        )

@grades_router.get("/conversion-table")
async def get_grade_conversion_table():
    """
    Get grade conversion table (0-20 to AD/A/B/C)
    Public information for reference
    """
    return {
        "conversion_system": "Numeric (0-20) to Letter (AD/A/B/C)",
        "conversions": [
            {"letter": "AD", "numeric_range": "18-20", "description": "Logro destacado", "passing": True},
            {"letter": "A", "numeric_range": "14-17", "description": "Logro esperado", "passing": True},
            {"letter": "B", "numeric_range": "11-13", "description": "En proceso", "passing": True},
            {"letter": "C", "numeric_range": "0-10", "description": "En inicio", "passing": False}
        ],
        "grade_weights": {
            "PARCIAL_1": "20%",
            "PARCIAL_2": "20%", 
            "PARCIAL_3": "20%",
            "FINAL": "40%"
        },
        "passing_grade": 11.0,
        "calculation_formula": "(P1*0.2) + (P2*0.2) + (P3*0.2) + (Final*0.4)"
    }

@grades_router.get("/student/{student_id}/transcript")
async def get_student_transcript(
    student_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get complete academic transcript for student
    Shows all courses, grades, and cumulative GPA
    """
    try:
        # Permission check
        if (current_user.get("role") == "STUDENT" and 
            current_user.get("id") != student_id):
            raise HTTPException(
                status_code=403,
                detail="Solo puede ver su propio historial académico"
            )
        
        # Get all grade records for student
        grade_records = await db.student_grades.find({
            "student_id": student_id
        }).sort("academic_period", 1).to_list(length=None)
        
        # Enrich with course information
        transcript = []
        total_credits = 0
        total_grade_points = 0
        
        for grade_record in grade_records:
            course = await db.courses.find_one({"id": grade_record["course_id"]})
            
            if course:
                credits = course.get("credits", 0)
                final_grade = grade_record.get("final_numeric_grade", 0)
                
                total_credits += credits
                total_grade_points += final_grade * credits
                
                transcript.append({
                    "academic_period": grade_record["academic_period"],
                    "course_code": course.get("code", ""),
                    "course_name": course.get("name", ""),
                    "credits": credits,
                    "final_numeric_grade": final_grade,
                    "final_letter_grade": grade_record.get("final_letter_grade", ""),
                    "is_passing": grade_record.get("is_passing", False),
                    "status": grade_record.get("status", "")
                })
        
        # Calculate cumulative GPA
        cumulative_gpa = total_grade_points / total_credits if total_credits > 0 else 0
        
        # Get student information
        student = await db.students.find_one({"id": student_id})
        
        return {
            "student_id": student_id,
            "student_info": {
                "name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip() if student else "",
                "student_code": student.get("student_code", "") if student else "",
                "career": student.get("career", "") if student else ""
            },
            "transcript": transcript,
            "academic_summary": {
                "total_courses": len(transcript),
                "total_credits": total_credits,
                "cumulative_gpa": round(cumulative_gpa, 2),
                "cumulative_gpa_letter": grades_system.convert_numeric_to_letter(cumulative_gpa),
                "passed_courses": sum(1 for t in transcript if t["is_passing"]),
                "failed_courses": sum(1 for t in transcript if not t["is_passing"])
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcript generation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generando historial académico: {str(e)}"
        )