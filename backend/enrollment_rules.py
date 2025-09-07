"""
Academic Enrollment Rules and Validation System
Implements blocking rules, prerequisites, and re-enrollment logic
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import asyncio
from motor.motor_asyncio import AsyncIOMotorCollection

from shared_deps import db, logger
from safe_mongo_operations import safe_update_one, safe_find_one_and_update, MongoUpdateError

@dataclass
class EnrollmentRule:
    """Represents an enrollment validation rule"""
    rule_type: str
    description: str
    blocking: bool
    error_message: str

@dataclass
class ValidationResult:
    """Result of enrollment validation"""
    valid: bool
    errors: List[str]
    warnings: List[str]
    suggestions: List[Dict]
    conflicts: List[Dict]

class EnrollmentRuleEngine:
    """Core engine for enrollment rule processing"""
    
    def __init__(self):
        self.rules = {
            'prerequisite': EnrollmentRule(
                'prerequisite',
                'Prerequisite course completion check',
                True,
                'Debe aprobar el curso prerequisito con nota ≥ 11'
            ),
            'schedule_conflict': EnrollmentRule(
                'schedule_conflict',
                'Schedule conflict detection',
                True,
                'Conflicto de horario detectado'
            ),
            'credit_limit': EnrollmentRule(
                'credit_limit',
                'Credit limit validation (12-24 credits)',
                True,
                'Límite de créditos excedido (12-24 créditos permitidos)'
            ),
            'debt_check': EnrollmentRule(
                'debt_check',
                'Financial debt verification',
                True,
                'Tiene deudas pendientes que impiden la matrícula'
            ),
            'section_capacity': EnrollmentRule(
                'section_capacity',
                'Section capacity limit',
                True,
                'Sección sin cupos disponibles'
            ),
            'enrollment_period': EnrollmentRule(
                'enrollment_period',
                'Enrollment period validation',
                True,
                'Fuera del período de matrícula'
            ),
            'academic_standing': EnrollmentRule(
                'academic_standing',
                'Academic standing check',
                True,
                'Estado académico no permite matrícula'
            )
        }

    async def validate_enrollment(
        self, 
        student_id: str, 
        course_ids: List[str], 
        academic_period: str
    ) -> ValidationResult:
        """
        Comprehensive enrollment validation
        
        Args:
            student_id: Student identifier
            course_ids: List of course IDs to enroll in
            academic_period: Academic period (e.g., "2025-I")
            
        Returns:
            ValidationResult with validation status and details
        """
        logger.info(f"Validating enrollment: student={student_id}, courses={len(course_ids)}, period={academic_period}")
        
        errors = []
        warnings = []
        suggestions = []
        conflicts = []
        
        try:
            # Get student data
            student = await db.students.find_one({"id": student_id})
            if not student:
                errors.append("Estudiante no encontrado")
                return ValidationResult(False, errors, warnings, suggestions, conflicts)
            
            # Get courses data
            courses = await db.courses.find({"id": {"$in": course_ids}}).to_list(length=None)
            if len(courses) != len(course_ids):
                errors.append("Algunos cursos no fueron encontrados")
                return ValidationResult(False, errors, warnings, suggestions, conflicts)
            
            # Run validation rules in parallel
            validation_tasks = [
                self._validate_prerequisites(student_id, courses),
                self._validate_schedule_conflicts(student_id, courses, academic_period),
                self._validate_credit_limits(student_id, courses, academic_period),
                self._validate_financial_debt(student_id),
                self._validate_section_capacity(course_ids, academic_period),
                self._validate_enrollment_period(academic_period),
                self._validate_academic_standing(student_id)
            ]
            
            results = await asyncio.gather(*validation_tasks, return_exceptions=True)
            
            # Process results
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Validation rule {i} failed: {str(result)}")
                    warnings.append(f"Error en validación: {str(result)}")
                    continue
                    
                if result['errors']:
                    errors.extend(result['errors'])
                if result['warnings']:
                    warnings.extend(result['warnings'])
                if result['suggestions']:
                    suggestions.extend(result['suggestions'])
                if result['conflicts']:
                    conflicts.extend(result['conflicts'])
            
            # Generate alternative suggestions if there are conflicts
            if conflicts and not errors:
                alt_suggestions = await self._generate_alternative_suggestions(
                    student_id, courses, academic_period, conflicts
                )
                suggestions.extend(alt_suggestions)
            
            is_valid = len(errors) == 0
            
            logger.info(f"Validation complete: valid={is_valid}, errors={len(errors)}, warnings={len(warnings)}")
            
            return ValidationResult(is_valid, errors, warnings, suggestions, conflicts)
            
        except Exception as e:
            logger.error(f"Enrollment validation failed: {str(e)}")
            errors.append(f"Error interno en validación: {str(e)}")
            return ValidationResult(False, errors, warnings, suggestions, conflicts)

    async def _validate_prerequisites(self, student_id: str, courses: List[Dict]) -> Dict:
        """Validate prerequisite course completion"""
        errors = []
        warnings = []
        
        try:
            # Get student's completed courses with grades
            completed_courses = await db.student_grades.find({
                "student_id": student_id,
                "final_grade": {"$gte": 11},  # Passing grade
                "status": "COMPLETED"
            }).to_list(length=None)
            
            completed_course_ids = {grade["course_id"] for grade in completed_courses}
            
            for course in courses:
                prerequisites = course.get("prerequisites", [])
                
                for prereq_id in prerequisites:
                    if prereq_id not in completed_course_ids:
                        prereq_course = await db.courses.find_one({"id": prereq_id})
                        prereq_name = prereq_course.get("name", prereq_id) if prereq_course else prereq_id
                        
                        errors.append(
                            f"Curso {course['name']}: Debe aprobar {prereq_name} (nota ≥ 11)"
                        )
            
            return {"errors": errors, "warnings": warnings, "suggestions": [], "conflicts": []}
            
        except Exception as e:
            logger.error(f"Prerequisite validation failed: {str(e)}")
            return {"errors": [f"Error validando prerequisitos: {str(e)}"], "warnings": [], "suggestions": [], "conflicts": []}

    async def _validate_schedule_conflicts(
        self, 
        student_id: str, 
        courses: List[Dict], 
        academic_period: str
    ) -> Dict:
        """Detect schedule conflicts between courses"""
        errors = []
        warnings = []
        conflicts = []
        
        try:
            # Get sections for the courses in the academic period
            course_ids = [course["id"] for course in courses]
            sections = await db.sections.find({
                "course_id": {"$in": course_ids},
                "academic_period": academic_period,
                "status": "ACTIVE"
            }).to_list(length=None)
            
            # Check for time conflicts
            for i, section1 in enumerate(sections):
                for j, section2 in enumerate(sections[i+1:], i+1):
                    if self._sections_have_time_conflict(section1, section2):
                        course1_name = next(c["name"] for c in courses if c["id"] == section1["course_id"])
                        course2_name = next(c["name"] for c in courses if c["id"] == section2["course_id"])
                        
                        conflict = {
                            "type": "schedule_conflict",
                            "message": f"Conflicto de horario: {course1_name} y {course2_name}",
                            "section1": section1,
                            "section2": section2
                        }
                        conflicts.append(conflict)
                        errors.append(conflict["message"])
            
            return {"errors": errors, "warnings": warnings, "suggestions": [], "conflicts": conflicts}
            
        except Exception as e:
            logger.error(f"Schedule validation failed: {str(e)}")
            return {"errors": [f"Error validando horarios: {str(e)}"], "warnings": [], "suggestions": [], "conflicts": []}

    def _sections_have_time_conflict(self, section1: Dict, section2: Dict) -> bool:
        """Check if two sections have overlapping schedules"""
        try:
            schedule1 = section1.get("schedule", {})
            schedule2 = section2.get("schedule", {})
            
            # Get days and times
            days1 = set(schedule1.get("days", []))
            days2 = set(schedule2.get("days", []))
            
            # No conflict if no common days
            if not days1.intersection(days2):
                return False
            
            # Check time overlap on common days
            start1 = schedule1.get("start_time", "00:00")
            end1 = schedule1.get("end_time", "00:00")
            start2 = schedule2.get("start_time", "00:00")
            end2 = schedule2.get("end_time", "00:00")
            
            # Convert to minutes for comparison
            start1_min = self._time_to_minutes(start1)
            end1_min = self._time_to_minutes(end1)
            start2_min = self._time_to_minutes(start2)
            end2_min = self._time_to_minutes(end2)
            
            # Check for overlap
            return not (end1_min <= start2_min or end2_min <= start1_min)
            
        except Exception:
            # Conservative approach: assume conflict if can't determine
            return True

    def _time_to_minutes(self, time_str: str) -> int:
        """Convert HH:MM time string to minutes since midnight"""
        try:
            hours, minutes = map(int, time_str.split(':'))
            return hours * 60 + minutes
        except:
            return 0

    async def _validate_credit_limits(
        self, 
        student_id: str, 
        courses: List[Dict], 
        academic_period: str
    ) -> Dict:
        """Validate credit limits (12-24 credits per period)"""
        errors = []
        warnings = []
        
        try:
            # Calculate total credits for selected courses
            total_credits = sum(course.get("credits", 0) for course in courses)
            
            # Get current enrollments for the period
            current_enrollments = await db.enrollments.find({
                "student_id": student_id,
                "academic_period": academic_period,
                "status": {"$in": ["ENROLLED", "COMPLETED"]}
            }).to_list(length=None)
            
            current_course_ids = [e["course_id"] for e in current_enrollments]
            current_courses = await db.courses.find({
                "id": {"$in": current_course_ids}
            }).to_list(length=None)
            
            current_credits = sum(course.get("credits", 0) for course in current_courses)
            total_credits_after = current_credits + total_credits
            
            if total_credits_after < 12:
                warnings.append(f"Créditos insuficientes: {total_credits_after}/12 mínimo")
            elif total_credits_after > 24:
                errors.append(f"Excede límite de créditos: {total_credits_after}/24 máximo")
            
            return {"errors": errors, "warnings": warnings, "suggestions": [], "conflicts": []}
            
        except Exception as e:
            logger.error(f"Credit validation failed: {str(e)}")
            return {"errors": [f"Error validando créditos: {str(e)}"], "warnings": [], "suggestions": [], "conflicts": []}

    async def _validate_financial_debt(self, student_id: str) -> Dict:
        """Check for pending financial obligations"""
        errors = []
        warnings = []
        
        try:
            # Check for pending receipts
            pending_receipts = await db.receipts.find({
                "customer_document": student_id,  # Assuming student ID is used as document
                "status": "PENDING"
            }).to_list(length=None)
            
            if pending_receipts:
                total_debt = sum(receipt.get("amount", 0) for receipt in pending_receipts)
                errors.append(f"Tiene deudas pendientes por S/. {total_debt:.2f}")
            
            return {"errors": errors, "warnings": warnings, "suggestions": [], "conflicts": []}
            
        except Exception as e:
            logger.error(f"Financial validation failed: {str(e)}")
            return {"errors": [f"Error validando deudas: {str(e)}"], "warnings": [], "suggestions": [], "conflicts": []}

    async def _validate_section_capacity(
        self, 
        course_ids: List[str], 
        academic_period: str
    ) -> Dict:
        """Validate section capacity limits"""
        errors = []
        warnings = []
        
        try:
            for course_id in course_ids:
                sections = await db.sections.find({
                    "course_id": course_id,
                    "academic_period": academic_period,
                    "status": "ACTIVE"
                }).to_list(length=None)
                
                if not sections:
                    errors.append(f"No hay secciones disponibles para el curso {course_id}")
                    continue
                
                # Check capacity for each section
                section_with_capacity = False
                for section in sections:
                    max_capacity = section.get("max_capacity", 30)
                    current_enrollments = await db.enrollments.count_documents({
                        "section_id": section["id"],
                        "status": {"$in": ["ENROLLED", "COMPLETED"]}
                    })
                    
                    if current_enrollments < max_capacity:
                        section_with_capacity = True
                        if max_capacity - current_enrollments <= 5:
                            warnings.append(f"Sección {section['code']} con pocos cupos ({max_capacity - current_enrollments} restantes)")
                        break
                
                if not section_with_capacity:
                    course = await db.courses.find_one({"id": course_id})
                    course_name = course.get("name", course_id) if course else course_id
                    errors.append(f"Sin cupos disponibles en {course_name}")
            
            return {"errors": errors, "warnings": warnings, "suggestions": [], "conflicts": []}
            
        except Exception as e:
            logger.error(f"Capacity validation failed: {str(e)}")
            return {"errors": [f"Error validando capacidad: {str(e)}"], "warnings": [], "suggestions": [], "conflicts": []}

    async def _validate_enrollment_period(self, academic_period: str) -> Dict:
        """Validate if enrollment is within allowed period"""
        errors = []
        warnings = []
        
        try:
            # Get enrollment period configuration
            period_config = await db.academic_periods.find_one({
                "period": academic_period
            })
            
            if not period_config:
                warnings.append(f"Configuración de período {academic_period} no encontrada")
                return {"errors": [], "warnings": warnings, "suggestions": [], "conflicts": []}
            
            now = datetime.now(timezone.utc)
            enrollment_start = period_config.get("enrollment_start")
            enrollment_end = period_config.get("enrollment_end")
            
            if enrollment_start and isinstance(enrollment_start, str):
                enrollment_start = datetime.fromisoformat(enrollment_start.replace('Z', '+00:00'))
            if enrollment_end and isinstance(enrollment_end, str):
                enrollment_end = datetime.fromisoformat(enrollment_end.replace('Z', '+00:00'))
            
            if enrollment_start and now < enrollment_start:
                errors.append(f"Matrícula inicia el {enrollment_start.strftime('%d/%m/%Y')}")
            elif enrollment_end and now > enrollment_end:
                errors.append(f"Período de matrícula cerrado desde el {enrollment_end.strftime('%d/%m/%Y')}")
            
            return {"errors": errors, "warnings": warnings, "suggestions": [], "conflicts": []}
            
        except Exception as e:
            logger.error(f"Period validation failed: {str(e)}")
            return {"errors": [f"Error validando período: {str(e)}"], "warnings": [], "suggestions": [], "conflicts": []}

    async def _validate_academic_standing(self, student_id: str) -> Dict:
        """Validate student's academic standing"""
        errors = []
        warnings = []
        
        try:
            student = await db.students.find_one({"id": student_id})
            if not student:
                errors.append("Estudiante no encontrado")
                return {"errors": errors, "warnings": warnings, "suggestions": [], "conflicts": []}
            
            academic_status = student.get("academic_status", "ACTIVE")
            
            if academic_status == "SUSPENDED":
                errors.append("Estudiante suspendido no puede matricularse")
            elif academic_status == "DISMISSED":
                errors.append("Estudiante separado no puede matricularse")
            elif academic_status == "ON_PROBATION":
                warnings.append("Estudiante en período de prueba académica")
            elif academic_status == "INACTIVE":
                errors.append("Estudiante inactivo - contacte registro académico")
            
            return {"errors": errors, "warnings": warnings, "suggestions": [], "conflicts": []}
            
        except Exception as e:
            logger.error(f"Academic standing validation failed: {str(e)}")
            return {"errors": [f"Error validando estado académico: {str(e)}"], "warnings": [], "suggestions": [], "conflicts": []}

    async def _generate_alternative_suggestions(
        self, 
        student_id: str, 
        original_courses: List[Dict], 
        academic_period: str,
        conflicts: List[Dict]
    ) -> List[Dict]:
        """Generate alternative course suggestions when conflicts exist"""
        suggestions = []
        
        try:
            # For schedule conflicts, suggest alternative sections
            for conflict in conflicts:
                if conflict["type"] == "schedule_conflict":
                    section1 = conflict["section1"]
                    section2 = conflict["section2"]
                    
                    # Find alternative sections for each conflicting course
                    alt_sections1 = await self._find_alternative_sections(
                        section1["course_id"], academic_period, section1["id"]
                    )
                    alt_sections2 = await self._find_alternative_sections(
                        section2["course_id"], academic_period, section2["id"]
                    )
                    
                    if alt_sections1:
                        course = await db.courses.find_one({"id": section1["course_id"]})
                        suggestions.append({
                            "type": "alternative_section",
                            "message": f"Secciones alternativas para {course.get('name', 'curso')}",
                            "course_id": section1["course_id"],
                            "alternatives": alt_sections1
                        })
                    
                    if alt_sections2:
                        course = await db.courses.find_one({"id": section2["course_id"]})
                        suggestions.append({
                            "type": "alternative_section", 
                            "message": f"Secciones alternativas para {course.get('name', 'curso')}",
                            "course_id": section2["course_id"],
                            "alternatives": alt_sections2
                        })
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Alternative suggestions generation failed: {str(e)}")
            return []

    async def _find_alternative_sections(
        self, 
        course_id: str, 
        academic_period: str, 
        exclude_section_id: str
    ) -> List[Dict]:
        """Find alternative sections for a course"""
        try:
            sections = await db.sections.find({
                "course_id": course_id,
                "academic_period": academic_period,
                "status": "ACTIVE",
                "id": {"$ne": exclude_section_id}
            }).to_list(length=None)
            
            # Check capacity for each section
            available_sections = []
            for section in sections:
                max_capacity = section.get("max_capacity", 30)
                current_enrollments = await db.enrollments.count_documents({
                    "section_id": section["id"],
                    "status": {"$in": ["ENROLLED", "COMPLETED"]}
                })
                
                if current_enrollments < max_capacity:
                    available_sections.append({
                        "section_id": section["id"],
                        "section_code": section.get("code", ""),
                        "schedule": section.get("schedule", {}),
                        "teacher": section.get("teacher_name", ""),
                        "available_slots": max_capacity - current_enrollments
                    })
            
            return available_sections
            
        except Exception as e:
            logger.error(f"Alternative sections search failed: {str(e)}")
            return []

# Re-enrollment specific logic
class ReEnrollmentManager:
    """Manages re-enrollment for students with failed courses"""
    
    async def check_reenrollment_eligibility(
        self, 
        student_id: str, 
        course_id: str
    ) -> Dict:
        """Check if student can re-enroll in a failed course"""
        try:
            # Get student's enrollment history for this course
            enrollments = await db.enrollments.find({
                "student_id": student_id,
                "course_id": course_id
            }).sort("created_at", -1).to_list(length=None)
            
            if not enrollments:
                return {"eligible": True, "attempt": 1, "message": "Primera matrícula"}
            
            # Count failed attempts
            failed_attempts = 0
            for enrollment in enrollments:
                final_grade = await db.student_grades.find_one({
                    "student_id": student_id,
                    "course_id": course_id,
                    "enrollment_id": enrollment["id"]
                })
                
                if final_grade and final_grade.get("final_grade", 0) < 11:
                    failed_attempts += 1
            
            max_attempts = 3  # University policy
            
            if failed_attempts >= max_attempts:
                return {
                    "eligible": False,
                    "attempt": failed_attempts + 1,
                    "message": f"Máximo de intentos alcanzado ({max_attempts})"
                }
            
            return {
                "eligible": True,
                "attempt": failed_attempts + 1,
                "message": f"Re-matrícula #{failed_attempts + 1}"
            }
            
        except Exception as e:
            logger.error(f"Re-enrollment eligibility check failed: {str(e)}")
            return {
                "eligible": False,
                "attempt": 0,
                "message": f"Error verificando elegibilidad: {str(e)}"
            }

    async def process_reenrollment(
        self, 
        student_id: str, 
        course_id: str, 
        section_id: str,
        academic_period: str
    ) -> Dict:
        """Process re-enrollment maintaining attempt tracking"""
        try:
            # Check eligibility
            eligibility = await self.check_reenrollment_eligibility(student_id, course_id)
            
            if not eligibility["eligible"]:
                return {
                    "success": False,
                    "message": eligibility["message"]
                }
            
            # Create new enrollment record
            enrollment_id = f"re-enroll-{student_id}-{course_id}-{datetime.now().timestamp()}"
            
            enrollment_data = {
                "id": enrollment_id,
                "student_id": student_id,
                "course_id": course_id,
                "section_id": section_id,
                "academic_period": academic_period,
                "enrollment_type": "RE_ENROLLMENT",
                "attempt_number": eligibility["attempt"],
                "status": "ENROLLED",
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
            
            logger.info(f"Re-enrollment successful: {enrollment_id}")
            
            return {
                "success": True,
                "enrollment_id": enrollment_id,
                "attempt": eligibility["attempt"],
                "message": f"Re-matrícula exitosa - Intento #{eligibility['attempt']}"
            }
            
        except Exception as e:
            logger.error(f"Re-enrollment processing failed: {str(e)}")
            return {
                "success": False,
                "message": f"Error procesando re-matrícula: {str(e)}"
            }

# Idempotency management
class EnrollmentIdempotencyManager:
    """Manages idempotent enrollment operations"""
    
    async def check_idempotency(self, idempotency_key: str) -> Optional[Dict]:
        """Check if operation was already processed"""
        try:
            result = await db.enrollment_operations.find_one({
                "idempotency_key": idempotency_key
            })
            return result
        except Exception as e:
            logger.error(f"Idempotency check failed: {str(e)}")
            return None

    async def record_operation(
        self, 
        idempotency_key: str, 
        operation_result: Dict
    ) -> None:
        """Record operation result for idempotency"""
        try:
            operation_record = {
                "idempotency_key": idempotency_key,
                "result": operation_result,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": datetime.now(timezone.utc).isoformat()  # Add TTL if needed
            }
            
            await db.enrollment_operations.insert_one(operation_record)
            
        except Exception as e:
            logger.error(f"Operation recording failed: {str(e)}")

# Export main components
enrollment_engine = EnrollmentRuleEngine()
reenrollment_manager = ReEnrollmentManager()
idempotency_manager = EnrollmentIdempotencyManager()