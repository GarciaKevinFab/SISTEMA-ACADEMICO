from pydantic import BaseModel
from datetime import datetime

# Modelo base para calificaciones
class GradeBase(BaseModel):
    student_id: str
    course_id: str
    grade_value: float
    grade_date: datetime = datetime.utcnow()
    
# Modelo para la creación de una calificación
class GradeCreate(GradeBase):
    pass

# Modelo para la actualización de una calificación
class GradeUpdate(GradeBase):
    grade_value: Optional[float] = None
    grade_date: Optional[datetime] = None
# Modelo para representar la respuesta de una calificación
class GradeResponse(GradeBase):
    id: str

    class Config:
        orm_mode = True
