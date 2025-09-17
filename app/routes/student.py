from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.models.student import StudentCreate, StudentUpdate, StudentResponse
from app.services.student_service import StudentService
from app.utils.password_utils import hash_password

router = APIRouter()

@router.post("/", response_model=StudentResponse)
async def create_student(student: StudentCreate):
    """
    Crear un nuevo estudiante con contraseña hasheada.
    """
    hashed_password = hash_password(student.password)
    student.password = hashed_password
    new_student = await StudentService.create_student(student)
    return new_student

@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(student_id: str):
    """
    Obtener un estudiante por su ID.
    """
    student = await StudentService.get_student(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

@router.put("/{student_id}", response_model=StudentResponse)
async def update_student(student_id: str, student: StudentUpdate):
    """
    Actualizar un estudiante existente.
    """
    updated_student = await StudentService.update_student(student_id, student)
    if not updated_student:
        raise HTTPException(status_code=404, detail="Student not found")
    return updated_student

@router.delete("/{student_id}", status_code=204)
async def delete_student(student_id: str):
    """
    Eliminar un estudiante por su ID.
    """
    deleted = await StudentService.delete_student(student_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": "Student deleted successfully"}

@router.get("/", response_model=List[StudentResponse])
async def get_all_students(skip: int = 0, limit: int = 10):
    """
    Obtener todos los estudiantes con paginación.
    """
    students = await StudentService.get_all_students(skip=skip, limit=limit)
    return students
