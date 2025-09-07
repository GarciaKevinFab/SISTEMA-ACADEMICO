# Academic Module API Routes - Complete Implementation

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timezone
from models import *
from academic_models import *
from finance_utils import log_audit_trail, prepare_for_mongo
import uuid

academic_router = APIRouter(prefix="/academic", tags=["Academic"])

# ====================================================================================================
# CAREER & CURRICULAR PLAN MANAGEMENT
# ====================================================================================================

@academic_router.post("/careers")
async def create_career(
    career_data: CareerCreate,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ACADEMIC_STAFF]))
):
    """Create new career program"""
    
    # Check if career code already exists
    existing_career = await db.careers.find_one({"code": career_data.code})
    if existing_career:
        raise HTTPException(status_code=400, detail="Career code already exists")
    
    career = Career(**career_data.dict())
    career_doc = prepare_for_mongo(career.dict())
    
    await db.careers.insert_one(career_doc)
    
    # Create default study plan
    study_plan_data = generate_study_plan(career.id, 10)  # Default 10 semesters
    await db.curricular_plans.insert_one(study_plan_data)
    
    await log_audit_trail(
        db, "careers", career.id, "CREATE",
        None, career_doc, current_user.id
    )
    
    return {"status": "success", "career": career}

@academic_router.get("/careers")
async def get_careers(
    is_active: bool = True,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get all careers"""
    
    filter_query = {"is_active": is_active}
    
    careers = await db.careers.find(filter_query).skip(skip).limit(limit).to_list(limit)
    total = await db.careers.count_documents(filter_query)
    
    return {
        "careers": [Career(**career) for career in careers],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@academic_router.post("/courses")
async def create_course(
    course_data: CourseCreate,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ACADEMIC_STAFF]))
):
    """Create new course"""
    
    # Check if course code already exists for the program
    existing_course = await db.courses.find_one({
        "code": course_data.code,
        "program": course_data.program
    })
    if existing_course:
        raise HTTPException(status_code=400, detail="Course code already exists for this program")
    
    course = Course(**course_data.dict())
    course_doc = prepare_for_mongo(course.dict())
    
    await db.courses.insert_one(course_doc)
    
    await log_audit_trail(
        db, "courses", course.id, "CREATE",
        None, course_doc, current_user.id
    )
    
    return {"status": "success", "course": course}

@academic_router.get("/courses")
async def get_courses(
    program: Optional[str] = None,
    semester: Optional[int] = None,
    is_active: bool = True,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get courses with filters"""
    
    filter_query = {"is_active": is_active}
    if program:
        filter_query["program"] = program
    if semester:
        filter_query["semester"] = semester
    
    courses = await db.courses.find(filter_query).skip(skip).limit(limit).to_list(limit)
    total = await db.courses.count_documents(filter_query)
    
    return {
        "courses": [Course(**course) for course in courses],
        "total": total,
        "skip": skip,
        "limit": limit
    }

# ====================================================================================================
# ACADEMIC PERIODS MANAGEMENT
# ====================================================================================================

@academic_router.post("/periods")
async def create_academic_period(
    period_data: AcademicPeriod,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ACADEMIC_STAFF]))
):
    """Create new academic period"""
    
    # Check for overlapping periods
    existing_period = await db.academic_periods.find_one({
        "year": period_data.year,
        "period": period_data.period
    })
    if existing_period:
        raise HTTPException(
            status_code=400, 
            detail=f"Academic period {period_data.year}-{period_data.period} already exists"
        )
    
    # If this is set as current, update other periods
    if period_data.is_current:
        await db.academic_periods.update_many(
            {"is_current": True},
            {"$set": {"is_current": False}}
        )
    
    period_doc = prepare_for_mongo(period_data.dict())
    await db.academic_periods.insert_one(period_doc)
    
    await log_audit_trail(
        db, "academic_periods", period_data.id, "CREATE",
        None, period_doc, current_user.id
    )
    
    return {"status": "success", "period": period_data}

@academic_router.get("/periods")
async def get_academic_periods(
    year: Optional[int] = None,
    is_active: bool = True,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get academic periods"""
    
    filter_query = {"is_active": is_active}
    if year:
        filter_query["year"] = year
    
    periods = await db.academic_periods.find(filter_query).sort("year", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.academic_periods.count_documents(filter_query)
    
    return {
        "periods": [AcademicPeriod(**period) for period in periods],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@academic_router.get("/periods/current")
async def get_current_period(current_user: User = Depends(get_current_user)):
    """Get current academic period"""
    
    current_period = await db.academic_periods.find_one({"is_current": True})
    if not current_period:
        raise HTTPException(status_code=404, detail="No current academic period set")
    
    return {"period": AcademicPeriod(**current_period)}

# ====================================================================================================
# ENROLLMENT MANAGEMENT
# ====================================================================================================

@academic_router.post("/enrollments")
async def create_enrollment(
    enrollment_data: EnrollmentCreate,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REGISTRAR, UserRole.STUDENT]))
):
    """Create new enrollment with validation"""
    
    # Validate student exists
    student = await db.students.find_one({"id": enrollment_data.student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Validate course exists
    course = await db.courses.find_one({"id": enrollment_data.course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Check if enrollment already exists for this period
    existing_enrollment = await db.enrollments.find_one({
        "student_id": enrollment_data.student_id,
        "course_id": enrollment_data.course_id,
        "academic_year": enrollment_data.academic_year,
        "academic_period": enrollment_data.academic_period
    })
    if existing_enrollment:
        raise HTTPException(status_code=400, detail="Student already enrolled in this course for this period")
    
    # Get student's current enrollments for validation
    current_enrollments = await db.enrollments.find({
        "student_id": enrollment_data.student_id,
        "academic_year": enrollment_data.academic_year,
        "academic_period": enrollment_data.academic_period,
        "status": "ACTIVE"
    }).to_list(100)
    
    # Get course prerequisites
    prerequisites = await db.course_prerequisites.find({"course_id": enrollment_data.course_id}).to_list(100)
    
    # Validate enrollment requirements
    validation = validate_enrollment_requirements(
        current_enrollments, 
        [CoursePrerequisite(**p) for p in prerequisites],
        enrollment_data.course_id
    )
    
    if not validation.can_enroll:
        raise HTTPException(status_code=400, detail=f"Enrollment not allowed: {', '.join(validation.errors)}")
    
    # Create enrollment
    enrollment = Enrollment(**enrollment_data.dict())
    enrollment_doc = prepare_for_mongo(enrollment.dict())
    
    await db.enrollments.insert_one(enrollment_doc)
    
    # Create grade components for the course
    grade_components = await db.grade_components.find({"course_id": enrollment_data.course_id}).to_list(100)
    for component in grade_components:
        student_grade = StudentGrade(
            enrollment_id=enrollment.id,
            grade_component_id=component["id"],
            graded_by=current_user.id
        )
        grade_doc = prepare_for_mongo(student_grade.dict())
        await db.student_grades.insert_one(grade_doc)
    
    await log_audit_trail(
        db, "enrollments", enrollment.id, "CREATE",
        None, enrollment_doc, current_user.id
    )
    
    return {
        "status": "success", 
        "enrollment": enrollment,
        "validation_warnings": validation.warnings
    }

@academic_router.get("/enrollments")
async def get_enrollments(
    student_id: Optional[str] = None,
    course_id: Optional[str] = None,
    academic_year: Optional[int] = None,
    academic_period: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get enrollments with filters"""
    
    filter_query = {}
    if student_id:
        filter_query["student_id"] = student_id
    if course_id:
        filter_query["course_id"] = course_id
    if academic_year:
        filter_query["academic_year"] = academic_year
    if academic_period:
        filter_query["academic_period"] = academic_period
    if status:
        filter_query["status"] = status
    
    enrollments = await db.enrollments.find(filter_query).skip(skip).limit(limit).to_list(limit)
    total = await db.enrollments.count_documents(filter_query)
    
    # Enrich with student and course data
    enriched_enrollments = []
    for enrollment in enrollments:
        student = await db.students.find_one({"id": enrollment["student_id"]})
        course = await db.courses.find_one({"id": enrollment["course_id"]})
        
        enriched_enrollment = {
            **enrollment,
            "student": Student(**student) if student else None,
            "course": Course(**course) if course else None
        }
        enriched_enrollments.append(enriched_enrollment)
    
    return {
        "enrollments": enriched_enrollments,
        "total": total,
        "skip": skip,
        "limit": limit
    }

# ====================================================================================================
# GRADES MANAGEMENT
# ====================================================================================================

@academic_router.post("/grades")
async def update_grade(
    enrollment_id: str,
    component_id: str,
    grade_data: GradeUpdate,
    current_user: User = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN, UserRole.ACADEMIC_STAFF]))
):
    """Update student grade for specific component"""
    
    # Validate enrollment exists
    enrollment = await db.enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Check if teacher is authorized for this course (if not admin)
    if current_user.role == UserRole.TEACHER:
        if enrollment.get("teacher_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to grade this course")
    
    # Find and update grade
    grade = await db.student_grades.find_one({
        "enrollment_id": enrollment_id,
        "grade_component_id": component_id
    })
    
    if not grade:
        raise HTTPException(status_code=404, detail="Grade component not found for this enrollment")
    
    # Determine literal grade
    literal_grade = "C"
    if grade_data.numerical_grade >= 17:
        literal_grade = "AD"
    elif grade_data.numerical_grade >= 14:
        literal_grade = "A"
    elif grade_data.numerical_grade >= 11:
        literal_grade = "B"
    
    update_data = {
        "score": grade_data.numerical_grade,
        "literal_grade": literal_grade,
        "grade_status": grade_data.grade_status.value,
        "comments": grade_data.comments,
        "graded_by": current_user.id,
        "graded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.student_grades.update_one(
        {"id": grade["id"]},
        {"$set": update_data}
    )
    
    # Calculate final grade for enrollment
    await calculate_final_grade(enrollment_id)
    
    await log_audit_trail(
        db, "student_grades", grade["id"], "UPDATE",
        {"score": grade.get("score")}, update_data, current_user.id
    )
    
    return {"status": "success", "message": "Grade updated successfully"}

async def calculate_final_grade(enrollment_id: str):
    """Calculate final grade based on all components"""
    
    # Get all grades for the enrollment
    grades = await db.student_grades.find({"enrollment_id": enrollment_id}).to_list(100)
    
    if not grades:
        return
    
    # Get grade components to calculate weighted average
    total_weight = 0
    weighted_score = 0
    
    for grade_record in grades:
        if grade_record.get("score") is not None:
            component = await db.grade_components.find_one({"id": grade_record["grade_component_id"]})
            if component:
                weight = component.get("weight_percentage", 0) / 100
                weighted_score += grade_record["score"] * weight
                total_weight += weight
    
    if total_weight > 0:
        final_numerical = round(weighted_score, 2)
        
        # Determine final status
        final_status = GradeStatus.APPROVED if final_numerical >= 11 else GradeStatus.FAILED
        final_literal = "C"
        if final_numerical >= 17:
            final_literal = "AD"
        elif final_numerical >= 14:
            final_literal = "A"
        elif final_numerical >= 11:
            final_literal = "B"
        
        # Update enrollment with final grade
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {
                "$set": {
                    "numerical_grade": final_numerical,
                    "literal_grade": final_literal,
                    "grade_status": final_status.value,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )

@academic_router.get("/grades/enrollment/{enrollment_id}")
async def get_enrollment_grades(
    enrollment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all grades for an enrollment"""
    
    # Validate enrollment exists
    enrollment = await db.enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Check authorization
    if current_user.role == UserRole.STUDENT:
        if enrollment["student_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Can only view your own grades")
    elif current_user.role == UserRole.TEACHER:
        if enrollment.get("teacher_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Can only view grades for your courses")
    
    # Get grades with component details
    grades = await db.student_grades.find({"enrollment_id": enrollment_id}).to_list(100)
    
    enriched_grades = []
    for grade in grades:
        component = await db.grade_components.find_one({"id": grade["grade_component_id"]})
        enriched_grades.append({
            **grade,
            "component": GradeComponent(**component) if component else None
        })
    
    return {
        "enrollment_id": enrollment_id,
        "grades": enriched_grades,
        "final_grade": {
            "numerical": enrollment.get("numerical_grade"),
            "literal": enrollment.get("literal_grade"),
            "status": enrollment.get("grade_status")
        }
    }

# ====================================================================================================
# ATTENDANCE MANAGEMENT
# ====================================================================================================

@academic_router.post("/attendance/sessions")
async def create_attendance_session(
    session_data: AttendanceSession,
    current_user: User = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))
):
    """Create attendance session"""
    
    # Validate course exists and teacher is authorized
    course = await db.courses.find_one({"id": session_data.course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if current_user.role == UserRole.TEACHER and session_data.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only create sessions for your courses")
    
    session_doc = prepare_for_mongo(session_data.dict())
    await db.attendance_sessions.insert_one(session_doc)
    
    await log_audit_trail(
        db, "attendance_sessions", session_data.id, "CREATE",
        None, session_doc, current_user.id
    )
    
    return {"status": "success", "session": session_data}

@academic_router.post("/attendance/mark")
async def mark_attendance(
    attendance_data: StudentAttendance,
    current_user: User = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))
):
    """Mark student attendance"""
    
    # Validate session exists
    session = await db.attendance_sessions.find_one({"id": attendance_data.attendance_session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found")
    
    # Validate enrollment exists
    enrollment = await db.enrollments.find_one({"id": attendance_data.enrollment_id})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Check for existing attendance record
    existing_attendance = await db.student_attendance.find_one({
        "attendance_session_id": attendance_data.attendance_session_id,
        "student_id": attendance_data.student_id
    })
    
    if existing_attendance:
        # Update existing record
        update_data = {
            "status": attendance_data.status,
            "arrival_time": attendance_data.arrival_time,
            "notes": attendance_data.notes
        }
        
        await db.student_attendance.update_one(
            {"id": existing_attendance["id"]},
            {"$set": update_data}
        )
        
        return {"status": "success", "message": "Attendance updated"}
    else:
        # Create new record
        attendance_doc = prepare_for_mongo(attendance_data.dict())
        await db.student_attendance.insert_one(attendance_doc)
        
        # Update enrollment attendance statistics
        await update_enrollment_attendance(attendance_data.enrollment_id)
        
        return {"status": "success", "message": "Attendance marked"}

async def update_enrollment_attendance(enrollment_id: str):
    """Update attendance statistics for enrollment"""
    
    attendance_records = await db.student_attendance.find({"enrollment_id": enrollment_id}).to_list(1000)
    
    total_classes = len(attendance_records)
    attended_classes = len([r for r in attendance_records if r["status"] in ["PRESENT", "LATE"]])
    attendance_percentage = calculate_attendance_percentage(attended_classes, total_classes)
    
    await db.enrollments.update_one(
        {"id": enrollment_id},
        {
            "$set": {
                "total_classes": total_classes,
                "attended_classes": attended_classes,
                "attendance_percentage": attendance_percentage,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )

# ====================================================================================================
# SCHEDULES MANAGEMENT
# ====================================================================================================

@academic_router.post("/schedules")
async def create_class_schedule(
    schedule_data: ClassSchedule,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ACADEMIC_STAFF]))
):
    """Create class schedule"""
    
    # Validate no conflicts
    existing_schedules = await db.class_schedules.find({
        "day_of_week": schedule_data.day_of_week,
        "is_active": True
    }).to_list(1000)
    
    conflicts = validate_schedule_conflict(existing_schedules + [schedule_data])
    if conflicts:
        raise HTTPException(status_code=400, detail=f"Schedule conflicts: {', '.join(conflicts)}")
    
    schedule_doc = prepare_for_mongo(schedule_data.dict())
    await db.class_schedules.insert_one(schedule_doc)
    
    await log_audit_trail(
        db, "class_schedules", schedule_data.id, "CREATE",
        None, schedule_doc, current_user.id
    )
    
    return {"status": "success", "schedule": schedule_data}

@academic_router.get("/schedules")
async def get_schedules(
    teacher_id: Optional[str] = None,
    course_id: Optional[str] = None,
    day_of_week: Optional[int] = None,
    current_user: User = Depends(get_current_user)
):
    """Get class schedules"""
    
    filter_query = {"is_active": True}
    if teacher_id:
        filter_query["teacher_id"] = teacher_id
    if course_id:
        filter_query["course_id"] = course_id
    if day_of_week:
        filter_query["day_of_week"] = day_of_week
    
    schedules = await db.class_schedules.find(filter_query).sort([("day_of_week", 1), ("start_time", 1)]).to_list(1000)
    
    # Enrich with course and teacher data
    enriched_schedules = []
    for schedule in schedules:
        course = await db.courses.find_one({"id": schedule["course_id"]})
        teacher = await db.users.find_one({"id": schedule["teacher_id"]})
        
        enriched_schedules.append({
            **schedule,
            "course": Course(**course) if course else None,
            "teacher": User(**teacher) if teacher else None
        })
    
    return {"schedules": enriched_schedules}

# ====================================================================================================
# REPORTS AND TRANSCRIPTS
# ====================================================================================================

@academic_router.get("/reports/student/{student_id}/transcript")
async def generate_student_transcript(
    student_id: str,
    transcript_type: str = "COMPLETE",
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REGISTRAR]))
):
    """Generate official student transcript"""
    
    # Validate student exists
    student = await db.students.find_one({"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get all enrollments
    enrollments = await db.enrollments.find({
        "student_id": student_id,
        "grade_status": {"$in": ["APPROVED", "FAILED"]}
    }).sort([("academic_year", 1), ("academic_period", 1)]).to_list(1000)
    
    # Calculate GPA and credits
    approved_enrollments = [e for e in enrollments if e.get("grade_status") == "APPROVED"]
    grades = [e.get("numerical_grade", 0) for e in approved_enrollments if e.get("numerical_grade")]
    credits = []
    
    total_credits_earned = 0
    total_credits_attempted = 0
    
    for enrollment in enrollments:
        course = await db.courses.find_one({"id": enrollment["course_id"]})
        if course:
            course_credits = course.get("credits", 0)
            total_credits_attempted += course_credits
            
            if enrollment.get("grade_status") == "APPROVED":
                total_credits_earned += course_credits
                credits.append(course_credits)
    
    overall_gpa = calculate_gpa(grades, credits)
    academic_standing = determine_academic_standing(overall_gpa, total_credits_earned, total_credits_attempted)
    
    # Create transcript record
    transcript = OfficialTranscript(
        student_id=student_id,
        academic_period_id="current",  # This should reference actual current period
        transcript_type=transcript_type,
        overall_gpa=overall_gpa,
        total_credits_earned=total_credits_earned,
        total_credits_attempted=total_credits_attempted,
        academic_standing=academic_standing,
        generated_by=current_user.id
    )
    
    transcript_doc = prepare_for_mongo(transcript.dict())
    await db.official_transcripts.insert_one(transcript_doc)
    
    return {
        "status": "success",
        "transcript": transcript,
        "enrollments": enrollments,
        "student": Student(**student)
    }

@academic_router.get("/reports/course/{course_id}/grade-report")
async def generate_course_grade_report(
    course_id: str,
    academic_year: int,
    academic_period: str,
    current_user: User = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN, UserRole.ACADEMIC_STAFF]))
):
    """Generate course grade report"""
    
    # Validate course exists
    course = await db.courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Get enrollments for the course in specified period
    enrollments = await db.enrollments.find({
        "course_id": course_id,
        "academic_year": academic_year,
        "academic_period": academic_period
    }).sort("student_id", 1).to_list(1000)
    
    # Enrich with student data and grades
    grade_report = []
    for enrollment in enrollments:
        student = await db.students.find_one({"id": enrollment["student_id"]})
        grades = await db.student_grades.find({"enrollment_id": enrollment["id"]}).to_list(100)
        
        # Get grade components
        grade_details = []
        for grade in grades:
            component = await db.grade_components.find_one({"id": grade["grade_component_id"]})
            grade_details.append({
                "component": component.get("component_name") if component else "Unknown",
                "score": grade.get("score"),
                "weight": component.get("weight_percentage") if component else 0
            })
        
        grade_report.append({
            "student": Student(**student) if student else None,
            "enrollment": Enrollment(**enrollment),
            "grade_details": grade_details,
            "final_grade": enrollment.get("numerical_grade"),
            "final_status": enrollment.get("grade_status"),
            "attendance_percentage": enrollment.get("attendance_percentage", 0)
        })
    
    return {
        "course": Course(**course),
        "academic_year": academic_year,
        "academic_period": academic_period,
        "grade_report": grade_report,
        "statistics": {
            "total_students": len(grade_report),
            "approved": len([r for r in grade_report if r["enrollment"].grade_status == "APPROVED"]),
            "failed": len([r for r in grade_report if r["enrollment"].grade_status == "FAILED"]),
            "pending": len([r for r in grade_report if r["enrollment"].grade_status == "INCOMPLETE"])
        }
    }