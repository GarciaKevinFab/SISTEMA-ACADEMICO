from pydantic import BaseModel, EmailStr, validator
from typing import Optional

# Validador para email único (como ejemplo)
class EmailValidation(BaseModel):
    email: EmailStr

    @validator("email")
    def email_must_be_unique(cls, v):
        # Aquí iría la lógica para verificar si el email es único en la base de datos
        # Si no es único, se lanzaría una excepción
        if not check_if_email_is_unique(v):
            raise ValueError("Email already exists")
        return v

# Función simulada para la verificación de un email único
def check_if_email_is_unique(email: str) -> bool:
    # Lógica de base de datos aquí. Por ejemplo, consultar si el email ya existe.
    # Para efectos de ejemplo, simula que el email ya existe.
    existing_emails = ["test@example.com", "admin@example.com"]
    return email not in existing_emails
# Validación para contraseñas seguras
class PasswordValidation(BaseModel):
    password: str

    @validator("password")
    def password_must_be_secure(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one number")
        if not any(char.isupper() for char in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(char.islower() for char in v):
            raise ValueError("Password must contain at least one lowercase letter")
        return v
