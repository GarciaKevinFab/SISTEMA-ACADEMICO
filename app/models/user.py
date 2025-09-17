from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

# Modelo base para usuarios
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Modelo para la creación de usuarios (incluir contraseñas, etc.)
class UserCreate(UserBase):
    password: str

# Modelo para la actualización de la información del usuario
class UserUpdate(UserBase):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
# Modelo para representar la respuesta del usuario (sin la contraseña)
class UserResponse(UserBase):
    id: UUID

    class Config:
        orm_mode = True

# Modelo para login, solo incluye el correo y la contraseña
class UserLogin(BaseModel):
    email: EmailStr
    password: str
