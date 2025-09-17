from fastapi import HTTPException, status
from app.services.enrollment_service import EnrollmentService
from app.models.enrollment import EnrollmentCreate, EnrollmentUpdate
from app.schemas.enrollment_schema import EnrollmentResponseSchema
from typing import List

class EnrollmentController:
    @staticmethod
    async def create_enrollment(enrollment_create: EnrollmentCreate) -> EnrollmentResponseSchema:
        """Crear una nueva inscripción."""
        try:
            enrollment = await EnrollmentService.create_enrollment(enrollment_create)
            return EnrollmentResponseSchema(id=enrollment.id, **enrollment.dict())
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating enrollment")

    @staticmethod
    async def get_enrollment(enrollment_id: str) -> EnrollmentResponseSchema:
        """Obtener una inscripción por su ID."""
        enrollment = await EnrollmentService.get_enrollment(enrollment_id)
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
        return enrollment

    @staticmethod
    async def update_enrollment(enrollment_id: str, enrollment_update: EnrollmentUpdate) -> EnrollmentResponseSchema:
        """Actualizar una inscripción."""
        updated_enrollment = await EnrollmentService.update_enrollment(enrollment_id, enrollment_update)
        if not updated_enrollment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
        return updated_enrollment

    @staticmethod
    async def delete_enrollment(enrollment_id: str) -> dict:
        """Eliminar una inscripción."""
        deleted = await EnrollmentService.delete_enrollment(enrollment_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
        return {"message": "Enrollment deleted successfully"}

    @staticmethod
    async def get_all_enrollments(skip: int = 0, limit: int = 10) -> List[EnrollmentResponseSchema]:
        """Obtener todas las inscripciones con paginación."""
        enrollments = await EnrollmentService.get_all_enrollments(skip, limit)
        return enrollments
