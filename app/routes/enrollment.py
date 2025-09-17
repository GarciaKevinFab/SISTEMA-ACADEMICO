from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.models.enrollment import EnrollmentCreate, EnrollmentUpdate, EnrollmentResponse
from app.services.enrollment_service import EnrollmentService

router = APIRouter()

@router.post("/", response_model=EnrollmentResponse)
async def create_enrollment(enrollment: EnrollmentCreate):
    """
    Crear una nueva inscripción.
    """
    new_enrollment = await EnrollmentService.create_enrollment(enrollment)
    return new_enrollment

@router.get("/{enrollment_id}", response_model=EnrollmentResponse)
async def get_enrollment(enrollment_id: str):
    """
    Obtener una inscripción por su ID.
    """
    enrollment = await EnrollmentService.get_enrollment(enrollment_id)
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return enrollment

@router.put("/{enrollment_id}", response_model=EnrollmentResponse)
async def update_enrollment(enrollment_id: str, enrollment: EnrollmentUpdate):
    """
    Actualizar una inscripción existente.
    """
    updated_enrollment = await EnrollmentService.update_enrollment(enrollment_id, enrollment)
    if not updated_enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return updated_enrollment

@router.delete("/{enrollment_id}", status_code=204)
async def delete_enrollment(enrollment_id: str):
    """
    Eliminar una inscripción por su ID.
    """
    deleted = await EnrollmentService.delete_enrollment(enrollment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return {"message": "Enrollment deleted successfully"}

@router.get("/", response_model=List[EnrollmentResponse])
async def get_all_enrollments(skip: int = 0, limit: int = 10):
    """
    Obtener todas las inscripciones con paginación.
    """
    enrollments = await EnrollmentService.get_all_enrollments(skip=skip, limit=limit)
    return enrollments
