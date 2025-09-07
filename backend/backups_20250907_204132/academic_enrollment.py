"""
MATRÍCULA DEL ESTUDIANTE - Sistema Académico Completo
Implementa reglas bloqueantes, re-matrícula, validaciones completas
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timezone
import asyncio

from shared_deps import get_current_user, db, logger
from logging_middleware import get_correlation_id, log_with_correlation, ErrorResponse, ErrorCodes
from fixed_optimizations import performance_monitor
from academic_complete import EnrollmentRequest, EnrollmentComplete, EnrollmentStatus

enrollment_router = APIRouter(prefix="/enrollment", tags=["Student Enrollment"])

class EnrollmentValidator:
    """Validador de reglas de matrícula"""
    
    @staticmethod
    async def validate_prerequisites(student_id: str, course_id: str) -> Dict[str, Any]:
        """Validar prerrequisitos del curso"""
        # Obtener prerrequisitos del curso
        course = await db.courses.find_one({"id": course_id})
        if not course:
            return {"valid": False, "message": "Curso no encontrado"}
        
        prerequisites = course.get("prerequisite_course_ids", [])
        if not prerequisites:
            return {"valid": True, "message": "Sin prerrequisitos"}
        
        # Verificar que el estudiante aprobó todos los prerrequisitos
        approved_courses = await db.enrollments.find({
            "student_id": student_id,
            "course_id": {"$in": prerequisites},
            "final_numerical_grade": {"$gte": 11},  # Nota aprobatoria >= 11
            "status": "COMPLETED"
        }).to_list(length=None)
        
        approved_course_ids = [e["course_id"] for e in approved_courses]
        missing_prerequisites = [p for p in prerequisites if p not in approved_course_ids]
        
        if missing_prerequisites:
            # Obtener nombres de cursos faltantes
            missing_courses = await db.courses.find({
                "id": {"$in": missing_prerequisites}
            }, {"name": 1, "code": 1}).to_list(length=None)
            
            course_names = [f"{c['code']} - {c['name']}" for c in missing_courses]
            
            return {
                "valid": False,
                "message": f"Prerrequisitos no aprobados: {', '.join(course_names)}"
            }
        
        return {"valid": True, "message": "Prerrequisitos cumplidos"}
    
    @staticmethod
    async def validate_schedule_conflicts(student_id: str, section_ids: List[str]) -> Dict[str, Any]:
        """Validar choques de horario"""
        if len(section_ids) <= 1:
            return {"valid": True, "message": "Sin choques posibles"}
        
        # Obtener horarios de todas las secciones
        sections = await db.sections.find({
            "id": {"$in": section_ids}
        }, {"id": 1, "schedule": 1, "course_id": 1}).to_list(length=None)
        
        # Crear mapa de horarios por día y hora
        schedule_map = {}
        conflicts = []
        
        for section in sections:
            section_schedule = section.get("schedule", [])
            for slot in section_schedule:
                day = slot.get("day")
                start = slot.get("start")
                end = slot.get("end")
                
                if not (day and start and end):
                    continue
                
                # Convertir horas a minutos para comparación
                start_minutes = int(start.split(":")[0]) * 60 + int(start.split(":")[1])
                end_minutes = int(end.split(":")[0]) * 60 + int(end.split(":")[1])
                
                key = f"{day}_{start_minutes}_{end_minutes}"
                
                if key in schedule_map:
                    # Hay conflicto
                    conflicts.append({
                        "day": day,
                        "time": f"{start}-{end}",
                        "section1": schedule_map[key],
                        "section2": section["id"]
                    })
                else:
                    schedule_map[key] = section["id"]
        
        if conflicts:
            return {
                "valid": False,
                "message": f"Choques de horario detectados: {len(conflicts)} conflictos",
                "conflicts": conflicts
            }
        
        return {"valid": True, "message": "Sin choques de horario"}
    
    @staticmethod
    async def validate_credit_limits(student_id: str, section_ids: List[str]) -> Dict[str, Any]:
        """Validar límites de créditos"""
        # Obtener créditos de los cursos seleccionados
        sections = await db.sections.find({
            "id": {"$in": section_ids}
        }, {"course_id": 1}).to_list(length=None)
        
        course_ids = [s["course_id"] for s in sections]
        courses = await db.courses.find({
            "id": {"$in": course_ids}
        }, {"credits": 1}).to_list(length=None)
        
        total_credits = sum(c.get("credits", 0) for c in courses)
        
        # Obtener límites del plan de estudios del estudiante
        student = await db.students.find_one({"id": student_id})
        if not student:
            return {"valid": False, "message": "Estudiante no encontrado"}
        
        # Asumir límites por defecto si no se encuentra el plan
        min_credits = 12
        max_credits = 24
        
        # Obtener límites del plan de estudios si existe
        career_id = student.get("career_id")
        if career_id:
            study_plan = await db.study_plans.find_one({
                "career_id": career_id,
                "is_active": True
            })
            if study_plan:
                min_credits = study_plan.get("min_credits_per_semester", 12)
                max_credits = study_plan.get("max_credits_per_semester", 24)
        
        if total_credits < min_credits:
            return {
                "valid": False,
                "message": f"Créditos insuficientes: {total_credits} (mínimo: {min_credits})"
            }
        
        if total_credits > max_credits:
            return {
                "valid": False,
                "message": f"Exceso de créditos: {total_credits} (máximo: {max_credits})"
            }
        
        return {
            "valid": True,
            "message": f"Créditos válidos: {total_credits} (rango: {min_credits}-{max_credits})"
        }
    
    @staticmethod
    async def validate_debt_status(student_id: str) -> Dict[str, Any]:
        """Validar estado de deuda con Tesorería"""
        # Buscar boletas pendientes de pago
        pending_receipts = await db.receipts.count_documents({
            "student_id": student_id,
            "payment_status": {"$in": ["PENDING", "OVERDUE"]},
            "is_active": True
        })
        
        if pending_receipts > 0:
            return {
                "valid": False,
                "message": f"Tiene {pending_receipts} boleta(s) pendiente(s) de pago"
            }
        
        return {"valid": True, "message": "Sin deudas pendientes"}
    
    @staticmethod
    async def validate_section_capacity(section_ids: List[str]) -> Dict[str, Any]:
        """Validar capacidad de secciones"""
        sections = await db.sections.find({
            "id": {"$in": section_ids}
        }, {"id": 1, "max_students": 1, "current_students": 1}).to_list(length=None)
        
        full_sections = []
        for section in sections:
            max_students = section.get("max_students", 30)
            current_students = section.get("current_students", 0)
            
            if current_students >= max_students:
                full_sections.append(section["id"])
        
        if full_sections:
            return {
                "valid": False,
                "message": f"Secciones llenas: {len(full_sections)} sección(es)",
                "full_sections": full_sections
            }
        
        return {"valid": True, "message": "Vacantes disponibles"}

@enrollment_router.post("/validate")
@performance_monitor
async def validate_enrollment(
    enrollment_request: EnrollmentRequest,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Validar matrícula antes de procesar"""
    correlation_id = get_correlation_id(request)
    
    try:
        student_id = enrollment_request.student_id
        section_ids = enrollment_request.section_ids
        
        # Ejecutar todas las validaciones en paralelo
        validation_tasks = [
            EnrollmentValidator.validate_debt_status(student_id),
            EnrollmentValidator.validate_section_capacity(section_ids),
            EnrollmentValidator.validate_credit_limits(student_id, section_ids),
            EnrollmentValidator.validate_schedule_conflicts(student_id, section_ids)
        ]
        
        # Validar prerrequisitos para cada curso
        sections = await db.sections.find({
            "id": {"$in": section_ids}
        }, {"course_id": 1}).to_list(length=None)
        
        for section in sections:
            course_id = section["course_id"]
            validation_tasks.append(
                EnrollmentValidator.validate_prerequisites(student_id, course_id)
            )
        
        # Ejecutar todas las validaciones
        results = await asyncio.gather(*validation_tasks)
        
        # Separar resultados
        debt_result = results[0]
        capacity_result = results[1]
        credits_result = results[2]
        schedule_result = results[3]
        prerequisite_results = results[4:] if len(results) > 4 else []
        
        # Consolidar validaciones
        validations = {
            "debt_status": debt_result,
            "section_capacity": capacity_result,
            "credit_limits": credits_result,
            "schedule_conflicts": schedule_result,
            "prerequisites": prerequisite_results
        }
        
        # Determinar si la matrícula es válida
        is_valid = all([
            debt_result["valid"],
            capacity_result["valid"],
            credits_result["valid"],
            schedule_result["valid"],
            all(p["valid"] for p in prerequisite_results)
        ])
        
        blocking_issues = []
        if not debt_result["valid"]:
            blocking_issues.append(debt_result["message"])
        if not capacity_result["valid"]:
            blocking_issues.append(capacity_result["message"])
        if not credits_result["valid"]:
            blocking_issues.append(credits_result["message"])
        if not schedule_result["valid"]:
            blocking_issues.append(schedule_result["message"])
        
        for prereq in prerequisite_results:
            if not prereq["valid"]:
                blocking_issues.append(prereq["message"])
        
        return {
            "valid": is_valid,
            "blocking_issues": blocking_issues,
            "validations": validations,
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error validating enrollment: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al validar matrícula",
            correlation_id=correlation_id,
            status_code=500
        )

@enrollment_router.post("/enroll")
@performance_monitor
async def process_enrollment(
    enrollment_request: EnrollmentRequest,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Procesar matrícula del estudiante"""
    correlation_id = get_correlation_id(request)
    
    try:
        student_id = enrollment_request.student_id
        section_ids = enrollment_request.section_ids
        
        # Validar primero
        validation_response = await validate_enrollment(enrollment_request, request, current_user)
        if not validation_response["valid"]:
            return ErrorResponse.create(
                code=ErrorCodes.BUSINESS_RULE_VIOLATION,
                message="Matrícula no válida",
                correlation_id=correlation_id,
                details={"blocking_issues": validation_response["blocking_issues"]},
                status_code=400
            )
        
        # Obtener información de secciones y cursos
        sections = await db.sections.find({
            "id": {"$in": section_ids}
        }).to_list(length=None)
        
        course_ids = [s["course_id"] for s in sections]
        courses = await db.courses.find({
            "id": {"$in": course_ids}
        }).to_list(length=None)
        
        # Crear diccionario para búsqueda rápida
        courses_dict = {c["id"]: c for c in courses}
        
        # Crear matrículas
        enrollments = []
        current_time = datetime.now(timezone.utc)
        academic_year = 2025
        academic_period = "2025-I"
        
        for section in sections:
            course = courses_dict[section["course_id"]]
            
            enrollment = EnrollmentComplete(
                student_id=student_id,
                section_id=section["id"],
                course_id=section["course_id"],
                teacher_id=section["teacher_id"],
                academic_year=academic_year,
                academic_period=academic_period,
                credits=course["credits"],
                enrollment_date=current_time
            )
            
            enrollments.append(enrollment.dict())
        
        # Insertar matrículas
        if enrollments:
            await db.enrollments.insert_many(enrollments)
            
            # Actualizar contador de estudiantes en secciones
            for section_id in section_ids:
                await db.sections.update_one(
                    {"id": section_id},
                    {"$inc": {"current_students": 1}}
                )
        
        log_with_correlation(
            logger, "info",
            f"Student {student_id} enrolled in {len(enrollments)} courses",
            request,
            user_data={"id": current_user.id, "role": current_user.role}
        )
        
        return {
            "enrollments": enrollments,
            "message": f"Matrícula procesada exitosamente: {len(enrollments)} cursos",
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error processing enrollment: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al procesar matrícula",
            correlation_id=correlation_id,
            status_code=500
        )

@enrollment_router.get("/student/{student_id}")
@performance_monitor
async def get_student_enrollments(
    student_id: str,
    request: Request,
    academic_year: Optional[int] = Query(None),
    academic_period: Optional[str] = Query(None),
    status: Optional[EnrollmentStatus] = Query(None),
    current_user = Depends(get_current_user)
):
    """Obtener matrículas de un estudiante"""
    correlation_id = get_correlation_id(request)
    
    try:
        # Construir query
        match_conditions = {"student_id": student_id}
        if academic_year:
            match_conditions["academic_year"] = academic_year
        if academic_period:
            match_conditions["academic_period"] = academic_period
        if status:
            match_conditions["status"] = status.value
        
        # Aggregation para información completa
        pipeline = [
            {"$match": match_conditions},
            {
                "$lookup": {
                    "from": "courses",
                    "localField": "course_id",
                    "foreignField": "id",
                    "as": "course_info"
                }
            },
            {
                "$lookup": {
                    "from": "sections",
                    "localField": "section_id",
                    "foreignField": "id",
                    "as": "section_info"
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "teacher_id",
                    "foreignField": "id",
                    "as": "teacher_info"
                }
            },
            {
                "$addFields": {
                    "course_name": {"$arrayElemAt": ["$course_info.name", 0]},
                    "course_code": {"$arrayElemAt": ["$course_info.code", 0]},
                    "section_code": {"$arrayElemAt": ["$section_info.section_code", 0]},
                    "teacher_name": {"$arrayElemAt": ["$teacher_info.full_name", 0]}
                }
            },
            {"$sort": {"academic_year": -1, "academic_period": -1, "enrollment_date": -1}}
        ]
        
        enrollments_cursor = db.enrollments.aggregate(pipeline)
        enrollments = await enrollments_cursor.to_list(length=None)
        
        # Calcular estadísticas
        total_credits = sum(e.get("credits", 0) for e in enrollments if e.get("status") == "ACTIVE")
        completed_courses = len([e for e in enrollments if e.get("status") == "COMPLETED"])
        
        return {
            "enrollments": enrollments,
            "statistics": {
                "total_enrollments": len(enrollments),
                "active_enrollments": len([e for e in enrollments if e.get("status") == "ACTIVE"]),
                "completed_courses": completed_courses,
                "total_credits": total_credits
            },
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error getting student enrollments: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al obtener matrículas",
            correlation_id=correlation_id,
            status_code=500
        )

@enrollment_router.post("/re-enroll")
@performance_monitor
async def re_enroll_student(
    enrollment_request: EnrollmentRequest,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Re-matrícula de cursos desaprobados sin duplicar histórico"""
    correlation_id = get_correlation_id(request)
    
    try:
        student_id = enrollment_request.student_id
        section_ids = enrollment_request.section_ids
        
        # Obtener cursos de las secciones seleccionadas
        sections = await db.sections.find({
            "id": {"$in": section_ids}
        }, {"course_id": 1}).to_list(length=None)
        
        course_ids = [s["course_id"] for s in sections]
        
        # Verificar que son cursos desaprobados
        failed_enrollments = await db.enrollments.find({
            "student_id": student_id,
            "course_id": {"$in": course_ids},
            "final_numerical_grade": {"$lt": 11},  # Desaprobado < 11
            "status": "COMPLETED"
        }).to_list(length=None)
        
        failed_course_ids = [e["course_id"] for e in failed_enrollments]
        
        # Verificar que no hay matrículas activas para estos cursos
        active_enrollments = await db.enrollments.find({
            "student_id": student_id,
            "course_id": {"$in": course_ids},
            "status": "ACTIVE"
        }).to_list(length=None)
        
        if active_enrollments:
            return ErrorResponse.create(
                code=ErrorCodes.BUSINESS_RULE_VIOLATION,
                message="Ya tiene matrículas activas para algunos de estos cursos",
                correlation_id=correlation_id,
                status_code=400
            )
        
        # Validar que todos los cursos son re-matriculables
        non_retakable = [cid for cid in course_ids if cid not in failed_course_ids]
        if non_retakable:
            return ErrorResponse.create(
                code=ErrorCodes.BUSINESS_RULE_VIOLATION,
                message="Algunos cursos no requieren re-matrícula (no fueron desaprobados)",
                correlation_id=correlation_id,
                status_code=400
            )
        
        # Procesar como matrícula normal
        return await process_enrollment(enrollment_request, request, current_user)
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error processing re-enrollment: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al procesar re-matrícula",
            correlation_id=correlation_id,
            status_code=500
        )