from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.models.grade import GradeCreate, GradeUpdate, GradeResponse
from app.services.grade_service import GradeService

router = APIRouter()

@router.post("/", response_model=GradeResponse)
async def create_grade(grade: GradeCreate):
    """
    Crear una nueva calificación.
    """
    new_grade = await GradeService.create_grade(grade)
    return new_grade

@router.get("/{grade_id}", response_model=GradeResponse)
async def get_grade(grade_id: str):
    """
    Obtener una calificación por su ID.
    """
    grade = await GradeService.get_grade(grade_id)
    if not grade:
        raise HTTPException(status_code=404, detail="Grade not found")
    return grade

@router.put("/{grade_id}", response_model=GradeResponse)
async def update_grade(grade_id: str, grade: GradeUpdate):
    """
    Actualizar una calificación existente.
    """
    updated_grade = await GradeService.update_grade(grade_id, grade)
    if not updated_grade:
        raise HTTPException(status_code=404, detail="Grade not found")
    return updated_grade

@router.delete("/{grade_id}", status_code=204)
async def delete_grade(grade_id: str):
    """
    Eliminar una calificación por su ID.
    """
    deleted = await GradeService.delete_grade(grade_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Grade not found")
    return {"message": "Grade deleted successfully"}

@router.get("/", response_model=List[GradeResponse])
async def get_all_grades(skip: int = 0, limit: int = 10):
    """
    Obtener todas las calificaciones con paginación.
    """
    grades = await GradeService.get_all_grades(skip=skip, limit=limit)
    return grades
