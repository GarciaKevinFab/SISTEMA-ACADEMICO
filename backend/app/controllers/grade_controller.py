from fastapi import HTTPException, status
from app.services.grade_service import GradeService
from app.models.grade import GradeCreate, GradeUpdate
from app.schemas.grade_schema import GradeResponseSchema
from typing import List

class GradeController:
    @staticmethod
    async def create_grade(grade_create: GradeCreate) -> GradeResponseSchema:
        """Crear una nueva calificación."""
        try:
            grade = await GradeService.create_grade(grade_create)
            return GradeResponseSchema(id=grade.id, **grade.dict())
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating grade")

    @staticmethod
    async def get_grade(grade_id: str) -> GradeResponseSchema:
        """Obtener una calificación por su ID."""
        grade = await GradeService.get_grade(grade_id)
        if not grade:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade not found")
        return grade

    @staticmethod
    async def update_grade(grade_id: str, grade_update: GradeUpdate) -> GradeResponseSchema:
        """Actualizar una calificación."""
        updated_grade = await GradeService.update_grade(grade_id, grade_update)
        if not updated_grade:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade not found")
        return updated_grade

    @staticmethod
    async def delete_grade(grade_id: str) -> dict:
        """Eliminar una calificación."""
        deleted = await GradeService.delete_grade(grade_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade not found")
        return {"message": "Grade deleted successfully"}

    @staticmethod
    async def get_all_grades(skip: int = 0, limit: int = 10) -> List[GradeResponseSchema]:
        """Obtener todas las calificaciones con paginación."""
        grades = await GradeService.get_all_grades(skip, limit)
        return grades
