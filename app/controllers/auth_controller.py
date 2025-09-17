from fastapi import HTTPException, status
from app.services.auth_service import AuthService
from app.models.user import UserCreate, UserLogin
from app.schemas.user_schema import UserResponseSchema
from fastapi.security import OAuth2PasswordBearer
from typing import Any

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

class AuthController:
    @staticmethod
    async def register(user_create: UserCreate) -> UserResponseSchema:
        """Registrar un nuevo usuario."""
        try:
            user = await AuthService.create_user(user_create)
            return UserResponseSchema(id=user.id, email=user.email, full_name=user.full_name, is_active=True, created_at=user.created_at)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error registering user")

    @staticmethod
    async def login(user_login: UserLogin) -> dict:
        """Autenticar al usuario y devolver el token de acceso."""
        user = await AuthService.authenticate_user(user_login.email, user_login.password)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        token = AuthService.create_access_token(data={"sub": user.email})
        return {"access_token": token, "token_type": "bearer"}

    @staticmethod
    async def get_current_user(token: str = oauth2_scheme) -> UserResponseSchema:
        """Obtener los detalles del usuario actual usando el token."""
        user = await AuthService.get_current_user(token)
        return user
