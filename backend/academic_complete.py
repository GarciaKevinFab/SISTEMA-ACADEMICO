"""
FASE 2 - MÓDULO ACADÉMICO COMPLETO (100%)
Sistema Académico IESPP 'Gustavo Allende Llavería'
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, BackgroundTasks
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timezone, timedelta
from pydantic import BaseModel, Field, validator
from enum import Enum
import uuid
import asyncio

from shared_deps import get_current_user, db, logger
from logging_middleware import get_correlation_id, log_with_correlation, ErrorResponse, ErrorCodes
from fixed_optimizations import performance_monitor, simple_cache, OptimizedQueries
from rbac_security import require_permission, ResourceType, Permission, UserRole

academic_complete_router = APIRouter(prefix="/academic", tags=["Academic Complete"])

# =================== MODELS ACADÉMICOS COMPLETOS ===================

class StudyPlanType(str, Enum):
    REGULAR = "REGULAR"
    ACCELERATED = "ACCELERATED"
    EVENING = "EVENING"
    WEEKEND = "WEEKEND"

class CourseType(str, Enum):
    MANDATORY = "MANDATORY"
    ELECTIVE = "ELECTIVE"
    PRACTICE = "PRACTICE"
    THESIS = "THESIS"

class EnrollmentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    WITHDRAWN = "WITHDRAWN"
    SUSPENDED = "SUSPENDED"
    COMPLETED = "COMPLETED"

class GradeScale(str, Enum):
    NUMERICAL = "NUMERICAL"  # 0-20
    LITERAL = "LITERAL"      # AD, A, B, C

class AttendanceStatus(str, Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LATE = "LATE"
    EXCUSED = "EXCUSED"

# Carreras & Planes de Estudio
class Career(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str = Field(..., min_length=2, max_length=10)
    name: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    duration_semesters: int = Field(..., gt=0, le=12)
    total_credits: int = Field(..., gt=0, le=300)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudyPlan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    career_id: str
    code: str = Field(..., min_length=2, max_length=20)
    name: str = Field(..., min_length=3, max_length=200)
    plan_type: StudyPlanType = StudyPlanType.REGULAR
    academic_year: int = Field(..., ge=2020, le=2030)
    semester_count: int = Field(..., gt=0, le=12)
    total_credits: int = Field(..., gt=0, le=300)
    min_credits_per_semester: int = Field(default=12)
    max_credits_per_semester: int = Field(default=24)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CourseComplete(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str = Field(..., min_length=2, max_length=15)
    name: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    career_id: str
    study_plan_id: str
    semester: int = Field(..., ge=1, le=12)
    credits: int = Field(..., ge=1, le=8)
    course_type: CourseType = CourseType.MANDATORY
    prerequisite_course_ids: List[str] = Field(default_factory=list)
    is_active: bool = True
    theory_hours: int = Field(default=0, ge=0)
    practice_hours: int = Field(default=0, ge=0)
    lab_hours: int = Field(default=0, ge=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Section(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    course_id: str
    section_code: str = Field(..., min_length=1, max_length=10)
    teacher_id: str
    classroom: Optional[str] = None
    max_students: int = Field(default=30, ge=1, le=100)
    current_students: int = Field(default=0, ge=0)
    academic_year: int = Field(..., ge=2020, le=2030)
    academic_period: str = Field(..., min_length=1, max_length=10)  # "2025-I", "2025-II"
    schedule: List[Dict[str, str]] = Field(default_factory=list)  # [{"day": "MONDAY", "start": "08:00", "end": "10:00"}]
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Matrícula del Estudiante
class EnrollmentComplete(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    section_id: str
    course_id: str
    teacher_id: str
    academic_year: int = Field(..., ge=2020, le=2030)
    academic_period: str = Field(..., min_length=1, max_length=10)
    enrollment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: EnrollmentStatus = EnrollmentStatus.ACTIVE
    credits: int = Field(..., ge=1, le=8)
    
    # Calificaciones
    partial_grade_1: Optional[float] = Field(None, ge=0, le=20)
    partial_grade_2: Optional[float] = Field(None, ge=0, le=20)
    partial_grade_3: Optional[float] = Field(None, ge=0, le=20)
    final_grade: Optional[float] = Field(None, ge=0, le=20)
    final_numerical_grade: Optional[float] = Field(None, ge=0, le=20)
    final_literal_grade: Optional[str] = Field(None, pattern="^(AD|A|B|C)$")
    grade_locked: bool = False
    grade_locked_at: Optional[datetime] = None
    grade_locked_by: Optional[str] = None
    
    # Asistencia
    total_sessions: int = Field(default=0, ge=0)
    attended_sessions: int = Field(default=0, ge=0)
    attendance_percentage: float = Field(default=0.0, ge=0, le=100)
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AttendanceRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    section_id: str
    student_id: str
    enrollment_id: str
    session_date: date
    session_number: int = Field(..., ge=1)
    status: AttendanceStatus = AttendanceStatus.PRESENT
    notes: Optional[str] = None
    recorded_by: str
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Horarios
class Schedule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    section_id: str
    student_id: Optional[str] = None  # Si es para estudiante específico
    teacher_id: Optional[str] = None  # Si es para docente
    classroom: Optional[str] = None   # Si es para aula
    day_of_week: str = Field(..., regex="^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)$")
    start_time: str = Field(..., regex="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")  # HH:MM
    end_time: str = Field(..., regex="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")    # HH:MM
    academic_year: int = Field(..., ge=2020, le=2030)
    academic_period: str = Field(..., min_length=1, max_length=10)

# DTOs para Requests
class CareerCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=10)
    name: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    duration_semesters: int = Field(..., gt=0, le=12)
    total_credits: int = Field(..., gt=0, le=300)

class StudyPlanCreate(BaseModel):
    career_id: str
    code: str = Field(..., min_length=2, max_length=20)
    name: str = Field(..., min_length=3, max_length=200)
    plan_type: StudyPlanType = StudyPlanType.REGULAR
    academic_year: int = Field(..., ge=2020, le=2030)
    semester_count: int = Field(..., gt=0, le=12)
    total_credits: int = Field(..., gt=0, le=300)
    min_credits_per_semester: int = Field(default=12)
    max_credits_per_semester: int = Field(default=24)

class CourseCreateComplete(BaseModel):
    code: str = Field(..., min_length=2, max_length=15)
    name: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    career_id: str
    study_plan_id: str
    semester: int = Field(..., ge=1, le=12)
    credits: int = Field(..., ge=1, le=8)
    course_type: CourseType = CourseType.MANDATORY
    prerequisite_course_ids: List[str] = Field(default_factory=list)
    theory_hours: int = Field(default=0, ge=0)
    practice_hours: int = Field(default=0, ge=0)
    lab_hours: int = Field(default=0, ge=0)

class SectionCreate(BaseModel):
    course_id: str
    section_code: str = Field(..., min_length=1, max_length=10)
    teacher_id: str
    classroom: Optional[str] = None
    max_students: int = Field(default=30, ge=1, le=100)
    academic_year: int = Field(..., ge=2020, le=2030)
    academic_period: str = Field(..., min_length=1, max_length=10)
    schedule: List[Dict[str, str]] = Field(default_factory=list)

class EnrollmentRequest(BaseModel):
    student_id: str
    section_ids: List[str] = Field(..., min_items=1, max_items=8)

class GradeUpdate(BaseModel):
    enrollment_id: str
    partial_grade_1: Optional[float] = Field(None, ge=0, le=20)
    partial_grade_2: Optional[float] = Field(None, ge=0, le=20)
    partial_grade_3: Optional[float] = Field(None, ge=0, le=20)
    final_grade: Optional[float] = Field(None, ge=0, le=20)

class AttendanceUpdate(BaseModel):
    enrollment_id: str
    session_date: date
    session_number: int = Field(..., ge=1)
    status: AttendanceStatus = AttendanceStatus.PRESENT
    notes: Optional[str] = None

# =================== ENDPOINTS ACADÉMICOS COMPLETOS ===================

# A) CARRERAS & PLANES DE ESTUDIO

@academic_complete_router.get("/careers")
@performance_monitor
@simple_cache(ttl=300, key_prefix="careers")
async def get_careers(
    request: Request,
    is_active: bool = Query(True),
    current_user = Depends(get_current_user)
):
    """Obtener lista completa de carreras"""
    correlation_id = get_correlation_id(request)
    
    try:
        query = {"is_active": is_active} if is_active else {}
        careers = await db.careers.find(query).sort("name", 1).to_list(length=None)
        
        return {
            "careers": [Career(**career) for career in careers],
            "total": len(careers),
            "correlation_id": correlation_id
        }
    except Exception as e:
        log_with_correlation(logger, "error", f"Error getting careers: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al obtener carreras",
            correlation_id=correlation_id,
            status_code=500
        )

@academic_complete_router.post("/careers")
@performance_monitor
@require_permission(ResourceType.COURSE, Permission.CREATE)
async def create_career(
    career_data: CareerCreate,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Crear nueva carrera"""
    correlation_id = get_correlation_id(request)
    
    try:
        # Verificar código único
        existing = await db.careers.find_one({"code": career_data.code})
        if existing:
            return ErrorResponse.create(
                code=ErrorCodes.DUPLICATE_RESOURCE,
                message=f"Carrera con código {career_data.code} ya existe",
                correlation_id=correlation_id,
                status_code=400
            )
        
        career = Career(**career_data.dict())
        await db.careers.insert_one(career.dict())
        
        log_with_correlation(
            logger, "info", f"Career created: {career.code}",
            request, user_data={"id": current_user.id, "role": current_user.role}
        )
        
        return {
            "career": career,
            "message": "Carrera creada exitosamente",
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error creating career: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al crear carrera",
            correlation_id=correlation_id,
            status_code=500
        )

@academic_complete_router.get("/study-plans")
@performance_monitor
@simple_cache(ttl=300, key_prefix="study_plans")
async def get_study_plans(
    request: Request,
    career_id: Optional[str] = Query(None),
    is_active: bool = Query(True),
    current_user = Depends(get_current_user)
):
    """Obtener planes de estudio"""
    correlation_id = get_correlation_id(request)
    
    try:
        query = {"is_active": is_active} if is_active else {}
        if career_id:
            query["career_id"] = career_id
        
        # Usar aggregation para incluir información de carrera
        pipeline = [
            {"$match": query},
            {
                "$lookup": {
                    "from": "careers",
                    "localField": "career_id",
                    "foreignField": "id",
                    "as": "career_info"
                }
            },
            {
                "$addFields": {
                    "career_name": {"$arrayElemAt": ["$career_info.name", 0]}
                }
            },
            {"$sort": {"academic_year": -1, "name": 1}}
        ]
        
        plans_cursor = db.study_plans.aggregate(pipeline)
        plans = await plans_cursor.to_list(length=None)
        
        return {
            "study_plans": plans,
            "total": len(plans),
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error getting study plans: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al obtener planes de estudio",
            correlation_id=correlation_id,
            status_code=500
        )

@academic_complete_router.post("/study-plans")
@performance_monitor
@require_permission(ResourceType.COURSE, Permission.CREATE)
async def create_study_plan(
    plan_data: StudyPlanCreate,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Crear nuevo plan de estudios"""
    correlation_id = get_correlation_id(request)
    
    try:
        # Verificar que la carrera existe
        career = await db.careers.find_one({"id": plan_data.career_id})
        if not career:
            return ErrorResponse.create(
                code=ErrorCodes.NOT_FOUND,
                message="Carrera no encontrada",
                correlation_id=correlation_id,
                status_code=404
            )
        
        # Verificar código único
        existing = await db.study_plans.find_one({"code": plan_data.code})
        if existing:
            return ErrorResponse.create(
                code=ErrorCodes.DUPLICATE_RESOURCE,
                message=f"Plan de estudios con código {plan_data.code} ya existe",
                correlation_id=correlation_id,
                status_code=400
            )
        
        study_plan = StudyPlan(**plan_data.dict())
        await db.study_plans.insert_one(study_plan.dict())
        
        log_with_correlation(
            logger, "info", f"Study plan created: {study_plan.code}",
            request, user_data={"id": current_user.id, "role": current_user.role}
        )
        
        return {
            "study_plan": study_plan,
            "message": "Plan de estudios creado exitosamente",
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error creating study plan: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al crear plan de estudios",
            correlation_id=correlation_id,
            status_code=500
        )

# B) CURSOS & SECCIONES COMPLETOS

@academic_complete_router.get("/courses")
@performance_monitor
async def get_courses_complete(
    request: Request,
    career_id: Optional[str] = Query(None),
    study_plan_id: Optional[str] = Query(None),
    semester: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user = Depends(get_current_user)
):
    """Obtener cursos completos con información agregada"""
    correlation_id = get_correlation_id(request)
    
    try:
        # Usar el optimizador de queries existente pero mejorado
        result = await OptimizedQueries.get_courses_with_enrollments_optimized(
            db, career_id, semester, skip, limit
        )
        
        return {
            **result,
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error getting courses: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al obtener cursos",
            correlation_id=correlation_id,
            status_code=500
        )

@academic_complete_router.post("/courses")
@performance_monitor
@require_permission(ResourceType.COURSE, Permission.CREATE)
async def create_course_complete(
    course_data: CourseCreateComplete,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Crear curso completo con validaciones"""
    correlation_id = get_correlation_id(request)
    
    try:
        # Validar que carrera y plan de estudios existen
        career = await db.careers.find_one({"id": course_data.career_id})
        if not career:
            return ErrorResponse.create(
                code=ErrorCodes.NOT_FOUND,
                message="Carrera no encontrada",
                correlation_id=correlation_id,
                status_code=404
            )
        
        study_plan = await db.study_plans.find_one({"id": course_data.study_plan_id})
        if not study_plan:
            return ErrorResponse.create(
                code=ErrorCodes.NOT_FOUND,
                message="Plan de estudios no encontrado",
                correlation_id=correlation_id,
                status_code=404
            )
        
        # Verificar código único
        existing = await db.courses.find_one({"code": course_data.code})
        if existing:
            return ErrorResponse.create(
                code=ErrorCodes.DUPLICATE_RESOURCE,
                message=f"Curso con código {course_data.code} ya existe",
                correlation_id=correlation_id,
                status_code=400
            )
        
        # Validar prerrequisitos existen
        if course_data.prerequisite_course_ids:
            prereq_count = await db.courses.count_documents({
                "id": {"$in": course_data.prerequisite_course_ids}
            })
            if prereq_count != len(course_data.prerequisite_course_ids):
                return ErrorResponse.create(
                    code=ErrorCodes.VALIDATION_ERROR,
                    message="Uno o más prerrequisitos no existen",
                    correlation_id=correlation_id,
                    status_code=400
                )
        
        course = CourseComplete(**course_data.dict())
        await db.courses.insert_one(course.dict())
        
        log_with_correlation(
            logger, "info", f"Course created: {course.code}",
            request, user_data={"id": current_user.id, "role": current_user.role}
        )
        
        return {
            "course": course,
            "message": "Curso creado exitosamente",
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error creating course: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al crear curso",
            correlation_id=correlation_id,
            status_code=500
        )

@academic_complete_router.get("/sections")
@performance_monitor
async def get_sections(
    request: Request,
    course_id: Optional[str] = Query(None),
    teacher_id: Optional[str] = Query(None),
    academic_year: Optional[int] = Query(None),
    academic_period: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user = Depends(get_current_user)
):
    """Obtener secciones con información completa"""
    correlation_id = get_correlation_id(request)
    
    try:
        match_conditions = {"is_active": True}
        if course_id:
            match_conditions["course_id"] = course_id
        if teacher_id:
            match_conditions["teacher_id"] = teacher_id
        if academic_year:
            match_conditions["academic_year"] = academic_year
        if academic_period:
            match_conditions["academic_period"] = academic_period
        
        # Aggregation pipeline para información completa
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
                    "teacher_name": {"$arrayElemAt": ["$teacher_info.full_name", 0]}
                }
            },
            {"$sort": {"academic_year": -1, "academic_period": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        sections_cursor = db.sections.aggregate(pipeline)
        sections = await sections_cursor.to_list(length=limit)
        
        # Total count
        total = await db.sections.count_documents(match_conditions)
        
        return {
            "sections": sections,
            "total": total,
            "skip": skip,
            "limit": limit,
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error getting sections: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al obtener secciones",
            correlation_id=correlation_id,
            status_code=500
        )