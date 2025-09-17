from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.models.course import CourseCreate, CourseUpdate, CourseResponse
from app.services.course_service import CourseService

router = APIRouter()

@router.post("/", response_model=CourseResponse)
async def create_course(course: CourseCreate):
    """
    Crear un nuevo curso.
    """
    new_course = await CourseService.create_course(course)
    return new_course

@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: str):
    """
    Obtener un curso por su ID.
    """
    course = await CourseService.get_course(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(course_id: str, course: CourseUpdate):
    """
    Actualizar un curso existente.
    """
    updated_course = await CourseService.update_course(course_id, course)
    if not updated_course:
        raise HTTPException(status_code=404, detail="Course not found")
    return updated_course

@router.delete("/{course_id}", status_code=204)
async def delete_course(course_id: str):
    """
    Eliminar un curso por su ID.
    """
    deleted = await CourseService.delete_course(course_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"message": "Course deleted successfully"}

@router.get("/", response_model=List[CourseResponse])
async def get_all_courses(skip: int = 0, limit: int = 10):
    """
    Obtener todos los cursos con paginación.
    """
    courses = await CourseService.get_all_courses(skip=skip, limit=limit)
    return courses
