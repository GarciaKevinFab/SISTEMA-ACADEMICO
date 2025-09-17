from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Modelo base para inscripciones
class EnrollmentBase(BaseModel):
    student_id: str
    course_id: str
    enrollment_date: datetime = datetime.utcnow()
    status: str = "active"  # Estado de la inscripción (e.g., active, completed, etc.)
    
# Modelo para la creación de una inscripción
class EnrollmentCreate(EnrollmentBase):
    pass

# Modelo para la actualización de una inscripción
class EnrollmentUpdate(EnrollmentBase):
    status: Optional[str] = None
    enrollment_date: Optional[datetime] = None
# Modelo para representar la respuesta de una inscripción
class EnrollmentResponse(EnrollmentBase):
    id: str

    class Config:
        orm_mode = True
