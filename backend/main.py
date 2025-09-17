# backend/main.py
from pathlib import Path
import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# .env en backend/ (opcional)
try:
    from dotenv import load_dotenv
    ROOT_DIR = Path(__file__).parent
    load_dotenv(dotenv_path=ROOT_DIR / ".env")
except Exception:
    pass

# Logging básico
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api.main")

# App
try:
    from fastapi.responses import ORJSONResponse
    app = FastAPI(
        title="Sistema Académico IESPP Gustavo Allende Llavería",
        default_response_class=ORJSONResponse,
    )
except Exception:
    app = FastAPI(title="Sistema Académico IESPP Gustavo Allende Llavería")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ALLOW_ORIGINS", "*").split(",") if os.getenv("CORS_ALLOW_ORIGINS") else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware propio de logging
try:
    from app.middleware.login_middleware import LoggingMiddleware
    app.add_middleware(LoggingMiddleware)
    logger.info("LoggingMiddleware cargado.")
except Exception as e:
    logger.warning(f"No se pudo cargar LoggingMiddleware: {e}")

# Routers (deben exponer una variable 'router')
def _safe_include(import_path: str, attr: str = "router", name: str = ""):
    try:
        module = __import__(import_path, fromlist=[attr])
        router = getattr(module, attr)
        app.include_router(router)
        logger.info(f"Router '{name or import_path}' incluido.")
    except Exception as e:
        logger.error(f"No se pudo incluir '{name or import_path}': {e}")

_safe_include("app.routes.auth", name="auth")
_safe_include("app.routes.course", name="course")
_safe_include("app.routes.enrollment", name="enrollment")
_safe_include("app.routes.grade", name="grade")
_safe_include("app.routes.procedure", name="procedure")
_safe_include("app.routes.student", name="student")

# Timing header
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    import time
    start = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = str(time.time() - start)
    return response

# Health
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Handler genérico
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Error en {request.url}: {exc}")
    return JSONResponse(status_code=500, content={"message": "An unexpected error occurred."})
