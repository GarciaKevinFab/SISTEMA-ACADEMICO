from fastapi import HTTPException, status
from app.services.procedure_service import ProcedureService
from app.models.procedure import ProcedureCreate, ProcedureUpdate
from app.schemas.procedure_schema import ProcedureResponseSchema
from typing import List

class ProcedureController:
    @staticmethod
    async def create_procedure(procedure_create: ProcedureCreate) -> ProcedureResponseSchema:
        """Crear un nuevo procedimiento."""
        try:
            procedure = await ProcedureService.create_procedure(procedure_create)
            return ProcedureResponseSchema(id=procedure.id, **procedure.dict())
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating procedure")

    @staticmethod
    async def get_procedure(procedure_id: str) -> ProcedureResponseSchema:
        """Obtener un procedimiento por su ID."""
        procedure = await ProcedureService.get_procedure(procedure_id)
        if not procedure:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedure not found")
        return procedure

    @staticmethod
    async def update_procedure(procedure_id: str, procedure_update: ProcedureUpdate) -> ProcedureResponseSchema:
        """Actualizar un procedimiento."""
        updated_procedure = await ProcedureService.update_procedure(procedure_id, procedure_update)
        if not updated_procedure:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedure not found")
        return updated_procedure

    @staticmethod
    async def delete_procedure(procedure_id: str) -> dict:
        """Eliminar un procedimiento."""
        deleted = await ProcedureService.delete_procedure(procedure_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedure not found")
        return {"message": "Procedure deleted successfully"}

    @staticmethod
    async def get_all_procedures(skip: int = 0, limit: int = 10) -> List[ProcedureResponseSchema]:
        """Obtener todos los procedimientos con paginación."""
        procedures = await ProcedureService.get_all_procedures(skip, limit)
        return procedures
