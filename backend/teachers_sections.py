"""
Teacher Management and Section Assignment System
Handles teacher assignment, schedule management, and section coordination
"""
from datetime import datetime, timezone, time, date
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import asyncio
import uuid

from shared_deps import db, logger
from safe_mongo_operations import safe_update_one, safe_find_one_and_update, MongoUpdateError

@dataclass
class ScheduleSlot:
    """Represents a time slot in the schedule"""
    day: str  # Monday, Tuesday, etc.
    start_time: time
    end_time: time
    classroom: str = ""

@dataclass
class TeacherWorkload:
    """Represents teacher's current workload"""
    teacher_id: str
    total_hours: int
    max_hours: int
    sections: List[str]
    schedule_slots: List[ScheduleSlot]

class TeacherSectionManager:
    """Manages teacher assignments and section schedules"""
    
    async def assign_teacher_to_section(
        self, 
        section_id: str, 
        teacher_id: str,
        academic_period: str
    ) -> Dict:
        """
        Assign a teacher to a section with validation
        
        Args:
            section_id: Section identifier
            teacher_id: Teacher identifier  
            academic_period: Academic period
            
        Returns:
            Assignment result with status and details
        """
        try:
            # Validate section exists
            section = await db.sections.find_one({"id": section_id})
            if not section:
                return {"success": False, "message": "Sección no encontrada"}
            
            # Validate teacher exists and is active
            teacher = await db.teachers.find_one({
                "id": teacher_id,
                "status": "ACTIVE"
            })
            if not teacher:
                return {"success": False, "message": "Docente no encontrado o inactivo"}
            
            # Check teacher workload limits
            workload_check = await self._check_teacher_workload(teacher_id, academic_period)
            if not workload_check["available"]:
                return {
                    "success": False, 
                    "message": f"Docente excede carga horaria máxima: {workload_check['message']}"
                }
            
            # Check schedule conflicts
            schedule_conflict = await self._check_teacher_schedule_conflict(
                teacher_id, section["schedule"], academic_period
            )
            if schedule_conflict["has_conflict"]:
                return {
                    "success": False,
                    "message": f"Conflicto de horario: {schedule_conflict['message']}"
                }
            
            # Check teacher qualifications for the course
            course = await db.courses.find_one({"id": section["course_id"]})
            if course:
                qualification_check = await self._check_teacher_qualifications(
                    teacher_id, course["id"]
                )
                if not qualification_check["qualified"]:
                    return {
                        "success": False,
                        "message": f"Docente no calificado: {qualification_check['message']}"
                    }
            
            # Perform assignment
            assignment_result = await self._perform_teacher_assignment(
                section_id, teacher_id, academic_period
            )
            
            if assignment_result["success"]:
                # Log assignment
                await self._log_teacher_assignment(
                    section_id, teacher_id, academic_period
                )
                
                # Update teacher workload cache
                await self._update_teacher_workload_cache(teacher_id, academic_period)
            
            return assignment_result
            
        except Exception as e:
            logger.error(f"Teacher assignment failed: {str(e)}")
            return {"success": False, "message": f"Error en asignación: {str(e)}"}

    async def _check_teacher_workload(
        self, 
        teacher_id: str, 
        academic_period: str
    ) -> Dict:
        """Check if teacher can take additional workload"""
        try:
            # Get teacher's maximum allowed hours
            teacher = await db.teachers.find_one({"id": teacher_id})
            max_hours = teacher.get("max_weekly_hours", 20)  # Default 20 hours/week
            
            # Calculate current workload
            current_sections = await db.sections.find({
                "teacher_id": teacher_id,
                "academic_period": academic_period,
                "status": "ACTIVE"
            }).to_list(length=None)
            
            total_hours = 0
            for section in current_sections:
                course = await db.courses.find_one({"id": section["course_id"]})
                if course:
                    # Assume 1 credit = 1 hour per week (theory) + 1 hour (practice)
                    credits = course.get("credits", 0)
                    course_type = course.get("type", "THEORY")
                    
                    if course_type == "THEORY":
                        hours_per_week = credits
                    elif course_type == "PRACTICE":
                        hours_per_week = credits * 2  # Practice courses need more time
                    else:
                        hours_per_week = credits * 1.5  # Mixed courses
                    
                    total_hours += hours_per_week
            
            available_hours = max_hours - total_hours
            
            return {
                "available": available_hours > 0,
                "current_hours": total_hours,
                "max_hours": max_hours,
                "available_hours": available_hours,
                "message": f"{total_hours}/{max_hours} horas semanales"
            }
            
        except Exception as e:
            logger.error(f"Workload check failed: {str(e)}")
            return {
                "available": False,
                "message": f"Error verificando carga: {str(e)}"
            }

    async def _check_teacher_schedule_conflict(
        self, 
        teacher_id: str, 
        new_schedule: Dict, 
        academic_period: str
    ) -> Dict:
        """Check for schedule conflicts with existing assignments"""
        try:
            # Get teacher's current sections
            current_sections = await db.sections.find({
                "teacher_id": teacher_id,
                "academic_period": academic_period,
                "status": "ACTIVE"
            }).to_list(length=None)
            
            # Check each existing section for conflicts
            for section in current_sections:
                existing_schedule = section.get("schedule", {})
                
                if self._schedules_overlap(existing_schedule, new_schedule):
                    course = await db.courses.find_one({"id": section["course_id"]})
                    course_name = course.get("name", "Curso") if course else "Curso"
                    
                    return {
                        "has_conflict": True,
                        "message": f"Conflicto con {course_name} - Sección {section.get('code', '')}",
                        "conflicting_section": section["id"]
                    }
            
            return {"has_conflict": False, "message": "Sin conflictos"}
            
        except Exception as e:
            logger.error(f"Schedule conflict check failed: {str(e)}")
            return {
                "has_conflict": True,
                "message": f"Error verificando horario: {str(e)}"
            }

    def _schedules_overlap(self, schedule1: Dict, schedule2: Dict) -> bool:
        """Check if two schedules have time overlap"""
        try:
            # Get days
            days1 = set(schedule1.get("days", []))
            days2 = set(schedule2.get("days", []))
            
            # No overlap if no common days
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
            
            # Check for overlap (including break time buffer)
            buffer_minutes = 15  # 15-minute buffer between classes
            return not (end1_min + buffer_minutes <= start2_min or end2_min + buffer_minutes <= start1_min)
            
        except Exception:
            # Conservative approach: assume overlap if can't determine
            return True

    def _time_to_minutes(self, time_str: str) -> int:
        """Convert HH:MM time string to minutes since midnight"""
        try:
            hours, minutes = map(int, time_str.split(':'))
            return hours * 60 + minutes
        except:
            return 0

    async def _check_teacher_qualifications(
        self, 
        teacher_id: str, 
        course_id: str
    ) -> Dict:
        """Check if teacher is qualified to teach the course"""
        try:
            # Get teacher qualifications
            teacher = await db.teachers.find_one({"id": teacher_id})
            if not teacher:
                return {"qualified": False, "message": "Docente no encontrado"}
            
            qualifications = teacher.get("qualifications", [])
            specializations = teacher.get("specializations", [])
            
            # Get course requirements
            course = await db.courses.find_one({"id": course_id})
            if not course:
                return {"qualified": True, "message": "Curso no encontrado - asignación permitida"}
            
            required_qualifications = course.get("required_qualifications", [])
            course_area = course.get("area", "")
            
            # Check basic qualifications
            if required_qualifications:
                has_required = any(qual in qualifications for qual in required_qualifications)
                if not has_required:
                    return {
                        "qualified": False,
                        "message": f"Requiere: {', '.join(required_qualifications)}"
                    }
            
            # Check specialization match
            if course_area and specializations:
                has_area_match = course_area in specializations
                if not has_area_match:
                    # Allow but warn
                    return {
                        "qualified": True,
                        "message": f"Advertencia: Especialización no coincide con {course_area}",
                        "warning": True
                    }
            
            return {"qualified": True, "message": "Docente calificado"}
            
        except Exception as e:
            logger.error(f"Qualification check failed: {str(e)}")
            return {
                "qualified": False,
                "message": f"Error verificando calificaciones: {str(e)}"
            }

    async def _perform_teacher_assignment(
        self, 
        section_id: str, 
        teacher_id: str, 
        academic_period: str
    ) -> Dict:
        """Execute the teacher assignment"""
        try:
            # Get teacher details for assignment
            teacher = await db.teachers.find_one({"id": teacher_id})
            teacher_name = f"{teacher.get('first_name', '')} {teacher.get('last_name', '')}".strip()
            
            # Update section with teacher assignment
            await safe_update_one(
                db.sections,
                {"id": section_id},
                {
                    "$set": {
                        "teacher_id": teacher_id,
                        "teacher_name": teacher_name,
                        "assigned_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            # Create assignment record
            assignment_record = {
                "id": str(uuid.uuid4()),
                "section_id": section_id,
                "teacher_id": teacher_id,
                "academic_period": academic_period,
                "assigned_by": "system",  # Could be user ID
                "assigned_at": datetime.now(timezone.utc).isoformat(),
                "status": "ACTIVE"
            }
            
            await db.teacher_assignments.insert_one(assignment_record)
            
            return {
                "success": True,
                "message": f"Docente {teacher_name} asignado exitosamente",
                "assignment_id": assignment_record["id"]
            }
            
        except Exception as e:
            logger.error(f"Teacher assignment execution failed: {str(e)}")
            return {"success": False, "message": f"Error ejecutando asignación: {str(e)}"}

    async def _log_teacher_assignment(
        self, 
        section_id: str, 
        teacher_id: str, 
        academic_period: str
    ) -> None:
        """Log teacher assignment for audit"""
        try:
            log_entry = {
                "id": str(uuid.uuid4()),
                "action": "TEACHER_ASSIGNMENT",
                "section_id": section_id,
                "teacher_id": teacher_id,
                "academic_period": academic_period,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "details": {
                    "assignment_type": "MANUAL",
                    "system": "academic_management"
                }
            }
            
            await db.audit_logs.insert_one(log_entry)
            
        except Exception as e:
            logger.error(f"Assignment logging failed: {str(e)}")

    async def _update_teacher_workload_cache(
        self, 
        teacher_id: str, 
        academic_period: str
    ) -> None:
        """Update cached teacher workload information"""
        try:
            workload_info = await self._calculate_teacher_workload(teacher_id, academic_period)
            
            await safe_update_one(
                db.teacher_workloads,
                {
                    "teacher_id": teacher_id,
                    "academic_period": academic_period
                },
                {
                    "$set": {
                        "workload_data": workload_info,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                },
                upsert=True
            )
            
        except Exception as e:
            logger.error(f"Workload cache update failed: {str(e)}")

    async def _calculate_teacher_workload(
        self, 
        teacher_id: str, 
        academic_period: str
    ) -> Dict:
        """Calculate complete teacher workload information"""
        try:
            # Get all sections assigned to teacher
            sections = await db.sections.find({
                "teacher_id": teacher_id,
                "academic_period": academic_period,
                "status": "ACTIVE"
            }).to_list(length=None)
            
            total_hours = 0
            total_students = 0
            courses = []
            schedule_slots = []
            
            for section in sections:
                # Get course info
                course = await db.courses.find_one({"id": section["course_id"]})
                if course:
                    credits = course.get("credits", 0)
                    course_hours = credits * 1.5  # Approximate hours per week
                    total_hours += course_hours
                    
                    courses.append({
                        "course_id": course["id"],
                        "course_name": course["name"],
                        "section_code": section.get("code", ""),
                        "credits": credits,
                        "weekly_hours": course_hours
                    })
                
                # Count students
                student_count = await db.enrollments.count_documents({
                    "section_id": section["id"],
                    "status": {"$in": ["ENROLLED", "COMPLETED"]}
                })
                total_students += student_count
                
                # Collect schedule slots
                schedule = section.get("schedule", {})
                if schedule:
                    schedule_slots.append({
                        "section_id": section["id"],
                        "days": schedule.get("days", []),
                        "start_time": schedule.get("start_time", ""),
                        "end_time": schedule.get("end_time", ""),
                        "classroom": schedule.get("classroom", "")
                    })
            
            return {
                "total_sections": len(sections),
                "total_hours": total_hours,
                "total_students": total_students,
                "courses": courses,
                "schedule_slots": schedule_slots,
                "calculated_at": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Workload calculation failed: {str(e)}")
            return {}

    async def get_teacher_schedule(
        self, 
        teacher_id: str, 
        academic_period: str,
        export_format: str = "json"
    ) -> Dict:
        """Get teacher's complete schedule"""
        try:
            # Get teacher sections
            sections = await db.sections.find({
                "teacher_id": teacher_id,
                "academic_period": academic_period,
                "status": "ACTIVE"
            }).to_list(length=None)
            
            # Build schedule grid
            schedule_grid = {}
            days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
            
            for day in days_of_week:
                schedule_grid[day] = []
            
            for section in sections:
                schedule = section.get("schedule", {})
                days = schedule.get("days", [])
                start_time = schedule.get("start_time", "")
                end_time = schedule.get("end_time", "")
                classroom = schedule.get("classroom", "")
                
                # Get course info
                course = await db.courses.find_one({"id": section["course_id"]})
                course_name = course.get("name", "Curso") if course else "Curso"
                
                for day in days:
                    if day in schedule_grid:
                        schedule_grid[day].append({
                            "start_time": start_time,
                            "end_time": end_time,
                            "course_name": course_name,
                            "section_code": section.get("code", ""),
                            "classroom": classroom,
                            "student_count": await db.enrollments.count_documents({
                                "section_id": section["id"],
                                "status": {"$in": ["ENROLLED", "COMPLETED"]}
                            })
                        })
            
            # Sort by time within each day
            for day in schedule_grid:
                schedule_grid[day].sort(key=lambda x: self._time_to_minutes(x["start_time"]))
            
            # Get teacher info
            teacher = await db.teachers.find_one({"id": teacher_id})
            teacher_name = f"{teacher.get('first_name', '')} {teacher.get('last_name', '')}".strip() if teacher else "Docente"
            
            result = {
                "teacher_id": teacher_id,
                "teacher_name": teacher_name,
                "academic_period": academic_period,
                "schedule": schedule_grid,
                "export_format": export_format,
                "generated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if export_format == "pdf":
                # Return task for PDF generation
                task_id = f"schedule-{teacher_id}-{academic_period}-{datetime.now().timestamp()}"
                result.update({
                    "taskId": task_id,
                    "statusUrl": f"/api/tasks/{task_id}",
                    "message": "Generación de horario PDF iniciada"
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Schedule generation failed: {str(e)}")
            raise Exception(f"Error generando horario: {str(e)}")

    async def suggest_alternative_sections(
        self, 
        course_id: str, 
        academic_period: str,
        exclude_section_id: Optional[str] = None
    ) -> List[Dict]:
        """Suggest alternative sections for a course when conflicts occur"""
        try:
            # Get all sections for the course
            query = {
                "course_id": course_id,
                "academic_period": academic_period,
                "status": "ACTIVE"
            }
            
            if exclude_section_id:
                query["id"] = {"$ne": exclude_section_id}
            
            sections = await db.sections.find(query).to_list(length=None)
            
            suggestions = []
            for section in sections:
                # Check availability
                current_enrollment = await db.enrollments.count_documents({
                    "section_id": section["id"],
                    "status": {"$in": ["ENROLLED", "COMPLETED"]}
                })
                
                max_capacity = section.get("max_capacity", 30)
                available_slots = max_capacity - current_enrollment
                
                if available_slots > 0:
                    # Get teacher info
                    teacher_name = section.get("teacher_name", "Por asignar")
                    
                    suggestions.append({
                        "section_id": section["id"],
                        "section_code": section.get("code", ""),
                        "teacher_name": teacher_name,
                        "schedule": section.get("schedule", {}),
                        "available_slots": available_slots,
                        "max_capacity": max_capacity,
                        "classroom": section.get("schedule", {}).get("classroom", ""),
                        "recommendation_score": self._calculate_recommendation_score(
                            section, available_slots, max_capacity
                        )
                    })
            
            # Sort by recommendation score (higher is better)
            suggestions.sort(key=lambda x: x["recommendation_score"], reverse=True)
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Alternative sections suggestion failed: {str(e)}")
            return []

    def _calculate_recommendation_score(
        self, 
        section: Dict, 
        available_slots: int, 
        max_capacity: int
    ) -> float:
        """Calculate recommendation score for section suggestions"""
        try:
            # Base score from availability (0-100)
            availability_score = (available_slots / max_capacity) * 100
            
            # Bonus for good schedule times (prefer morning/afternoon over evening)
            schedule = section.get("schedule", {})
            start_time = schedule.get("start_time", "08:00")
            time_hour = int(start_time.split(':')[0])
            
            if 8 <= time_hour <= 12:  # Morning
                time_bonus = 20
            elif 13 <= time_hour <= 17:  # Afternoon
                time_bonus = 15
            elif 18 <= time_hour <= 20:  # Evening
                time_bonus = 10
            else:  # Very early or very late
                time_bonus = 5
            
            # Bonus for having assigned teacher
            teacher_bonus = 10 if section.get("teacher_id") else 0
            
            # Penalty for overcrowding (>80% capacity)
            capacity_ratio = (max_capacity - available_slots) / max_capacity
            crowding_penalty = -20 if capacity_ratio > 0.8 else 0
            
            total_score = availability_score + time_bonus + teacher_bonus + crowding_penalty
            
            return max(0, min(100, total_score))  # Clamp to 0-100
            
        except Exception:
            return 50  # Default medium score

# Export manager instance
teacher_section_manager = TeacherSectionManager()