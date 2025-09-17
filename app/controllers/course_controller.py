from fastapi import HTTPException, status
from app.services.course_service import CourseService
from app.models.course import CourseCreate, CourseUpdate
from app.schemas.course_schema import CourseResponseSchema
from typing import List

class CourseController:
    @staticmethod
    async def create_course(course_create: CourseCreate) -> CourseResponseSchema:
        """Crear un nuevo curso."""
        try:
            course = await CourseService.create_course(course_create)
            return CourseResponseSchema(id=course.id, **course.dict())
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating course")

    @staticmethod
    async def get_course(course_id: str) -> CourseResponseSchema:
        """Obtener un curso por su ID."""
        course = await CourseService.get_course(course_id)
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        return course

    @staticmethod
    async def update_course(course_id: str, course_update: CourseUpdate) -> CourseResponseSchema:
        """Actualizar la información de un curso."""
        updated_course = await CourseService.update_course(course_id, course_update)
        if not updated_course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        return updated_course

    @staticmethod
    async def delete_course(course_id: str) -> dict:
        """Eliminar un curso."""
        deleted = await CourseService.delete_course(course_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        return {"message": "Course deleted successfully"}

    @staticmethod
    async def get_all_courses(skip: int = 0, limit: int = 10) -> List[CourseResponseSchema]:
        """Obtener todos los cursos con paginación."""
        courses = await CourseService.get_all_courses(skip, limit)
        return courses
