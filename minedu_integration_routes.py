"""
MINEDU Integration Routes
API endpoints for MINEDU integration management and monitoring
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase

from auth import get_current_user, check_permissions
from database import get_database
from integration.minedu.producer import MINEDUProducer, EntityType
from integration.minedu.worker import MINEDUWorker
from integration.minedu.outbox_repo import OutboxRepository
from scripts.reconcile_minedu import MINEDUReconciler

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/minedu", tags=["MINEDU Integration"])

# Pydantic Models
class OutboxEventCreate(BaseModel):
    entity_type: str = Field(..., description="Tipo de entidad")
    entity_id: str = Field(..., description="ID de la entidad")
    period_id: str = Field(..., description="ID del período")
    payload: Dict[str, Any] = Field(..., description="Datos a enviar")
    version: int = Field(default=1, description="Versión del evento")

class OutboxEventResponse(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    period_id: str
    status: str
    retry_count: int
    created_at: str
    updated_at: str
    error_message: Optional[str] = None

class IntegrationStats(BaseModel):
    pending: int = 0
    sending: int = 0
    sent: int = 0
    acked: int = 0
    retry: int = 0
    failed: int = 0
    dead_letter: int = 0
    circuit_breaker: Dict[str, Any] = {}

class ReconciliationRequest(BaseModel):
    period_id: str = Field(..., description="Período a conciliar")
    auto_reprocess: bool = Field(default=True, description="Reprocesar automáticamente")

class ReprocessRequest(BaseModel):
    event_ids: Optional[List[str]] = Field(None, description="IDs específicos a reprocesar")
    status_filter: Optional[str] = Field(None, description="Filtro por estado")
    limit: int = Field(default=10, ge=1, le=100, description="Límite de eventos")

@router.post("/events", response_model=Dict[str, str])
async def create_outbox_event(
    event: OutboxEventCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Crear evento en outbox para envío a MINEDU"""
    
    # Verificar permisos - solo ADMIN, REGISTRAR, ADMIN_ACADEMIC
    check_permissions(current_user, ["ADMIN", "REGISTRAR", "ADMIN_ACADEMIC"])
    
    try:
        producer = MINEDUProducer(db)
        
        # Convertir string a enum
        entity_type_enum = EntityType(event.entity_type)
        
        # Crear evento
        event_id = await producer.create_outbox_event(
            entity_type=entity_type_enum,
            entity_id=event.entity_id,
            period_id=event.period_id,
            payload=event.payload,
            version=event.version
        )
        
        logger.info(f"Created MINEDU event {event_id} by user {current_user['email']}")
        
        return {
            "event_id": event_id,
            "message": "Evento creado exitosamente",
            "status": "PENDING"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Tipo de entidad inválido: {e}")
    except Exception as e:
        logger.error(f"Error creating MINEDU event: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/events/{event_id}", response_model=OutboxEventResponse)
async def get_outbox_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Obtener evento específico del outbox"""
    
    check_permissions(current_user, ["ADMIN", "REGISTRAR", "ADMIN_ACADEMIC"])
    
    try:
        outbox_repo = OutboxRepository(db)
        event = await outbox_repo.find_by_id(event_id)
        
        if not event:
            raise HTTPException(status_code=404, detail="Evento no encontrado")
        
        return OutboxEventResponse(
            id=event["id"],
            entity_type=event["entity_type"],
            entity_id=event["entity_id"],
            period_id=event["period_id"],
            status=event["status"],
            retry_count=event.get("retry_count", 0),
            created_at=event["created_at"],
            updated_at=event["updated_at"],
            error_message=event.get("error_message")
        )
        
    except Exception as e:
        logger.error(f"Error fetching MINEDU event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/events", response_model=List[OutboxEventResponse])
async def list_outbox_events(
    status: Optional[str] = Query(None, description="Filtrar por estado"),
    entity_type: Optional[str] = Query(None, description="Filtrar por tipo de entidad"),
    period_id: Optional[str] = Query(None, description="Filtrar por período"),
    limit: int = Query(50, ge=1, le=200, description="Límite de resultados"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Listar eventos del outbox con filtros"""
    
    check_permissions(current_user, ["ADMIN", "REGISTRAR", "ADMIN_ACADEMIC"])
    
    try:
        outbox_repo = OutboxRepository(db)
        
        # Construir filtros
        query = {}
        if status:
            query["status"] = status
        if entity_type:
            query["entity_type"] = entity_type
        if period_id:
            query["period_id"] = period_id
        
        # Obtener eventos
        cursor = db.minedu_outbox.find(query).limit(limit).sort("created_at", -1)
        events = await cursor.to_list(length=None)
        
        return [
            OutboxEventResponse(
                id=event["id"],
                entity_type=event["entity_type"],
                entity_id=event["entity_id"],
                period_id=event["period_id"],
                status=event["status"],
                retry_count=event.get("retry_count", 0),
                created_at=event["created_at"],
                updated_at=event["updated_at"],
                error_message=event.get("error_message")
            )
            for event in events
        ]
        
    except Exception as e:
        logger.error(f"Error listing MINEDU events: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/stats", response_model=IntegrationStats)
async def get_integration_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Obtener estadísticas de integración MINEDU"""
    
    check_permissions(current_user, ["ADMIN", "REGISTRAR", "ADMIN_ACADEMIC"])
    
    try:
        worker = MINEDUWorker(db)
        stats = await worker.get_processing_stats()
        
        return IntegrationStats(
            pending=stats.get("PENDING", 0),
            sending=stats.get("SENDING", 0),
            sent=stats.get("SENT", 0),
            acked=stats.get("ACKED", 0),
            retry=stats.get("RETRY", 0),
            failed=stats.get("FAILED", 0),
            dead_letter=stats.get("DEAD_LETTER", 0),
            circuit_breaker=stats.get("CIRCUIT_BREAKER", {})
        )
        
    except Exception as e:
        logger.error(f"Error fetching MINEDU stats: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/reconcile", response_model=Dict[str, Any])
async def reconcile_period(
    request: ReconciliationRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Ejecutar conciliación para un período específico"""
    
    check_permissions(current_user, ["ADMIN", "REGISTRAR"])
    
    try:
        reconciler = MINEDUReconciler(db)
        result = await reconciler.reconcile_period(request.period_id)
        
        logger.info(f"Reconciliation completed by {current_user['email']} for period {request.period_id}")
        
        return {
            "success": True,
            "message": f"Conciliación completada para período {request.period_id}",
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Error in reconciliation for period {request.period_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error en conciliación: {str(e)}")

@router.get("/reconciliation/history", response_model=List[Dict[str, Any]])
async def get_reconciliation_history(
    period_id: Optional[str] = Query(None, description="Filtrar por período"),
    limit: int = Query(10, ge=1, le=50, description="Límite de resultados"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Obtener historial de conciliaciones"""
    
    check_permissions(current_user, ["ADMIN", "REGISTRAR", "ADMIN_ACADEMIC"])
    
    try:
        reconciler = MINEDUReconciler(db)
        history = await reconciler.get_reconciliation_history(period_id, limit)
        
        return history
        
    except Exception as e:
        logger.error(f"Error fetching reconciliation history: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/reprocess", response_model=Dict[str, Any])
async def reprocess_events(
    request: ReprocessRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Reprocesar eventos fallidos o específicos"""
    
    check_permissions(current_user, ["ADMIN", "REGISTRAR"])
    
    try:
        worker = MINEDUWorker(db)
        outbox_repo = OutboxRepository(db)
        
        reprocessed = 0
        
        if request.event_ids:
            # Reprocesar eventos específicos
            for event_id in request.event_ids:
                success = await outbox_repo.update_status(
                    event_id,
                    "PENDING",
                    {"retry_count": 0, "error_message": "Manual reprocessing"}
                )
                if success:
                    reprocessed += 1
        else:
            # Reprocesar por filtro de estado
            criteria = {}
            if request.status_filter:
                criteria["status"] = request.status_filter
            else:
                criteria["status"] = "FAILED"
            
            reprocessed = await outbox_repo.bulk_reprocess_by_criteria(
                criteria, 
                request.limit
            )
        
        logger.info(f"Reprocessed {reprocessed} events by user {current_user['email']}")
        
        return {
            "success": True,
            "message": f"Se reprocesaron {reprocessed} eventos",
            "reprocessed_count": reprocessed
        }
        
    except Exception as e:
        logger.error(f"Error reprocessing events: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/enrollments/sync", response_model=Dict[str, str])
async def sync_enrollment_to_minedu(
    student_id: str,
    course_id: str,
    period_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Sincronizar matrícula específica con MINEDU"""
    
    check_permissions(current_user, ["ADMIN", "REGISTRAR", "ADMIN_ACADEMIC"])
    
    try:
        # Obtener datos de matrícula
        enrollment = await db.enrollments.find_one({
            "student_id": student_id,
            "course_id": course_id,
            "period_id": period_id
        })
        
        if not enrollment:
            raise HTTPException(status_code=404, detail="Matrícula no encontrada")
        
        # Crear evento MINEDU
        producer = MINEDUProducer(db)
        event_id = await producer.create_enrollment_event(
            student_id=student_id,
            course_id=course_id,
            period_id=period_id,
            enrollment_data={
                "enrollment_date": enrollment.get("enrollment_date"),
                "status": enrollment.get("status"),
                "credits": enrollment.get("credits", 0)
            }
        )
        
        logger.info(f"Synced enrollment {student_id}:{course_id} to MINEDU by {current_user['email']}")
        
        return {
            "event_id": event_id,
            "message": "Matrícula sincronizada con MINEDU",
            "student_id": student_id,
            "course_id": course_id
        }
        
    except Exception as e:
        logger.error(f"Error syncing enrollment to MINEDU: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/grades/sync", response_model=Dict[str, str])
async def sync_grade_to_minedu(
    student_id: str,
    course_id: str,
    period_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Sincronizar calificación específica con MINEDU"""
    
    check_permissions(current_user, ["ADMIN", "REGISTRAR", "TEACHER"])
    
    try:
        # Obtener datos de calificación
        grade = await db.grades.find_one({
            "student_id": student_id,
            "course_id": course_id,
            "period_id": period_id
        })
        
        if not grade:
            raise HTTPException(status_code=404, detail="Calificación no encontrada")
        
        # Crear evento MINEDU
        producer = MINEDUProducer(db)
        event_id = await producer.create_grade_event(
            student_id=student_id,
            course_id=course_id,
            period_id=period_id,
            grade_data={
                "numerical_grade": grade.get("numerical_grade"),
                "literal_grade": grade.get("literal_grade"),
                "status": grade.get("status"),
                "evaluation_date": grade.get("evaluation_date")
            }
        )
        
        logger.info(f"Synced grade {student_id}:{course_id} to MINEDU by {current_user['email']}")
        
        return {
            "event_id": event_id,
            "message": "Calificación sincronizada con MINEDU",
            "student_id": student_id,
            "course_id": course_id
        }
        
    except Exception as e:
        logger.error(f"Error syncing grade to MINEDU: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.delete("/events/{event_id}")
async def delete_outbox_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Eliminar evento del outbox (solo ADMIN)"""
    
    check_permissions(current_user, ["ADMIN"])
    
    try:
        result = await db.minedu_outbox.delete_one({"id": event_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Evento no encontrado")
        
        logger.info(f"Deleted MINEDU event {event_id} by {current_user['email']}")
        
        return {"message": "Evento eliminado exitosamente"}
        
    except Exception as e:
        logger.error(f"Error deleting MINEDU event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/maintenance/cleanup")
async def cleanup_old_events(
    days_old: int = Query(30, ge=7, le=365, description="Días de antigüedad"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Limpiar eventos antiguos (solo ADMIN)"""
    
    check_permissions(current_user, ["ADMIN"])
    
    try:
        outbox_repo = OutboxRepository(db)
        cleaned = await outbox_repo.cleanup_old_events(days_old)
        
        logger.info(f"Cleaned {cleaned} old MINEDU events by {current_user['email']}")
        
        return {
            "message": f"Se limpiaron {cleaned} eventos antiguos",
            "cleaned_count": cleaned,
            "days_old": days_old
        }
        
    except Exception as e:
        logger.error(f"Error cleaning old events: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/maintenance/reset-stuck")
async def reset_stuck_events(
    hours_stuck: int = Query(2, ge=1, le=24, description="Horas atascado"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Resetear eventos atascados en SENDING (solo ADMIN)"""
    
    check_permissions(current_user, ["ADMIN"])
    
    try:
        outbox_repo = OutboxRepository(db)
        reset = await outbox_repo.reset_stuck_events(hours_stuck)
        
        logger.info(f"Reset {reset} stuck MINEDU events by {current_user['email']}")
        
        return {
            "message": f"Se resetearon {reset} eventos atascados",
            "reset_count": reset,
            "hours_stuck": hours_stuck
        }
        
    except Exception as e:
        logger.error(f"Error resetting stuck events: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")