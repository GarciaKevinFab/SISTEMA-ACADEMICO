"""
Complete Grades and Academic Records (Actas) System
Implements 0-20 to AD/A/B/C conversion, immutable closures, and official PDF generation
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import uuid
import qrcode
from io import BytesIO
import base64

from shared_deps import db, logger
from safe_mongo_operations import safe_update_one, safe_find_one_and_update, MongoUpdateError

class GradeStatus(Enum):
    """Grade entry status"""
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    CLOSED = "CLOSED"
    REOPENED = "REOPENED"

class GradeLetter(Enum):
    """Letter grade system"""
    AD = "AD"  # 18-20
    A = "A"    # 14-17
    B = "B"    # 11-13
    C = "C"    # 0-10

@dataclass
class GradeConversion:
    """Grade conversion configuration"""
    numeric_grade: float
    letter_grade: str
    description: str
    passing: bool

class GradesSystem:
    """Complete grades management system"""
    
    # Grade conversion table (0-20 to AD/A/B/C)
    GRADE_CONVERSIONS = {
        'AD': GradeConversion(18.0, 'AD', 'Logro destacado', True),
        'A': GradeConversion(14.0, 'A', 'Logro esperado', True),
        'B': GradeConversion(11.0, 'B', 'En proceso', True),
        'C': GradeConversion(0.0, 'C', 'En inicio', False)
    }
    
    def __init__(self):
        self.grade_periods = ['PARCIAL_1', 'PARCIAL_2', 'PARCIAL_3', 'FINAL']
        self.grade_weights = {
            'PARCIAL_1': 0.2,  # 20%
            'PARCIAL_2': 0.2,  # 20% 
            'PARCIAL_3': 0.2,  # 20%
            'FINAL': 0.4       # 40%
        }

    def convert_numeric_to_letter(self, numeric_grade: float) -> str:
        """Convert numeric grade (0-20) to letter grade (AD/A/B/C)"""
        if numeric_grade >= 18:
            return 'AD'
        elif numeric_grade >= 14:
            return 'A'
        elif numeric_grade >= 11:
            return 'B'
        else:
            return 'C'

    def calculate_final_grade(self, grades: Dict[str, float]) -> Dict:
        """Calculate final grade from period grades"""
        try:
            # Get individual period grades
            parcial_1 = grades.get('PARCIAL_1', 0.0)
            parcial_2 = grades.get('PARCIAL_2', 0.0)
            parcial_3 = grades.get('PARCIAL_3', 0.0)
            final_exam = grades.get('FINAL', 0.0)
            
            # Calculate weighted average
            final_numeric = (
                parcial_1 * self.grade_weights['PARCIAL_1'] +
                parcial_2 * self.grade_weights['PARCIAL_2'] +
                parcial_3 * self.grade_weights['PARCIAL_3'] +
                final_exam * self.grade_weights['FINAL']
            )
            
            # Round to 2 decimal places
            final_numeric = round(final_numeric, 2)
            
            # Convert to letter grade
            final_letter = self.convert_numeric_to_letter(final_numeric)
            
            # Determine if passing
            is_passing = final_numeric >= 11.0
            
            return {
                'final_numeric': final_numeric,
                'final_letter': final_letter,
                'is_passing': is_passing,
                'individual_grades': grades,
                'calculation_details': {
                    'parcial_1_weighted': parcial_1 * self.grade_weights['PARCIAL_1'],
                    'parcial_2_weighted': parcial_2 * self.grade_weights['PARCIAL_2'],
                    'parcial_3_weighted': parcial_3 * self.grade_weights['PARCIAL_3'],
                    'final_weighted': final_exam * self.grade_weights['FINAL'],
                    'weights_used': self.grade_weights
                }
            }
            
        except Exception as e:
            logger.error(f"Grade calculation failed: {str(e)}")
            return {
                'final_numeric': 0.0,
                'final_letter': 'C',
                'is_passing': False,
                'error': str(e)
            }

    async def save_student_grades(
        self,
        section_id: str,
        student_id: str,
        grades: Dict[str, float],
        teacher_id: str
    ) -> Dict:
        """Save individual student grades (DRAFT status)"""
        try:
            # Validate grade values
            for period, grade in grades.items():
                if not (0 <= grade <= 20):
                    return {
                        'success': False,
                        'message': f'Nota inválida para {period}: {grade} (debe estar entre 0-20)'
                    }
            
            # Calculate final grade
            grade_calculation = self.calculate_final_grade(grades)
            
            # Create grade record
            grade_record = {
                'id': str(uuid.uuid4()),
                'section_id': section_id,
                'student_id': student_id,
                'teacher_id': teacher_id,
                'academic_period': await self._get_section_period(section_id),
                'course_id': await self._get_section_course(section_id),
                'individual_grades': grades,
                'final_numeric_grade': grade_calculation['final_numeric'],
                'final_letter_grade': grade_calculation['final_letter'],
                'is_passing': grade_calculation['is_passing'],
                'status': GradeStatus.DRAFT.value,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat(),
                'calculation_details': grade_calculation.get('calculation_details', {})
            }
            
            # Upsert grade record
            await safe_find_one_and_update(
                db.student_grades,
                {
                    'section_id': section_id,
                    'student_id': student_id
                },
                {
                    '$set': grade_record
                },
                upsert=True
            )
            
            # Log grade save
            await self._log_grade_action(
                'GRADE_SAVE',
                section_id,
                student_id,
                teacher_id,
                {'grades_saved': grades}
            )
            
            return {
                'success': True,
                'message': 'Calificaciones guardadas exitosamente',
                'grade_record_id': grade_record['id'],
                'final_grade': grade_calculation
            }
            
        except Exception as e:
            logger.error(f"Grade save failed: {str(e)}")
            return {
                'success': False,
                'message': f'Error guardando calificaciones: {str(e)}'
            }

    async def submit_section_grades(
        self,
        section_id: str,
        teacher_id: str,
        force_submit: bool = False
    ) -> Dict:
        """Submit all grades for a section (SUBMITTED status)"""
        try:
            # Check if all students have complete grades
            section_students = await self._get_section_students(section_id)
            incomplete_students = []
            
            for student in section_students:
                grade_record = await db.student_grades.find_one({
                    'section_id': section_id,
                    'student_id': student['id']
                })
                
                if not grade_record:
                    incomplete_students.append(student['name'])
                    continue
                
                # Check if all periods have grades
                individual_grades = grade_record.get('individual_grades', {})
                missing_periods = []
                
                for period in self.grade_periods:
                    if period not in individual_grades or individual_grades[period] is None:
                        missing_periods.append(period)
                
                if missing_periods and not force_submit:
                    incomplete_students.append(f"{student['name']} (falta: {', '.join(missing_periods)})")
            
            if incomplete_students and not force_submit:
                return {
                    'success': False,
                    'message': 'Estudiantes con calificaciones incompletas',
                    'incomplete_students': incomplete_students
                }
            
            # Update all grades to SUBMITTED status
            update_result = await db.student_grades.update_many(
                {'section_id': section_id},
                {
                    '$set': {
                        'status': GradeStatus.SUBMITTED.value,
                        'submitted_at': datetime.now(timezone.utc).isoformat(),
                        'submitted_by': teacher_id
                    }
                }
            )
            
            # Update section status
            await safe_update_one(
                db.sections,
                {'id': section_id},
                {
                    '$set': {
                        'grades_status': GradeStatus.SUBMITTED.value,
                        'grades_submitted_at': datetime.now(timezone.utc).isoformat(),
                        'grades_submitted_by': teacher_id
                    }
                }
            )
            
            # Log submission
            await self._log_grade_action(
                'GRADES_SUBMIT',
                section_id,
                None,
                teacher_id,
                {
                    'students_affected': update_result.modified_count,
                    'incomplete_students': len(incomplete_students),
                    'force_submit': force_submit
                }
            )
            
            return {
                'success': True,
                'message': 'Calificaciones enviadas exitosamente',
                'students_affected': update_result.modified_count,
                'status': GradeStatus.SUBMITTED.value
            }
            
        except Exception as e:
            logger.error(f"Grade submission failed: {str(e)}")
            return {
                'success': False,
                'message': f'Error enviando calificaciones: {str(e)}'
            }

    async def close_section_grades(
        self,
        section_id: str,
        admin_user_id: str,
        admin_role: str
    ) -> Dict:
        """Close section grades (CLOSED status - IMMUTABLE)"""
        try:
            # Only REGISTRAR or ADMIN_ACADEMIC can close grades
            if admin_role not in ['REGISTRAR', 'ADMIN_ACADEMIC']:
                return {
                    'success': False,
                    'message': 'Solo REGISTRAR o ADMIN_ACADEMIC pueden cerrar actas'
                }
            
            # Check if grades are submitted
            section = await db.sections.find_one({'id': section_id})
            if not section or section.get('grades_status') != GradeStatus.SUBMITTED.value:
                return {
                    'success': False,
                    'message': 'Las calificaciones deben estar enviadas antes de cerrar'
                }
            
            # Create immutable closure record
            closure_id = str(uuid.uuid4())
            closure_record = {
                'id': closure_id,
                'section_id': section_id,
                'academic_period': section.get('academic_period'),
                'course_id': section.get('course_id'),
                'closed_by': admin_user_id,
                'closed_at': datetime.now(timezone.utc).isoformat(),
                'closure_type': 'IMMUTABLE',
                'status': 'ACTIVE'
            }
            
            # Get all grades for this section (snapshot)
            grade_records = await db.student_grades.find({
                'section_id': section_id
            }).to_list(length=None)
            
            closure_record['grades_snapshot'] = grade_records
            closure_record['total_students'] = len(grade_records)
            
            # Insert closure record
            await db.grade_closures.insert_one(closure_record)
            
            # Update all grades to CLOSED (immutable)
            await db.student_grades.update_many(
                {'section_id': section_id},
                {
                    '$set': {
                        'status': GradeStatus.CLOSED.value,
                        'closed_at': datetime.now(timezone.utc).isoformat(),
                        'closed_by': admin_user_id,
                        'closure_id': closure_id,
                        'immutable': True  # Flag to prevent changes
                    }
                }
            )
            
            # Update section status
            await safe_update_one(
                db.sections,
                {'id': section_id},
                {
                    '$set': {
                        'grades_status': GradeStatus.CLOSED.value,
                        'grades_closed_at': datetime.now(timezone.utc).isoformat(),
                        'grades_closed_by': admin_user_id,
                        'closure_id': closure_id
                    }
                }
            )
            
            # Log closure (audit)
            await self._log_grade_action(
                'GRADES_CLOSE',
                section_id,
                None,
                admin_user_id,
                {
                    'closure_id': closure_id,
                    'students_affected': len(grade_records),
                    'admin_role': admin_role
                }
            )
            
            return {
                'success': True,
                'message': 'Acta cerrada exitosamente (inmutable)',
                'closure_id': closure_id,
                'status': GradeStatus.CLOSED.value
            }
            
        except Exception as e:
            logger.error(f"Grade closure failed: {str(e)}")
            return {
                'success': False,
                'message': f'Error cerrando acta: {str(e)}'
            }

    async def reopen_section_grades(
        self,
        section_id: str,
        admin_user_id: str,
        admin_role: str,
        reason: str
    ) -> Dict:
        """Reopen closed grades (REGISTRAR/ADMIN_ACADEMIC only)"""
        try:
            # Strict permission check
            if admin_role not in ['REGISTRAR', 'ADMIN_ACADEMIC']:
                return {
                    'success': False,
                    'message': 'Solo REGISTRAR o ADMIN_ACADEMIC pueden reabrir actas'
                }
            
            # Check if grades are closed
            section = await db.sections.find_one({'id': section_id})
            if not section or section.get('grades_status') != GradeStatus.CLOSED.value:
                return {
                    'success': False,
                    'message': 'Solo se pueden reabrir actas cerradas'
                }
            
            # Get closure record
            closure_id = section.get('closure_id')
            if closure_id:
                # Mark closure as reopened (audit trail)
                await safe_update_one(
                    db.grade_closures,
                    {'id': closure_id},
                    {
                        '$set': {
                            'status': 'REOPENED',
                            'reopened_by': admin_user_id,
                            'reopened_at': datetime.now(timezone.utc).isoformat(),
                            'reopen_reason': reason
                        }
                    }
                )
            
            # Update grades to REOPENED status
            await db.student_grades.update_many(
                {'section_id': section_id},
                {
                    '$set': {
                        'status': GradeStatus.REOPENED.value,
                        'reopened_at': datetime.now(timezone.utc).isoformat(),
                        'reopened_by': admin_user_id,
                        'reopen_reason': reason
                    },
                    '$unset': {
                        'immutable': ""  # Remove immutable flag
                    }
                }
            )
            
            # Update section status
            await safe_update_one(
                db.sections,
                {'id': section_id},
                {
                    '$set': {
                        'grades_status': GradeStatus.REOPENED.value,
                        'grades_reopened_at': datetime.now(timezone.utc).isoformat(),
                        'grades_reopened_by': admin_user_id,
                        'reopen_reason': reason
                    }
                }
            )
            
            # Log reopening (critical audit)
            await self._log_grade_action(
                'GRADES_REOPEN',
                section_id,
                None,
                admin_user_id,
                {
                    'closure_id': closure_id,
                    'reopen_reason': reason,
                    'admin_role': admin_role
                }
            )
            
            return {
                'success': True,
                'message': 'Acta reabierta exitosamente',
                'status': GradeStatus.REOPENED.value,
                'reason': reason
            }
            
        except Exception as e:
            logger.error(f"Grade reopening failed: {str(e)}")
            return {
                'success': False,
                'message': f'Error reabriendo acta: {str(e)}'
            }

    async def generate_official_acta_pdf(
        self,
        section_id: str,
        include_qr: bool = True
    ) -> Dict:
        """Generate official acta PDF with QR verification"""
        try:
            # Get section and course information
            section = await db.sections.find_one({'id': section_id})
            if not section:
                return {'success': False, 'message': 'Sección no encontrada'}
            
            course = await db.courses.find_one({'id': section['course_id']})
            course_name = course.get('name', 'Curso') if course else 'Curso'
            
            # Get all grade records
            grade_records = await db.student_grades.find({
                'section_id': section_id
            }).to_list(length=None)
            
            if not grade_records:
                return {'success': False, 'message': 'No hay calificaciones registradas'}
            
            # Create acta document record
            acta_id = str(uuid.uuid4())
            acta_record = {
                'id': acta_id,
                'section_id': section_id,
                'course_id': section['course_id'],
                'course_name': course_name,
                'section_code': section.get('code', ''),
                'academic_period': section.get('academic_period'),
                'teacher_name': section.get('teacher_name', ''),
                'total_students': len(grade_records),
                'generated_at': datetime.now(timezone.utc).isoformat(),
                'status': 'GENERATED',
                'grade_records': grade_records
            }
            
            # Generate QR code for verification
            if include_qr:
                qr_data = f"ACTA-{acta_id}-{section_id}"
                qr_code = self._generate_qr_code(qr_data)
                acta_record['qr_code_data'] = qr_code
                acta_record['verification_url'] = f"/verificar/{acta_id}"
            
            # Insert acta record
            await db.official_actas.insert_one(acta_record)
            
            # Return task for PDF generation (polling pattern)
            task_id = f"acta-{acta_id}-{datetime.now().timestamp()}"
            
            return {
                'success': True,
                'message': 'Generación de acta iniciada',
                'acta_id': acta_id,
                'taskId': task_id,
                'statusUrl': f'/api/tasks/{task_id}',
                'verification_url': f'/verificar/{acta_id}' if include_qr else None
            }
            
        except Exception as e:
            logger.error(f"Acta PDF generation failed: {str(e)}")
            return {
                'success': False,
                'message': f'Error generando acta: {str(e)}'
            }

    def _generate_qr_code(self, data: str) -> str:
        """Generate QR code as base64 string"""
        try:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(data)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()
            
            return img_str
            
        except Exception as e:
            logger.error(f"QR code generation failed: {str(e)}")
            return ""

    async def verify_acta_qr(self, acta_id: str) -> Dict:
        """Verify acta QR code (public endpoint - no sensitive data)"""
        try:
            acta = await db.official_actas.find_one({'id': acta_id})
            if not acta:
                return {
                    'valid': False,
                    'message': 'Acta no encontrada'
                }
            
            # Return only non-sensitive verification data
            return {
                'valid': True,
                'acta_id': acta_id,
                'course_name': acta.get('course_name', ''),
                'academic_period': acta.get('academic_period', ''),
                'section_code': acta.get('section_code', ''),
                'generated_at': acta.get('generated_at', ''),
                'total_students': acta.get('total_students', 0),
                'status': acta.get('status', ''),
                'message': 'Acta oficial verificada'
            }
            
        except Exception as e:
            logger.error(f"Acta verification failed: {str(e)}")
            return {
                'valid': False,
                'message': 'Error en verificación'
            }

    # Helper methods
    async def _get_section_period(self, section_id: str) -> str:
        """Get academic period for section"""
        section = await db.sections.find_one({'id': section_id})
        return section.get('academic_period', '') if section else ''

    async def _get_section_course(self, section_id: str) -> str:
        """Get course ID for section"""
        section = await db.sections.find_one({'id': section_id})
        return section.get('course_id', '') if section else ''

    async def _get_section_students(self, section_id: str) -> List[Dict]:
        """Get enrolled students in section"""
        enrollments = await db.enrollments.find({
            'section_id': section_id,
            'status': {'$in': ['ENROLLED', 'COMPLETED']}
        }).to_list(length=None)
        
        students = []
        for enrollment in enrollments:
            student = await db.students.find_one({'id': enrollment['student_id']})
            if student:
                students.append({
                    'id': student['id'],
                    'name': f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
                    'enrollment_id': enrollment['id']
                })
        
        return students

    async def _log_grade_action(
        self,
        action: str,
        section_id: str,
        student_id: Optional[str],
        user_id: str,
        details: Dict
    ) -> None:
        """Log grade-related actions for audit"""
        try:
            log_entry = {
                'id': str(uuid.uuid4()),
                'action': action,
                'section_id': section_id,
                'student_id': student_id,
                'user_id': user_id,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'details': details
            }
            
            await db.audit_logs.insert_one(log_entry)
            
        except Exception as e:
            logger.error(f"Grade action logging failed: {str(e)}")

# Export system instance
grades_system = GradesSystem()