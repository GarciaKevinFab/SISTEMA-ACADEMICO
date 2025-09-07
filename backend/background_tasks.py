"""
Background Tasks Manager for Sistema Académico
Handles PDF generation, exports, and heavy computations asynchronously
"""
import asyncio
import uuid
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Callable
from enum import Enum
import logging
from pathlib import Path
import traceback

logger = logging.getLogger("api.background")

class TaskStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"  
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

class BackgroundTask:
    """Background task representation"""
    
    def __init__(self, task_id: str, task_type: str, params: Dict[str, Any], user_id: str):
        self.task_id = task_id
        self.task_type = task_type
        self.params = params
        self.user_id = user_id
        self.status = TaskStatus.PENDING
        self.created_at = datetime.now(timezone.utc)
        self.started_at = None
        self.completed_at = None
        self.result = None
        self.error = None
        self.progress = 0
        self.progress_message = "Tarea iniciada"

    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary for API responses"""
        return {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "status": self.status.value,
            "progress": self.progress,
            "progress_message": self.progress_message,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "result": self.result,
            "error": self.error
        }

class BackgroundTaskManager:
    """Manages background tasks execution"""
    
    def __init__(self):
        self.tasks: Dict[str, BackgroundTask] = {}
        self.task_handlers: Dict[str, Callable] = {}
        self.running_tasks = set()
        
    def register_handler(self, task_type: str, handler: Callable):
        """Register a task handler"""
        self.task_handlers[task_type] = handler
        logger.info(f"Registered handler for task type: {task_type}")
    
    def create_task(self, task_type: str, params: Dict[str, Any], user_id: str) -> str:
        """Create a new background task"""
        task_id = str(uuid.uuid4())
        task = BackgroundTask(task_id, task_type, params, user_id)
        self.tasks[task_id] = task
        
        logger.info(f"Created background task {task_id} of type {task_type}")
        return task_id
    
    async def execute_task(self, task_id: str):
        """Execute a background task"""
        if task_id not in self.tasks:
            return
        
        task = self.tasks[task_id]
        
        if task.task_type not in self.task_handlers:
            task.status = TaskStatus.FAILED
            task.error = f"No handler found for task type: {task.task_type}"
            return
        
        try:
            task.status = TaskStatus.RUNNING
            task.started_at = datetime.now(timezone.utc)
            task.progress = 10
            task.progress_message = "Ejecutando tarea..."
            
            self.running_tasks.add(task_id)
            
            # Execute the task
            handler = self.task_handlers[task.task_type]
            result = await handler(task)
            
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now(timezone.utc)
            task.result = result
            task.progress = 100
            task.progress_message = "Tarea completada exitosamente"
            
            logger.info(f"Background task {task_id} completed successfully")
            
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.completed_at = datetime.now(timezone.utc)
            task.error = str(e)
            task.progress_message = f"Error: {str(e)}"
            
            logger.error(f"Background task {task_id} failed: {str(e)}")
            logger.error(traceback.format_exc())
            
        finally:
            self.running_tasks.discard(task_id)
    
    def start_task(self, task_id: str):
        """Start a background task"""
        asyncio.create_task(self.execute_task(task_id))
    
    def get_task(self, task_id: str) -> Optional[BackgroundTask]:
        """Get task by ID"""
        return self.tasks.get(task_id)
    
    def get_user_tasks(self, user_id: str, limit: int = 20) -> list:
        """Get tasks for a specific user"""
        user_tasks = [
            task for task in self.tasks.values() 
            if task.user_id == user_id
        ]
        
        # Sort by creation date (newest first)
        user_tasks.sort(key=lambda t: t.created_at, reverse=True)
        
        return user_tasks[:limit]
    
    def cleanup_old_tasks(self, max_age_hours: int = 24):
        """Clean up old completed/failed tasks"""
        cutoff = datetime.now(timezone.utc).timestamp() - (max_age_hours * 3600)
        
        tasks_to_remove = []
        for task_id, task in self.tasks.items():
            if (task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED] and 
                task.completed_at and 
                task.completed_at.timestamp() < cutoff):
                tasks_to_remove.append(task_id)
        
        for task_id in tasks_to_remove:
            del self.tasks[task_id]
        
        logger.info(f"Cleaned up {len(tasks_to_remove)} old tasks")

# Global task manager
task_manager = BackgroundTaskManager()

# Task Handlers
async def generate_pdf_certificate_handler(task: BackgroundTask) -> Dict[str, Any]:
    """Handler for PDF certificate generation"""
    try:
        task.progress = 20
        task.progress_message = "Generando certificado PDF..."
        
        # Simulate PDF generation
        await asyncio.sleep(2)  # Simulate work
        
        task.progress = 50
        task.progress_message = "Añadiendo código QR..."
        
        await asyncio.sleep(1)
        
        task.progress = 80
        task.progress_message = "Finalizando documento..."
        
        await asyncio.sleep(1)
        
        # Generate mock result
        result = {
            "file_path": f"/certificates/cert_{task.task_id}.pdf",
            "file_size": 245760,  # 240KB
            "qr_code": f"CERT-{task.task_id}",
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
        return result
        
    except Exception as e:
        logger.error(f"PDF generation failed: {str(e)}")
        raise

async def generate_academic_report_handler(task: BackgroundTask) -> Dict[str, Any]:
    """Handler for academic report generation"""
    try:
        params = task.params
        report_type = params.get("report_type", "student_grades")
        
        task.progress = 15
        task.progress_message = "Consultando datos académicos..."
        
        await asyncio.sleep(2)
        
        task.progress = 40
        task.progress_message = "Procesando calificaciones..."
        
        await asyncio.sleep(3)
        
        task.progress = 70
        task.progress_message = "Generando reporte PDF..."
        
        await asyncio.sleep(2)
        
        task.progress = 90
        task.progress_message = "Finalizando reporte..."
        
        await asyncio.sleep(1)
        
        result = {
            "report_type": report_type,
            "file_path": f"/reports/academic_{report_type}_{task.task_id}.pdf",
            "records_processed": params.get("student_count", 50),
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
        return result
        
    except Exception as e:
        logger.error(f"Academic report generation failed: {str(e)}")
        raise

async def export_minedu_data_handler(task: BackgroundTask) -> Dict[str, Any]:
    """Handler for MINEDU data export"""
    try:
        params = task.params
        export_type = params.get("export_type", "enrollments")
        
        task.progress = 10
        task.progress_message = "Preparando datos para MINEDU..."
        
        await asyncio.sleep(2)
        
        task.progress = 30
        task.progress_message = "Validando integridad de datos..."
        
        await asyncio.sleep(3)
        
        task.progress = 60
        task.progress_message = "Enviando datos a MINEDU..."
        
        await asyncio.sleep(4)
        
        task.progress = 85
        task.progress_message = "Confirmando recepción..."
        
        await asyncio.sleep(2)
        
        result = {
            "export_type": export_type,
            "records_exported": params.get("record_count", 100),
            "minedu_batch_id": f"MINEDU-{task.task_id}",
            "export_status": "SUCCESS",
            "exported_at": datetime.now(timezone.utc).isoformat()
        }
        
        return result
        
    except Exception as e:
        logger.error(f"MINEDU export failed: {str(e)}")
        raise

async def bulk_grade_processing_handler(task: BackgroundTask) -> Dict[str, Any]:
    """Handler for bulk grade processing"""
    try:
        params = task.params
        grades_data = params.get("grades", [])
        
        task.progress = 5
        task.progress_message = "Validando datos de calificaciones..."
        
        processed_count = 0
        total_count = len(grades_data)
        
        for i, grade_data in enumerate(grades_data):
            # Simulate processing each grade
            await asyncio.sleep(0.1)
            processed_count += 1
            
            # Update progress
            progress = 5 + (processed_count / total_count) * 80
            task.progress = int(progress)
            task.progress_message = f"Procesando calificación {processed_count}/{total_count}"
        
        task.progress = 90
        task.progress_message = "Generando reporte de procesamiento..."
        
        await asyncio.sleep(1)
        
        result = {
            "grades_processed": processed_count,
            "grades_updated": processed_count - 2,  # Simulate some failures
            "grades_failed": 2,
            "processing_summary": {
                "total": total_count,
                "success": processed_count - 2,
                "errors": 2
            },
            "processed_at": datetime.now(timezone.utc).isoformat()
        }
        
        return result
        
    except Exception as e:
        logger.error(f"Bulk grade processing failed: {str(e)}")
        raise

# Register task handlers
task_manager.register_handler("generate_pdf_certificate", generate_pdf_certificate_handler)
task_manager.register_handler("generate_academic_report", generate_academic_report_handler)
task_manager.register_handler("export_minedu_data", export_minedu_data_handler)
task_manager.register_handler("bulk_grade_processing", bulk_grade_processing_handler)

# Utility functions for task creation
async def create_pdf_certificate_task(procedure_id: str, user_id: str) -> str:
    """Create a PDF certificate generation task"""
    params = {
        "procedure_id": procedure_id,
        "certificate_type": "procedure_completion"
    }
    return task_manager.create_task("generate_pdf_certificate", params, user_id)

async def create_academic_report_task(report_type: str, filters: Dict[str, Any], user_id: str) -> str:
    """Create an academic report generation task"""
    params = {
        "report_type": report_type,
        "filters": filters,
        "student_count": filters.get("student_count", 50)
    }
    return task_manager.create_task("generate_academic_report", params, user_id)

async def create_minedu_export_task(export_type: str, academic_period: str, user_id: str) -> str:
    """Create a MINEDU export task"""
    params = {
        "export_type": export_type,
        "academic_period": academic_period,
        "record_count": 100
    }
    return task_manager.create_task("export_minedu_data", params, user_id)

# Background task cleanup scheduler
async def periodic_cleanup():
    """Periodic cleanup of old tasks"""
    while True:
        try:
            await asyncio.sleep(3600)  # Run every hour
            task_manager.cleanup_old_tasks(max_age_hours=24)
        except Exception as e:
            logger.error(f"Error in periodic cleanup: {str(e)}")

# Start the cleanup scheduler
asyncio.create_task(periodic_cleanup())