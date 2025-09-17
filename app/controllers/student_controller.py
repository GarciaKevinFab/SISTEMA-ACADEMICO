from fastapi import HTTPException, status
from app.services.student_service import StudentService
from app.models.student import StudentCreate, StudentUpdate
from app.schemas.student_schema import StudentResponseSchema
from typing import List

class StudentController:
    @staticmethod
    async def create_student(student_create: StudentCreate) -> StudentResponseSchema:
        """Crear un nuevo estudiante."""
        try:
            student = await StudentService.create_student(student_create)
            return StudentResponseSchema(id=student.id, **student.dict())
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating student")

    @staticmethod
    async def get_student(student_id: str) -> StudentResponseSchema:
        """Obtener un estudiante por su ID."""
        student = await StudentService.get_student(student_id)
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
        return student

    @staticmethod
    async def update_student(student_id: str, student_update: StudentUpdate) -> StudentResponseSchema:
        """Actualizar la información de un estudiante."""
        updated_student = await StudentService.update_student(student_id, student_update)
        if not updated_student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
        return updated_student

    @staticmethod
    async def delete_student(student_id: str) -> dict:
        """Eliminar un estudiante."""
        deleted = await StudentService.delete_student(student_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
        return {"message": "Student deleted successfully"}

    @staticmethod
    async def get_all_students(skip: int = 0, limit: int = 10) -> List[StudentResponseSchema]:
        """Obtener todos los estudiantes con paginación."""
        students = await StudentService.get_all_students(skip, limit)
        return students
