from app.models.student import StudentCreate, StudentUpdate, StudentResponse
from app.db import db
from typing import List, Optional

class StudentService:
    
    @staticmethod
    async def create_student(student: StudentCreate) -> StudentResponse:
        student_dict = student.dict()
        new_student = await db.students.insert_one(student_dict)
        return StudentResponse(id=str(new_student.inserted_id), **student_dict)

    @staticmethod
    async def get_student(student_id: str) -> Optional[StudentResponse]:
        student = await db.students.find_one({"_id": student_id})
        if student:
            return StudentResponse(id=str(student["_id"]), **student)
        return None

    @staticmethod
    async def update_student(student_id: str, student: StudentUpdate) -> Optional[StudentResponse]:
        updated_student = await db.students.find_one_and_update(
            {"_id": student_id},
            {"$set": student.dict(exclude_unset=True)},
            return_document=True
        )
        if updated_student:
            return StudentResponse(id=str(updated_student["_id"]), **updated_student)
        return None

    @staticmethod
    async def delete_student(student_id: str) -> bool:
        result = await db.students.delete_one({"_id": student_id})
        return result.deleted_count > 0

    @staticmethod
    async def get_all_students(skip: int = 0, limit: int = 10) -> List[StudentResponse]:
        students = []
        async for student in db.students.find().skip(skip).limit(limit):
            students.append(StudentResponse(id=str(student["_id"]), **student))
        return students
# Additional functions to help in student related operations can go here.
# You can add more complex business logic or helpers to deal with students.
