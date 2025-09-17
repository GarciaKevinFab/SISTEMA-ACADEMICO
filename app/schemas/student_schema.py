from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

# Esquema para la creación de estudiante
class StudentCreateSchema(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    gender: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    password: str

# Esquema para la actualización de estudiante
class StudentUpdateSchema(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    gender: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    is_active: Optional[bool] = None

# Esquema para la respuesta de un estudiante
class StudentResponseSchema(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: EmailStr
    gender: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True
# Esquema para login de estudiante
class StudentLoginSchema(BaseModel):
    email: EmailStr
    password: str
