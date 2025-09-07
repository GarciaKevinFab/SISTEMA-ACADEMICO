"""
SISTEMA DE CALIFICACIONES COMPLETO - Sistema Académico
Implementa calificaciones parciales, finales, conversión AD/A/B/C, actas oficiales con QR
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, BackgroundTasks
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timezone
from pydantic import BaseModel, Field
from enum import Enum
import uuid
import qrcode
import io
import base64
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from shared_deps import get_current_user, db, logger
from logging_middleware import get_correlation_id, log_with_correlation, ErrorResponse, ErrorCodes
from fixed_optimizations import performance_monitor
from academic_complete import GradeUpdate, EnrollmentComplete

grades_router = APIRouter(prefix="/grades", tags=["Grades Management"])

class GradeType(str, Enum):
    PARTIAL_1 = "PARTIAL_1"
    PARTIAL_2 = "PARTIAL_2"
    PARTIAL_3 = "PARTIAL_3"
    FINAL = "FINAL"

class ActaStatus(str, Enum):
    DRAFT = "DRAFT"
    LOCKED = "LOCKED"
    PUBLISHED = "PUBLISHED"

class GradeEntry(BaseModel):
    enrollment_id: str
    grade_type: GradeType
    grade_value: float = Field(..., ge=0, le=20)
    recorded_by: str
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notes: Optional[str] = None

class ActaOficial(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    section_id: str
    course_id: str
    teacher_id: str
    academic_year: int = Field(..., ge=2020, le=2030)
    academic_period: str = Field(..., min_length=1, max_length=10)
    acta_number: str = Field(..., min_length=1, max_length=20)
    status: ActaStatus = ActaStatus.DRAFT
    enrollments_data: List[Dict[str, Any]] = Field(default_factory=list)
    qr_code: Optional[str] = None
    pdf_path: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    locked_at: Optional[datetime] = None
    locked_by: Optional[str] = None
    published_at: Optional[datetime] = None
    published_by: Optional[str] = None

class GradeCalculator:
    """Calculadora de calificaciones y conversiones"""
    
    @staticmethod
    def calculate_final_grade(partial1: Optional[float], partial2: Optional[float], 
                            partial3: Optional[float], final: Optional[float]) -> Optional[float]:
        """Calcular nota final (promedio de parciales + final)"""
        partials = [g for g in [partial1, partial2, partial3] if g is not None]
        
        if not partials or final is None:
            return None
        
        # Promedio de parciales (60%) + Examen final (40%)
        partial_average = sum(partials) / len(partials)
        final_grade = (partial_average * 0.6) + (final * 0.4)
        
        return round(final_grade, 2)
    
    @staticmethod
    def convert_to_literal(numerical_grade: float) -> str:
        """Convertir nota numérica (0-20) a literal (AD/A/B/C)"""
        if numerical_grade >= 18:
            return "AD"  # Logro destacado
        elif numerical_grade >= 14:
            return "A"   # Logro esperado
        elif numerical_grade >= 11:
            return "B"   # En proceso
        else:
            return "C"   # En inicio
    
    @staticmethod
    def is_passing_grade(numerical_grade: float) -> bool:
        """Verificar si la nota es aprobatoria"""
        return numerical_grade >= 11

class QRGenerator:
    """Generador de códigos QR para actas"""
    
    @staticmethod
    def generate_qr_code(acta_id: str) -> str:
        """Generar código QR para verificación de acta"""
        verification_url = f"https://sistema.gustavo-allende.edu.pe/verificar/{acta_id}"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(verification_url)
        qr.make(fit=True)
        
        # Crear imagen
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convertir a base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return img_str

class ActaPDFGenerator:
    """Generador de PDFs para actas oficiales"""
    
    @staticmethod
    def generate_acta_pdf(acta: ActaOficial, course_info: Dict, section_info: Dict, 
                         teacher_info: Dict, enrollments: List[Dict]) -> str:
        """Generar PDF del acta oficial"""
        
        # Crear archivo temporal
        pdf_filename = f"/tmp/acta_{acta.id}.pdf"
        
        # Crear documento
        doc = SimpleDocTemplate(pdf_filename, pagesize=A4)
        elements = []
        styles = getSampleStyleSheet()
        
        # Estilo personalizado para título
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=30,
            alignment=1  # Centrado
        )
        
        # Título
        title = Paragraph(
            "IESPP 'GUSTAVO ALLENDE LLAVERÍA'<br/>ACTA DE EVALUACIÓN OFICIAL",
            title_style
        )
        elements.append(title)
        elements.append(Spacer(1, 20))
        
        # Información del curso
        info_data = [
            ["ACTA N°:", acta.acta_number],
            ["CURSO:", f"{course_info['code']} - {course_info['name']}"],
            ["SECCIÓN:", section_info['section_code']],
            ["DOCENTE:", teacher_info['full_name']],
            ["PERÍODO:", f"{acta.academic_year} - {acta.academic_period}"],
            ["FECHA:", datetime.now().strftime("%d/%m/%Y")]
        ]
        
        info_table = Table(info_data, colWidths=[2*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        
        elements.append(info_table)
        elements.append(Spacer(1, 30))
        
        # Tabla de calificaciones
        grade_headers = [
            "N°", "CÓDIGO", "APELLIDOS Y NOMBRES", 
            "PARCIAL 1", "PARCIAL 2", "PARCIAL 3", "FINAL", "PROMEDIO", "LITERAL"
        ]
        
        grade_data = [grade_headers]
        
        for i, enrollment in enumerate(enrollments, 1):
            student_info = enrollment.get('student_info', {})
            full_name = f"{student_info.get('last_name', '')} {student_info.get('second_last_name', '')}, {student_info.get('first_name', '')}"
            
            grade_data.append([
                str(i),
                student_info.get('student_code', ''),
                full_name,
                str(enrollment.get('partial_grade_1', '-')),
                str(enrollment.get('partial_grade_2', '-')),
                str(enrollment.get('partial_grade_3', '-')),
                str(enrollment.get('final_grade', '-')),
                str(enrollment.get('final_numerical_grade', '-')),
                enrollment.get('final_literal_grade', '-')
            ])
        
        # Crear tabla de calificaciones
        grade_table = Table(grade_data, colWidths=[
            0.4*inch, 0.8*inch, 2.5*inch, 0.6*inch, 0.6*inch, 
            0.6*inch, 0.6*inch, 0.7*inch, 0.6*inch
        ])
        
        grade_table.setStyle(TableStyle([
            # Encabezados
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            
            # Datos
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            
            # Nombres a la izquierda
            ('ALIGN', (2, 1), (2, -1), 'LEFT'),
        ]))
        
        elements.append(grade_table)
        elements.append(Spacer(1, 30))
        
        # Estadísticas
        total_students = len(enrollments)
        approved = len([e for e in enrollments if e.get('final_numerical_grade', 0) >= 11])
        failed = total_students - approved
        
        stats_data = [
            ["RESUMEN ESTADÍSTICO"],
            [f"Total de estudiantes: {total_students}"],
            [f"Aprobados: {approved}"],
            [f"Desaprobados: {failed}"],
            [f"Porcentaje de aprobación: {(approved/total_students*100):.1f}%"]
        ]
        
        stats_table = Table(stats_data, colWidths=[4*inch])
        stats_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        
        elements.append(stats_table)
        elements.append(Spacer(1, 40))
        
        # Firmas
        signature_data = [
            ["", ""],
            ["_________________________", "_________________________"],
            ["DOCENTE", "COORDINADOR ACADÉMICO"],
            [teacher_info['full_name'], ""],
        ]
        
        signature_table = Table(signature_data, colWidths=[3*inch, 3*inch])
        signature_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 2), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 20),
        ]))
        
        elements.append(signature_table)
        
        # QR Code
        if acta.qr_code:
            elements.append(Spacer(1, 20))
            qr_text = Paragraph(
                f"<b>Verificación QR:</b> Escanee para verificar autenticidad<br/>ID: {acta.id}",
                styles['Normal']
            )
            elements.append(qr_text)
        
        # Construir PDF
        doc.build(elements)
        
        return pdf_filename

@grades_router.post("/entry")
@performance_monitor
async def record_grade(
    grade_entry: GradeEntry,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Registrar calificaciones parciales o finales"""
    correlation_id = get_correlation_id(request)
    
    try:
        # Verificar que la matrícula existe
        enrollment = await db.enrollments.find_one({"id": grade_entry.enrollment_id})
        if not enrollment:
            return ErrorResponse.create(
                code=ErrorCodes.NOT_FOUND,
                message="Matrícula no encontrada",
                correlation_id=correlation_id,
                status_code=404
            )
        
        # Verificar que el usuario puede calificar (docente del curso o admin)
        if current_user.role not in ["ADMIN", "REGISTRAR"]:
            if current_user.id != enrollment["teacher_id"]:
                return ErrorResponse.create(
                    code=ErrorCodes.AUTHORIZATION_ERROR,
                    message="No autorizado para calificar este curso",
                    correlation_id=correlation_id,
                    status_code=403
                )
        
        # Verificar que las notas no están bloqueadas
        if enrollment.get("grade_locked", False):
            return ErrorResponse.create(
                code=ErrorCodes.BUSINESS_RULE_VIOLATION,
                message="Las calificaciones están bloqueadas",
                correlation_id=correlation_id,
                status_code=400
            )
        
        # Actualizar la calificación correspondiente
        update_field = {
            GradeType.PARTIAL_1: "partial_grade_1",
            GradeType.PARTIAL_2: "partial_grade_2", 
            GradeType.PARTIAL_3: "partial_grade_3",
            GradeType.FINAL: "final_grade"
        }[grade_entry.grade_type]
        
        update_data = {
            update_field: grade_entry.grade_value,
            "updated_at": datetime.now(timezone.utc)
        }
        
        # Si es nota final, calcular promedio y literal
        if grade_entry.grade_type == GradeType.FINAL:
            final_grade = GradeCalculator.calculate_final_grade(
                enrollment.get("partial_grade_1"),
                enrollment.get("partial_grade_2"),
                enrollment.get("partial_grade_3"),
                grade_entry.grade_value
            )
            
            if final_grade is not None:
                update_data["final_numerical_grade"] = final_grade
                update_data["final_literal_grade"] = GradeCalculator.convert_to_literal(final_grade)
        
        # Actualizar matrícula
        await db.enrollments.update_one(
            {"id": grade_entry.enrollment_id},
            {"$set": update_data}
        )
        
        # Registrar en auditoría
        audit_record = {
            "id": str(uuid.uuid4()),
            "action": "GRADE_RECORDED",
            "enrollment_id": grade_entry.enrollment_id,
            "grade_type": grade_entry.grade_type.value,
            "grade_value": grade_entry.grade_value,
            "recorded_by": current_user.id,
            "recorded_at": datetime.now(timezone.utc),
            "notes": grade_entry.notes,
            "correlation_id": correlation_id
        }
        
        await db.grade_audit.insert_one(audit_record)
        
        log_with_correlation(
            logger, "info",
            f"Grade recorded: {grade_entry.grade_type} = {grade_entry.grade_value} for enrollment {grade_entry.enrollment_id}",
            request,
            user_data={"id": current_user.id, "role": current_user.role}
        )
        
        return {
            "message": "Calificación registrada exitosamente",
            "grade_entry": grade_entry,
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error recording grade: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al registrar calificación",
            correlation_id=correlation_id,
            status_code=500
        )

@grades_router.get("/section/{section_id}")
@performance_monitor
async def get_section_grades(
    section_id: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Obtener calificaciones de una sección"""
    correlation_id = get_correlation_id(request)
    
    try:
        # Obtener matrículas con información de estudiantes
        pipeline = [
            {"$match": {"section_id": section_id, "status": "ACTIVE"}},
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
                    "student_code": {"$arrayElemAt": ["$student_info.student_code", 0]},
                    "course_name": {"$arrayElemAt": ["$course_info.name", 0]},
                    "course_code": {"$arrayElemAt": ["$course_info.code", 0]}
                }
            },
            {"$sort": {"student_code": 1}}
        ]
        
        enrollments_cursor = db.enrollments.aggregate(pipeline)
        enrollments = await enrollments_cursor.to_list(length=None)
        
        # Calcular estadísticas
        total_students = len(enrollments)
        with_grades = len([e for e in enrollments if e.get("final_numerical_grade") is not None])
        approved = len([e for e in enrollments if (e.get("final_numerical_grade") or 0) >= 11])
        
        return {
            "section_id": section_id,
            "enrollments": enrollments,
            "statistics": {
                "total_students": total_students,
                "with_grades": with_grades,
                "approved": approved,
                "pending_grades": total_students - with_grades,
                "approval_rate": (approved / total_students * 100) if total_students > 0 else 0
            },
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error getting section grades: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al obtener calificaciones",
            correlation_id=correlation_id,
            status_code=500
        )

@grades_router.post("/lock-section/{section_id}")
@performance_monitor
async def lock_section_grades(
    section_id: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Bloquear calificaciones de una sección (inmovilización)"""
    correlation_id = get_correlation_id(request)
    
    try:
        # Verificar permisos
        if current_user.role not in ["ADMIN", "REGISTRAR"]:
            return ErrorResponse.create(
                code=ErrorCodes.AUTHORIZATION_ERROR,
                message="No autorizado para bloquear calificaciones",
                correlation_id=correlation_id,
                status_code=403
            )
        
        # Verificar que todas las notas finales están completas
        incomplete_grades = await db.enrollments.count_documents({
            "section_id": section_id,
            "status": "ACTIVE",
            "final_numerical_grade": {"$exists": False}
        })
        
        if incomplete_grades > 0:
            return ErrorResponse.create(
                code=ErrorCodes.BUSINESS_RULE_VIOLATION,
                message=f"Hay {incomplete_grades} calificaciones incompletas",
                correlation_id=correlation_id,
                status_code=400
            )
        
        # Bloquear todas las matrículas de la sección
        current_time = datetime.now(timezone.utc)
        
        result = await db.enrollments.update_many(
            {"section_id": section_id, "status": "ACTIVE"},
            {
                "$set": {
                    "grade_locked": True,
                    "grade_locked_at": current_time,
                    "grade_locked_by": current_user.id,
                    "status": "COMPLETED"
                }
            }
        )
        
        # Registrar en auditoría
        audit_record = {
            "id": str(uuid.uuid4()),
            "action": "GRADES_LOCKED",
            "section_id": section_id,
            "locked_by": current_user.id,
            "locked_at": current_time,
            "enrollments_affected": result.modified_count,
            "correlation_id": correlation_id
        }
        
        await db.grade_audit.insert_one(audit_record)
        
        log_with_correlation(
            logger, "info",
            f"Section grades locked: {section_id}, {result.modified_count} enrollments affected",
            request,
            user_data={"id": current_user.id, "role": current_user.role}
        )
        
        return {
            "message": f"Calificaciones bloqueadas exitosamente: {result.modified_count} matrículas",
            "locked_at": current_time,
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error locking grades: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al bloquear calificaciones",
            correlation_id=correlation_id,
            status_code=500
        )

@grades_router.post("/acta/{section_id}")
@performance_monitor
async def generate_acta_oficial(
    section_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """Generar acta oficial con QR verificable"""
    correlation_id = get_correlation_id(request)
    
    try:
        # Verificar permisos
        if current_user.role not in ["ADMIN", "REGISTRAR", "TEACHER"]:
            return ErrorResponse.create(
                code=ErrorCodes.AUTHORIZATION_ERROR,
                message="No autorizado para generar actas",
                correlation_id=correlation_id,
                status_code=403
            )
        
        # Obtener información de la sección
        section = await db.sections.find_one({"id": section_id})
        if not section:
            return ErrorResponse.create(
                code=ErrorCodes.NOT_FOUND,
                message="Sección no encontrada",
                correlation_id=correlation_id,
                status_code=404
            )
        
        # Verificar que las calificaciones están bloqueadas
        locked_enrollments = await db.enrollments.count_documents({
            "section_id": section_id,
            "grade_locked": True
        })
        
        total_enrollments = await db.enrollments.count_documents({
            "section_id": section_id
        })
        
        if locked_enrollments != total_enrollments:
            return ErrorResponse.create(
                code=ErrorCodes.BUSINESS_RULE_VIOLATION,
                message="Las calificaciones deben estar bloqueadas antes de generar el acta",
                correlation_id=correlation_id,
                status_code=400
            )
        
        # Crear acta
        acta_number = f"ACTA-{section['academic_year']}-{section['academic_period']}-{section_id[:8]}"
        
        acta = ActaOficial(
            section_id=section_id,
            course_id=section["course_id"],
            teacher_id=section["teacher_id"],
            academic_year=section["academic_year"],
            academic_period=section["academic_period"],
            acta_number=acta_number,
            created_by=current_user.id
        )
        
        # Generar QR
        acta.qr_code = QRGenerator.generate_qr_code(acta.id)
        
        # Obtener matrículas para el acta
        enrollments = await get_section_grades(section_id, request, current_user)
        acta.enrollments_data = enrollments["enrollments"]
        
        # Guardar acta en base de datos
        await db.actas_oficiales.insert_one(acta.dict())
        
        # Programar generación de PDF en background
        background_tasks.add_task(generate_acta_pdf_background, acta.id)
        
        log_with_correlation(
            logger, "info",
            f"Official acta generated: {acta_number}",
            request,
            user_data={"id": current_user.id, "role": current_user.role}
        )
        
        return {
            "acta": acta,
            "message": "Acta oficial generada exitosamente",
            "verification_url": f"/verificar/{acta.id}",
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error generating acta: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al generar acta oficial",
            correlation_id=correlation_id,
            status_code=500
        )

async def generate_acta_pdf_background(acta_id: str):
    """Generar PDF del acta en background"""
    try:
        # Obtener acta
        acta_data = await db.actas_oficiales.find_one({"id": acta_id})
        if not acta_data:
            return
        
        acta = ActaOficial(**acta_data)
        
        # Obtener información adicional
        course_info = await db.courses.find_one({"id": acta.course_id})
        section_info = await db.sections.find_one({"id": acta.section_id})
        teacher_info = await db.users.find_one({"id": acta.teacher_id})
        
        # Generar PDF
        pdf_path = ActaPDFGenerator.generate_acta_pdf(
            acta, course_info, section_info, teacher_info, acta.enrollments_data
        )
        
        # Actualizar acta con ruta del PDF
        await db.actas_oficiales.update_one(
            {"id": acta_id},
            {"$set": {"pdf_path": pdf_path}}
        )
        
        logger.info(f"PDF generated for acta: {acta_id}")
        
    except Exception as e:
        logger.error(f"Error generating PDF for acta {acta_id}: {str(e)}")

@grades_router.get("/verificar/{acta_id}")
async def verify_acta(acta_id: str, request: Request):
    """Verificación pública de acta oficial"""
    correlation_id = get_correlation_id(request)
    
    try:
        acta = await db.actas_oficiales.find_one({"id": acta_id})
        if not acta:
            return ErrorResponse.create(
                code=ErrorCodes.NOT_FOUND,
                message="Acta no encontrada",
                correlation_id=correlation_id,
                status_code=404
            )
        
        # Información pública de verificación
        return {
            "valid": True,
            "acta_number": acta["acta_number"],
            "academic_year": acta["academic_year"],
            "academic_period": acta["academic_period"],
            "created_at": acta["created_at"],
            "status": acta["status"],
            "verification_date": datetime.now(timezone.utc),
            "correlation_id": correlation_id
        }
        
    except Exception as e:
        log_with_correlation(logger, "error", f"Error verifying acta: {str(e)}", request)
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error al verificar acta",
            correlation_id=correlation_id,
            status_code=500
        )