from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, File, UploadFile, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
import logging
import uuid
from pathlib import Path
import hashlib
import asyncio
import pandas as pd
import qrcode
import io
import base64
import time

# Import structured logging
from logging_middleware import (
    setup_logging, 
    CorrelationIdMiddleware, 
    get_correlation_id,
    log_with_correlation,
    ErrorResponse,
    ErrorCodes,
    create_standardized_exception_handler
)
# Configuration and setup
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Setup structured logging
setup_logging()
logger = logging.getLogger("api.main")

# Import all modules
from finance_models import *
from finance_enums import *
from finance_utils import *
from academic_models import *

# Import performance optimizations - FIXED VERSION
# Move MINEDU, Security, and Reports routes to root level
import sys
sys.path.append('/app')
# Temporarily comment out problematic imports
# from minedu_integration_routes import router as minedu_integration_router
# from security_compliance_routes import router as security_compliance_router  
# from academic_reports_routes import router as academic_reports_router

from fixed_optimizations import (
    FixedMongoOptimizer, OptimizedQueries, PerformanceTracker,
    performance_monitor, simple_cache, memory_cache
)

# Import routes after fixing circular dependencies
try:
    # Import route modules
    from academic_routes import academic_router
    from minedu_integration import minedu_router  
    from mesa_partes_routes import mesa_partes_router
    from optimized_endpoints import optimized_router
    from enrollment_routes import enrollment_router
    from teachers_sections import teacher_section_manager
    from grades_routes import grades_router
    from grades_system import grades_system
    from attendance_system import attendance_system
    from attendance_routes import attendance_router
    # NOTE: New route modules imported separately to avoid circular imports
    ROUTES_AVAILABLE = True
    logger.info("All route modules imported successfully")
except ImportError as e:
    logger.warning(f"Could not import route modules: {e}")
    ROUTES_AVAILABLE = False
# Database connection - FIXED with proper connection pooling
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
mongo_client = FixedMongoOptimizer(mongo_url, os.environ.get('DB_NAME', 'sistemaacademico'))
db = mongo_client.get_database()

# Performance tracker
perf_tracker = PerformanceTracker()

# Security setup
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# FastAPI app - Using standard FastAPI with orjson response class
try:
    from fastapi.responses import ORJSONResponse
    app = FastAPI(
        title="Sistema Académico IESPP Gustavo Allende Llavería",
        default_response_class=ORJSONResponse
    )
    logger.info("FastAPI application initialized with ORJSONResponse")
except ImportError as e:
    app = FastAPI(
        title="Sistema Académico IESPP Gustavo Allende Llavería"
    )
    logger.warning(f"Could not import ORJSONResponse, using default response class. Error: {e}")
# Include routers after fixing circular dependencies
app.include_router(academic_router)
app.include_router(minedu_router)
app.include_router(mesa_partes_router)
app.include_router(optimized_router)
app.include_router(enrollment_router)
app.include_router(teacher_section_manager)
app.include_router(grades_router)
app.include_router(grades_system)
app.include_router(attendance_system)
app.include_router(attendance_router)

# Initialize performance monitor
app.add_middleware(performance_monitor)

# Initialize CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Correlation ID middleware
app.add_middleware(CorrelationIdMiddleware)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
# Event on application startup
@app.on_event("startup")
async def startup_db():
    try:
        # Establish connection with MongoDB
        await db.client.connect()
        logger.info("Connected to database successfully")
    except Exception as e:
        logger.error(f"Error connecting to database: {e}")
        raise e

# Event on application shutdown
@app.on_event("shutdown")
async def shutdown_db():
    try:
        # Close MongoDB connection
        await db.client.close()
        logger.info("Database connection closed")
    except Exception as e:
        logger.error(f"Error closing database connection: {e}")
        raise e
# Custom exception handling
@app.exception_handler(Exception)
async def custom_exception_handler(request, exc):
    logger.error(f"Error in request {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"message": "An unexpected error occurred."},
    )

# Middleware to handle error responses
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response
