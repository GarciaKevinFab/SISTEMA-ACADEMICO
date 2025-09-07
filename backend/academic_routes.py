from fastapi import APIRouter, HTTPException, Depends, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timezone
import uuid

from academic_models import *
from academic_enums import *
from server import get_current_user, db, logger

academic_router = APIRouter(prefix="/academic", tags=["Academic"])

# Dashboard and Statistics
@academic_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user = Depends(get_current_user)):
    """Get dashboard statistics based on user role"""
    try:
        stats = {}
        
        if current_user['role'] == 'ADMIN':
            # Admin sees all stats
            total_students = await db.students.count_documents({"status": "ENROLLED"})
            total_courses = await db.courses.count_documents({"is_active": True})
            active_enrollments = await db.enrollments.count_documents({"status": "ACTIVE"})
            pending_procedures = await db.procedures.count_documents({"status": "RECEIVED"})
            
            stats = {
                "total_students": total_students,
                "total_courses": total_courses,
                "active_enrollments": active_enrollments,
                "pending_procedures": pending_procedures
            }
            
        elif current_user['role'] == 'TEACHER':
            # Teacher sees their assigned courses and pending grades
            my_courses = await db.enrollments.count_documents({"teacher_id": current_user['id']})
            pending_grades = await db.enrollments.count_documents({
                "teacher_id": current_user['id'],
                "grade_status": "INCOMPLETE"
            })
            
            stats = {
                "my_courses": my_courses,
                "pending_grades": pending_grades
            }
            
        elif current_user['role'] == 'STUDENT':
            # Student sees their enrollments and approved courses
            my_enrollments = await db.enrollments.count_documents({"student_id": current_user['id']})
            approved_courses = await db.enrollments.count_documents({
                "student_id": current_user['id'],
                "grade_status": "APPROVED"
            })
            
            stats = {
                "my_enrollments": my_enrollments,
                "approved_courses": approved_courses
            }
        
        return {"stats": stats}
        
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener estadísticas")

# Students Management
@academic_router.post("/students", response_model=Student)
async def create_student(student_data: StudentCreate, current_user = Depends(get_current_user)):
    """Create a new student"""
    try:
        # Check permissions
        if current_user['role'] not in ['ADMIN', 'REGISTRAR']:
            raise HTTPException(status_code=403, detail="No autorizado para crear estudiantes")
        
        # Check if student already exists
        existing_student = await db.students.find_one({
            "document_number": student_data.document_number
        })
        
        if existing_student:
            raise HTTPException(status_code=400, detail="Ya existe un estudiante con este documento")
        
        # Create student
        student = Student(**student_data.dict(), created_by=current_user['id'])
        student_dict = student.dict()
        
        # Convert date objects to strings for MongoDB
        if isinstance(student_dict.get('birth_date'), date):
            student_dict['birth_date'] = student_dict['birth_date'].isoformat()
        if isinstance(student_dict.get('created_at'), datetime):
            student_dict['created_at'] = student_dict['created_at'].isoformat()
        if isinstance(student_dict.get('updated_at'), datetime):
            student_dict['updated_at'] = student_dict['updated_at'].isoformat()
        
        await db.students.insert_one(student_dict)
        
        logger.info(f"Student created: {student.student_code} by {current_user['username']}")
        return student
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating student: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al crear estudiante")

@academic_router.get("/students", response_model=Dict[str, Any])
async def get_students(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    program: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user = Depends(get_current_user)
):
    """Get students with filtering and pagination"""
    try:
        # Build query
        query = {}
        
        if program and program != 'ALL':
            query["program"] = program
            
        if status and status != 'ALL':
            query["status"] = status
            
        if search:
            query["$or"] = [
                {"first_name": {"$regex": search, "$options": "i"}},
                {"last_name": {"$regex": search, "$options": "i"}},
                {"document_number": {"$regex": search, "$options": "i"}},
                {"student_code": {"$regex": search, "$options": "i"}}
            ]
        
        # Get students
        students_cursor = db.students.find(query).skip(skip).limit(limit)
        students = await students_cursor.to_list(length=limit)
        
        # Parse dates back from strings
        for student in students:
            if isinstance(student.get('birth_date'), str):
                student['birth_date'] = datetime.fromisoformat(student['birth_date']).date()
            if isinstance(student.get('created_at'), str):
                student['created_at'] = datetime.fromisoformat(student['created_at'])
            if isinstance(student.get('updated_at'), str):
                student['updated_at'] = datetime.fromisoformat(student['updated_at'])
        
        total = await db.students.count_documents(query)
        
        return {
            "students": students,
            "total": total,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"Error fetching students: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener estudiantes")

@academic_router.get("/students/{student_id}", response_model=Student)
async def get_student(student_id: str, current_user = Depends(get_current_user)):
    """Get student by ID"""
    try:
        student = await db.students.find_one({"id": student_id})
        
        if not student:
            raise HTTPException(status_code=404, detail="Estudiante no encontrado")
        
        # Parse dates back from strings
        if isinstance(student.get('birth_date'), str):
            student['birth_date'] = datetime.fromisoformat(student['birth_date']).date()
        if isinstance(student.get('created_at'), str):
            student['created_at'] = datetime.fromisoformat(student['created_at'])
        if isinstance(student.get('updated_at'), str):
            student['updated_at'] = datetime.fromisoformat(student['updated_at'])
        
        return Student(**student)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching student {student_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener estudiante")

# Courses Management
@academic_router.post("/courses", response_model=Course)
async def create_course(course_data: CourseCreate, current_user = Depends(get_current_user)):
    """Create a new course"""
    try:
        # Check permissions
        if current_user['role'] not in ['ADMIN', 'REGISTRAR']:
            raise HTTPException(status_code=403, detail="No autorizado para crear cursos")
        
        # Check if course code already exists
        existing_course = await db.courses.find_one({"code": course_data.code})
        
        if existing_course:
            raise HTTPException(status_code=400, detail="Ya existe un curso con este código")
        
        # Create course
        course = Course(**course_data.dict())
        course_dict = course.dict()
        
        # Convert datetime to string for MongoDB
        if isinstance(course_dict.get('created_at'), datetime):
            course_dict['created_at'] = course_dict['created_at'].isoformat()
        
        await db.courses.insert_one(course_dict)
        
        logger.info(f"Course created: {course.code} by {current_user['username']}")
        return course
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating course: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al crear curso")

@academic_router.get("/courses", response_model=Dict[str, Any])
async def get_courses(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    program: Optional[str] = Query(None),
    semester: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user = Depends(get_current_user)
):
    """Get courses with filtering and pagination"""
    try:
        # Build query
        query = {}
        
        if program and program != 'ALL':
            query["program"] = program
            
        if semester:
            query["semester"] = semester
            
        if is_active is not None:
            query["is_active"] = is_active
        
        # Get courses
        courses_cursor = db.courses.find(query).skip(skip).limit(limit)
        courses = await courses_cursor.to_list(length=limit)
        
        # Parse dates back from strings
        for course in courses:
            if isinstance(course.get('created_at'), str):
                course['created_at'] = datetime.fromisoformat(course['created_at'])
        
        total = await db.courses.count_documents(query)
        
        return {
            "courses": courses,
            "total": total,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"Error fetching courses: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener cursos")

# Enrollments Management
@academic_router.post("/enrollments", response_model=Enrollment)
async def create_enrollment(enrollment_data: EnrollmentCreate, current_user = Depends(get_current_user)):
    """Create a new enrollment"""
    try:
        # Check permissions
        if current_user['role'] not in ['ADMIN', 'REGISTRAR']:
            raise HTTPException(status_code=403, detail="No autorizado para crear matrículas")
        
        # Validate student exists
        student = await db.students.find_one({"id": enrollment_data.student_id})
        if not student:
            raise HTTPException(status_code=404, detail="Estudiante no encontrado")
        
        # Validate course exists
        course = await db.courses.find_one({"id": enrollment_data.course_id})
        if not course:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        
        # Check if enrollment already exists
        existing_enrollment = await db.enrollments.find_one({
            "student_id": enrollment_data.student_id,
            "course_id": enrollment_data.course_id,
            "academic_year": enrollment_data.academic_year,
            "academic_period": enrollment_data.academic_period
        })
        
        if existing_enrollment:
            raise HTTPException(status_code=400, detail="El estudiante ya está matriculado en este curso")
        
        # Create enrollment
        enrollment = Enrollment(**enrollment_data.dict())
        enrollment_dict = enrollment.dict()
        
        # Convert datetime to string for MongoDB
        if isinstance(enrollment_dict.get('enrollment_date'), datetime):
            enrollment_dict['enrollment_date'] = enrollment_dict['enrollment_date'].isoformat()
        if isinstance(enrollment_dict.get('created_at'), datetime):
            enrollment_dict['created_at'] = enrollment_dict['created_at'].isoformat()
        if isinstance(enrollment_dict.get('updated_at'), datetime):
            enrollment_dict['updated_at'] = enrollment_dict['updated_at'].isoformat()
        
        await db.enrollments.insert_one(enrollment_dict)
        
        logger.info(f"Enrollment created: {enrollment.id} by {current_user['username']}")
        return enrollment
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating enrollment: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al crear matrícula")

@academic_router.get("/enrollments", response_model=Dict[str, Any])
async def get_enrollments(
    student_id: Optional[str] = Query(None),
    course_id: Optional[str] = Query(None),
    academic_year: Optional[int] = Query(None),
    academic_period: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user = Depends(get_current_user)
):
    """Get enrollments with filtering and pagination"""
    try:
        # Build query
        query = {}
        
        if student_id:
            query["student_id"] = student_id
            
        if course_id:
            query["course_id"] = course_id
            
        if academic_year:
            query["academic_year"] = academic_year
            
        if academic_period and academic_period != 'ALL':
            query["academic_period"] = academic_period
            
        if status and status != 'ALL':
            query["status"] = status
        
        # Get enrollments with student and course details
        pipeline = [
            {"$match": query},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$lookup": {
                    "from": "students",
                    "localField": "student_id",
                    "foreignField": "id",
                    "as": "student_info"
                }
            },
            {
                "$lookup": {
                    "from": "courses",
                    "localField": "course_id", 
                    "foreignField": "id",
                    "as": "course_info"
                }
            }
        ]
        
        enrollments = await db.enrollments.aggregate(pipeline).to_list(length=limit)
        
        # Parse dates back from strings
        for enrollment in enrollments:
            if isinstance(enrollment.get('enrollment_date'), str):
                enrollment['enrollment_date'] = datetime.fromisoformat(enrollment['enrollment_date'])
            if isinstance(enrollment.get('created_at'), str):
                enrollment['created_at'] = datetime.fromisoformat(enrollment['created_at'])
            if isinstance(enrollment.get('updated_at'), str):
                enrollment['updated_at'] = datetime.fromisoformat(enrollment['updated_at'])
        
        total = await db.enrollments.count_documents(query)
        
        return {
            "enrollments": enrollments,
            "total": total,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"Error fetching enrollments: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener matrículas")

# Grades Management
@academic_router.put("/enrollments/{enrollment_id}/grade")
async def update_grade(
    enrollment_id: str, 
    grade_data: GradeUpdate, 
    current_user = Depends(get_current_user)
):
    """Update enrollment grades"""
    try:
        # Check permissions
        if current_user['role'] not in ['ADMIN', 'TEACHER']:
            raise HTTPException(status_code=403, detail="No autorizado para actualizar calificaciones")
        
        # Get enrollment
        enrollment = await db.enrollments.find_one({"id": enrollment_id})
        if not enrollment:
            raise HTTPException(status_code=404, detail="Matrícula no encontrada")
        
        # If teacher, verify they are assigned to this course
        if current_user['role'] == 'TEACHER' and enrollment.get('teacher_id') != current_user['id']:
            raise HTTPException(status_code=403, detail="No autorizado para calificar este curso")
        
        # Convert numerical grade to literal grade
        literal_grade = "C"
        if grade_data.numerical_grade >= 18:
            literal_grade = "AD"
        elif grade_data.numerical_grade >= 14:
            literal_grade = "A"
        elif grade_data.numerical_grade >= 11:
            literal_grade = "B"
        
        # Update enrollment
        update_data = {
            "numerical_grade": grade_data.numerical_grade,
            "literal_grade": literal_grade,
            "grade_status": grade_data.grade_status.value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": update_data}
        )
        
        logger.info(f"Grade updated for enrollment {enrollment_id} by {current_user['username']}")
        
        return {"message": "Calificación actualizada exitosamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating grade: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al actualizar calificación")

# Attendance Management
@academic_router.put("/enrollments/{enrollment_id}/attendance")
async def update_attendance(
    enrollment_id: str,
    attendance_data: AttendanceUpdate,
    current_user = Depends(get_current_user)
):
    """Update enrollment attendance"""
    try:
        # Check permissions
        if current_user['role'] not in ['ADMIN', 'TEACHER']:
            raise HTTPException(status_code=403, detail="No autorizado para actualizar asistencia")
        
        # Get enrollment
        enrollment = await db.enrollments.find_one({"id": enrollment_id})
        if not enrollment:
            raise HTTPException(status_code=404, detail="Matrícula no encontrada")
        
        # If teacher, verify they are assigned to this course
        if current_user['role'] == 'TEACHER' and enrollment.get('teacher_id') != current_user['id']:
            raise HTTPException(status_code=403, detail="No autorizado para registrar asistencia de este curso")
        
        # Calculate attendance percentage
        attendance_percentage = 0.0
        if attendance_data.total_classes > 0:
            attendance_percentage = (attendance_data.attended_classes / attendance_data.total_classes) * 100
        
        # Update enrollment
        update_data = {
            "total_classes": attendance_data.total_classes,
            "attended_classes": attendance_data.attended_classes,
            "attendance_percentage": round(attendance_percentage, 2),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": update_data}
        )
        
        logger.info(f"Attendance updated for enrollment {enrollment_id} by {current_user['username']}")
        
        return {"message": "Asistencia actualizada exitosamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating attendance: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al actualizar asistencia")

# Academic Periods Management
@academic_router.get("/academic-periods", response_model=Dict[str, Any])
async def get_academic_periods(current_user = Depends(get_current_user)):
    """Get academic periods"""
    try:
        periods = await db.academic_periods.find({}).to_list(length=None)
        
        # Parse dates back from strings
        for period in periods:
            if isinstance(period.get('start_date'), str):
                period['start_date'] = datetime.fromisoformat(period['start_date']).date()
            if isinstance(period.get('end_date'), str):
                period['end_date'] = datetime.fromisoformat(period['end_date']).date()
            if isinstance(period.get('created_at'), str):
                period['created_at'] = datetime.fromisoformat(period['created_at'])
        
        return {"periods": periods}
        
    except Exception as e:
        logger.error(f"Error fetching academic periods: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener períodos académicos")

# Reports
@academic_router.get("/reports/student-grades/{student_id}")
async def get_student_grades_report(student_id: str, current_user = Depends(get_current_user)):
    """Get student grades report"""
    try:
        # Verify student exists
        student = await db.students.find_one({"id": student_id})
        if not student:
            raise HTTPException(status_code=404, detail="Estudiante no encontrado")
        
        # Get enrollments with grades
        enrollments = await db.enrollments.find({
            "student_id": student_id,
            "numerical_grade": {"$exists": True, "$ne": None}
        }).to_list(length=None)
        
        # Get course details for each enrollment
        enriched_enrollments = []
        for enrollment in enrollments:
            course = await db.courses.find_one({"id": enrollment['course_id']})
            if course:
                enrollment['course_name'] = course['name']
                enrollment['course_code'] = course['code']
                enrollment['credits'] = course['credits']
                enriched_enrollments.append(enrollment)
        
        # Calculate GPA
        total_points = sum(e['numerical_grade'] * e.get('credits', 0) for e in enriched_enrollments)
        total_credits = sum(e.get('credits', 0) for e in enriched_enrollments)
        gpa = round(total_points / total_credits, 2) if total_credits > 0 else 0.0
        
        return {
            "student": student,
            "enrollments": enriched_enrollments,
            "gpa": gpa,
            "total_credits": total_credits,
            "completed_courses": len(enriched_enrollments)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating student grades report: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al generar reporte de notas")

@academic_router.get("/reports/course-enrollment/{course_id}")
async def get_course_enrollment_report(course_id: str, current_user = Depends(get_current_user)):
    """Get course enrollment report"""
    try:
        # Verify course exists
        course = await db.courses.find_one({"id": course_id})
        if not course:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        
        # Get enrollments for this course
        enrollments = await db.enrollments.find({"course_id": course_id}).to_list(length=None)
        
        # Get student details for each enrollment
        enriched_enrollments = []
        for enrollment in enrollments:
            student = await db.students.find_one({"id": enrollment['student_id']})
            if student:
                enrollment['student_name'] = f"{student['first_name']} {student['last_name']}"
                enrollment['student_code'] = student['student_code']
                enrollment['student_program'] = student['program']
                enriched_enrollments.append(enrollment)
        
        return {
            "course": course,
            "enrollments": enriched_enrollments,
            "total_enrolled": len(enriched_enrollments),
            "approved_count": len([e for e in enriched_enrollments if e.get('grade_status') == 'APPROVED']),
            "failed_count": len([e for e in enriched_enrollments if e.get('grade_status') == 'FAILED']),
            "pending_count": len([e for e in enriched_enrollments if e.get('grade_status') == 'INCOMPLETE'])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating course enrollment report: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al generar reporte de matrícula")