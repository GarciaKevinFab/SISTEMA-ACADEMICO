"""
Attendance Management API Routes
Session-based attendance with CSV import and comprehensive reporting
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, date
import io

from shared_deps import get_current_user, db, logger
from logging_middleware import log_with_correlation, ErrorResponse, ErrorCodes
from attendance_system import attendance_system, AttendanceStatus

attendance_router = APIRouter(prefix="/attendance", tags=["Attendance Management"])

# Pydantic Models
class AttendanceSessionCreate(BaseModel):
    section_id: str = Field(..., description="Section identifier")
    session_date: date = Field(..., description="Session date")
    session_name: str = Field(..., description="Session name/description")

class AttendanceRecord(BaseModel):
    student_id: str = Field(..., description="Student identifier")
    status: str = Field(..., description="Attendance status")
    notes: str = Field(default="", description="Optional notes")

class AttendanceRecordBatch(BaseModel):
    session_id: str = Field(..., description="Session identifier")
    records: List[AttendanceRecord] = Field(..., description="Attendance records")

class AttendanceReportRequest(BaseModel):
    section_id: str = Field(..., description="Section identifier")
    start_date: Optional[date] = Field(None, description="Report start date")
    end_date: Optional[date] = Field(None, description="Report end date")

class AttendanceResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

@attendance_router.post("/sessions", response_model=AttendanceResponse)
async def create_attendance_session(
    request: AttendanceSessionCreate,
    current_user = Depends(get_current_user)
):
    """
    Create new attendance session for a section
    Initializes attendance records for all enrolled students
    """
    correlation_id = log_with_correlation("attendance_session_create_start", {
        "section_id": request.section_id,
        "session_date": request.session_date.isoformat(),
        "teacher_id": current_user.get("id")
    })
    
    try:
        # Permission check
        if current_user.get("role") not in ["TEACHER", "ADMIN_ACADEMIC", "REGISTRAR"]:
            raise HTTPException(
                status_code=403,
                detail="Solo docentes pueden crear sesiones de asistencia"
            )
        
        # Validate section assignment for teachers
        if current_user.get("role") == "TEACHER":
            section = await db.sections.find_one({"id": request.section_id})
            if not section or section.get("teacher_id") != current_user.get("id"):
                raise HTTPException(
                    status_code=403,
                    detail="No está asignado a esta sección"
                )
        
        # Create session
        result = await attendance_system.create_attendance_session(
            request.section_id,
            request.session_date,
            request.session_name,
            current_user.get("id")
        )
        
        if not result["success"]:
            status_code = 409 if "Ya existe" in result["message"] else 400
            raise HTTPException(status_code=status_code, detail=result["message"])
        
        log_with_correlation("attendance_session_create_complete", {
            "session_id": result["session_id"]
        }, correlation_id)
        
        return AttendanceResponse(
            success=True,
            message=result["message"],
            data={
                "session_id": result["session_id"],
                "session_date": result["session_date"],
                "section_id": request.section_id
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_with_correlation("attendance_session_create_error", {
            "error": str(e)
        }, correlation_id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error creando sesión de asistencia: {str(e)}"
        )

@attendance_router.post("/record", response_model=AttendanceResponse)
async def record_attendance_batch(
    request: AttendanceRecordBatch,
    current_user = Depends(get_current_user)
):
    """
    Record attendance for multiple students in a session
    Batch operation for efficiency
    """
    correlation_id = log_with_correlation("attendance_record_start", {
        "session_id": request.session_id,
        "record_count": len(request.records),
        "teacher_id": current_user.get("id")
    })
    
    try:
        # Permission check
        if current_user.get("role") not in ["TEACHER", "ADMIN_ACADEMIC", "REGISTRAR"]:
            raise HTTPException(
                status_code=403,
                detail="Solo docentes pueden registrar asistencia"
            )
        
        # Validate session exists and get section
        session = await db.attendance_sessions.find_one({"id": request.session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
        # Validate section assignment for teachers
        if current_user.get("role") == "TEACHER":
            section = await db.sections.find_one({"id": session["section_id"]})
            if not section or section.get("teacher_id") != current_user.get("id"):
                raise HTTPException(
                    status_code=403,
                    detail="No está asignado a esta sección"
                )
        
        # Record each attendance
        recorded_results = []
        errors = []
        
        for record in request.records:
            result = await attendance_system.record_attendance(
                request.session_id,
                record.student_id,
                record.status,
                record.notes,
                current_user.get("id")
            )
            
            if result["success"]:
                recorded_results.append({
                    "student_id": record.student_id,
                    "status": record.status
                })
            else:
                errors.append({
                    "student_id": record.student_id,
                    "error": result["message"]
                })
        
        log_with_correlation("attendance_record_complete", {
            "recorded_count": len(recorded_results),
            "error_count": len(errors)
        }, correlation_id)
        
        return AttendanceResponse(
            success=len(errors) == 0,
            message=f"Asistencia registrada: {len(recorded_results)} estudiantes" + 
                   (f", {len(errors)} errores" if errors else ""),
            data={
                "recorded_attendance": recorded_results,
                "errors": errors,
                "session_id": request.session_id
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_with_correlation("attendance_record_error", {
            "error": str(e)
        }, correlation_id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error registrando asistencia: {str(e)}"
        )

@attendance_router.post("/import/preview")
async def import_attendance_csv_preview(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    """
    Preview CSV import with error detection and validation
    Shows preview data and any import errors before saving
    """
    correlation_id = log_with_correlation("attendance_import_preview_start", {
        "session_id": session_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "teacher_id": current_user.get("id")
    })
    
    try:
        # Permission check
        if current_user.get("role") not in ["TEACHER", "ADMIN_ACADEMIC", "REGISTRAR"]:
            raise HTTPException(
                status_code=403,
                detail="Solo docentes pueden importar asistencia"
            )
        
        # Validate file type
        if not file.content_type.startswith('text/') and file.content_type != 'application/vnd.ms-excel':
            raise HTTPException(
                status_code=400,
                detail="Solo se permiten archivos CSV (.csv)"
            )
        
        # Read file content
        content = await file.read()
        csv_content = content.decode('utf-8')
        
        # Generate preview
        result = await attendance_system.import_attendance_csv_preview(
            csv_content,
            session_id
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        
        log_with_correlation("attendance_import_preview_complete", {
            "total_rows": result["summary"]["total_rows"],
            "valid_rows": result["summary"]["valid_rows"],
            "error_rows": result["summary"]["error_rows"]
        }, correlation_id)
        
        return {
            "success": True,
            "message": result["message"],
            "preview": result["preview"],
            "errors": result["errors"],
            "summary": result["summary"],
            "can_import": result["summary"]["can_import"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_with_correlation("attendance_import_preview_error", {
            "error": str(e)
        }, correlation_id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando archivo CSV: {str(e)}"
        )

@attendance_router.post("/import/save")
async def import_attendance_csv_save(
    request: Dict[str, Any],
    current_user = Depends(get_current_user)
):
    """
    Save validated CSV attendance data
    Requires preview data from previous step
    """
    correlation_id = log_with_correlation("attendance_import_save_start", {
        "session_id": request.get("session_id"),
        "record_count": len(request.get("preview_data", [])),
        "teacher_id": current_user.get("id")
    })
    
    try:
        # Permission check
        if current_user.get("role") not in ["TEACHER", "ADMIN_ACADEMIC", "REGISTRAR"]:
            raise HTTPException(
                status_code=403,
                detail="Solo docentes pueden guardar asistencia importada"
            )
        
        # Validate required fields
        session_id = request.get("session_id")
        preview_data = request.get("preview_data", [])
        
        if not session_id:
            raise HTTPException(status_code=400, detail="ID de sesión requerido")
        if not preview_data:
            raise HTTPException(status_code=400, detail="Datos de previsualización requeridos")
        
        # Save imported data
        result = await attendance_system.import_attendance_csv_save(
            preview_data,
            session_id,
            current_user.get("id")
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        
        log_with_correlation("attendance_import_save_complete", {
            "saved_records": len(result["saved_records"]),
            "errors": len(result["errors"])
        }, correlation_id)
        
        return AttendanceResponse(
            success=True,
            message=result["message"],
            data={
                "saved_records": result["saved_records"],
                "errors": result["errors"],
                "session_id": result["session_id"]
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_with_correlation("attendance_import_save_error", {
            "error": str(e)
        }, correlation_id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error guardando asistencia importada: {str(e)}"
        )

@attendance_router.get("/sessions/{session_id}")
async def get_session_attendance(
    session_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get complete attendance for a specific session
    Includes student information and statistics
    """
    try:
        # Permission check
        if current_user.get("role") not in ["TEACHER", "ADMIN_ACADEMIC", "REGISTRAR", "STUDENT"]:
            raise HTTPException(
                status_code=403,
                detail="No autorizado para ver asistencia"
            )
        
        # Get session attendance
        result = await attendance_system.get_session_attendance(
            session_id,
            include_student_info=True
        )
        
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["message"])
        
        # Filter data for students (only their own attendance)
        if current_user.get("role") == "STUDENT":
            student_records = [
                r for r in result["attendance_records"] 
                if r["student_id"] == current_user.get("id")
            ]
            result["attendance_records"] = student_records
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session attendance retrieval error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo asistencia de sesión: {str(e)}"
        )

@attendance_router.post("/reports", response_model=AttendanceResponse)
async def generate_attendance_report(
    request: AttendanceReportRequest,
    current_user = Depends(get_current_user)
):
    """
    Generate consolidated attendance report for section
    Includes statistics and detailed breakdown by student
    """
    correlation_id = log_with_correlation("attendance_report_start", {
        "section_id": request.section_id,
        "start_date": request.start_date.isoformat() if request.start_date else None,
        "end_date": request.end_date.isoformat() if request.end_date else None,
        "user_id": current_user.get("id")
    })
    
    try:
        # Permission check
        if current_user.get("role") not in ["TEACHER", "ADMIN_ACADEMIC", "REGISTRAR"]:
            raise HTTPException(
                status_code=403,
                detail="Solo docentes y administradores pueden generar reportes"
            )
        
        # Generate report
        result = await attendance_system.generate_attendance_report(
            request.section_id,
            request.start_date,
            request.end_date
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        
        log_with_correlation("attendance_report_complete", {
            "total_students": result["period_info"]["total_students"],
            "total_sessions": result["period_info"]["total_sessions"]
        }, correlation_id)
        
        return AttendanceResponse(
            success=True,
            message="Reporte de asistencia generado exitosamente",
            data=result
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_with_correlation("attendance_report_error", {
            "error": str(e)
        }, correlation_id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error generando reporte de asistencia: {str(e)}"
        )

@attendance_router.get("/section/{section_id}/sessions")
async def get_section_sessions(
    section_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get all attendance sessions for a section
    Ordered by date descending
    """
    try:
        # Permission check
        if current_user.get("role") not in ["TEACHER", "ADMIN_ACADEMIC", "REGISTRAR"]:
            raise HTTPException(
                status_code=403,
                detail="No autorizado para ver sesiones de asistencia"
            )
        
        # Get sessions
        sessions = await db.attendance_sessions.find({
            "section_id": section_id
        }).sort("session_date", -1).to_list(length=None)
        
        # Enrich with statistics
        enriched_sessions = []
        for session in sessions:
            # Get attendance statistics
            attendance_records = await db.attendance_records.find({
                "session_id": session["id"]
            }).to_list(length=None)
            
            status_counts = {}
            for status in attendance_system.valid_statuses:
                status_counts[status] = sum(1 for r in attendance_records if r["status"] == status)
            
            total_students = len(attendance_records)
            attendance_rate = (status_counts.get("PRESENT", 0) / total_students * 100) if total_students > 0 else 0
            
            enriched_session = {
                **session,
                "statistics": {
                    "total_students": total_students,
                    "attendance_rate": round(attendance_rate, 2),
                    "status_counts": status_counts
                }
            }
            enriched_sessions.append(enriched_session)
        
        return {
            "section_id": section_id,
            "sessions": enriched_sessions,
            "total_sessions": len(enriched_sessions)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Section sessions retrieval error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo sesiones: {str(e)}"
        )

@attendance_router.get("/statuses")
async def get_attendance_statuses():
    """
    Get available attendance status options
    Public reference information
    """
    return {
        "valid_statuses": attendance_system.valid_statuses,
        "status_descriptions": {
            "PRESENT": "Presente - Estudiante asistió a la sesión",
            "ABSENT": "Ausente - Estudiante no asistió",
            "LATE": "Tardanza - Estudiante llegó tarde",
            "EXCUSED": "Justificado - Ausencia justificada"
        },
        "default_status": "ABSENT",
        "csv_format": {
            "required_columns": ["student_id", "student_name", "status"],
            "optional_columns": ["notes", "timestamp"],
            "example_row": {
                "student_id": "EST001",
                "student_name": "Juan Pérez",
                "status": "PRESENT",
                "notes": "Participó activamente",
                "timestamp": "2025-01-15T08:00:00"
            }
        }
    }