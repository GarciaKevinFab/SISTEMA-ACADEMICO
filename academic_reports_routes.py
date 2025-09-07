"""
Academic Reports Routes
API endpoints for academic reporting and analytics
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase
import io

from auth import get_current_user, check_permissions
from database import get_database
from academic_reports import AcademicReports

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["Academic Reports"])

# Pydantic Models
class StudentReportRequest(BaseModel):
    student_id: str = Field(..., description="ID del estudiante")
    include_periods: Optional[List[str]] = Field(None, description="Períodos a incluir")
    format_type: str = Field(default="PDF", description="Formato (PDF/CSV)")

class CourseReportRequest(BaseModel):
    course_id: str = Field(..., description="ID del curso")
    period_id: str = Field(..., description="ID del período")
    teacher_id: Optional[str] = Field(None, description="ID del docente")
    format_type: str = Field(default="PDF", description="Formato (PDF/CSV)")

class ConsistencyCheckResult(BaseModel):
    check_date: str
    period_id: Optional[str] = None
    total_anomalies: int
    severity_distribution: Dict[str, int]
    consistency_score: int
    anomalies: List[Dict[str, Any]]

@router.post("/student-history")
async def generate_student_history_report(
    request: StudentReportRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Generar reporte de historial académico completo del estudiante"""
    
    # Verificar permisos
    user_role = current_user.get("role")
    student_id = request.student_id
    
    # Estudiantes solo pueden ver su propio historial
    if user_role == "STUDENT" and current_user.get("id") != student_id:
        raise HTTPException(status_code=403, detail="Solo puedes acceder a tu propio historial")
    
    # Otros roles necesitan permisos específicos
    if user_role not in ["STUDENT", "ADMIN", "REGISTRAR", "ADMIN_ACADEMIC", "TEACHER"]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes")
    
    try:
        reports = AcademicReports(db)
        
        # Generar reporte
        report_buffer = await reports.generate_student_history_report(
            student_id=request.student_id,
            include_periods=request.include_periods,
            format_type=request.format_type
        )
        
        # Determinar tipo de contenido y nombre de archivo
        if request.format_type.upper() == "PDF":
            media_type = "application/pdf"
            filename = f"historial_academico_{request.student_id}.pdf"
        else:
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"historial_academico_{request.student_id}.xlsx"
        
        # Crear respuesta de streaming
        def generate():
            yield report_buffer.read()
        
        logger.info(f"Generated student history report for {request.student_id} by {current_user['email']}")
        
        return StreamingResponse(
            io.BytesIO(report_buffer.getvalue()),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating student history report: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/course-outcomes")
async def generate_course_outcomes_report(
    request: CourseReportRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Generar reporte de resultados del curso con distribución de notas y asistencia"""
    
    # Verificar permisos
    check_permissions(current_user, ["ADMIN", "REGISTRAR", "ADMIN_ACADEMIC", "TEACHER"])
    
    # Si es docente, verificar que tenga asignado el curso
    if current_user.get("role") == "TEACHER":
        assignment = await db.teacher_assignments.find_one({
            "teacher_id": current_user["id"],
            "course_id": request.course_id,
            "period_id": request.period_id
        })
        
        if not assignment:
            raise HTTPException(status_code=403, detail="No tienes asignado este curso")
    
    try:
        reports = AcademicReports(db)
        
        # Generar reporte
        report_buffer = await reports.generate_course_outcomes_report(
            course_id=request.course_id,
            period_id=request.period_id,
            teacher_id=request.teacher_id,
            format_type=request.format_type
        )
        
        # Determinar tipo de contenido y nombre de archivo
        if request.format_type.upper() == "PDF":
            media_type = "application/pdf"
            filename = f"resultados_curso_{request.course_id}_{request.period_id}.pdf"
        else:
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"resultados_curso_{request.course_id}_{request.period_id}.xlsx"
        
        logger.info(f"Generated course outcomes report for {request.course_id} by {current_user['email']}")
        
        return StreamingResponse(
            io.BytesIO(report_buffer.getvalue()),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating course outcomes report: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/consistency-check", response_model=ConsistencyCheckResult)
async def check_academic_consistency(
    period_id: Optional[str] = Query(None, description="Período específico a verificar"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Verificar consistencia de datos académicos y detectar anomalías"""
    
    check_permissions(current_user, ["ADMIN", "REGISTRAR", "ADMIN_ACADEMIC"])
    
    try:
        reports = AcademicReports(db)
        
        # Ejecutar verificación de consistencia
        result = await reports.check_academic_consistency(period_id)
        
        logger.info(f"Consistency check completed by {current_user['email']}: {result['total_anomalies']} anomalies found")
        
        return ConsistencyCheckResult(
            check_date=result["check_date"],
            period_id=result.get("period_id"),
            total_anomalies=result["total_anomalies"],
            severity_distribution=result["severity_distribution"],
            consistency_score=result["consistency_score"],
            anomalies=result["anomalies"]
        )
        
    except Exception as e:
        logger.error(f"Error in consistency check: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/consistency-history")
async def get_consistency_check_history(
    period_id: Optional[str] = Query(None, description="Filtrar por período"),
    limit: int = Query(10, ge=1, le=50, description="Límite de resultados"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Obtener historial de verificaciones de consistencia"""
    
    check_permissions(current_user, ["ADMIN", "REGISTRAR", "ADMIN_ACADEMIC"])
    
    try:
        query = {}
        if period_id:
            query["period_id"] = period_id
        
        cursor = db.consistency_checks.find(query).sort("check_date", -1).limit(limit)
        history = await cursor.to_list(length=None)
        
        return history
        
    except Exception as e:
        logger.error(f"Error fetching consistency history: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/dashboard/analytics", response_model=Dict[str, Any])
async def get_academic_analytics(
    period_id: Optional[str] = Query(None, description="Período específico"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Obtener analytics académicos para dashboard"""
    
    check_permissions(current_user, ["ADMIN", "REGISTRAR", "ADMIN_ACADEMIC"])
    
    try:
        # Construir filtros
        period_filter = {"period_id": period_id} if period_id else {}
        
        # Estadísticas generales
        total_students = await db.students.count_documents({"status": "ACTIVE"})
        total_courses = await db.courses.count_documents({"status": "ACTIVE"})
        total_enrollments = await db.enrollments.count_documents({**period_filter, "status": "ACTIVE"})
        
        # Distribución de calificaciones
        grade_pipeline = [
            {"$match": period_filter},
            {"$group": {
                "_id": "$literal_grade",
                "count": {"$sum": 1}
            }}
        ]
        
        grade_cursor = db.grades.aggregate(grade_pipeline)
        grade_distribution = {item["_id"]: item["count"] for item in await grade_cursor.to_list(length=None)}
        
        # Tasa de aprobación
        approved_count = await db.grades.count_documents({**period_filter, "status": "APPROVED"})
        total_grades = await db.grades.count_documents(period_filter)
        approval_rate = (approved_count / total_grades * 100) if total_grades > 0 else 0
        
        # Cursos con más estudiantes
        enrollment_pipeline = [
            {"$match": {**period_filter, "status": "ACTIVE"}},
            {"$group": {
                "_id": "$course_id", 
                "enrollment_count": {"$sum": 1}
            }},
            {"$sort": {"enrollment_count": -1}},
            {"$limit": 5}
        ]
        
        enrollment_cursor = db.enrollments.aggregate(enrollment_pipeline)
        top_courses = await enrollment_cursor.to_list(length=None)
        
        # Obtener nombres de cursos
        course_ids = [c["_id"] for c in top_courses]
        courses_cursor = db.courses.find({"id": {"$in": course_ids}})
        courses_dict = {c["id"]: c["name"] for c in await courses_cursor.to_list(length=None)}
        
        for course in top_courses:
            course["course_name"] = courses_dict.get(course["_id"], "Curso no encontrado")
        
        # Estadísticas de asistencia promedio
        attendance_pipeline = [
            {"$match": period_filter},
            {"$group": {
                "_id": "$student_id",
                "attendance_percentage": {"$avg": "$attendance_percentage"}
            }},
            {"$group": {
                "_id": None,
                "avg_attendance": {"$avg": "$attendance_percentage"}
            }}
        ]
        
        attendance_cursor = db.attendance.aggregate(attendance_pipeline)
        attendance_result = await attendance_cursor.to_list(length=None)
        avg_attendance = attendance_result[0]["avg_attendance"] if attendance_result else 0
        
        # Últimas verificaciones de consistencia
        latest_consistency = await db.consistency_checks.find_one(
            {},
            sort=[("check_date", -1)]
        )
        
        analytics = {
            "period_id": period_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "overview": {
                "total_students": total_students,
                "total_courses": total_courses,
                "total_enrollments": total_enrollments,
                "approval_rate": round(approval_rate, 1),
                "average_attendance": round(avg_attendance, 1) if avg_attendance else 0
            },
            "grade_distribution": grade_distribution,
            "top_courses": top_courses,
            "consistency_status": {
                "last_check": latest_consistency["check_date"] if latest_consistency else None,
                "total_anomalies": latest_consistency["total_anomalies"] if latest_consistency else 0,
                "consistency_score": latest_consistency["consistency_score"] if latest_consistency else 0
            }
        }
        
        return analytics
        
    except Exception as e:
        logger.error(f"Error generating academic analytics: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/student/{student_id}/summary", response_model=Dict[str, Any])
async def get_student_academic_summary(
    student_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Obtener resumen académico rápido del estudiante"""
    
    # Verificar permisos - estudiantes solo pueden ver su propio resumen
    user_role = current_user.get("role")
    if user_role == "STUDENT" and current_user.get("id") != student_id:
        raise HTTPException(status_code=403, detail="Solo puedes acceder a tu propio resumen")
    
    if user_role not in ["STUDENT", "ADMIN", "REGISTRAR", "ADMIN_ACADEMIC", "TEACHER"]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes")
    
    try:
        # Obtener estudiante
        student = await db.students.find_one({"id": student_id})
        if not student:
            raise HTTPException(status_code=404, detail="Estudiante no encontrado")
        
        # Obtener matrículas activas
        current_enrollments = await db.enrollments.count_documents({
            "student_id": student_id,
            "status": "ACTIVE"
        })
        
        # Obtener total de créditos
        credits_pipeline = [
            {"$match": {"student_id": student_id}},
            {"$group": {
                "_id": None,
                "total_credits": {"$sum": "$credits"}
            }}
        ]
        
        credits_cursor = db.enrollments.aggregate(credits_pipeline)
        credits_result = await credits_cursor.to_list(length=None)
        total_credits = credits_result[0]["total_credits"] if credits_result else 0
        
        # Obtener promedio ponderado
        grades_cursor = db.grades.find({"student_id": student_id})
        grades = await grades_cursor.to_list(length=None)
        
        if grades:
            weighted_sum = sum(g["numerical_grade"] * g.get("credits", 1) for g in grades if g.get("numerical_grade"))
            credit_sum = sum(g.get("credits", 1) for g in grades if g.get("numerical_grade"))
            gpa = weighted_sum / credit_sum if credit_sum > 0 else 0
        else:
            gpa = 0
        
        # Obtener cursos aprobados/desaprobados
        approved_courses = await db.grades.count_documents({
            "student_id": student_id,
            "status": "APPROVED"
        })
        
        failed_courses = await db.grades.count_documents({
            "student_id": student_id,
            "status": "FAILED"
        })
        
        # Asistencia promedio
        attendance_pipeline = [
            {"$match": {"student_id": student_id}},
            {"$group": {
                "_id": None,
                "avg_attendance": {"$avg": "$attendance_percentage"}
            }}
        ]
        
        attendance_cursor = db.attendance.aggregate(attendance_pipeline)
        attendance_result = await attendance_cursor.to_list(length=None)
        avg_attendance = attendance_result[0]["avg_attendance"] if attendance_result else 0
        
        summary = {
            "student_id": student_id,
            "student_name": student.get("full_name", ""),
            "program": student.get("program", ""),
            "status": student.get("status", ""),
            "academic_summary": {
                "current_enrollments": current_enrollments,
                "total_credits": total_credits,
                "gpa": round(gpa, 2),
                "approved_courses": approved_courses,
                "failed_courses": failed_courses,
                "average_attendance": round(avg_attendance, 1) if avg_attendance else 0
            },
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        
        return summary
        
    except Exception as e:
        logger.error(f"Error generating student summary: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/course/{course_id}/period/{period_id}/analytics")
async def get_course_period_analytics(
    course_id: str,
    period_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Obtener analytics detallados del curso en período específico"""
    
    check_permissions(current_user, ["ADMIN", "REGISTRAR", "ADMIN_ACADEMIC", "TEACHER"])
    
    # Verificar asignación si es docente
    if current_user.get("role") == "TEACHER":
        assignment = await db.teacher_assignments.find_one({
            "teacher_id": current_user["id"],
            "course_id": course_id,
            "period_id": period_id
        })
        
        if not assignment:
            raise HTTPException(status_code=403, detail="No tienes asignado este curso")
    
    try:
        # Obtener información del curso
        course = await db.courses.find_one({"id": course_id})
        if not course:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        
        # Matrículas del curso
        enrollments = await db.enrollments.count_documents({
            "course_id": course_id,
            "period_id": period_id,
            "status": "ACTIVE"
        })
        
        # Distribución de calificaciones
        grade_pipeline = [
            {"$match": {"course_id": course_id, "period_id": period_id}},
            {"$group": {
                "_id": "$literal_grade",
                "count": {"$sum": 1}
            }}
        ]
        
        grade_cursor = db.grades.aggregate(grade_pipeline)
        grade_distribution = {item["_id"]: item["count"] for item in await grade_cursor.to_list(length=None)}
        
        # Estadísticas de notas
        grades_cursor = db.grades.find({"course_id": course_id, "period_id": period_id})
        grades = [g["numerical_grade"] for g in await grades_cursor.to_list(length=None) if g.get("numerical_grade")]
        
        grade_stats = {}
        if grades:
            grade_stats = {
                "average": round(sum(grades) / len(grades), 2),
                "min": min(grades),
                "max": max(grades),
                "count": len(grades)
            }
        
        # Tasa de aprobación
        approved = await db.grades.count_documents({
            "course_id": course_id,
            "period_id": period_id,
            "status": "APPROVED"
        })
        
        total_grades = await db.grades.count_documents({
            "course_id": course_id,
            "period_id": period_id
        })
        
        approval_rate = (approved / total_grades * 100) if total_grades > 0 else 0
        
        # Asistencia promedio del curso
        attendance_pipeline = [
            {"$match": {"course_id": course_id, "period_id": period_id}},
            {"$group": {
                "_id": None,
                "avg_attendance": {"$avg": "$attendance_percentage"}
            }}
        ]
        
        attendance_cursor = db.attendance.aggregate(attendance_pipeline)
        attendance_result = await attendance_cursor.to_list(length=None)
        avg_attendance = attendance_result[0]["avg_attendance"] if attendance_result else 0
        
        analytics = {
            "course_id": course_id,
            "course_name": course.get("name", ""),
            "period_id": period_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "enrollment_count": enrollments,
            "grade_distribution": grade_distribution,
            "grade_statistics": grade_stats,
            "approval_rate": round(approval_rate, 1),
            "average_attendance": round(avg_attendance, 1) if avg_attendance else 0
        }
        
        return analytics
        
    except Exception as e:
        logger.error(f"Error generating course analytics: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")