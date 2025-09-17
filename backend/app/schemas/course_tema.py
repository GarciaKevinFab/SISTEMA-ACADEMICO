from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# Esquema para la creación de un curso
class CourseCreateSchema(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime

# Esquema para la actualización de un curso
class CourseUpdateSchema(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

# Esquema para la respuesta de un curso
class CourseResponseSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    created_at: datetime

    class Config:
        orm_mode = True
# Esquema para login de curso
class CourseLoginSchema(BaseModel):
    name: str
    description: Optional[str] = None
