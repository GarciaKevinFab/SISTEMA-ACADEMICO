"""
Shared dependencies to avoid circular imports
"""
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from dotenv import load_dotenv
from pathlib import Path
from logging_middleware import get_correlation_id, log_with_correlation

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Database connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
security = HTTPBearer()

# Logging
logger = logging.getLogger(__name__)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    request: Request = None
):
    """Get current authenticated user with correlation logging"""
    correlation_id = get_correlation_id(request) if request else None
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            if request:
                log_with_correlation(
                    logger, "warning", 
                    "Invalid token - no username in payload", 
                    request,
                    extra_data={"correlation_id": correlation_id}
                )
            raise HTTPException(status_code=401, detail="Token inválido")
        
        user = await db.users.find_one({"username": username})
        if user is None:
            if request:
                log_with_correlation(
                    logger, "warning", 
                    f"User not found for username: {username}", 
                    request,
                    extra_data={"correlation_id": correlation_id}
                )
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
        if request:
            log_with_correlation(
                logger, "debug", 
                f"User authenticated successfully: {username}", 
                request,
                user_data=user,
                extra_data={"correlation_id": correlation_id}
            )
        
        return user
        
    except JWTError as e:
        if request:
            log_with_correlation(
                logger, "warning", 
                f"JWT error during authentication: {str(e)}", 
                request,
                extra_data={"correlation_id": correlation_id}
            )
        raise HTTPException(status_code=401, detail="Token inválido")
    except HTTPException:
        raise
    except Exception as e:
        if request:
            log_with_correlation(
                logger, "error", 
                f"Unexpected error during authentication: {str(e)}", 
                request,
                extra_data={"correlation_id": correlation_id}
            )
        raise HTTPException(status_code=500, detail="Error de autenticación")

async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get current user but don't fail if not authenticated"""
    try:
        return await get_current_user(credentials, request)
    except HTTPException:
        return None