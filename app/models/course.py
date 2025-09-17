from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Modelo base para cursos
class CourseBase(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    is_active: bool = True
    created_at: datetime = datetime.utcnow()

# Modelo para la creación de un curso
class CourseCreate(CourseBase):
    pass

# Modelo para la actualización de información de un curso
class CourseUpdate(CourseBase):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None
# Modelo para representar la respuesta de un curso
class CourseResponse(CourseBase):
    id: str

    class Config:
        orm_mode = True
