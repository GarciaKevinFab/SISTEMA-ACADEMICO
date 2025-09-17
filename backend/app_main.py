from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import sys

# Asegurarnos de que backend está en el PYTHONPATH
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Importar routers directamente desde el paquete backend
from routes.auth import router as auth_router
from routes.student import router as student_router
from routes.course import router as course_router
from routes.enrollment import router as enrollment_router
from routes.grade import router as grade_router
from routes.procedure import router as procedure_router

# Crear la app FastAPI
app = FastAPI(title="Sistema Académico", version="1.0")

# Configuración de CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir todos los routers con sus prefijos y tags
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(student_router, prefix="/students", tags=["students"])
app.include_router(course_router, prefix="/courses", tags=["courses"])
app.include_router(enrollment_router, prefix="/enrollments", tags=["enrollments"])
app.include_router(grade_router, prefix="/grades", tags=["grades"])
app.include_router(procedure_router, prefix="/procedures", tags=["procedures"])

# Correr directamente con python app_main.py
if __name__ == "__main__":
    uvicorn.run("app_main:app", host="127.0.0.1", port=3000, reload=True)
