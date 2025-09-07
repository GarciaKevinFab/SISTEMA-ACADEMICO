from __future__ import annotations
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timezone
from enum import Enum
import uuid

# Academic Module Comprehensive Models

class CurricularPlan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    career_id: str
    plan_code: str = Field(..., min_length=3, max_length=20)
    plan_name: str = Field(..., min_length=5, max_length=100)
    version: str = Field(default="1.0")
    effective_date: date
    total_credits: int = Field(..., ge=1)
    total_semesters: int = Field(..., ge=1, le=10)
    is_active: bool = True
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class CoursePrerequisite(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    course_id: str  # Course that requires prerequisite
    prerequisite_course_id: str  # Required course
    is_strict: bool = True  # If false, can be waived by academic staff
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AcademicPeriod(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    year: int = Field(..., ge=2020, le=2030)
    period: str = Field(..., pattern="^(I|II|III|VERANO)$")
    period_name: str = Field(..., min_length=5, max_length=50)
    start_date: date
    end_date: date
    enrollment_start: date
    enrollment_end: date
    is_active: bool = True
    is_current: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClassSchedule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    course_id: str
    teacher_id: str
    academic_period_id: str
    classroom: str = Field(..., min_length=1, max_length=50)
    day_of_week: int = Field(..., ge=1, le=7)  # 1=Monday, 7=Sunday
    start_time: str = Field(..., pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$")  # HH:MM format
    end_time: str = Field(..., pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    max_capacity: int = Field(default=30, ge=1, le=100)
    current_enrolled: int = Field(default=0, ge=0)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EnrollmentValidation(BaseModel):
    can_enroll: bool
    errors: List[str] = []
    warnings: List[str] = []
    max_credits_allowed: int
    current_credits: int
    selected_credits: int

class GradeScale(BaseModel):
    numerical_min: float = Field(..., ge=0, le=20)
    numerical_max: float = Field(..., ge=0, le=20)
    literal_grade: str = Field(..., pattern="^(AD|A|B|C)$")
    description: str
    is_passing: bool

class AttendanceSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    course_id: str
    teacher_id: str
    session_date: date
    session_topic: str = Field(..., min_length=5, max_length=200)
    total_students: int = Field(default=0, ge=0)
    present_students: int = Field(default=0, ge=0)
    absent_students: int = Field(default=0, ge=0)
    late_students: int = Field(default=0, ge=0)
    session_notes: Optional[str] = Field(None, max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudentAttendance(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    attendance_session_id: str
    student_id: str
    enrollment_id: str
    status: str = Field(..., pattern="^(PRESENT|ABSENT|LATE|JUSTIFIED)$")
    arrival_time: Optional[str] = Field(None, pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    notes: Optional[str] = Field(None, max_length=200)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GradeComponent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    course_id: str
    component_name: str = Field(..., min_length=3, max_length=50)  # e.g., "Examen Parcial", "Trabajo Final"
    weight_percentage: float = Field(..., ge=0, le=100)
    max_score: float = Field(default=20.0, ge=0, le=20)
    is_mandatory: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudentGrade(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    enrollment_id: str
    grade_component_id: str
    score: Optional[float] = Field(None, ge=0, le=20)
    literal_grade: Optional[str] = Field(None, pattern="^(AD|A|B|C)$")
    is_final: bool = False
    graded_by: str
    graded_at: Optional[datetime] = None
    comments: Optional[str] = Field(None, max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OfficialTranscript(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    academic_period_id: str
    transcript_type: str = Field(..., pattern="^(PARTIAL|COMPLETE|FINAL)$")
    overall_gpa: float = Field(default=0.0, ge=0, le=20)
    total_credits_earned: int = Field(default=0, ge=0)
    total_credits_attempted: int = Field(default=0, ge=0)
    academic_standing: str = Field(default="REGULAR", pattern="^(EXCELLENT|GOOD|REGULAR|PROBATION|SUSPENDED)$")
    generated_by: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    pdf_path: Optional[str] = None

# MINEDU Integration Models

class SIAGIESync(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    record_type: str = Field(..., pattern="^(STUDENT|ENROLLMENT|GRADE|TEACHER)$")
    local_record_id: str
    siagie_id: Optional[str] = None
    sync_status: str = Field(default="PENDING", pattern="^(PENDING|IN_PROGRESS|COMPLETED|FAILED|RETRY)$")
    last_sync_attempt: Optional[datetime] = None
    sync_response: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    retry_count: int = Field(default=0, ge=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SIAGIEBatch(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    batch_type: str = Field(..., pattern="^(ENROLLMENT|GRADES|STUDENTS|TEACHERS)$")
    academic_period_id: str
    total_records: int = Field(default=0, ge=0)
    processed_records: int = Field(default=0, ge=0)
    successful_records: int = Field(default=0, ge=0)
    failed_records: int = Field(default=0, ge=0)
    batch_status: str = Field(default="PENDING", pattern="^(PENDING|PROCESSING|COMPLETED|FAILED)$")
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Utility Functions

def calculate_gpa(grades: List[float], credits: List[int]) -> float:
    """Calculate GPA weighted by credits"""
    if not grades or not credits or len(grades) != len(credits):
        return 0.0
    
    total_points = sum(grade * credit for grade, credit in zip(grades, credits))
    total_credits = sum(credits)
    
    return round(total_points / total_credits, 2) if total_credits > 0 else 0.0

def validate_schedule_conflict(schedules: List[ClassSchedule]) -> List[str]:
    """Validate for schedule conflicts"""
    conflicts = []
    
    for i, schedule1 in enumerate(schedules):
        for j, schedule2 in enumerate(schedules[i+1:], i+1):
            if (schedule1.day_of_week == schedule2.day_of_week and
                schedule1.teacher_id == schedule2.teacher_id):
                
                # Check time overlap
                start1 = datetime.strptime(schedule1.start_time, "%H:%M").time()
                end1 = datetime.strptime(schedule1.end_time, "%H:%M").time()
                start2 = datetime.strptime(schedule2.start_time, "%H:%M").time()
                end2 = datetime.strptime(schedule2.end_time, "%H:%M").time()
                
                if not (end1 <= start2 or end2 <= start1):
                    conflicts.append(
                        f"Conflicto de horario: {schedule1.course_id} y {schedule2.course_id} "
                        f"el día {schedule1.day_of_week}"
                    )
    
    return conflicts

def validate_enrollment_requirements(
    student_enrollments: List[Dict],
    course_prerequisites: List[CoursePrerequisite],
    new_course_id: str
) -> EnrollmentValidation:
    """Validate if student can enroll in course"""
    errors = []
    warnings = []
    
    # Check prerequisites
    course_prereqs = [p for p in course_prerequisites if p.course_id == new_course_id]
    completed_courses = [e['course_id'] for e in student_enrollments if e.get('grade_status') == 'APPROVED']
    
    for prereq in course_prereqs:
        if prereq.prerequisite_course_id not in completed_courses:
            if prereq.is_strict:
                errors.append(f"Prerequisito no cumplido: {prereq.prerequisite_course_id}")
            else:
                warnings.append(f"Prerequisito recomendado: {prereq.prerequisite_course_id}")
    
    # Calculate credits
    current_credits = sum(e.get('credits', 0) for e in student_enrollments if e.get('status') == 'ACTIVE')
    max_credits = 24  # Maximum credits per semester
    
    return EnrollmentValidation(
        can_enroll=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        max_credits_allowed=max_credits,
        current_credits=current_credits,
        selected_credits=current_credits
    )

def generate_academic_calendar(
    start_date: date,
    end_date: date,
    total_weeks: int = 16
) -> List[Dict[str, Any]]:
    """Generate academic calendar with important dates"""
    calendar_events = []
    
    # Calculate key dates
    total_days = (end_date - start_date).days
    days_per_week = total_days // total_weeks
    
    current_date = start_date
    
    for week in range(1, total_weeks + 1):
        week_start = current_date
        week_end = current_date + datetime.timedelta(days=days_per_week-1)
        
        calendar_events.append({
            "week_number": week,
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "event_type": "ACADEMIC_WEEK",
            "description": f"Semana Académica {week}"
        })
        
        current_date += datetime.timedelta(days=days_per_week)
    
    # Add special events
    mid_term = start_date + datetime.timedelta(days=total_days//2)
    calendar_events.append({
        "date": mid_term.isoformat(),
        "event_type": "MID_TERM_EXAMS",
        "description": "Exámenes Parciales"
    })
    
    final_exams = end_date - datetime.timedelta(days=7)
    calendar_events.append({
        "date": final_exams.isoformat(),
        "event_type": "FINAL_EXAMS",
        "description": "Exámenes Finales"
    })
    
    return calendar_events

def calculate_attendance_percentage(present: int, total: int) -> float:
    """Calculate attendance percentage"""
    return round((present / total) * 100, 2) if total > 0 else 0.0

def determine_academic_standing(gpa: float, credits_completed: int, total_credits: int) -> str:
    """Determine academic standing based on GPA and progress"""
    if gpa >= 17.0:
        return "EXCELLENT"
    elif gpa >= 14.0:
        return "GOOD"
    elif gpa >= 11.0:
        return "REGULAR"
    elif gpa >= 8.0:
        return "PROBATION"
    else:
        return "SUSPENDED"

def generate_study_plan(career_id: str, total_semesters: int) -> Dict[str, Any]:
    """Generate default study plan structure"""
    study_plan = {
        "career_id": career_id,
        "total_semesters": total_semesters,
        "semesters": []
    }
    
    for semester in range(1, total_semesters + 1):
        study_plan["semesters"].append({
            "semester_number": semester,
            "semester_name": f"Semestre {semester}",
            "courses": [],
            "total_credits": 0,
            "is_elective_semester": semester > (total_semesters - 2)  # Last 2 semesters allow electives
        })
    
    return study_plan