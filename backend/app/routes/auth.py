from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.services.auth_service import AuthService 
from app.models.user import UserCreate, UserLogin, UserResponse
from app.schemas.user_schema import Token
from app.utils.password_utils import hash_password, verify_password

router = APIRouter()

# OAuth2PasswordBearer is a dependency that expects a token in the Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

@router.post("/register", response_model=UserResponse)
async def register_user(user: UserCreate):
    """
    Registrar un nuevo usuario.
    """
    hashed_password = hash_password(user.password)
    user.password = hashed_password
    new_user = await AuthService.create_user(user)
    return new_user

@router.post("/login", response_model=UserResponse)
async def login_user(user: UserLogin):
    """
    Iniciar sesión con email y contraseña.
    """
    db_user = await AuthService.authenticate_user(user.email, user.password)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return db_user

@router.get("/me", response_model=UserResponse)
async def get_current_user(current_user: UserResponse = Depends(AuthService.get_current_user)):
    """
    Obtener el usuario actualmente autenticado.
    """
    return current_user

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Endpoint para obtener JWT usando OAuth2 Password Flow.
    """
    user = await AuthService.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    access_token = AuthService.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}
