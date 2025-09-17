from pydantic import BaseModel, EmailStr

# Esquema para la creación de usuario
class UserCreateSchema(BaseModel):
    email: EmailStr
    full_name: str
    password: str

# Esquema para la actualización de usuario
class UserUpdateSchema(BaseModel):
    email: EmailStr
    full_name: str
    is_active: bool = True

# Esquema para la respuesta del usuario (sin contraseña)
class UserResponseSchema(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    is_active: bool
    created_at: str

    class Config:
        orm_mode = True
# Esquema para login de usuario
class UserLoginSchema(BaseModel):
    email: EmailStr
    password: str
