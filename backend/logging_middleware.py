"""
Structured Logging Middleware with Correlation ID for Sistema Académico
"""
import logging
import uuid
import time
import json
from typing import Optional
from datetime import datetime, timezone
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import traceback

# Configure structured logging
class StructuredFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add correlation_id if available
        if hasattr(record, 'correlation_id'):
            log_data["correlation_id"] = record.correlation_id
            
        # Add user info if available
        if hasattr(record, 'user_id'):
            log_data["user_id"] = record.user_id
        if hasattr(record, 'username'):
            log_data["username"] = record.username
            
        # Add request info if available
        if hasattr(record, 'method'):
            log_data["method"] = record.method
        if hasattr(record, 'path'):
            log_data["path"] = record.path
        if hasattr(record, 'status_code'):
            log_data["status_code"] = record.status_code
        if hasattr(record, 'duration_ms'):
            log_data["duration_ms"] = record.duration_ms
            
        # Add exception info if available
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info)
            }
            
        return json.dumps(log_data)

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Middleware to add correlation ID to all requests and responses"""
    
    async def dispatch(self, request: Request, call_next):
        # Generate or extract correlation ID
        correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        
        # Add to request state
        request.state.correlation_id = correlation_id
        
        # Start timing
        start_time = time.time()
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration_ms = round((time.time() - start_time) * 1000, 2)
            
            # Add correlation ID to response headers
            response.headers["X-Correlation-ID"] = correlation_id
            
            # Log request completion
            logger = logging.getLogger("api.request")
            extra = {
                "correlation_id": correlation_id,
                "method": request.method,
                "path": str(request.url.path),
                "status_code": response.status_code,
                "duration_ms": duration_ms
            }
            
            if response.status_code >= 400:
                logger.warning(f"Request completed with error: {request.method} {request.url.path}", extra=extra)
            else:
                logger.info(f"Request completed: {request.method} {request.url.path}", extra=extra)
                
            return response
            
        except Exception as e:
            # Calculate duration
            duration_ms = round((time.time() - start_time) * 1000, 2)
            
            # Log error
            logger = logging.getLogger("api.error")
            extra = {
                "correlation_id": correlation_id,
                "method": request.method,
                "path": str(request.url.path),
                "duration_ms": duration_ms,
                "error": str(e)
            }
            logger.error(f"Request failed: {request.method} {request.url.path}", extra=extra, exc_info=True)
            
            # Return structured error response
            error_response = {
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "Error interno del servidor",
                    "correlation_id": correlation_id
                }
            }
            
            response = JSONResponse(
                status_code=500,
                content=error_response
            )
            response.headers["X-Correlation-ID"] = correlation_id
            return response

def get_correlation_id(request: Request) -> str:
    """Get correlation ID from request"""
    return getattr(request.state, 'correlation_id', str(uuid.uuid4()))

def log_with_correlation(logger: logging.Logger, level: str, message: str, request: Request = None, user_data: dict = None, extra_data: dict = None):
    """Log message with correlation ID and context"""
    extra = {}
    
    if request:
        extra.update({
            "correlation_id": get_correlation_id(request),
            "method": request.method,
            "path": str(request.url.path)
        })
    
    if user_data:
        extra.update({
            "user_id": user_data.get("id"),
            "username": user_data.get("username")
        })
    
    if extra_data:
        extra.update(extra_data)
    
    getattr(logger, level)(message, extra=extra)

def setup_logging():
    """Setup structured logging configuration"""
    # Create formatter
    formatter = StructuredFormatter()
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Configure specific loggers
    loggers = [
        "api.request",
        "api.error", 
        "api.auth",
        "api.academic",
        "api.finance",
        "api.admission",
        "api.procedures",
        "api.minedu"
    ]
    
    for logger_name in loggers:
        logger = logging.getLogger(logger_name)
        logger.setLevel(logging.INFO)
        logger.propagate = True
    
    return root_logger

class ErrorResponse:
    """Standardized error response format"""
    
    @staticmethod
    def create(
        code: str,
        message: str,
        correlation_id: str,
        details: Optional[dict] = None,
        status_code: int = 500
    ) -> JSONResponse:
        error_data = {
            "error": {
                "code": code,
                "message": message,
                "correlation_id": correlation_id
            }
        }
        
        if details:
            error_data["error"]["details"] = details
            
        return JSONResponse(
            status_code=status_code,
            content=error_data
        )

# Common error codes
class ErrorCodes:
    VALIDATION_ERROR = "VALIDATION_ERROR"
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR"
    AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    DUPLICATE_RESOURCE = "DUPLICATE_RESOURCE"
    BUSINESS_RULE_VIOLATION = "BUSINESS_RULE_VIOLATION"
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    INVALID_REQUEST = "INVALID_REQUEST"

def create_standardized_exception_handler():
    """Create standardized exception handler"""
    
    async def exception_handler(request: Request, exc: Exception):
        correlation_id = get_correlation_id(request)
        
        # Log the exception
        logger = logging.getLogger("api.error")
        extra = {
            "correlation_id": correlation_id,
            "method": request.method,
            "path": str(request.url.path),
            "exception_type": type(exc).__name__
        }
        
        logger.error(f"Unhandled exception: {str(exc)}", extra=extra, exc_info=True)
        
        return ErrorResponse.create(
            code=ErrorCodes.INTERNAL_SERVER_ERROR,
            message="Error interno del servidor",
            correlation_id=correlation_id,
            status_code=500
        )
    
    return exception_handler