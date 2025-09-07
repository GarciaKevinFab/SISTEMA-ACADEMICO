from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks, Query
from fastapi.responses import FileResponse
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import uuid
import os
from pathlib import Path
import qrcode
import io
import base64
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm

from server import get_current_user, db, logger, generate_tracking_code, calculate_deadline, log_procedure_action, send_procedure_notification

mesa_partes_router = APIRouter(prefix="/mesa-partes", tags=["Mesa de Partes"])

# Procedure Types Management
@mesa_partes_router.post("/procedure-types", response_model=Dict[str, Any])
async def create_procedure_type(
    procedure_type_data: dict,
    current_user = Depends(get_current_user)
):
    """Create a new procedure type"""
    try:
        # Check permissions - only admin can create procedure types
        if current_user['role'] not in ['ADMIN']:
            raise HTTPException(status_code=403, detail="No autorizado para crear tipos de trámite")
        
        # Validate required fields
        if not procedure_type_data.get('name'):
            raise HTTPException(status_code=400, detail="El nombre del tipo de trámite es requerido")
        
        if not procedure_type_data.get('area'):
            raise HTTPException(status_code=400, detail="El área del trámite es requerida")
        
        if not isinstance(procedure_type_data.get('processing_days'), int) or procedure_type_data.get('processing_days') <= 0:
            raise HTTPException(status_code=400, detail="Los días de procesamiento deben ser un número entero positivo")
        
        # Check if procedure type already exists
        existing_type = await db.procedure_types.find_one({
            "name": procedure_type_data['name'],
            "area": procedure_type_data['area']
        })
        
        if existing_type:
            raise HTTPException(status_code=400, detail="Ya existe un tipo de trámite con este nombre en esta área")
        
        # Create procedure type
        procedure_type = {
            "id": str(uuid.uuid4()),
            "name": procedure_type_data['name'],
            "description": procedure_type_data.get('description', ''),
            "area": procedure_type_data['area'],
            "required_documents": procedure_type_data.get('required_documents', []),
            "processing_days": procedure_type_data['processing_days'],
            "is_active": procedure_type_data.get('is_active', True),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.procedure_types.insert_one(procedure_type)
        
        logger.info(f"Procedure type created: {procedure_type['name']} by {current_user['username']}")
        
        return {
            "message": "Tipo de trámite creado exitosamente",
            "procedure_type": procedure_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating procedure type: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al crear tipo de trámite")

@mesa_partes_router.get("/procedure-types", response_model=Dict[str, Any])
async def get_procedure_types(
    area: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user = Depends(get_current_user)
):
    """Get procedure types"""
    try:
        # Build query
        query = {}
        
        if area and area != 'ALL':
            query["area"] = area
            
        if is_active is not None:
            query["is_active"] = is_active
        
        # Get procedure types
        procedure_types = await db.procedure_types.find(query).sort("name", 1).to_list(length=None)
        
        # Parse dates back from strings
        for pt in procedure_types:
            if isinstance(pt.get('created_at'), str):
                pt['created_at'] = datetime.fromisoformat(pt['created_at'])
        
        return {
            "procedure_types": procedure_types,
            "total": len(procedure_types)
        }
        
    except Exception as e:
        logger.error(f"Error fetching procedure types: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener tipos de trámite")

# Procedures Management
@mesa_partes_router.post("/procedures", response_model=Dict[str, Any])
async def create_procedure(
    procedure_data: dict,
    current_user = Depends(get_current_user)
):
    """Create a new procedure"""
    try:
        # Validate procedure type exists
        procedure_type = await db.procedure_types.find_one({
            "id": procedure_data.get('procedure_type_id')
        })
        
        if not procedure_type:
            raise HTTPException(status_code=404, detail="Tipo de trámite no encontrado")
        
        # Generate tracking code and calculate deadline
        tracking_code = generate_tracking_code()
        deadline = calculate_deadline(procedure_type['processing_days'])
        
        # Create procedure
        procedure = {
            "id": str(uuid.uuid4()),
            "tracking_code": tracking_code,
            "procedure_type_id": procedure_data['procedure_type_id'],
            "subject": procedure_data['subject'],
            "description": procedure_data['description'],
            "status": "RECEIVED",
            "priority": procedure_data.get('priority', 'NORMAL'),
            "created_by": current_user['id'],
            "applicant_name": procedure_data.get('applicant_name'),
            "applicant_email": procedure_data.get('applicant_email'),
            "applicant_phone": procedure_data.get('applicant_phone'),
            "applicant_document": procedure_data.get('applicant_document'),
            "area": procedure_type['area'],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "deadline": deadline.isoformat(),
            "observations": procedure_data.get('observations'),
            "attachment_ids": [],
            "email_notifications_sent": 0,
            "last_notification_sent": None
        }
        
        await db.procedures.insert_one(procedure)
        
        # Log creation action
        await log_procedure_action(
            procedure_id=procedure['id'],
            action="CREATED",
            performed_by=current_user['id'],
            new_status="RECEIVED",
            comment="Trámite creado"
        )
        
        # Send notification to applicant if email provided
        if procedure_data.get('applicant_email'):
            await send_procedure_notification(
                procedure_id=procedure['id'],
                recipient_email=procedure_data['applicant_email'],
                notification_type="PROCEDURE_CREATED",
                subject=f"Trámite Creado - {tracking_code}",
                content=f"Su trámite '{procedure['subject']}' ha sido recibido. Código de seguimiento: {tracking_code}"
            )
        
        logger.info(f"Procedure created: {tracking_code} by {current_user['username']}")
        
        return {
            "message": "Trámite creado exitosamente",
            "procedure": procedure,
            "tracking_code": tracking_code
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating procedure: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al crear trámite")

@mesa_partes_router.get("/procedures", response_model=Dict[str, Any])
async def get_procedures(
    status: Optional[str] = Query(None),
    area: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user = Depends(get_current_user)
):
    """Get procedures with filtering and pagination"""
    try:
        # Build query based on user role
        query = {}
        
        # Role-based filtering
        if current_user['role'] == 'STUDENT':
            query["created_by"] = current_user['id']
        elif current_user['role'] in ['ADMIN_WORKER', 'TEACHER']:
            if assigned_to:
                query["assigned_to"] = assigned_to
        
        # Additional filters
        if status and status != 'ALL':
            query["status"] = status
            
        if area and area != 'ALL':
            query["area"] = area
            
        if priority and priority != 'ALL':
            query["priority"] = priority
        
        if search:
            query["$or"] = [
                {"tracking_code": {"$regex": search, "$options": "i"}},
                {"subject": {"$regex": search, "$options": "i"}},
                {"applicant_name": {"$regex": search, "$options": "i"}},
                {"applicant_document": {"$regex": search, "$options": "i"}}
            ]
        
        # Get procedures with procedure type details
        pipeline = [
            {"$match": query},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$lookup": {
                    "from": "procedure_types",
                    "localField": "procedure_type_id",
                    "foreignField": "id",
                    "as": "procedure_type_info"
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "created_by",
                    "foreignField": "id",
                    "as": "creator_info"
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "assigned_to",
                    "foreignField": "id",
                    "as": "assignee_info"
                }
            }
        ]
        
        procedures = await db.procedures.aggregate(pipeline).to_list(length=limit)
        
        # Parse dates back from strings
        for procedure in procedures:
            if isinstance(procedure.get('created_at'), str):
                procedure['created_at'] = datetime.fromisoformat(procedure['created_at'])
            if isinstance(procedure.get('updated_at'), str):
                procedure['updated_at'] = datetime.fromisoformat(procedure['updated_at'])
            if isinstance(procedure.get('deadline'), str):
                procedure['deadline'] = datetime.fromisoformat(procedure['deadline'])
        
        total = await db.procedures.count_documents(query)
        
        return {
            "procedures": procedures,
            "total": total,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"Error fetching procedures: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener trámites")

@mesa_partes_router.get("/procedures/{tracking_code}", response_model=Dict[str, Any])
async def get_procedure_by_tracking_code(
    tracking_code: str,
    current_user = Depends(get_current_user)
):
    """Get procedure by tracking code - public endpoint"""
    try:
        # Find procedure
        procedure = await db.procedures.find_one({"tracking_code": tracking_code})
        
        if not procedure:
            raise HTTPException(status_code=404, detail="Trámite no encontrado")
        
        # Get procedure type details
        procedure_type = await db.procedure_types.find_one({"id": procedure['procedure_type_id']})
        
        # Get procedure logs for timeline
        logs = await db.procedure_logs.find({"procedure_id": procedure['id']}).sort("performed_at", 1).to_list(length=None)
        
        # Parse dates
        if isinstance(procedure.get('created_at'), str):
            procedure['created_at'] = datetime.fromisoformat(procedure['created_at'])
        if isinstance(procedure.get('updated_at'), str):
            procedure['updated_at'] = datetime.fromisoformat(procedure['updated_at'])
        if isinstance(procedure.get('deadline'), str):
            procedure['deadline'] = datetime.fromisoformat(procedure['deadline'])
        
        # Public view - only show safe information
        safe_procedure_data = {
            "tracking_code": procedure['tracking_code'],
            "subject": procedure['subject'],
            "status": procedure['status'],
            "priority": procedure['priority'],
            "area": procedure['area'],
            "created_at": procedure['created_at'],
            "deadline": procedure['deadline'],
            "procedure_type": procedure_type['name'] if procedure_type else None,
            "timeline": [
                {
                    "action": log['action'],
                    "status": log.get('new_status'),
                    "comment": log.get('comment'),
                    "performed_at": datetime.fromisoformat(log['performed_at']) if isinstance(log.get('performed_at'), str) else log.get('performed_at')
                }
                for log in logs
            ]
        }
        
        # If user is authenticated and authorized, show more details
        if current_user:
            if (current_user['id'] == procedure['created_by'] or 
                current_user['role'] in ['ADMIN', 'ADMIN_WORKER'] or
                current_user['id'] == procedure.get('assigned_to')):
                
                safe_procedure_data.update({
                    "description": procedure['description'],
                    "observations": procedure.get('observations'),
                    "applicant_name": procedure.get('applicant_name'),
                    "applicant_email": procedure.get('applicant_email'),
                    "applicant_phone": procedure.get('applicant_phone'),
                    "assigned_to": procedure.get('assigned_to'),
                    "resolution": procedure.get('resolution')
                })
        
        return {
            "procedure": safe_procedure_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching procedure {tracking_code}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener trámite")

@mesa_partes_router.put("/procedures/{procedure_id}/status")
async def update_procedure_status(
    procedure_id: str,
    status_data: dict,
    current_user = Depends(get_current_user)
):
    """Update procedure status"""
    try:
        # Check permissions
        if current_user['role'] not in ['ADMIN', 'ADMIN_WORKER']:
            raise HTTPException(status_code=403, detail="No autorizado para actualizar estado de trámites")
        
        # Get procedure
        procedure = await db.procedures.find_one({"id": procedure_id})
        if not procedure:
            raise HTTPException(status_code=404, detail="Trámite no encontrado")
        
        old_status = procedure['status']
        new_status = status_data['status']
        comment = status_data.get('comment', '')
        
        # Update procedure
        update_data = {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # If completing procedure
        if new_status == "COMPLETED":
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
            if status_data.get('resolution'):
                update_data["resolution"] = status_data['resolution']
        
        await db.procedures.update_one(
            {"id": procedure_id},
            {"$set": update_data}
        )
        
        # Log status change
        await log_procedure_action(
            procedure_id=procedure_id,
            action="STATUS_CHANGED",
            performed_by=current_user['id'],
            previous_status=old_status,
            new_status=new_status,
            comment=comment
        )
        
        # Send notification if requested
        if status_data.get('notify_applicant', True) and procedure.get('applicant_email'):
            await send_procedure_notification(
                procedure_id=procedure_id,
                recipient_email=procedure['applicant_email'],
                notification_type="STATUS_CHANGE",
                subject=f"Actualización de Trámite - {procedure['tracking_code']}",
                content=f"Su trámite '{procedure['subject']}' ha cambiado de estado a: {new_status}. {comment}"
            )
        
        logger.info(f"Procedure {procedure['tracking_code']} status updated: {old_status} -> {new_status} by {current_user['username']}")
        
        return {"message": "Estado del trámite actualizado exitosamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating procedure status: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al actualizar estado del trámite")

@mesa_partes_router.post("/procedures/{procedure_id}/documents")
async def upload_procedure_document(
    procedure_id: str,
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    """Upload document for procedure"""
    try:
        # Get procedure
        procedure = await db.procedures.find_one({"id": procedure_id})
        if not procedure:
            raise HTTPException(status_code=404, detail="Trámite no encontrado")
        
        # Check permissions
        if (current_user['id'] != procedure['created_by'] and 
            current_user['role'] not in ['ADMIN', 'ADMIN_WORKER']):
            raise HTTPException(status_code=403, detail="No autorizado para subir documentos a este trámite")
        
        # Validate file
        if file.size > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="El archivo es demasiado grande (máximo 10MB)")
        
        # Create uploads directory if it doesn't exist
        upload_dir = Path("uploads/procedures")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{procedure_id}_{uuid.uuid4()}{file_extension}"
        file_path = upload_dir / unique_filename
        
        # Save file
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Create attachment record
        attachment = {
            "id": str(uuid.uuid4()),
            "procedure_id": procedure_id,
            "file_name": file.filename,
            "file_path": str(file_path),
            "file_size": file.size,
            "file_type": file.content_type,
            "uploaded_by": current_user['id'],
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.procedure_attachments.insert_one(attachment)
        
        # Update procedure with attachment ID
        await db.procedures.update_one(
            {"id": procedure_id},
            {
                "$push": {"attachment_ids": attachment['id']},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        # Log action
        await log_procedure_action(
            procedure_id=procedure_id,
            action="DOCUMENT_UPLOADED",
            performed_by=current_user['id'],
            comment=f"Documento subido: {file.filename}"
        )
        
        logger.info(f"Document uploaded for procedure {procedure['tracking_code']}: {file.filename}")
        
        return {
            "message": "Documento subido exitosamente",
            "attachment": attachment
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al subir documento")

@mesa_partes_router.get("/procedures/{procedure_id}/certificate")
async def generate_procedure_certificate(
    procedure_id: str,
    current_user = Depends(get_current_user)
):
    """Generate procedure certificate PDF"""
    try:
        # Get procedure
        procedure = await db.procedures.find_one({"id": procedure_id})
        if not procedure:
            raise HTTPException(status_code=404, detail="Trámite no encontrado")
        
        # Check permissions
        if (current_user['id'] != procedure['created_by'] and 
            current_user['role'] not in ['ADMIN', 'ADMIN_WORKER']):
            raise HTTPException(status_code=403, detail="No autorizado para generar certificado de este trámite")
        
        # Only generate certificate for completed procedures
        if procedure['status'] != 'COMPLETED':
            raise HTTPException(status_code=400, detail="Solo se pueden generar certificados para trámites completados")
        
        # Get procedure type
        procedure_type = await db.procedure_types.find_one({"id": procedure['procedure_type_id']})
        
        # Create certificates directory if it doesn't exist
        cert_dir = Path("uploads/certificates")
        cert_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate certificate PDF
        cert_filename = f"certificado_{procedure['tracking_code']}.pdf"
        cert_path = cert_dir / cert_filename
        
        # Generate QR code for verification
        qr_data = f"IESPP-CERT-{procedure['tracking_code']}"
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(qr_data)
        qr.make(fit=True)
        
        qr_img = qr.make_image(fill_color="black", back_color="white")
        qr_buffer = io.BytesIO()
        qr_img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)
        
        # Create PDF
        c = canvas.Canvas(str(cert_path), pagesize=A4)
        width, height = A4
        
        # Header
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredText(width/2, height-2*cm, "INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO")
        c.drawCentredText(width/2, height-2.5*cm, '"GUSTAVO ALLENDE LLAVERÍA"')
        
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredText(width/2, height-4*cm, "CONSTANCIA DE TRÁMITE")
        
        # Content
        c.setFont("Helvetica", 12)
        y_pos = height - 6*cm
        
        c.drawString(3*cm, y_pos, f"Código de Seguimiento: {procedure['tracking_code']}")
        y_pos -= 1*cm
        
        c.drawString(3*cm, y_pos, f"Tipo de Trámite: {procedure_type['name'] if procedure_type else 'N/A'}")
        y_pos -= 1*cm
        
        c.drawString(3*cm, y_pos, f"Asunto: {procedure['subject']}")
        y_pos -= 1*cm
        
        c.drawString(3*cm, y_pos, f"Solicitante: {procedure.get('applicant_name', 'N/A')}")
        y_pos -= 1*cm
        
        c.drawString(3*cm, y_pos, f"Estado: {procedure['status']}")
        y_pos -= 1*cm
        
        created_date = datetime.fromisoformat(procedure['created_at']) if isinstance(procedure['created_at'], str) else procedure['created_at']
        c.drawString(3*cm, y_pos, f"Fecha de Solicitud: {created_date.strftime('%d/%m/%Y')}")
        y_pos -= 1*cm
        
        if procedure.get('completed_at'):
            completed_date = datetime.fromisoformat(procedure['completed_at']) if isinstance(procedure['completed_at'], str) else procedure['completed_at']
            c.drawString(3*cm, y_pos, f"Fecha de Completado: {completed_date.strftime('%d/%m/%Y')}")
            y_pos -= 1*cm
        
        if procedure.get('resolution'):
            c.drawString(3*cm, y_pos, f"Resolución: {procedure['resolution']}")
            y_pos -= 1*cm
        
        # QR Code
        c.drawString(width-8*cm, 3*cm, "Código QR para verificación:")
        # Note: In a real implementation, you would embed the QR image here
        
        # Footer
        c.setFont("Helvetica", 10)
        c.drawCentredText(width/2, 2*cm, f"Documento generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        c.drawCentredText(width/2, 1.5*cm, "Este documento es válido solo con código QR")
        
        c.save()
        
        logger.info(f"Certificate generated for procedure {procedure['tracking_code']}")
        
        return FileResponse(
            cert_path,
            media_type='application/pdf',
            filename=cert_filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating certificate: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al generar certificado")

# Dashboard and Statistics
@mesa_partes_router.get("/dashboard/stats")
async def get_mesa_partes_stats(current_user = Depends(get_current_user)):
    """Get Mesa de Partes dashboard statistics"""
    try:
        stats = {}
        
        if current_user['role'] in ['ADMIN', 'ADMIN_WORKER']:
            # Admin stats
            total_procedures = await db.procedures.count_documents({})
            pending_procedures = await db.procedures.count_documents({"status": "RECEIVED"})
            in_process_procedures = await db.procedures.count_documents({"status": "IN_PROCESS"})
            completed_procedures = await db.procedures.count_documents({"status": "COMPLETED"})
            overdue_procedures = await db.procedures.count_documents({
                "deadline": {"$lt": datetime.now(timezone.utc).isoformat()},
                "status": {"$nin": ["COMPLETED", "REJECTED"]}
            })
            
            stats = {
                "total_procedures": total_procedures,
                "pending_procedures": pending_procedures,
                "in_process_procedures": in_process_procedures,
                "completed_procedures": completed_procedures,
                "overdue_procedures": overdue_procedures
            }
        else:
            # User stats
            my_procedures = await db.procedures.count_documents({"created_by": current_user['id']})
            my_pending = await db.procedures.count_documents({
                "created_by": current_user['id'],
                "status": {"$nin": ["COMPLETED", "REJECTED"]}
            })
            
            stats = {
                "my_procedures": my_procedures,
                "my_pending": my_pending
            }
        
        return {"stats": stats}
        
    except Exception as e:
        logger.error(f"Error fetching Mesa de Partes stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener estadísticas")