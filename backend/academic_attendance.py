"""
SISTEMA DE ASISTENCIA COMPLETO - Sistema Académico
Implementa registro por sesión, porcentajes, import CSV con previsualización
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, File, UploadFile
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timezone
from pydantic import BaseModel, Field
import pandas as pd
import io
import uuid
import csv

from shared_deps import get_current_user, db, logger
from logging_middleware import get_correlation_id, log_with_correlation, ErrorResponse, ErrorCodes
from fixed_optimizations import performance_monitor
from academic_complete import AttendanceRecord, AttendanceStatus, AttendanceUpdate

attendance_router = APIRouter(prefix="/attendance", tags=["Attendance Management"])

class AttendanceSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    section_id: str
    session_number: int = Field(..., ge=1)
    session_date: date
    topic: Optional[str] = None
    planned: bool = True
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BulkAttendanceUpdate(BaseModel):
    section_id: str
    session_date: date
    session_number: int = Field(..., ge=1)
    attendance_records: List[Dict[str, Any]]  # [{"student_id": "...", "status": "PRESENT"}]

class AttendanceImportPreview(BaseModel):
    preview_data: List[Dict[str, Any]]
    total_records: int
    validation_errors: List[str]
    session_info: Dict[str, Any]

class AttendanceCalculator:
    """Calculadora de porcentajes de asistencia"""
    
    @staticmethod
    async def calculate_student_attendance(student_id: str, section_id: str) -> Dict[str, Any]:
        """Calcular porcentaje de asistencia de un estudiante"""
        
        # Obtener todos los registros de asistencia
        attendance_records = await db.attendance_records.find({
            "student_id": student_id,
            "section_id": section_id
        }).to_list(length=None)
        
        if not attendance_records:
            return {
                "total_sessions": 0,
                "attended_sessions": 0,
                "late_sessions": 0,
                "excused_sessions": 0,
                "absent_sessions": 0,
                "attendance_percentage": 0.0
            }
        
        # Contar por estado
        status_counts = {
            AttendanceStatus.PRESENT: 0,
            AttendanceStatus.LATE: 0,
            AttendanceStatus.EXCUSED: 0,
            AttendanceStatus.ABSENT: 0
        }
        
        for record in attendance_records:
            status = record["status"]
            status_counts[status] = status_counts.get(status, 0) + 1
        
        total_sessions = len(attendance_records)
        attended_sessions = status_counts[AttendanceStatus.PRESENT] + status_counts[AttendanceStatus.LATE]
        attendance_percentage = (attended_sessions / total_sessions * 100) if total_sessions > 0 else 0
        
        return {
            "total_sessions": total_sessions,
            "attended_sessions": attended_sessions,
            "late_sessions": status_counts[AttendanceStatus.LATE],
            "excused_sessions": status_counts[AttendanceStatus.EXCUSED],
            "absent_sessions": status_counts[AttendanceStatus.ABSENT],
            "attendance_percentage": round(attendance_percentage, 2)
        }
    
    @staticmethod
    async def update_enrollment_attendance(student_id: str, section_id: str):
        """Actualizar porcentaje de asistencia en la matrícula"""
        
        attendance_stats = await AttendanceCalculator.calculate_student_attendance(student_id, section_id)
        
        # Actualizar matrícula
        await db.enrollments.update_one(
            {"student_id": student_id, "section_id": section_id},
            {
                "$set": {
                    "total_sessions": attendance_stats["total_sessions"],
                    "attended_sessions": attendance_stats["attended_sessions"],
                    "attendance_percentage": attendance_stats["attendance_percentage"],
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )

@attendance_router.post("/session/create")
@performance_monitor
async def create_attendance_session(
    session_data: AttendanceSession,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Crear sesión de asistencia planificada"""
    correlation_id = get_correlation_id(request)
    
    try:
        # Verificar que la sección existe
        section = await db.sections.find_one({"id": session_data.section_id})
        if not section:
            return ErrorResponse.create(
                code=ErrorCodes.NOT_FOUND,
                message="Sección no encontrada",
                correlation_id=correlation_id,
                status_code=404
            )
        
        # Verificar permisos (docente de la sección o admin)
        if current_user.role not in ["ADMIN", "REGISTRAR"]:
            if current_user.id != section["teacher_id"]:
                return ErrorResponse.create(
                    code=ErrorCodes.AUTHORIZATION_ERROR,
                    message="No autorizado para crear sesiones en esta sección",
                    correlation_id=correlation_id,
                    status_code=403
                )
        
        # Verificar que no existe sesión con mismo número
        existing_session = await db.attendance_sessions.find_one({
            "section_id": session_data.section_id,
            "session_number": session_data.session_number
        })
        
        if existing_session:
            return ErrorResponse.create(
                code=ErrorCodes.DUPLICATE_RESOURCE,
                message=f"Ya existe sesión número {session_data.session_number}",
                correlation_id=correlation_id,
                status_code=400
            )
        
        session_data.created_by = current_user.id
        await db.attendance_sessions.insert_one(session_data.dict())
        
        log_with_correlation(
            logger, "info",
            f"Attendance session created: {session_data.section_id} - Session {session_data.session_number}",
            request,
            user_data={"id": current_user.id, "role": current_user.role}
        )
        
        return {
            "session": session_data,
            "message": "Sesión de asistencia creada exitosamente",
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error creating attendance session: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al crear sesión de asistencia",
            correlation_id=correlation_id,
            status_code=500
        )

@attendance_router.post("/record")
@performance_monitor
async def record_attendance(
    attendance_update: AttendanceUpdate,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Registrar asistencia individual"""
    correlation_id = get_correlation_id(request)
    
    try:
        # Verificar que la matrícula existe
        enrollment = await db.enrollments.find_one({"id": attendance_update.enrollment_id})
        if not enrollment:
            return ErrorResponse.create(
                code=ErrorCodes.NOT_FOUND,
                message="Matrícula no encontrada",
                correlation_id=correlation_id,
                status_code=404
            )
        
        section_id = enrollment["section_id"]
        student_id = enrollment["student_id"]
        
        # Verificar permisos
        section = await db.sections.find_one({"id": section_id})
        if current_user.role not in ["ADMIN", "REGISTRAR"]:
            if current_user.id != section["teacher_id"]:
                return ErrorResponse.create(
                    code=ErrorCodes.AUTHORIZATION_ERROR,
                    message="No autorizado para registrar asistencia",
                    correlation_id=correlation_id,
                    status_code=403
                )
        
        # Verificar/crear sesión de asistencia
        session = await db.attendance_sessions.find_one({
            "section_id": section_id,
            "session_number": attendance_update.session_number,
            "session_date": attendance_update.session_date.isoformat()
        })
        
        if not session:
            # Crear sesión automáticamente
            session_data = AttendanceSession(
                section_id=section_id,
                session_number=attendance_update.session_number,
                session_date=attendance_update.session_date,
                planned=False,
                created_by=current_user.id
            )
            await db.attendance_sessions.insert_one(session_data.dict())
        
        # Verificar si ya existe registro para esta sesión
        existing_record = await db.attendance_records.find_one({
            "section_id": section_id,
            "student_id": student_id,
            "session_date": attendance_update.session_date.isoformat(),
            "session_number": attendance_update.session_number
        })
        
        if existing_record:
            # Actualizar registro existente
            await db.attendance_records.update_one(
                {"id": existing_record["id"]},
                {
                    "$set": {
                        "status": attendance_update.status.value,
                        "notes": attendance_update.notes,
                        "recorded_by": current_user.id,
                        "recorded_at": datetime.now(timezone.utc)
                    }
                }
            )
            action = "UPDATED"
        else:
            # Crear nuevo registro
            attendance_record = AttendanceRecord(
                section_id=section_id,
                student_id=student_id,
                enrollment_id=attendance_update.enrollment_id,
                session_date=attendance_update.session_date,
                session_number=attendance_update.session_number,
                status=attendance_update.status,
                notes=attendance_update.notes,
                recorded_by=current_user.id
            )
            await db.attendance_records.insert_one(attendance_record.dict())
            action = "CREATED"
        
        # Actualizar porcentaje de asistencia en la matrícula
        await AttendanceCalculator.update_enrollment_attendance(student_id, section_id)
        
        log_with_correlation(
            logger, "info",
            f"Attendance {action}: {student_id} - Session {attendance_update.session_number} - {attendance_update.status}",
            request,
            user_data={"id": current_user.id, "role": current_user.role}
        )
        
        return {
            "message": f"Asistencia {action.lower()} exitosamente",
            "action": action,
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error recording attendance: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al registrar asistencia",
            correlation_id=correlation_id,
            status_code=500
        )

@attendance_router.post("/bulk")
@performance_monitor
async def record_bulk_attendance(
    bulk_update: BulkAttendanceUpdate,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Registrar asistencia masiva para una sesión"""
    correlation_id = get_correlation_id(request)
    
    try:
        section_id = bulk_update.section_id
        
        # Verificar permisos
        section = await db.sections.find_one({"id": section_id})
        if not section:
            return ErrorResponse.create(
                code=ErrorCodes.NOT_FOUND,
                message="Sección no encontrada",
                correlation_id=correlation_id,
                status_code=404
            )
        
        if current_user.role not in ["ADMIN", "REGISTRAR"]:
            if current_user.id != section["teacher_id"]:
                return ErrorResponse.create(
                    code=ErrorCodes.AUTHORIZATION_ERROR,
                    message="No autorizado para registrar asistencia",
                    correlation_id=correlation_id,
                    status_code=403
                )
        
        # Crear sesión si no existe
        session = await db.attendance_sessions.find_one({
            "section_id": section_id,
            "session_number": bulk_update.session_number,
            "session_date": bulk_update.session_date.isoformat()
        })
        
        if not session:
            session_data = AttendanceSession(
                section_id=section_id,
                session_number=bulk_update.session_number,
                session_date=bulk_update.session_date,
                planned=False,
                created_by=current_user.id
            )
            await db.attendance_sessions.insert_one(session_data.dict())
        
        # Procesar registros de asistencia
        records_processed = 0
        records_updated = 0
        errors = []
        
        for record_data in bulk_update.attendance_records:
            try:
                student_id = record_data["student_id"]
                status = record_data["status"]
                notes = record_data.get("notes")
                
                # Verificar que el estudiante está matriculado en la sección
                enrollment = await db.enrollments.find_one({
                    "student_id": student_id,
                    "section_id": section_id,
                    "status": "ACTIVE"
                })
                
                if not enrollment:
                    errors.append(f"Estudiante {student_id} no matriculado en la sección")
                    continue
                
                # Verificar si ya existe registro
                existing_record = await db.attendance_records.find_one({
                    "section_id": section_id,
                    "student_id": student_id,
                    "session_date": bulk_update.session_date.isoformat(),
                    "session_number": bulk_update.session_number
                })
                
                if existing_record:
                    # Actualizar
                    await db.attendance_records.update_one(
                        {"id": existing_record["id"]},
                        {
                            "$set": {
                                "status": status,
                                "notes": notes,
                                "recorded_by": current_user.id,
                                "recorded_at": datetime.now(timezone.utc)
                            }
                        }
                    )
                    records_updated += 1
                else:
                    # Crear nuevo
                    attendance_record = AttendanceRecord(
                        section_id=section_id,
                        student_id=student_id,
                        enrollment_id=enrollment["id"],
                        session_date=bulk_update.session_date,
                        session_number=bulk_update.session_number,
                        status=AttendanceStatus(status),
                        notes=notes,
                        recorded_by=current_user.id
                    )
                    await db.attendance_records.insert_one(attendance_record.dict())
                
                # Actualizar porcentaje de asistencia
                await AttendanceCalculator.update_enrollment_attendance(student_id, section_id)
                
                records_processed += 1
                
            except Exception as e:
                errors.append(f"Error procesando estudiante {student_id}: {str(e)}")
        
        log_with_correlation(
            logger, "info",
            f"Bulk attendance processed: {records_processed} records, {records_updated} updated",
            request,
            user_data={"id": current_user.id, "role": current_user.role}
        )
        
        return {
            "message": "Asistencia masiva procesada",
            "records_processed": records_processed,
            "records_updated": records_updated,
            "errors": errors,
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error processing bulk attendance: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al procesar asistencia masiva",
            correlation_id=correlation_id,
            status_code=500
        )

@attendance_router.post("/import/preview")
@performance_monitor
async def preview_csv_import(
    request: Request,
    file: UploadFile = File(...),
    section_id: str = Query(...),
    session_number: int = Query(..., ge=1),
    session_date: str = Query(...),  # YYYY-MM-DD format
    current_user = Depends(get_current_user)
):
    """Previsualizar importación de asistencia desde CSV"""
    correlation_id = get_correlation_id(request)
    
    try:
        # Verificar formato de archivo
        if not file.filename.endswith('.csv'):
            return ErrorResponse.create(
                code=ErrorCodes.VALIDATION_ERROR,
                message="Solo se permiten archivos CSV",
                correlation_id=correlation_id,
                status_code=400
            )
        
        # Leer archivo CSV
        content = await file.read()
        csv_data = content.decode('utf-8')
        
        # Procesar CSV
        csv_reader = csv.DictReader(io.StringIO(csv_data))
        preview_data = []
        validation_errors = []
        
        # Campos requeridos
        required_fields = ['student_code', 'status']
        
        # Verificar encabezados
        if not all(field in csv_reader.fieldnames for field in required_fields):
            return ErrorResponse.create(
                code=ErrorCodes.VALIDATION_ERROR,
                message=f"Campos requeridos: {', '.join(required_fields)}",
                correlation_id=correlation_id,
                status_code=400
            )
        
        # Procesar filas
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 for header
            try:
                student_code = row['student_code'].strip()
                status = row['status'].strip().upper()
                notes = row.get('notes', '').strip()
                
                # Validar código de estudiante
                if not student_code:
                    validation_errors.append(f"Fila {row_num}: Código de estudiante vacío")
                    continue
                
                # Validar estado
                valid_statuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']
                if status not in valid_statuses:
                    validation_errors.append(f"Fila {row_num}: Estado inválido '{status}'. Valores válidos: {', '.join(valid_statuses)}")
                    continue
                
                # Buscar estudiante
                student = await db.students.find_one({"student_code": student_code})
                if not student:
                    validation_errors.append(f"Fila {row_num}: Estudiante no encontrado '{student_code}'")
                    continue
                
                # Verificar matrícula en la sección
                enrollment = await db.enrollments.find_one({
                    "student_id": student["id"],
                    "section_id": section_id,
                    "status": "ACTIVE"
                })
                
                if not enrollment:
                    validation_errors.append(f"Fila {row_num}: Estudiante '{student_code}' no matriculado en la sección")
                    continue
                
                preview_data.append({
                    "row_number": row_num,
                    "student_code": student_code,
                    "student_name": f"{student['first_name']} {student['last_name']}",
                    "status": status,
                    "notes": notes,
                    "valid": True
                })
                
            except Exception as e:
                validation_errors.append(f"Fila {row_num}: Error procesando fila - {str(e)}")
        
        # Información de la sesión
        session_info = {
            "section_id": section_id,
            "session_number": session_number,
            "session_date": session_date,
            "preview_records": len(preview_data),
            "validation_errors": len(validation_errors)
        }
        
        return {
            "preview": AttendanceImportPreview(
                preview_data=preview_data[:50],  # Limitar vista previa a 50 registros
                total_records=len(preview_data),
                validation_errors=validation_errors,
                session_info=session_info
            ),
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error previewing CSV import: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al previsualizar importación",
            correlation_id=correlation_id,
            status_code=500
        )

@attendance_router.get("/section/{section_id}/report")
@performance_monitor
async def get_attendance_report(
    section_id: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Obtener reporte de asistencia de una sección"""
    correlation_id = get_correlation_id(request)
    
    try:
        # Obtener matrículas con porcentajes de asistencia
        pipeline = [
            {"$match": {"section_id": section_id, "status": {"$in": ["ACTIVE", "COMPLETED"]}}},
            {
                "$lookup": {
                    "from": "students",
                    "localField": "student_id",
                    "foreignField": "id",
                    "as": "student_info"
                }
            },
            {
                "$addFields": {
                    "student_name": {
                        "$concat": [
                            {"$arrayElemAt": ["$student_info.first_name", 0]},
                            " ",
                            {"$arrayElemAt": ["$student_info.last_name", 0]}
                        ]
                    },
                    "student_code": {"$arrayElemAt": ["$student_info.student_code", 0]}
                }
            },
            {"$sort": {"student_code": 1}},
            {
                "$project": {
                    "student_id": 1,
                    "student_code": 1,
                    "student_name": 1,
                    "total_sessions": 1,
                    "attended_sessions": 1,
                    "attendance_percentage": 1
                }
            }
        ]
        
        enrollments_cursor = db.enrollments.aggregate(pipeline)
        enrollments = await enrollments_cursor.to_list(length=None)
        
        # Obtener estadísticas generales
        total_students = len(enrollments)
        good_attendance = len([e for e in enrollments if e.get("attendance_percentage", 0) >= 80])
        poor_attendance = len([e for e in enrollments if e.get("attendance_percentage", 0) < 70])
        
        # Promedio de asistencia de la sección
        avg_attendance = sum(e.get("attendance_percentage", 0) for e in enrollments) / total_students if total_students > 0 else 0
        
        return {
            "section_id": section_id,
            "students": enrollments,
            "statistics": {
                "total_students": total_students,
                "average_attendance": round(avg_attendance, 2),
                "good_attendance_count": good_attendance,
                "poor_attendance_count": poor_attendance,
                "good_attendance_percentage": (good_attendance / total_students * 100) if total_students > 0 else 0
            },
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error getting attendance report: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al obtener reporte de asistencia",
            correlation_id=correlation_id,
            status_code=500
        )