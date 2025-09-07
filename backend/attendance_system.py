"""
Attendance Management System
Handles session-based attendance with CSV import and error reporting
"""
from datetime import datetime, timezone, date, time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import csv
import io
import uuid

from shared_deps import db, logger
from safe_mongo_operations import safe_update_one, safe_find_one_and_update, MongoUpdateError

class AttendanceStatus(Enum):
    """Attendance status options"""
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LATE = "LATE"
    EXCUSED = "EXCUSED"

@dataclass
class AttendanceRecord:
    """Individual attendance record"""
    student_id: str
    session_id: str
    status: AttendanceStatus
    timestamp: datetime
    notes: str = ""

@dataclass
class ImportError:
    """CSV import error details"""
    row_number: int
    field: str
    value: str
    error_message: str
    suggested_fix: str

class AttendanceSystem:
    """Complete attendance management system"""
    
    def __init__(self):
        self.valid_statuses = [status.value for status in AttendanceStatus]
    
    async def create_attendance_session(
        self,
        section_id: str,
        session_date: date,
        session_name: str,
        teacher_id: str
    ) -> Dict:
        """Create a new attendance session"""
        try:
            # Validate section exists
            section = await db.sections.find_one({"id": section_id})
            if not section:
                return {"success": False, "message": "Sección no encontrada"}
            
            # Check if session already exists for this date
            existing_session = await db.attendance_sessions.find_one({
                "section_id": section_id,
                "session_date": session_date.isoformat()
            })
            
            if existing_session:
                return {
                    "success": False, 
                    "message": f"Ya existe sesión para {session_date}",
                    "existing_session_id": existing_session["id"]
                }
            
            # Create session
            session_id = str(uuid.uuid4())
            session_record = {
                "id": session_id,
                "section_id": section_id,
                "session_date": session_date.isoformat(),
                "session_name": session_name,
                "teacher_id": teacher_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "ACTIVE"
            }
            
            await db.attendance_sessions.insert_one(session_record)
            
            # Initialize attendance records for all enrolled students
            await self._initialize_session_attendance(session_id, section_id)
            
            return {
                "success": True,
                "message": "Sesión de asistencia creada",
                "session_id": session_id,
                "session_date": session_date.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Session creation failed: {str(e)}")
            return {"success": False, "message": f"Error creando sesión: {str(e)}"}

    async def _initialize_session_attendance(
        self,
        session_id: str,
        section_id: str
    ) -> None:
        """Initialize attendance records for all enrolled students"""
        try:
            # Get enrolled students
            enrollments = await db.enrollments.find({
                "section_id": section_id,
                "status": {"$in": ["ENROLLED", "COMPLETED"]}
            }).to_list(length=None)
            
            # Create attendance records with default ABSENT status
            attendance_records = []
            for enrollment in enrollments:
                record = {
                    "id": str(uuid.uuid4()),
                    "session_id": session_id,
                    "section_id": section_id,
                    "student_id": enrollment["student_id"],
                    "status": AttendanceStatus.ABSENT.value,  # Default to absent
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "notes": "",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                attendance_records.append(record)
            
            if attendance_records:
                await db.attendance_records.insert_many(attendance_records)
                
        except Exception as e:
            logger.error(f"Session attendance initialization failed: {str(e)}")

    async def record_attendance(
        self,
        session_id: str,
        student_id: str,
        status: str,
        notes: str = "",
        teacher_id: Optional[str] = None
    ) -> Dict:
        """Record attendance for a student in a session"""
        try:
            # Validate status
            if status not in self.valid_statuses:
                return {
                    "success": False,
                    "message": f"Estado inválido: {status}. Válidos: {', '.join(self.valid_statuses)}"
                }
            
            # Update attendance record
            update_result = await safe_find_one_and_update(
                db.attendance_records,
                {
                    "session_id": session_id,
                    "student_id": student_id
                },
                {
                    "$set": {
                        "status": status,
                        "notes": notes,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "recorded_by": teacher_id
                    }
                }
            )
            
            if not update_result:
                return {"success": False, "message": "Registro de asistencia no encontrado"}
            
            return {
                "success": True,
                "message": f"Asistencia registrada: {status}",
                "student_id": student_id,
                "status": status
            }
            
        except Exception as e:
            logger.error(f"Attendance recording failed: {str(e)}")
            return {"success": False, "message": f"Error registrando asistencia: {str(e)}"}

    async def import_attendance_csv_preview(
        self,
        csv_content: str,
        session_id: str
    ) -> Dict:
        """Preview CSV import with error detection and validation"""
        try:
            # Parse CSV content
            csv_file = io.StringIO(csv_content)
            csv_reader = csv.DictReader(csv_file)
            
            preview_data = []
            import_errors = []
            row_number = 0
            
            # Expected columns
            required_columns = ["student_id", "student_name", "status"]
            optional_columns = ["notes", "timestamp"]
            
            # Validate headers
            if not csv_reader.fieldnames:
                return {
                    "success": False,
                    "message": "Archivo CSV vacío o sin encabezados"
                }
            
            missing_columns = [col for col in required_columns if col not in csv_reader.fieldnames]
            if missing_columns:
                return {
                    "success": False,
                    "message": f"Columnas faltantes: {', '.join(missing_columns)}",
                    "expected_columns": required_columns + optional_columns
                }
            
            # Get session information for validation
            session = await db.attendance_sessions.find_one({"id": session_id})
            if not session:
                return {"success": False, "message": "Sesión no encontrada"}
            
            # Get enrolled students for validation
            enrolled_students = await self._get_enrolled_students(session["section_id"])
            enrolled_student_ids = {s["id"] for s in enrolled_students}
            
            # Process each row
            for row in csv_reader:
                row_number += 1
                errors_in_row = []
                
                # Validate student_id
                student_id = row.get("student_id", "").strip()
                if not student_id:
                    errors_in_row.append(ImportError(
                        row_number=row_number,
                        field="student_id",
                        value=student_id,
                        error_message="ID de estudiante vacío",
                        suggested_fix="Proporcionar ID de estudiante válido"
                    ))
                elif student_id not in enrolled_student_ids:
                    errors_in_row.append(ImportError(
                        row_number=row_number,
                        field="student_id", 
                        value=student_id,
                        error_message="Estudiante no inscrito en la sección",
                        suggested_fix="Verificar ID de estudiante o inscripción"
                    ))
                
                # Validate status
                status = row.get("status", "").strip().upper()
                if not status:
                    errors_in_row.append(ImportError(
                        row_number=row_number,
                        field="status",
                        value=status,
                        error_message="Estado de asistencia vacío",
                        suggested_fix=f"Usar uno de: {', '.join(self.valid_statuses)}"
                    ))
                elif status not in self.valid_statuses:
                    errors_in_row.append(ImportError(
                        row_number=row_number,
                        field="status",
                        value=status,
                        error_message="Estado de asistencia inválido",
                        suggested_fix=f"Usar uno de: {', '.join(self.valid_statuses)}"
                    ))
                
                # Validate timestamp if provided
                timestamp_str = row.get("timestamp", "").strip()
                if timestamp_str:
                    try:
                        # Try to parse timestamp
                        datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    except ValueError:
                        errors_in_row.append(ImportError(
                            row_number=row_number,
                            field="timestamp",
                            value=timestamp_str,
                            error_message="Formato de timestamp inválido",
                            suggested_fix="Usar formato ISO: YYYY-MM-DDTHH:MM:SS"
                        ))
                
                # Add to preview if no critical errors
                if not errors_in_row:
                    # Get student name for display
                    student_name = row.get("student_name", "").strip()
                    if not student_name:
                        # Try to get from database
                        student = await db.students.find_one({"id": student_id})
                        if student:
                            student_name = f"{student.get('first_name', '')} {student.get('last_name', '')}".strip()
                    
                    preview_data.append({
                        "row_number": row_number,
                        "student_id": student_id,
                        "student_name": student_name,
                        "status": status,
                        "notes": row.get("notes", "").strip(),
                        "timestamp": timestamp_str or datetime.now(timezone.utc).isoformat()
                    })
                else:
                    import_errors.extend(errors_in_row)
            
            # Generate summary
            total_rows = row_number
            valid_rows = len(preview_data)
            error_rows = len(set(err.row_number for err in import_errors))
            
            return {
                "success": True,
                "message": f"Previsualización generada: {valid_rows}/{total_rows} filas válidas",
                "preview": preview_data,
                "errors": [
                    {
                        "row": err.row_number,
                        "field": err.field,
                        "value": err.value,
                        "message": err.error_message,
                        "fix": err.suggested_fix
                    }
                    for err in import_errors
                ],
                "summary": {
                    "total_rows": total_rows,
                    "valid_rows": valid_rows,
                    "error_rows": error_rows,
                    "can_import": error_rows == 0
                },
                "session_id": session_id
            }
            
        except Exception as e:
            logger.error(f"CSV preview failed: {str(e)}")
            return {
                "success": False,
                "message": f"Error procesando CSV: {str(e)}"
            }

    async def import_attendance_csv_save(
        self,
        preview_data: List[Dict],
        session_id: str,
        teacher_id: str
    ) -> Dict:
        """Save validated CSV attendance data"""
        try:
            # Validate session exists
            session = await db.attendance_sessions.find_one({"id": session_id})
            if not session:
                return {"success": False, "message": "Sesión no encontrada"}
            
            # Save each attendance record
            saved_records = []
            errors = []
            
            for record in preview_data:
                try:
                    result = await self.record_attendance(
                        session_id,
                        record["student_id"],
                        record["status"],
                        record.get("notes", ""),
                        teacher_id
                    )
                    
                    if result["success"]:
                        saved_records.append({
                            "student_id": record["student_id"],
                            "student_name": record["student_name"],
                            "status": record["status"]
                        })
                    else:
                        errors.append({
                            "student_id": record["student_id"],
                            "error": result["message"]
                        })
                        
                except Exception as e:
                    errors.append({
                        "student_id": record["student_id"],
                        "error": str(e)
                    })
            
            # Update session with import information
            await safe_update_one(
                db.attendance_sessions,
                {"id": session_id},
                {
                    "$set": {
                        "csv_imported_at": datetime.now(timezone.utc).isoformat(),
                        "csv_imported_by": teacher_id,
                        "csv_import_stats": {
                            "total_records": len(preview_data),
                            "saved_records": len(saved_records),
                            "errors": len(errors)
                        }
                    }
                }
            )
            
            return {
                "success": len(errors) == 0,
                "message": f"Asistencia importada: {len(saved_records)} registros" + 
                          (f", {len(errors)} errores" if errors else ""),
                "saved_records": saved_records,
                "errors": errors,
                "session_id": session_id
            }
            
        except Exception as e:
            logger.error(f"CSV save failed: {str(e)}")
            return {
                "success": False,
                "message": f"Error guardando asistencia: {str(e)}"
            }

    async def get_session_attendance(
        self,
        session_id: str,
        include_student_info: bool = True
    ) -> Dict:
        """Get complete attendance for a session"""
        try:
            # Get session information
            session = await db.attendance_sessions.find_one({"id": session_id})
            if not session:
                return {"success": False, "message": "Sesión no encontrada"}
            
            # Get attendance records
            attendance_records = await db.attendance_records.find({
                "session_id": session_id
            }).to_list(length=None)
            
            # Enrich with student information if requested
            if include_student_info:
                enriched_records = []
                for record in attendance_records:
                    student = await db.students.find_one({"id": record["student_id"]})
                    
                    enriched_record = {
                        **record,
                        "student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip() if student else "Estudiante",
                        "student_code": student.get("student_code", "") if student else ""
                    }
                    enriched_records.append(enriched_record)
                
                attendance_records = enriched_records
            
            # Calculate statistics
            status_counts = {}
            for status in self.valid_statuses:
                status_counts[status] = sum(1 for r in attendance_records if r["status"] == status)
            
            total_students = len(attendance_records)
            attendance_rate = (status_counts.get("PRESENT", 0) / total_students * 100) if total_students > 0 else 0
            
            return {
                "success": True,
                "session_info": session,
                "attendance_records": attendance_records,
                "statistics": {
                    "total_students": total_students,
                    "attendance_rate": round(attendance_rate, 2),
                    "status_counts": status_counts
                }
            }
            
        except Exception as e:
            logger.error(f"Session attendance retrieval failed: {str(e)}")
            return {
                "success": False,
                "message": f"Error obteniendo asistencia: {str(e)}"
            }

    async def generate_attendance_report(
        self,
        section_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict:
        """Generate consolidated attendance report for section"""
        try:
            # Build date filter
            date_filter = {"section_id": section_id}
            if start_date:
                if not end_date:
                    end_date = date.today()
                
                date_filter["session_date"] = {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            
            # Get sessions in date range
            sessions = await db.attendance_sessions.find(date_filter).to_list(length=None)
            
            if not sessions:
                return {
                    "success": False,
                    "message": "No hay sesiones en el período seleccionado"
                }
            
            # Get all attendance records for these sessions
            session_ids = [s["id"] for s in sessions]
            attendance_records = await db.attendance_records.find({
                "session_id": {"$in": session_ids}
            }).to_list(length=None)
            
            # Group by student
            student_attendance = {}
            for record in attendance_records:
                student_id = record["student_id"]
                if student_id not in student_attendance:
                    student_attendance[student_id] = {
                        "student_id": student_id,
                        "sessions": {},
                        "totals": {status: 0 for status in self.valid_statuses}
                    }
                
                session_id = record["session_id"]
                status = record["status"]
                
                student_attendance[student_id]["sessions"][session_id] = {
                    "status": status,
                    "timestamp": record["timestamp"],
                    "notes": record.get("notes", "")
                }
                
                student_attendance[student_id]["totals"][status] += 1
            
            # Enrich with student information and calculate rates
            report_data = []
            for student_id, attendance_data in student_attendance.items():
                student = await db.students.find_one({"id": student_id})
                
                total_sessions = len(sessions)
                present_count = attendance_data["totals"]["PRESENT"]
                attendance_rate = (present_count / total_sessions * 100) if total_sessions > 0 else 0
                
                report_entry = {
                    "student_id": student_id,
                    "student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip() if student else "Estudiante",
                    "student_code": student.get("student_code", "") if student else "",
                    "attendance_rate": round(attendance_rate, 2),
                    "session_totals": attendance_data["totals"],
                    "detailed_sessions": []
                }
                
                # Add session details
                for session in sessions:
                    session_attendance = attendance_data["sessions"].get(session["id"], {
                        "status": "NO_DATA",
                        "timestamp": "",
                        "notes": ""
                    })
                    
                    report_entry["detailed_sessions"].append({
                        "session_date": session["session_date"],
                        "session_name": session["session_name"],
                        "status": session_attendance["status"],
                        "notes": session_attendance["notes"]
                    })
                
                report_data.append(report_entry)
            
            # Sort by attendance rate (descending)
            report_data.sort(key=lambda x: x["attendance_rate"], reverse=True)
            
            # Calculate section statistics
            total_students = len(report_data)
            average_attendance = sum(s["attendance_rate"] for s in report_data) / total_students if total_students > 0 else 0
            
            return {
                "success": True,
                "report_data": report_data,
                "period_info": {
                    "section_id": section_id,
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None,
                    "total_sessions": len(sessions),
                    "total_students": total_students
                },
                "section_statistics": {
                    "average_attendance_rate": round(average_attendance, 2),
                    "students_above_80": sum(1 for s in report_data if s["attendance_rate"] >= 80),
                    "students_below_70": sum(1 for s in report_data if s["attendance_rate"] < 70)
                }
            }
            
        except Exception as e:
            logger.error(f"Attendance report generation failed: {str(e)}")
            return {
                "success": False,
                "message": f"Error generando reporte: {str(e)}"
            }

    async def _get_enrolled_students(self, section_id: str) -> List[Dict]:
        """Get enrolled students for a section"""
        try:
            enrollments = await db.enrollments.find({
                "section_id": section_id,
                "status": {"$in": ["ENROLLED", "COMPLETED"]}
            }).to_list(length=None)
            
            students = []
            for enrollment in enrollments:
                student = await db.students.find_one({"id": enrollment["student_id"]})
                if student:
                    students.append({
                        "id": student["id"],
                        "name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
                        "code": student.get("student_code", "")
                    })
            
            return students
            
        except Exception:
            return []

# Export system instance
attendance_system = AttendanceSystem()