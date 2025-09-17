from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# Esquema para la creación de una inscripción
class EnrollmentCreateSchema(BaseModel):
    student_id: str
    course_id: str
    enrollment_date: datetime = datetime.utcnow()
    status: str = "active"

# Esquema para la actualización de una inscripción
class EnrollmentUpdateSchema(BaseModel):
    status: Optional[str] = None
    enrollment_date: Optional[datetime] = None

# Esquema para la respuesta de una inscripción
class EnrollmentResponseSchema(BaseModel):
    id: str
    student_id: str
    course_id: str
    enrollment_date: datetime
    status: str

    class Config:
        orm_mode = True
# Esquema para login de inscripción
class EnrollmentLoginSchema(BaseModel):
    student_id: str
    course_id: str
