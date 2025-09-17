from app.models.enrollment import EnrollmentCreate, EnrollmentUpdate, EnrollmentResponse
from app.db import db
from typing import List, Optional

class EnrollmentService:
    
    @staticmethod
    async def create_enrollment(enrollment: EnrollmentCreate) -> EnrollmentResponse:
        enrollment_dict = enrollment.dict()
        new_enrollment = await db.enrollments.insert_one(enrollment_dict)
        return EnrollmentResponse(id=str(new_enrollment.inserted_id), **enrollment_dict)

    @staticmethod
    async def get_enrollment(enrollment_id: str) -> Optional[EnrollmentResponse]:
        enrollment = await db.enrollments.find_one({"_id": enrollment_id})
        if enrollment:
            return EnrollmentResponse(id=str(enrollment["_id"]), **enrollment)
        return None

    @staticmethod
    async def update_enrollment(enrollment_id: str, enrollment: EnrollmentUpdate) -> Optional[EnrollmentResponse]:
        updated_enrollment = await db.enrollments.find_one_and_update(
            {"_id": enrollment_id},
            {"$set": enrollment.dict(exclude_unset=True)},
            return_document=True
        )
        if updated_enrollment:
            return EnrollmentResponse(id=str(updated_enrollment["_id"]), **updated_enrollment)
        return None

    @staticmethod
    async def delete_enrollment(enrollment_id: str) -> bool:
        result = await db.enrollments.delete_one({"_id": enrollment_id})
        return result.deleted_count > 0

    @staticmethod
    async def get_all_enrollments(skip: int = 0, limit: int = 10) -> List[EnrollmentResponse]:
        enrollments = []
        async for enrollment in db.enrollments.find().skip(skip).limit(limit):
            enrollments.append(EnrollmentResponse(id=str(enrollment["_id"]), **enrollment))
        return enrollments
# Additional functions to help in enrollment related operations can go here.
# You can add more complex business logic or helpers to deal with enrollments.
