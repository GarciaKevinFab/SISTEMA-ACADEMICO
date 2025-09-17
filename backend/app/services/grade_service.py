from app.models.grade import GradeCreate, GradeUpdate, GradeResponse
from app.db import db
from typing import List, Optional

class GradeService:
    
    @staticmethod
    async def create_grade(grade: GradeCreate) -> GradeResponse:
        grade_dict = grade.dict()
        new_grade = await db.grades.insert_one(grade_dict)
        return GradeResponse(id=str(new_grade.inserted_id), **grade_dict)

    @staticmethod
    async def get_grade(grade_id: str) -> Optional[GradeResponse]:
        grade = await db.grades.find_one({"_id": grade_id})
        if grade:
            return GradeResponse(id=str(grade["_id"]), **grade)
        return None

    @staticmethod
    async def update_grade(grade_id: str, grade: GradeUpdate) -> Optional[GradeResponse]:
        updated_grade = await db.grades.find_one_and_update(
            {"_id": grade_id},
            {"$set": grade.dict(exclude_unset=True)},
            return_document=True
        )
        if updated_grade:
            return GradeResponse(id=str(updated_grade["_id"]), **updated_grade)
        return None

    @staticmethod
    async def delete_grade(grade_id: str) -> bool:
        result = await db.grades.delete_one({"_id": grade_id})
        return result.deleted_count > 0

    @staticmethod
    async def get_all_grades(skip: int = 0, limit: int = 10) -> List[GradeResponse]:
        grades = []
        async for grade in db.grades.find().skip(skip).limit(limit):
            grades.append(GradeResponse(id=str(grade["_id"]), **grade))
        return grades
# Additional functions to help in grade related operations can go here.
# You can add more complex business logic or helpers to deal with grades.
