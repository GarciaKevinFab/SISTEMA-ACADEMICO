from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# Modelo base para estudiantes
class StudentBase(BaseModel):
    first_name: str
    last_name: str
    email: str
    gender: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime = datetime.utcnow()

# Modelo para la creación de estudiantes
class StudentCreate(StudentBase):
    password: str

# Modelo para la actualización de la información de estudiantes
class StudentUpdate(StudentBase):
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    is_active: Optional[bool] = None
# Modelo para representar la respuesta de un estudiante (sin la contraseña)
class StudentResponse(StudentBase):
    id: str

    class Config:
        orm_mode = True

# Modelo para login de estudiante, solo incluye el correo y la contraseña
class StudentLogin(BaseModel):
    email: str
    password: str
