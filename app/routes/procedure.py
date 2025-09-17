from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.models.procedure import ProcedureCreate, ProcedureUpdate, ProcedureResponse
from app.services.procedure_service import ProcedureService

router = APIRouter()

@router.post("/", response_model=ProcedureResponse)
async def create_procedure(procedure: ProcedureCreate):
    """
    Crear un nuevo procedimiento.
    """
    new_procedure = await ProcedureService.create_procedure(procedure)
    return new_procedure

@router.get("/{procedure_id}", response_model=ProcedureResponse)
async def get_procedure(procedure_id: str):
    """
    Obtener un procedimiento por su ID.
    """
    procedure = await ProcedureService.get_procedure(procedure_id)
    if not procedure:
        raise HTTPException(status_code=404, detail="Procedure not found")
    return procedure

@router.put("/{procedure_id}", response_model=ProcedureResponse)
async def update_procedure(procedure_id: str, procedure: ProcedureUpdate):
    """
    Actualizar un procedimiento existente.
    """
    updated_procedure = await ProcedureService.update_procedure(procedure_id, procedure)
    if not updated_procedure:
        raise HTTPException(status_code=404, detail="Procedure not found")
    return updated_procedure

@router.delete("/{procedure_id}", status_code=204)
async def delete_procedure(procedure_id: str):
    """
    Eliminar un procedimiento por su ID.
    """
    deleted = await ProcedureService.delete_procedure(procedure_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Procedure not found")
    return {"message": "Procedure deleted successfully"}

@router.get("/", response_model=List[ProcedureResponse])
async def get_all_procedures(skip: int = 0, limit: int = 10):
    """
    Obtener todos los procedimientos con paginación.
    """
    procedures = await ProcedureService.get_all_procedures(skip=skip, limit=limit)
    return procedures
