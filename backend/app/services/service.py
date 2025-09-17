from app.models.user import UserCreate, UserLogin, UserResponse
from app.utils.password_utils import verify_password, hash_password
from app.utils.jwt_utils import create_access_token
from app.db import db
from typing import Optional
from fastapi import HTTPException, status

class AuthService:
    
    @staticmethod
    async def create_user(user: UserCreate) -> UserResponse:
        # Logic for creating a new user
        user_dict = user.dict()
        user_dict["password"] = hash_password(user.password)  # Hash password
        new_user = await db.users.insert_one(user_dict)
        return UserResponse(id=str(new_user.inserted_id), **user_dict)

    @staticmethod
    async def authenticate_user(email: str, password: str) -> Optional[UserResponse]:
        # Logic for authenticating user
        user = await db.users.find_one({"email": email})
        if user and verify_password(password, user["password"]):
            return UserResponse(id=str(user["_id"]), email=user["email"], full_name=user["full_name"])
        return None

    @staticmethod
    async def get_current_user(token: str) -> UserResponse:
        # Logic to extract user from the token
        user_data = await AuthService.verify_jwt_token(token)
        if not user_data:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return user_data

    @staticmethod
    async def verify_jwt_token(token: str) -> Optional[UserResponse]:
        # Logic to verify JWT token
        payload = create_access_token(token)
        user = await db.users.find_one({"email": payload.get("sub")})
        if user:
            return UserResponse(id=str(user["_id"]), email=user["email"], full_name=user["full_name"])
        return None
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        # Generate JWT access token
        to_encode = data.copy()
        if expires_delta:
            expiration = datetime.utcnow() + expires_delta
        else:
            expiration = datetime.utcnow() + timedelta(minutes=15)
        to_encode.update({"exp": expiration})
        encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        return encoded_jwt

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        # Verify the password
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def hash_password(password: str) -> str:
        # Hash the password using bcrypt
        return pwd_context.hash(password)
