from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, File, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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

# Import finance modules
from finance_models import *
from finance_enums import *
from finance_utils import *

# Configuration and setup
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Database connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security setup
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# FastAPI app
app = FastAPI(title="Sistema Académico IESPP Gustavo Allende Llavería")
api_router = APIRouter(prefix="/api")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Enums and Types
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "ADMIN"
    TEACHER = "TEACHER"
    STUDENT = "STUDENT"
    REGISTRAR = "REGISTRAR"
    ADMIN_WORKER = "ADMIN_WORKER"  # Trabajador administrativo
    EXTERNAL_USER = "EXTERNAL_USER"  # Usuario externo
    APPLICANT = "APPLICANT"  # Postulante
    ACADEMIC_STAFF = "ACADEMIC_STAFF"  # Personal académico
    FINANCE_ADMIN = "FINANCE_ADMIN"  # Administrador financiero
    CASHIER = "CASHIER"  # Cajero/a
    WAREHOUSE = "WAREHOUSE"  # Almacén
    HR_ADMIN = "HR_ADMIN"  # Administrador RRHH
    LOGISTICS = "LOGISTICS"  # Logística

class DocumentType(str, Enum):
    DNI = "DNI"
    FOREIGN_CARD = "FOREIGN_CARD"
    PASSPORT = "PASSPORT"
    CONADIS_CARD = "CONADIS_CARD"

class StudentStatus(str, Enum):
    ENROLLED = "ENROLLED"
    TRANSFERRED = "TRANSFERRED"
    WITHDRAWN = "WITHDRAWN"
    GRADUATED = "GRADUATED"
    SUSPENDED = "SUSPENDED"

class GradeStatus(str, Enum):
    APPROVED = "APPROVED"
    FAILED = "FAILED"
    INCOMPLETE = "INCOMPLETE"
    WITHDRAWN = "WITHDRAWN"

class ProcedureStatus(str, Enum):
    RECEIVED = "RECEIVED"        # Recibido
    IN_PROCESS = "IN_PROCESS"    # En proceso
    COMPLETED = "COMPLETED"      # Finalizado
    REJECTED = "REJECTED"        # Rechazado
    PENDING_INFO = "PENDING_INFO" # Pendiente de información

class ProcedureArea(str, Enum):
    ACADEMIC = "ACADEMIC"        # Académica
    ADMINISTRATIVE = "ADMINISTRATIVE"  # Administrativa
    FINANCIAL = "FINANCIAL"      # Financiera
    LEGAL = "LEGAL"             # Legal
    HR = "HR"                   # Recursos Humanos
    GENERAL = "GENERAL"         # General

class AdmissionStatus(str, Enum):
    OPEN = "OPEN"               # Abierta
    CLOSED = "CLOSED"           # Cerrada
    SUSPENDED = "SUSPENDED"     # Suspendida

class ApplicationStatus(str, Enum):
    REGISTERED = "REGISTERED"   # Registrado
    DOCUMENTS_PENDING = "DOCUMENTS_PENDING"  # Documentos pendientes
    DOCUMENTS_COMPLETE = "DOCUMENTS_COMPLETE"  # Documentos completos
    EVALUATED = "EVALUATED"     # Evaluado
    ADMITTED = "ADMITTED"       # Admitido
    NOT_ADMITTED = "NOT_ADMITTED"  # No admitido
    WAITING_LIST = "WAITING_LIST"  # Lista de espera

class DocumentType(str, Enum):
    DNI = "DNI"
    FOREIGN_CARD = "FOREIGN_CARD"
    PASSPORT = "PASSPORT"
    CONADIS_CARD = "CONADIS_CARD"

class ApplicantDocumentType(str, Enum):
    BIRTH_CERTIFICATE = "BIRTH_CERTIFICATE"  # Partida de nacimiento
    STUDY_CERTIFICATE = "STUDY_CERTIFICATE"  # Certificado de estudios
    PHOTO = "PHOTO"                          # Fotografía
    DNI_COPY = "DNI_COPY"                   # Copia de DNI
    CONADIS_COPY = "CONADIS_COPY"           # Copia carné CONADIS
    OTHER = "OTHER"                         # Otro documento

# Finance and Administration Enums
class CashSessionStatus(str, Enum):
    OPEN = "OPEN"                           # Abierta
    CLOSED = "CLOSED"                       # Cerrada
    RECONCILED = "RECONCILED"               # Conciliada

class MovementType(str, Enum):
    INCOME = "INCOME"                       # Ingreso
    EXPENSE = "EXPENSE"                     # Egreso
    TRANSFER = "TRANSFER"                   # Transferencia

class PaymentMethod(str, Enum):
    CASH = "CASH"                          # Efectivo
    BANK_DEPOSIT = "BANK_DEPOSIT"          # Depósito bancario
    BANK_TRANSFER = "BANK_TRANSFER"        # Transferencia bancaria
    CHECK = "CHECK"                        # Cheque

class ReceiptStatus(str, Enum):
    PENDING = "PENDING"                    # Pendiente
    PAID = "PAID"                         # Pagado  
    CANCELLED = "CANCELLED"               # Anulado
    REFUNDED = "REFUNDED"                 # Devuelto

class ReceiptConcept(str, Enum):
    ENROLLMENT = "ENROLLMENT"              # Matrícula
    TUITION = "TUITION"                   # Pensión
    CERTIFICATE = "CERTIFICATE"           # Constancia
    PROCEDURE = "PROCEDURE"               # Trámite
    OTHER = "OTHER"                       # Otro

class InventoryMovementType(str, Enum):
    ENTRY = "ENTRY"                       # Entrada
    EXIT = "EXIT"                         # Salida
    TRANSFER = "TRANSFER"                 # Transferencia
    ADJUSTMENT = "ADJUSTMENT"             # Ajuste

class ContractType(str, Enum):
    PERMANENT = "PERMANENT"               # Nombrado
    TEMPORARY = "TEMPORARY"               # Contratado
    CAS = "CAS"                          # CAS
    LOCACION = "LOCACION"                # Locación

class EmployeeStatus(str, Enum):
    ACTIVE = "ACTIVE"                     # Activo
    INACTIVE = "INACTIVE"                 # Inactivo
    SUSPENDED = "SUSPENDED"               # Suspendido
    RETIRED = "RETIRED"                   # Cesante

# Pydantic Models
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2, max_length=100)
    role: UserRole = UserRole.STUDENT
    phone: Optional[str] = Field(None, max_length=15)

class UserLogin(BaseModel):
    username: str
    password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    full_name: str
    role: UserRole
    phone: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None

class StudentCreate(BaseModel):
    # Personal Information
    first_name: str = Field(..., min_length=2, max_length=50)
    last_name: str = Field(..., min_length=2, max_length=50)
    second_last_name: Optional[str] = Field(None, max_length=50)
    birth_date: date
    gender: str = Field(..., pattern="^(M|F)$")
    
    # Identity Document
    document_type: DocumentType
    document_number: str = Field(..., min_length=8, max_length=20)
    
    # Contact Information
    email: Optional[str] = Field(None, pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    phone: Optional[str] = Field(None, max_length=15)
    address: str = Field(..., min_length=10, max_length=200)
    district: str = Field(..., min_length=2, max_length=50)
    province: str = Field(..., min_length=2, max_length=50)
    department: str = Field(..., min_length=2, max_length=50)
    
    # Academic Information
    program: str = Field(..., min_length=3, max_length=100)
    entry_year: int = Field(..., ge=2020, le=2030)
    
    # Special needs
    has_disability: bool = False
    disability_description: Optional[str] = None
    support_needs: Optional[List[str]] = []
    
    @validator('document_number')
    def validate_document_number(cls, v, values):
        document_type = values.get('document_type')
        if document_type == DocumentType.DNI:
            if not v.isdigit() or len(v) != 8:
                raise ValueError('DNI must be exactly 8 digits')
        return v

class Student(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_code: str = Field(default_factory=lambda: f"EST{datetime.now().year}{str(uuid.uuid4())[:6].upper()}")
    
    # Personal Information  
    first_name: str
    last_name: str
    second_last_name: Optional[str] = None
    birth_date: date
    gender: str
    
    # Identity Document
    document_type: DocumentType
    document_number: str
    
    # Contact Information
    email: Optional[str] = None
    phone: Optional[str] = None
    address: str
    district: str
    province: str
    department: str
    
    # Academic Information
    program: str
    entry_year: int
    status: StudentStatus = StudentStatus.ENROLLED
    
    # Special needs
    has_disability: bool = False
    disability_description: Optional[str] = None 
    support_needs: Optional[List[str]] = []
    
    # System fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    siagie_id: Optional[str] = None  # MINEDU integration

class CourseCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=20)
    name: str = Field(..., min_length=5, max_length=100)
    credits: int = Field(..., ge=1, le=10)
    semester: int = Field(..., ge=1, le=10)
    program: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    prerequisites: Optional[List[str]] = []

class Course(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    credits: int
    semester: int
    program: str
    description: Optional[str] = None
    prerequisites: Optional[List[str]] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EnrollmentCreate(BaseModel):
    student_id: str
    course_id: str
    academic_year: int = Field(..., ge=2020, le=2030)
    academic_period: str = Field(..., pattern="^(I|II|III)$")
    teacher_id: Optional[str] = None

class Enrollment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    course_id: str
    academic_year: int
    academic_period: str
    teacher_id: Optional[str] = None
    enrollment_date: datetime = Field(default_factory=datetime.utcnow)
    status: str = "ACTIVE"
    
    # Grades
    numerical_grade: Optional[float] = Field(None, ge=0, le=20)
    literal_grade: Optional[str] = Field(None, pattern="^(AD|A|B|C)$")
    grade_status: GradeStatus = GradeStatus.INCOMPLETE
    
    # Attendance
    total_classes: int = 0
    attended_classes: int = 0
    attendance_percentage: float = 0.0
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class GradeUpdate(BaseModel):
    numerical_grade: float = Field(..., ge=0, le=20)
    grade_status: GradeStatus = GradeStatus.APPROVED
    comments: Optional[str] = None

class AttendanceUpdate(BaseModel):
    total_classes: int = Field(..., ge=1)
    attended_classes: int = Field(..., ge=0)

# Mesa de Partes Models
class ProcedureTypeCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    area: ProcedureArea
    required_documents: Optional[List[str]] = []
    processing_days: int = Field(..., ge=1, le=365)
    is_active: bool = True

class ProcedureType(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    area: ProcedureArea
    required_documents: Optional[List[str]] = []
    processing_days: int
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ProcedureCreate(BaseModel):
    procedure_type_id: str
    subject: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=10, max_length=1000)
    
    # Datos del solicitante (para usuarios externos)
    applicant_name: Optional[str] = Field(None, max_length=100)
    applicant_email: Optional[str] = Field(None, pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    applicant_phone: Optional[str] = Field(None, max_length=15)
    applicant_document: Optional[str] = Field(None, max_length=20)
    
    # Prioridad y observaciones
    priority: str = Field(default="NORMAL", pattern="^(LOW|NORMAL|HIGH|URGENT)$")
    observations: Optional[str] = Field(None, max_length=500)

class ProcedureAttachment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    procedure_id: str
    file_name: str
    file_path: str
    file_size: int
    file_type: str
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class ProcedureLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    procedure_id: str
    action: str  # CREATED, STATUS_CHANGED, ASSIGNED, COMMENT_ADDED, etc.
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    comment: Optional[str] = None
    performed_by: str
    performed_at: datetime = Field(default_factory=datetime.utcnow)
    ip_address: Optional[str] = None

class Procedure(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tracking_code: str  # Código único de seguimiento
    procedure_type_id: str
    subject: str
    description: str
    
    # Estado y seguimiento
    status: ProcedureStatus = ProcedureStatus.RECEIVED
    priority: str = "NORMAL"
    
    # Datos del solicitante
    created_by: str  # ID del usuario que creó
    applicant_name: Optional[str] = None
    applicant_email: Optional[str] = None
    applicant_phone: Optional[str] = None
    applicant_document: Optional[str] = None
    
    # Asignación y procesamiento
    assigned_to: Optional[str] = None  # ID del trabajador asignado
    assigned_at: Optional[datetime] = None
    area: ProcedureArea
    
    # Fechas importantes
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deadline: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Observaciones y comentarios
    observations: Optional[str] = None
    resolution: Optional[str] = None
    
    # Archivos adjuntos (IDs)
    attachment_ids: Optional[List[str]] = []
    
    # Notificaciones
    email_notifications_sent: int = 0
    last_notification_sent: Optional[datetime] = None

class ProcedureUpdate(BaseModel):
    status: Optional[ProcedureStatus] = None
    assigned_to: Optional[str] = None
    priority: Optional[str] = None
    observations: Optional[str] = None
    resolution: Optional[str] = None

class ProcedureStatusUpdate(BaseModel):
    status: ProcedureStatus
    comment: Optional[str] = None
    notify_applicant: bool = True

class NotificationLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    procedure_id: str
    recipient_email: str
    notification_type: str  # STATUS_CHANGE, DEADLINE_REMINDER, etc.
    subject: str
    content: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    delivery_status: str = "PENDING"  # PENDING, SENT, FAILED

# Admission Module Models
class CareerCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=10)
    name: str = Field(..., min_length=5, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    duration_years: int = Field(..., ge=1, le=10)
    is_active: bool = True

class Career(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    description: Optional[str] = None
    duration_years: int
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AdmissionCallCreate(BaseModel):
    name: str = Field(..., min_length=5, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    academic_year: int = Field(..., ge=2024, le=2030)
    academic_period: str = Field(..., pattern="^(I|II|III)$")
    
    # Fechas importantes
    registration_start: datetime
    registration_end: datetime
    exam_date: Optional[datetime] = None
    results_date: Optional[datetime] = None
    
    # Configuración
    application_fee: float = Field(default=0.0, ge=0)
    max_applications_per_career: int = Field(default=1, ge=1, le=3)
    
    # Carreras y vacantes
    available_careers: List[str] = []  # Career IDs
    career_vacancies: Dict[str, int] = {}  # Career ID -> number of vacancies
    
    # Requisitos
    minimum_age: int = Field(default=16, ge=15, le=30)
    maximum_age: int = Field(default=35, ge=20, le=50)
    required_documents: List[str] = ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY"]
    
    # Estado
    is_active: bool = True

class AdmissionCall(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    academic_year: int
    academic_period: str
    
    # Fechas importantes
    registration_start: datetime
    registration_end: datetime
    exam_date: Optional[datetime] = None
    results_date: Optional[datetime] = None
    
    # Configuración
    application_fee: float = 0.0
    max_applications_per_career: int = 1
    
    # Carreras y vacantes
    available_careers: List[str] = []
    career_vacancies: Dict[str, int] = {}
    
    # Requisitos
    minimum_age: int = 16
    maximum_age: int = 35
    required_documents: List[str] = []
    
    # Estado y contadores
    status: AdmissionStatus = AdmissionStatus.OPEN
    is_active: bool = True
    total_applications: int = 0
    
    # Auditoría
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ApplicantCreate(BaseModel):
    # Información personal
    first_name: str = Field(..., min_length=2, max_length=50)
    last_name: str = Field(..., min_length=2, max_length=50)
    second_last_name: Optional[str] = Field(None, max_length=50)
    birth_date: date
    gender: str = Field(..., pattern="^(M|F)$")
    
    # Documentos de identidad
    document_type: DocumentType
    document_number: str = Field(..., min_length=8, max_length=20)
    
    # Contacto
    email: str = Field(..., pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    phone: str = Field(..., min_length=9, max_length=15)
    address: str = Field(..., min_length=10, max_length=200)
    district: str = Field(..., min_length=2, max_length=50)
    province: str = Field(..., min_length=2, max_length=50)
    department: str = Field(..., min_length=2, max_length=50)
    
    # Información académica
    high_school_name: str = Field(..., min_length=5, max_length=100)
    high_school_year: int = Field(..., ge=2010, le=2025)
    
    # Información especial
    has_disability: bool = False
    disability_description: Optional[str] = None
    conadis_number: Optional[str] = None
    
    # Información socioeconómica (opcional)
    guardian_name: Optional[str] = Field(None, max_length=100)
    guardian_phone: Optional[str] = Field(None, max_length=15)
    monthly_family_income: Optional[str] = None  # Range como "500-1000"
    
    @validator('document_number')
    def validate_document_number(cls, v, values):
        document_type = values.get('document_type')
        if document_type == DocumentType.DNI:
            if not v.isdigit() or len(v) != 8:
                raise ValueError('DNI must be exactly 8 digits')
        return v

class Applicant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    applicant_code: str = Field(default_factory=lambda: f"APL{datetime.now().year}{str(uuid.uuid4())[:6].upper()}")
    
    # Información personal
    first_name: str
    last_name: str
    second_last_name: Optional[str] = None
    birth_date: date
    gender: str
    
    # Documentos de identidad
    document_type: DocumentType
    document_number: str
    
    # Contacto
    email: str
    phone: str
    address: str
    district: str
    province: str
    department: str
    
    # Información académica
    high_school_name: str
    high_school_year: int
    
    # Información especial
    has_disability: bool = False
    disability_description: Optional[str] = None
    conadis_number: Optional[str] = None
    
    # Información socioeconómica
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    monthly_family_income: Optional[str] = None
    
    # Sistema
    user_id: Optional[str] = None  # Link to User if they register
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ApplicationCreate(BaseModel):
    admission_call_id: str
    applicant_id: str
    career_preferences: List[str] = Field(..., min_items=1, max_items=3)  # Career IDs in order of preference
    
    # Motivación
    motivation_letter: Optional[str] = Field(None, max_length=1000)
    career_interest_reason: Optional[str] = Field(None, max_length=500)

class Application(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    application_number: str = Field(default_factory=lambda: f"ADM{datetime.now().year}{str(uuid.uuid4())[:8].upper()}")
    
    admission_call_id: str
    applicant_id: str
    career_preferences: List[str] = []  # Career IDs in order of preference
    
    # Estado y seguimiento
    status: ApplicationStatus = ApplicationStatus.REGISTERED
    
    # Evaluación
    exam_score: Optional[float] = Field(None, ge=0, le=20)
    interview_score: Optional[float] = Field(None, ge=0, le=20)
    final_score: Optional[float] = Field(None, ge=0, le=20)
    
    # Resultado
    admitted_career: Optional[str] = None  # Career ID if admitted
    admission_position: Optional[int] = None  # Position in ranking
    
    # Motivación
    motivation_letter: Optional[str] = None
    career_interest_reason: Optional[str] = None
    
    # Documentos
    required_documents_submitted: List[str] = []
    documents_complete: bool = False
    
    # Fechas importantes
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    evaluated_at: Optional[datetime] = None
    result_published_at: Optional[datetime] = None
    
    # Auditoría
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ApplicantDocumentCreate(BaseModel):
    applicant_id: str
    document_type: ApplicantDocumentType
    file_name: str
    file_path: str
    file_size: int
    file_extension: str

class ApplicantDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    applicant_id: str
    document_type: ApplicantDocumentType
    file_name: str
    file_path: str
    file_size: int
    file_extension: str
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class AdmissionEvaluationCreate(BaseModel):
    application_id: str
    exam_score: Optional[float] = Field(None, ge=0, le=20)
    interview_score: Optional[float] = Field(None, ge=0, le=20)
    observations: Optional[str] = Field(None, max_length=500)

class AdmissionEvaluation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    application_id: str
    
    # Puntajes
    exam_score: Optional[float] = None
    interview_score: Optional[float] = None
    final_score: Optional[float] = None
    
    # Detalles
    observations: Optional[str] = None
    
    # Auditoría
    evaluated_by: str
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AdmissionResultCreate(BaseModel):
    admission_call_id: str
    application_id: str
    career_id: str
    is_admitted: bool
    position: int
    result_type: str = Field(..., pattern="^(ADMITTED|WAITING_LIST|NOT_ADMITTED)$")

class AdmissionResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    admission_call_id: str
    application_id: str
    career_id: str
    
    # Resultado
    is_admitted: bool
    position: int  # Position in ranking
    result_type: str  # ADMITTED, WAITING_LIST, NOT_ADMITTED
    
    # Puntajes finales
    final_score: float
    
    # Publicación
    published_at: datetime = Field(default_factory=datetime.utcnow)
    is_published: bool = True
    
    # Auditoría
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str

# Utility functions
def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def generate_tracking_code() -> str:
    """Generate unique tracking code for procedures"""
    timestamp = datetime.now().strftime('%Y%m%d')
    random_part = str(uuid.uuid4())[:8].upper()
    return f"IESPP-{timestamp}-{random_part}"

def calculate_deadline(processing_days: int) -> datetime:
    """Calculate deadline based on processing days (excluding weekends)"""
    current_date = datetime.now()
    days_added = 0
    while days_added < processing_days:
        current_date += timedelta(days=1)
        # Skip weekends (Saturday=5, Sunday=6)
        if current_date.weekday() < 5:
            days_added += 1
    return current_date

def calculate_age(birth_date: date) -> int:
    """Calculate age from birth date"""
    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))

def calculate_final_score(exam_score: float = None, interview_score: float = None) -> float:
    """Calculate final admission score (80% exam + 20% interview)"""
    if exam_score is None and interview_score is None:
        return 0.0
    
    exam_weight = 0.8
    interview_weight = 0.2
    
    final_exam = (exam_score or 0) * exam_weight
    final_interview = (interview_score or 0) * interview_weight
    
    return round(final_exam + final_interview, 2)

def generate_applicant_code(year: int = None) -> str:
    """Generate unique applicant code"""
    year = year or datetime.now().year
    random_part = str(uuid.uuid4())[:6].upper()
    return f"APL{year}{random_part}"

def generate_application_number(year: int = None) -> str:
    """Generate unique application number"""
    year = year or datetime.now().year
    random_part = str(uuid.uuid4())[:8].upper()
    return f"ADM{year}{random_part}"

async def validate_admission_requirements(applicant: Applicant, admission_call: AdmissionCall) -> tuple[bool, List[str]]:
    """Validate if applicant meets admission requirements"""
    errors = []
    
    # Age validation
    age = calculate_age(applicant.birth_date)
    if age < admission_call.minimum_age:
        errors.append(f"Edad mínima requerida: {admission_call.minimum_age} años")
    if age > admission_call.maximum_age:
        errors.append(f"Edad máxima permitida: {admission_call.maximum_age} años")
    
    # Document validation
    required_docs = set(admission_call.required_documents)
    # This would be checked against submitted documents in a real implementation
    
    return len(errors) == 0, errors

async def generate_admission_ranking(admission_call_id: str, career_id: str) -> List[Dict]:
    """Generate admission ranking for a specific career"""
    
    # Get all applications for this admission call and career
    applications = await db.applications.find({
        "admission_call_id": admission_call_id,
        "career_preferences": {"$in": [career_id]},
        "status": {"$in": ["EVALUATED"]},
        "final_score": {"$exists": True, "$ne": None}
    }).to_list(1000)
    
    # Sort by final score (descending) and application date (ascending for tie-breaking)
    ranking = sorted(
        applications, 
        key=lambda x: (-x.get('final_score', 0), x.get('submitted_at', datetime.utcnow()))
    )
    
    # Add position numbers
    for i, app in enumerate(ranking, 1):
        app['position'] = i
    
    return ranking

async def publish_admission_results(admission_call_id: str) -> Dict[str, Any]:
    """Publish admission results for all careers"""
    
    # Get admission call
    admission_call = await db.admission_calls.find_one({"id": admission_call_id})
    if not admission_call:
        raise HTTPException(status_code=404, detail="Admission call not found")
    
    results_summary = {
        "total_careers": 0,
        "total_applications": 0,
        "total_admitted": 0,
        "total_waiting_list": 0,
        "total_not_admitted": 0,
        "career_results": {}
    }
    
    # Process each career
    for career_id in admission_call.get('available_careers', []):
        career = await db.careers.find_one({"id": career_id})
        if not career:
            continue
            
        # Get vacancies for this career
        vacancies = admission_call.get('career_vacancies', {}).get(career_id, 0)
        
        # Generate ranking
        ranking = await generate_admission_ranking(admission_call_id, career_id)
        
        # Determine results
        admitted_count = 0
        waiting_list_count = 0
        not_admitted_count = 0
        
        for i, application in enumerate(ranking):
            position = i + 1
            
            # Determine result type
            if position <= vacancies:
                result_type = "ADMITTED"
                is_admitted = True
                admitted_count += 1
            elif position <= vacancies * 1.5:  # 50% more for waiting list
                result_type = "WAITING_LIST" 
                is_admitted = False
                waiting_list_count += 1
            else:
                result_type = "NOT_ADMITTED"
                is_admitted = False
                not_admitted_count += 1
            
            # Create result record
            result = AdmissionResult(
                admission_call_id=admission_call_id,
                application_id=application['id'],
                career_id=career_id,
                is_admitted=is_admitted,
                position=position,
                result_type=result_type,
                final_score=application.get('final_score', 0),
                created_by="SYSTEM"
            )
            
            # Save result
            await db.admission_results.insert_one(result.dict())
            
            # Update application status
            new_status = ApplicationStatus.ADMITTED if is_admitted else (
                ApplicationStatus.WAITING_LIST if result_type == "WAITING_LIST" else ApplicationStatus.NOT_ADMITTED
            )
            
            await db.applications.update_one(
                {"id": application['id']},
                {
                    "$set": {
                        "status": new_status.value,
                        "admitted_career": career_id if is_admitted else None,
                        "admission_position": position,
                        "result_published_at": datetime.utcnow()
                    }
                }
            )
        
        # Update summary
        results_summary["career_results"][career_id] = {
            "career_name": career['name'],
            "vacancies": vacancies,
            "applications": len(ranking),
            "admitted": admitted_count,
            "waiting_list": waiting_list_count,
            "not_admitted": not_admitted_count
        }
        
        results_summary["total_careers"] += 1
        results_summary["total_applications"] += len(ranking)
        results_summary["total_admitted"] += admitted_count
        results_summary["total_waiting_list"] += waiting_list_count
        results_summary["total_not_admitted"] += not_admitted_count
    
    # Update admission call status
    await db.admission_calls.update_one(
        {"id": admission_call_id},
        {
            "$set": {
                "results_published": True,
                "results_date": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return results_summary

async def log_procedure_action(
    procedure_id: str, 
    action: str, 
    performed_by: str, 
    previous_status: str = None, 
    new_status: str = None, 
    comment: str = None,
    ip_address: str = None
):
    """Log procedure actions for audit trail"""
    log_entry = ProcedureLog(
        procedure_id=procedure_id,
        action=action,
        previous_status=previous_status,
        new_status=new_status,
        comment=comment,
        performed_by=performed_by,
        ip_address=ip_address
    )
    
    log_doc = log_entry.dict()
    await db.procedure_logs.insert_one(log_doc)
    return log_entry

async def send_procedure_notification(
    procedure_id: str,
    recipient_email: str,
    notification_type: str,
    subject: str,
    content: str
):
    """Send email notification and log it"""
    # En un entorno real, aquí se integraría con un servicio de email como SendGrid
    # Por ahora, solo registramos la notificación
    notification = NotificationLog(
        procedure_id=procedure_id,
        recipient_email=recipient_email,
        notification_type=notification_type,
        subject=subject,
        content=content,
        delivery_status="SENT"  # Simulamos envío exitoso
    )
    
    notification_doc = notification.dict()
    await db.notification_logs.insert_one(notification_doc)
    
    # Actualizar contador de notificaciones en el trámite
    await db.procedures.update_one(
        {"id": procedure_id},
        {
            "$inc": {"email_notifications_sent": 1},
            "$set": {"last_notification_sent": datetime.utcnow()}
        }
    )
    
    logger.info(f"Notification sent to {recipient_email} for procedure {procedure_id}")
    return notification

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"username": username})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(allowed_roles: List[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)):
        # ADMIN role has access to all endpoints
        if current_user.role == UserRole.ADMIN or current_user.role in allowed_roles:
            return current_user
        raise HTTPException(
            status_code=403, 
            detail=f"Access denied. Required roles: {[role.value for role in allowed_roles]} or ADMIN"
        )
    return role_checker

# API Routes

# Authentication
@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"$or": [{"username": user_data.username}, {"email": user_data.email}]})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")
    
    # Create user
    hashed_password = hash_password(user_data.password)
    user_dict = user_data.dict()
    del user_dict['password']
    
    user = User(**user_dict)
    user_doc = user.dict()
    user_doc['password'] = hashed_password
    
    result = await db.users.insert_one(user_doc)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "message": "User registered successfully"
    }

@api_router.post("/auth/login")
async def login_user(user_credentials: UserLogin):
    user = await db.users.find_one({"username": user_credentials.username})
    if not user or not verify_password(user_credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Update last login
    await db.users.update_one(
        {"_id": user["_id"]}, 
        {"$set": {"last_login": datetime.utcnow()}}
    )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user['username']}, expires_delta=access_token_expires
    )
    
    user_obj = User(**user)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_obj,
        "message": "Login successful"
    }

@api_router.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# Students Management
@api_router.post("/students", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.REGISTRAR]))])
async def create_student(student_data: StudentCreate, current_user: User = Depends(get_current_user)):
    # Check if student with same document exists
    existing_student = await db.students.find_one({"document_number": student_data.document_number})
    if existing_student:
        raise HTTPException(status_code=400, detail="Student with this document number already exists")
    
    student = Student(**student_data.dict())
    student.created_by = current_user.id
    
    student_doc = student.dict()
    # Convert date objects to ISO format strings for MongoDB
    if 'birth_date' in student_doc and hasattr(student_doc['birth_date'], 'isoformat'):
        student_doc['birth_date'] = student_doc['birth_date'].isoformat()
    
    await db.students.insert_one(student_doc)
    
    logger.info(f"Student {student.student_code} created by {current_user.username}")
    
    return {
        "status": "success",
        "student": student,
        "message": "Student created successfully"
    }

@api_router.get("/students", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.REGISTRAR, UserRole.TEACHER]))])
async def get_students(
    skip: int = 0, 
    limit: int = 50,
    program: Optional[str] = None,
    status: Optional[StudentStatus] = None,
    current_user: User = Depends(get_current_user)
):
    filter_query = {}
    if program:
        filter_query["program"] = program
    if status:
        filter_query["status"] = status.value
    
    students = await db.students.find(filter_query).skip(skip).limit(limit).to_list(limit)
    total = await db.students.count_documents(filter_query)
    
    return {
        "students": [Student(**student) for student in students],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/students/{student_id}")
async def get_student(student_id: str, current_user: User = Depends(get_current_user)):
    student = await db.students.find_one({"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Check permissions
    if current_user.role == UserRole.STUDENT and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return Student(**student)

@api_router.put("/students/{student_id}", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.REGISTRAR]))])
async def update_student(student_id: str, student_data: StudentCreate, current_user: User = Depends(get_current_user)):
    student = await db.students.find_one({"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    update_data = student_data.dict()
    update_data["updated_at"] = datetime.utcnow()
    
    # Convert date objects to ISO format strings for MongoDB
    if 'birth_date' in update_data and hasattr(update_data['birth_date'], 'isoformat'):
        update_data['birth_date'] = update_data['birth_date'].isoformat()
    
    await db.students.update_one({"id": student_id}, {"$set": update_data})
    
    updated_student = await db.students.find_one({"id": student_id})
    return Student(**updated_student)

# Courses Management
@api_router.post("/courses", dependencies=[Depends(require_role([UserRole.ADMIN]))])
async def create_course(course_data: CourseCreate, current_user: User = Depends(get_current_user)):
    # Check if course code exists
    existing_course = await db.courses.find_one({"code": course_data.code})
    if existing_course:
        raise HTTPException(status_code=400, detail="Course with this code already exists")
    
    course = Course(**course_data.dict())
    course_doc = course.dict()
    
    await db.courses.insert_one(course_doc)
    
    return {
        "status": "success",
        "course": course,
        "message": "Course created successfully"
    }

@api_router.get("/courses")
async def get_courses(
    skip: int = 0,
    limit: int = 50,
    program: Optional[str] = None,
    semester: Optional[int] = None,
    current_user: User = Depends(get_current_user)
):
    filter_query = {"is_active": True}
    if program:
        filter_query["program"] = program
    if semester:
        filter_query["semester"] = semester
    
    courses = await db.courses.find(filter_query).skip(skip).limit(limit).to_list(limit)
    total = await db.courses.count_documents(filter_query)
    
    return {
        "courses": [Course(**course) for course in courses],
        "total": total,
        "skip": skip,
        "limit": limit
    }

# Enrollment Management
@api_router.post("/enrollments", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.REGISTRAR]))])
async def create_enrollment(enrollment_data: EnrollmentCreate, current_user: User = Depends(get_current_user)):
    # Verify student exists
    student = await db.students.find_one({"id": enrollment_data.student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Verify course exists
    course = await db.courses.find_one({"id": enrollment_data.course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Check if enrollment already exists
    existing_enrollment = await db.enrollments.find_one({
        "student_id": enrollment_data.student_id,
        "course_id": enrollment_data.course_id,
        "academic_year": enrollment_data.academic_year,
        "academic_period": enrollment_data.academic_period
    })
    if existing_enrollment:
        raise HTTPException(status_code=400, detail="Student already enrolled in this course for this period")
    
    enrollment = Enrollment(**enrollment_data.dict())
    enrollment_doc = enrollment.dict()
    
    await db.enrollments.insert_one(enrollment_doc)
    
    return {
        "status": "success",
        "enrollment": enrollment,
        "message": "Enrollment created successfully"
    }

@api_router.get("/enrollments")
async def get_enrollments(
    student_id: Optional[str] = None,
    course_id: Optional[str] = None,
    academic_year: Optional[int] = None,
    academic_period: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    filter_query = {}
    
    # Role-based filtering
    if current_user.role == UserRole.STUDENT:
        filter_query["student_id"] = current_user.id
    elif current_user.role == UserRole.TEACHER:
        filter_query["teacher_id"] = current_user.id
    
    if student_id:
        filter_query["student_id"] = student_id
    if course_id:
        filter_query["course_id"] = course_id
    if academic_year:
        filter_query["academic_year"] = academic_year
    if academic_period:
        filter_query["academic_period"] = academic_period
    
    enrollments = await db.enrollments.find(filter_query).skip(skip).limit(limit).to_list(limit)
    total = await db.enrollments.count_documents(filter_query)
    
    # Enrich with student and course data
    enriched_enrollments = []
    for enrollment in enrollments:
        student = await db.students.find_one({"id": enrollment["student_id"]})
        course = await db.courses.find_one({"id": enrollment["course_id"]})
        
        enrollment_obj = Enrollment(**enrollment)
        enriched_enrollment = {
            **enrollment_obj.dict(),
            "student": Student(**student) if student else None,
            "course": Course(**course) if course else None
        }
        enriched_enrollments.append(enriched_enrollment)
    
    return {
        "enrollments": enriched_enrollments,
        "total": total,
        "skip": skip,
        "limit": limit
    }

# Grades Management
@api_router.put("/enrollments/{enrollment_id}/grade", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))])
async def update_grade(enrollment_id: str, grade_data: GradeUpdate, current_user: User = Depends(get_current_user)):
    enrollment = await db.enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Check if teacher is assigned to this course
    if current_user.role == UserRole.TEACHER and enrollment.get("teacher_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied. You can only grade courses assigned to you.")
    
    # Convert numerical to literal grade
    literal_grade = "C"
    if grade_data.numerical_grade >= 18:
        literal_grade = "AD"
    elif grade_data.numerical_grade >= 14:
        literal_grade = "A"
    elif grade_data.numerical_grade >= 11:
        literal_grade = "B"
    
    # Determine grade status
    grade_status = GradeStatus.APPROVED if grade_data.numerical_grade >= 11 else GradeStatus.FAILED
    
    update_data = {
        "numerical_grade": grade_data.numerical_grade,
        "literal_grade": literal_grade,
        "grade_status": grade_status.value,
        "updated_at": datetime.utcnow()
    }
    
    await db.enrollments.update_one({"id": enrollment_id}, {"$set": update_data})
    
    # TODO: Send to MINEDU SIAGIE
    logger.info(f"Grade updated for enrollment {enrollment_id} by {current_user.username}")
    
    return {
        "status": "success",
        "message": "Grade updated successfully",
        "grade": update_data
    }

@api_router.put("/enrollments/{enrollment_id}/attendance", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))])
async def update_attendance(enrollment_id: str, attendance_data: AttendanceUpdate, current_user: User = Depends(get_current_user)):
    enrollment = await db.enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Calculate attendance percentage
    attendance_percentage = (attendance_data.attended_classes / attendance_data.total_classes) * 100 if attendance_data.total_classes > 0 else 0
    
    update_data = {
        "total_classes": attendance_data.total_classes,
        "attended_classes": attendance_data.attended_classes,
        "attendance_percentage": round(attendance_percentage, 2),
        "updated_at": datetime.utcnow()
    }
    
    await db.enrollments.update_one({"id": enrollment_id}, {"$set": update_data})
    
    return {
        "status": "success",
        "message": "Attendance updated successfully",
        "attendance": update_data
    }

# Dashboard and Reports
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    stats = {}
    
    if current_user.role in [UserRole.ADMIN, UserRole.REGISTRAR]:
        # Admin dashboard
        total_students = await db.students.count_documents({"status": "ENROLLED"})
        total_courses = await db.courses.count_documents({"is_active": True})
        total_enrollments = await db.enrollments.count_documents({"status": "ACTIVE"})
        
        # Recent enrollments
        recent_enrollments = await db.enrollments.find().sort("created_at", -1).limit(5).to_list(5)
        
        stats = {
            "total_students": total_students,
            "total_courses": total_courses,
            "total_enrollments": total_enrollments,
            "recent_enrollments": len(recent_enrollments)
        }
    
    elif current_user.role == UserRole.TEACHER:
        # Teacher dashboard
        my_courses = await db.enrollments.count_documents({"teacher_id": current_user.id})
        pending_grades = await db.enrollments.count_documents({
            "teacher_id": current_user.id,
            "grade_status": "INCOMPLETE"
        })
        
        stats = {
            "my_courses": my_courses,
            "pending_grades": pending_grades
        }
    
    elif current_user.role == UserRole.STUDENT:
        # Student dashboard
        my_enrollments = await db.enrollments.count_documents({"student_id": current_user.id})
        approved_courses = await db.enrollments.count_documents({
            "student_id": current_user.id,
            "grade_status": "APPROVED"
        })
        
        stats = {
            "my_enrollments": my_enrollments,
            "approved_courses": approved_courses
        }
    
    # Add Mesa de Partes stats for all roles
    if current_user.role in [UserRole.ADMIN, UserRole.ADMIN_WORKER]:
        # Admin/Worker stats
        total_procedures = await db.procedures.count_documents({})
        pending_procedures = await db.procedures.count_documents({"status": {"$in": ["RECEIVED", "IN_PROCESS"]}})
        my_assigned = await db.procedures.count_documents({"assigned_to": current_user.id})
        
        stats.update({
            "total_procedures": total_procedures,
            "pending_procedures": pending_procedures,
            "my_assigned_procedures": my_assigned
        })
    
    elif current_user.role == UserRole.EXTERNAL_USER:
        # External user stats
        my_procedures = await db.procedures.count_documents({"created_by": current_user.id})
        my_pending = await db.procedures.count_documents({
            "created_by": current_user.id, 
            "status": {"$in": ["RECEIVED", "IN_PROCESS"]}
        })
        
        stats.update({
            "my_procedures": my_procedures,
            "my_pending_procedures": my_pending
        })
    
    # Add Admission stats
    if current_user.role in [UserRole.ADMIN, UserRole.ACADEMIC_STAFF]:
        # Admin/Academic staff stats
        total_applicants = await db.applicants.count_documents({})
        total_applications = await db.applications.count_documents({})
        active_admission_calls = await db.admission_calls.count_documents({"is_active": True, "status": "OPEN"})
        pending_evaluations = await db.applications.count_documents({"status": "DOCUMENTS_COMPLETE"})
        
        stats.update({
            "total_applicants": total_applicants,
            "total_applications": total_applications,
            "active_admission_calls": active_admission_calls,
            "pending_evaluations": pending_evaluations
        })
    
    elif current_user.role == UserRole.APPLICANT:
        # Applicant stats
        # Find applicant profile
        applicant = await db.applicants.find_one({"user_id": current_user.id})
        if applicant:
            my_applications = await db.applications.count_documents({"applicant_id": applicant["id"]})
            pending_applications = await db.applications.count_documents({
                "applicant_id": applicant["id"],
                "status": {"$in": ["REGISTERED", "DOCUMENTS_PENDING", "DOCUMENTS_COMPLETE"]}
            })
            
            stats.update({
                "my_applications": my_applications,
                "pending_applications": pending_applications
            })
        else:
            stats.update({
                "my_applications": 0,
                "pending_applications": 0
            })
    
    return stats

@api_router.get("/dashboard/admission-stats", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.ACADEMIC_STAFF]))])
async def get_admission_stats(current_user: User = Depends(get_current_user)):
    """Get detailed admission statistics"""
    
    # Applications by status
    status_stats = await db.applications.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(10)
    
    # Applications by career
    career_stats = await db.applications.aggregate([
        {"$unwind": "$career_preferences"},
        {
            "$lookup": {
                "from": "careers",
                "localField": "career_preferences",
                "foreignField": "id",
                "as": "career_info"
            }
        },
        {"$unwind": "$career_info"},
        {"$group": {"_id": "$career_info.name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    # Applications by gender
    gender_stats = await db.applications.aggregate([
        {
            "$lookup": {
                "from": "applicants",
                "localField": "applicant_id",
                "foreignField": "id",
                "as": "applicant_info"
            }
        },
        {"$unwind": "$applicant_info"},
        {"$group": {"_id": "$applicant_info.gender", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(10)
    
    # Applications by department (geography)
    geography_stats = await db.applications.aggregate([
        {
            "$lookup": {
                "from": "applicants",
                "localField": "applicant_id",
                "foreignField": "id",
                "as": "applicant_info"
            }
        },
        {"$unwind": "$applicant_info"},
        {"$group": {"_id": "$applicant_info.department", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    # Applications by age group
    age_distribution = {}
    applications = await db.applications.find({}).to_list(1000)
    for app in applications:
        applicant = await db.applicants.find_one({"id": app["applicant_id"]})
        if applicant:
            age = calculate_age(date.fromisoformat(applicant["birth_date"]))
            age_group = f"{(age // 5) * 5}-{(age // 5) * 5 + 4}"
            age_distribution[age_group] = age_distribution.get(age_group, 0) + 1
    
    age_stats = [{"_id": k, "count": v} for k, v in sorted(age_distribution.items())]
    
    # Monthly application trends (last 6 months)
    six_months_ago = datetime.now() - timedelta(days=180)
    monthly_stats = await db.applications.aggregate([
        {"$match": {"submitted_at": {"$gte": six_months_ago}}},
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$submitted_at"},
                    "month": {"$month": "$submitted_at"}
                },
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id.year": 1, "_id.month": 1}}
    ]).to_list(12)
    
    # Score distribution
    score_stats = await db.applications.aggregate([
        {"$match": {"final_score": {"$exists": True, "$ne": None}}},
        {
            "$group": {
                "_id": {
                    "$switch": {
                        "branches": [
                            {"case": {"$gte": ["$final_score", 18]}, "then": "18-20"},
                            {"case": {"$gte": ["$final_score", 16]}, "then": "16-18"},
                            {"case": {"$gte": ["$final_score", 14]}, "then": "14-16"},
                            {"case": {"$gte": ["$final_score", 12]}, "then": "12-14"},
                            {"case": {"$gte": ["$final_score", 10]}, "then": "10-12"}
                        ],
                        "default": "0-10"
                    }
                },
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": -1}}
    ]).to_list(10)
    
    return {
        "status_distribution": status_stats,
        "career_distribution": career_stats,
        "gender_distribution": gender_stats,
        "geography_distribution": geography_stats,
        "age_distribution": age_stats,
        "monthly_trends": monthly_stats,
        "score_distribution": score_stats,
        "total_applicants": await db.applicants.count_documents({}),
        "total_applications": await db.applications.count_documents({}),
        "total_evaluated": await db.applications.count_documents({"status": "EVALUATED"}),
        "total_admitted": await db.admission_results.count_documents({"is_admitted": True})
    }

@api_router.get("/dashboard/procedure-stats", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.ADMIN_WORKER]))])
async def get_procedure_stats(current_user: User = Depends(get_current_user)):
    """Get detailed Mesa de Partes statistics"""
    
    # Status distribution
    status_stats = await db.procedures.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(10)
    
    # Area distribution
    area_stats = await db.procedures.aggregate([
        {"$group": {"_id": "$area", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(10)
    
    # Monthly trends (last 6 months)
    six_months_ago = datetime.now() - timedelta(days=180)
    monthly_stats = await db.procedures.aggregate([
        {"$match": {"created_at": {"$gte": six_months_ago.isoformat()}}},
        {
            "$group": {
                "_id": {
                    "year": {"$year": {"$dateFromString": {"dateString": "$created_at"}}},
                    "month": {"$month": {"$dateFromString": {"dateString": "$created_at"}}}
                },
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id.year": 1, "_id.month": 1}}
    ]).to_list(12)
    
    # Average processing time
    completed_procedures = await db.procedures.find({
        "status": "COMPLETED",
        "completed_at": {"$exists": True}
    }).to_list(1000)
    
    processing_times = []
    for proc in completed_procedures:
        if proc.get("completed_at") and proc.get("created_at"):
            created = datetime.fromisoformat(proc["created_at"])
            completed = datetime.fromisoformat(proc["completed_at"])
            processing_times.append((completed - created).days)
    
    avg_processing_time = sum(processing_times) / len(processing_times) if processing_times else 0
    
    # Top procedure types
    type_stats = await db.procedures.aggregate([
        {
            "$lookup": {
                "from": "procedure_types",
                "localField": "procedure_type_id",
                "foreignField": "id",
                "as": "type_info"
            }
        },
        {"$unwind": "$type_info"},
        {"$group": {"_id": "$type_info.name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    return {
        "status_distribution": status_stats,
        "area_distribution": area_stats,
        "monthly_trends": monthly_stats,
        "average_processing_days": round(avg_processing_time, 1),
        "top_procedure_types": type_stats,
        "total_procedures": await db.procedures.count_documents({}),
        "total_completed": await db.procedures.count_documents({"status": "COMPLETED"}),
        "total_pending": await db.procedures.count_documents({"status": {"$in": ["RECEIVED", "IN_PROCESS"]}}),
    }

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Admission Module - Careers Management
@api_router.post("/careers", dependencies=[Depends(require_role([UserRole.ADMIN]))])
async def create_career(career_data: CareerCreate, current_user: User = Depends(get_current_user)):
    """Create a new career"""
    
    # Check if career with same code exists
    existing_career = await db.careers.find_one({"code": career_data.code})
    if existing_career:
        raise HTTPException(status_code=400, detail="Career with this code already exists")
    
    career = Career(**career_data.dict())
    career_doc = career.dict()
    
    await db.careers.insert_one(career_doc)
    
    logger.info(f"Career {career.code} created by {current_user.username}")
    
    return {
        "status": "success",
        "career": career,
        "message": "Career created successfully"
    }

@api_router.get("/careers")
async def get_careers(
    is_active: bool = True,
    current_user: User = Depends(get_current_user)
):
    """Get available careers"""
    filter_query = {"is_active": is_active}
    
    careers = await db.careers.find(filter_query).sort("name", 1).to_list(100)
    
    return {
        "careers": [Career(**career) for career in careers],
        "total": len(careers)
    }

# Admission Module - Admission Calls Management
@api_router.post("/admission-calls", dependencies=[Depends(require_role([UserRole.ADMIN]))])
async def create_admission_call(admission_call_data: AdmissionCallCreate, current_user: User = Depends(get_current_user)):
    """Create a new admission call"""
    
    # Validate careers exist
    for career_id in admission_call_data.available_careers:
        career = await db.careers.find_one({"id": career_id})
        if not career:
            raise HTTPException(status_code=400, detail=f"Career {career_id} not found")
    
    # Validate dates
    if admission_call_data.registration_end <= admission_call_data.registration_start:
        raise HTTPException(status_code=400, detail="Registration end date must be after start date")
    
    admission_call_dict = admission_call_data.dict()
    admission_call_dict['created_by'] = current_user.id
    admission_call = AdmissionCall(**admission_call_dict)
    
    admission_call_doc = admission_call.dict()
    # Convert datetime objects for MongoDB
    for field in ['registration_start', 'registration_end', 'exam_date', 'results_date']:
        if admission_call_doc.get(field):
            admission_call_doc[field] = admission_call_doc[field].isoformat()
    
    await db.admission_calls.insert_one(admission_call_doc)
    
    logger.info(f"Admission call {admission_call.name} created by {current_user.username}")
    
    return {
        "status": "success",
        "admission_call": admission_call,
        "message": "Admission call created successfully"
    }

@api_router.get("/admission-calls")
async def get_admission_calls(
    is_active: bool = True,
    academic_year: Optional[int] = None,
    current_user: User = Depends(get_current_user)
):
    """Get admission calls"""
    filter_query = {"is_active": is_active}
    if academic_year:
        filter_query["academic_year"] = academic_year
    
    admission_calls = await db.admission_calls.find(filter_query).sort("created_at", -1).to_list(50)
    
    # Enrich with career information
    enriched_calls = []
    for call in admission_calls:
        # Get career details
        career_details = []
        for career_id in call.get('available_careers', []):
            career = await db.careers.find_one({"id": career_id})
            if career:
                career_info = {
                    **Career(**career).dict(),
                    "vacancies": call.get('career_vacancies', {}).get(career_id, 0)
                }
                career_details.append(career_info)
        
        admission_call_obj = AdmissionCall(**call)
        enriched_call = {
            **admission_call_obj.dict(),
            "careers": career_details
        }
        enriched_calls.append(enriched_call)
    
    return {
        "admission_calls": enriched_calls,
        "total": len(enriched_calls)
    }

# Admission Module - Applicants Management
@api_router.post("/applicants")
async def create_applicant(applicant_data: ApplicantCreate, current_user: User = Depends(get_current_user)):
    """Create a new applicant (can be self-registration or admin creation)"""
    
    # Check if applicant with same document exists
    existing_applicant = await db.applicants.find_one({"document_number": applicant_data.document_number})
    if existing_applicant:
        raise HTTPException(status_code=400, detail="Applicant with this document number already exists")
    
    # Check if email is already registered
    existing_email = await db.applicants.find_one({"email": applicant_data.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate age
    age = calculate_age(applicant_data.birth_date)
    if age < 15:
        raise HTTPException(status_code=400, detail="Minimum age is 15 years")
    if age > 50:
        raise HTTPException(status_code=400, detail="Maximum age is 50 years")
    
    applicant = Applicant(**applicant_data.dict())
    
    # Link to user if they are registering themselves
    if current_user.role == UserRole.APPLICANT:
        applicant.user_id = current_user.id
    
    applicant_doc = applicant.dict()
    # Convert date to ISO format
    applicant_doc['birth_date'] = applicant_doc['birth_date'].isoformat()
    
    await db.applicants.insert_one(applicant_doc)
    
    logger.info(f"Applicant {applicant.applicant_code} created")
    
    return {
        "status": "success",
        "applicant": applicant,
        "message": "Applicant registered successfully"
    }

@api_router.get("/applicants", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.ACADEMIC_STAFF]))])
async def get_applicants(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get applicants list"""
    
    filter_query = {}
    if search:
        filter_query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"applicant_code": {"$regex": search, "$options": "i"}},
            {"document_number": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    applicants = await db.applicants.find(filter_query).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.applicants.count_documents(filter_query)
    
    return {
        "applicants": [Applicant(**applicant) for applicant in applicants],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/applicants/me")
async def get_my_applicant_profile(current_user: User = Depends(get_current_user)):
    """Get current user's applicant profile"""
    
    if current_user.role != UserRole.APPLICANT:
        raise HTTPException(status_code=403, detail="Only applicants can access this endpoint")
    
    applicant = await db.applicants.find_one({"user_id": current_user.id})
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    return Applicant(**applicant)

# Admission Module - Applications Management
@api_router.post("/applications")
async def create_application(application_data: ApplicationCreate, current_user: User = Depends(get_current_user)):
    """Create a new application"""
    
    # Verify admission call exists and is open
    admission_call = await db.admission_calls.find_one({"id": application_data.admission_call_id})
    if not admission_call:
        raise HTTPException(status_code=404, detail="Admission call not found")
    
    # Check if registration is still open
    current_date = datetime.now()
    registration_end = datetime.fromisoformat(admission_call['registration_end'])
    if current_date > registration_end:
        raise HTTPException(status_code=400, detail="Registration period has ended")
    
    # Verify applicant exists
    applicant = await db.applicants.find_one({"id": application_data.applicant_id})
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    
    # Check if applicant already applied for this admission call
    existing_application = await db.applications.find_one({
        "admission_call_id": application_data.admission_call_id,
        "applicant_id": application_data.applicant_id
    })
    if existing_application:
        raise HTTPException(status_code=400, detail="Applicant already applied for this admission call")
    
    # Validate career preferences
    available_careers = admission_call.get('available_careers', [])
    for career_id in application_data.career_preferences:
        if career_id not in available_careers:
            raise HTTPException(status_code=400, detail=f"Career {career_id} not available in this admission call")
    
    # Validate age requirements
    age = calculate_age(date.fromisoformat(applicant['birth_date']))
    if age < admission_call.get('minimum_age', 16) or age > admission_call.get('maximum_age', 35):
        raise HTTPException(
            status_code=400, 
            detail=f"Age must be between {admission_call.get('minimum_age', 16)} and {admission_call.get('maximum_age', 35)} years"
        )
    
    application = Application(**application_data.dict())
    
    application_doc = application.dict()
    await db.applications.insert_one(application_doc)
    
    # Update admission call application count
    await db.admission_calls.update_one(
        {"id": application_data.admission_call_id},
        {"$inc": {"total_applications": 1}}
    )
    
    logger.info(f"Application {application.application_number} created for applicant {application_data.applicant_id}")
    
    return {
        "status": "success",
        "application": application,
        "message": "Application submitted successfully"
    }

@api_router.get("/applications", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.ACADEMIC_STAFF]))])
async def get_applications(
    admission_call_id: Optional[str] = None,
    career_id: Optional[str] = None,
    status: Optional[ApplicationStatus] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get applications list"""
    
    filter_query = {}
    if admission_call_id:
        filter_query["admission_call_id"] = admission_call_id
    if career_id:
        filter_query["career_preferences"] = {"$in": [career_id]}
    if status:
        filter_query["status"] = status.value
    
    applications = await db.applications.find(filter_query).skip(skip).limit(limit).sort("submitted_at", -1).to_list(limit)
    total = await db.applications.count_documents(filter_query)
    
    # Enrich with applicant and admission call data
    enriched_applications = []
    for application in applications:
        # Get applicant
        applicant = await db.applicants.find_one({"id": application["applicant_id"]})
        
        # Get admission call
        admission_call = await db.admission_calls.find_one({"id": application["admission_call_id"]})
        
        # Get career preferences details
        career_details = []
        for career_id in application.get("career_preferences", []):
            career = await db.careers.find_one({"id": career_id})
            if career:
                career_details.append(Career(**career))
        
        application_obj = Application(**application)
        enriched_application = {
            **application_obj.dict(),
            "applicant": Applicant(**applicant) if applicant else None,
            "admission_call": AdmissionCall(**admission_call) if admission_call else None,
            "career_preferences_details": career_details
        }
        enriched_applications.append(enriched_application)
    
    return {
        "applications": enriched_applications,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/applications/me")
async def get_my_applications(current_user: User = Depends(get_current_user)):
    """Get current user's applications"""
    
    if current_user.role != UserRole.APPLICANT:
        raise HTTPException(status_code=403, detail="Only applicants can access this endpoint")
    
    # Find applicant profile
    applicant = await db.applicants.find_one({"user_id": current_user.id})
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    # Get applications
    applications = await db.applications.find({"applicant_id": applicant["id"]}).sort("submitted_at", -1).to_list(50)
    
    # Enrich with details
    enriched_applications = []
    for application in applications:
        # Get admission call
        admission_call = await db.admission_calls.find_one({"id": application["admission_call_id"]})
        
        # Get career preferences details
        career_details = []
        for career_id in application.get("career_preferences", []):
            career = await db.careers.find_one({"id": career_id})
            if career:
                career_details.append(Career(**career))
        
        application_obj = Application(**application)
        enriched_application = {
            **application_obj.dict(),
            "admission_call": AdmissionCall(**admission_call) if admission_call else None,
            "career_preferences_details": career_details
        }
        enriched_applications.append(enriched_application)
    
    return {
        "applications": enriched_applications,
        "total": len(enriched_applications)
    }

# Admission Module - Evaluations Management
@api_router.post("/evaluations", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.ACADEMIC_STAFF]))])
async def create_evaluation(evaluation_data: AdmissionEvaluationCreate, current_user: User = Depends(get_current_user)):
    """Create or update an evaluation for an application"""
    
    # Verify application exists
    application = await db.applications.find_one({"id": evaluation_data.application_id})
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Check if evaluation already exists
    existing_evaluation = await db.admission_evaluations.find_one({"application_id": evaluation_data.application_id})
    
    if existing_evaluation:
        # Update existing evaluation
        update_data = evaluation_data.dict()
        update_data["evaluated_by"] = current_user.id
        update_data["evaluated_at"] = datetime.utcnow()
        
        # Calculate final score
        exam_score = update_data.get("exam_score")
        interview_score = update_data.get("interview_score")
        final_score = calculate_final_score(exam_score, interview_score)
        update_data["final_score"] = final_score
        
        await db.admission_evaluations.update_one(
            {"application_id": evaluation_data.application_id},
            {"$set": update_data}
        )
        
        # Update application with scores
        await db.applications.update_one(
            {"id": evaluation_data.application_id},
            {
                "$set": {
                    "exam_score": exam_score,
                    "interview_score": interview_score, 
                    "final_score": final_score,
                    "status": ApplicationStatus.EVALUATED.value,
                    "evaluated_at": datetime.utcnow()
                }
            }
        )
        
        evaluation = AdmissionEvaluation(**{**update_data, "id": existing_evaluation["id"]})
        message = "Evaluation updated successfully"
        
    else:
        # Create new evaluation
        evaluation = AdmissionEvaluation(**evaluation_data.dict())
        evaluation.evaluated_by = current_user.id
        
        # Calculate final score
        final_score = calculate_final_score(evaluation.exam_score, evaluation.interview_score)
        evaluation.final_score = final_score
        
        evaluation_doc = evaluation.dict()
        await db.admission_evaluations.insert_one(evaluation_doc)
        
        # Update application with scores
        await db.applications.update_one(
            {"id": evaluation_data.application_id},
            {
                "$set": {
                    "exam_score": evaluation.exam_score,
                    "interview_score": evaluation.interview_score,
                    "final_score": final_score,
                    "status": ApplicationStatus.EVALUATED.value,
                    "evaluated_at": datetime.utcnow()
                }
            }
        )
        
        message = "Evaluation created successfully"
    
    logger.info(f"Evaluation for application {evaluation_data.application_id} created/updated by {current_user.username}")
    
    return {
        "status": "success",
        "evaluation": evaluation,
        "message": message
    }

@api_router.get("/evaluations", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.ACADEMIC_STAFF]))])
async def get_evaluations(
    application_id: Optional[str] = None,
    admission_call_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get evaluations"""
    
    filter_query = {}
    if application_id:
        filter_query["application_id"] = application_id
    
    evaluations = await db.admission_evaluations.find(filter_query).sort("evaluated_at", -1).to_list(100)
    
    # Enrich with application data if needed
    enriched_evaluations = []
    for evaluation in evaluations:
        # Get application
        application = await db.applications.find_one({"id": evaluation["application_id"]})
        if admission_call_id and application and application.get("admission_call_id") != admission_call_id:
            continue
            
        evaluation_obj = AdmissionEvaluation(**evaluation)
        enriched_evaluation = {
            **evaluation_obj.dict(),
            "application": Application(**application) if application else None
        }
        enriched_evaluations.append(enriched_evaluation)
    
    return {
        "evaluations": enriched_evaluations,
        "total": len(enriched_evaluations)
    }

# Admission Module - Results Management
@api_router.post("/admission-results/publish/{admission_call_id}", dependencies=[Depends(require_role([UserRole.ADMIN]))])
async def publish_admission_results(admission_call_id: str, current_user: User = Depends(get_current_user)):
    """Publish admission results for an admission call"""
    
    try:
        results_summary = await publish_admission_results(admission_call_id)
        
        logger.info(f"Admission results published for call {admission_call_id} by {current_user.username}")
        
        return {
            "status": "success",
            "message": "Admission results published successfully",
            "summary": results_summary
        }
        
    except Exception as e:
        logger.error(f"Error publishing admission results: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error publishing results: {str(e)}")

@api_router.get("/admission-results", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.ACADEMIC_STAFF]))])
async def get_admission_results(
    admission_call_id: Optional[str] = None,
    career_id: Optional[str] = None,
    result_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get admission results"""
    
    filter_query = {}
    if admission_call_id:
        filter_query["admission_call_id"] = admission_call_id
    if career_id:
        filter_query["career_id"] = career_id
    if result_type:
        filter_query["result_type"] = result_type
    
    results = await db.admission_results.find(filter_query).sort([("career_id", 1), ("position", 1)]).to_list(500)
    
    # Enrich with application and applicant data
    enriched_results = []
    for result in results:
        # Get application
        application = await db.applications.find_one({"id": result["application_id"]})
        
        # Get applicant
        applicant = None
        if application:
            applicant = await db.applicants.find_one({"id": application["applicant_id"]})
        
        # Get career
        career = await db.careers.find_one({"id": result["career_id"]})
        
        result_obj = AdmissionResult(**result)
        enriched_result = {
            **result_obj.dict(),
            "application": Application(**application) if application else None,
            "applicant": Applicant(**applicant) if applicant else None,
            "career": Career(**career) if career else None
        }
        enriched_results.append(enriched_result)
    
    return {
        "results": enriched_results,
        "total": len(enriched_results)
    }

# Public endpoint for checking admission results
@api_router.get("/public/admission-results/check")
async def check_admission_result(document_number: str, admission_call_id: str):
    """Check admission result by document number (public endpoint)"""
    
    # Find applicant by document number
    applicant = await db.applicants.find_one({"document_number": document_number})
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    
    # Find application
    application = await db.applications.find_one({
        "admission_call_id": admission_call_id,
        "applicant_id": applicant["id"]
    })
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Find result
    result = await db.admission_results.find_one({"application_id": application["id"]})
    if not result:
        raise HTTPException(status_code=404, detail="Results not yet published")
    
    # Get career details
    career = await db.careers.find_one({"id": result["career_id"]})
    
    # Get admission call details
    admission_call = await db.admission_calls.find_one({"id": admission_call_id})
    
    return {
        "applicant_name": f"{applicant['first_name']} {applicant['last_name']} {applicant.get('second_last_name', '')}".strip(),
        "document_number": applicant["document_number"],
        "career": career["name"] if career else "N/A",
        "result_type": result["result_type"],
        "is_admitted": result["is_admitted"],
        "position": result["position"],
        "final_score": result["final_score"],
        "admission_call": admission_call["name"] if admission_call else "N/A"
    }

@api_router.get("/admission-calls/{call_id}")
async def get_admission_call(call_id: str, current_user: User = Depends(get_current_user)):
    """Get specific admission call details"""
    
    admission_call = await db.admission_calls.find_one({"id": call_id})
    if not admission_call:
        raise HTTPException(status_code=404, detail="Admission call not found")
    
    # Get career details
    career_details = []
    for career_id in admission_call.get('available_careers', []):
        career = await db.careers.find_one({"id": career_id})
        if career:
            career_info = {
                **Career(**career).dict(),
                "vacancies": admission_call.get('career_vacancies', {}).get(career_id, 0)
            }
            career_details.append(career_info)
    
    # Get application statistics
    total_applications = await db.applications.count_documents({"admission_call_id": call_id})
    
    return {
        "admission_call": AdmissionCall(**admission_call),
        "careers": career_details,
        "statistics": {
            "total_applications": total_applications
        }
    }

# Public endpoint for viewing admission calls (no auth required)
@api_router.get("/public/admission-calls")
async def get_public_admission_calls():
    """Get active admission calls for public view"""
    current_date = datetime.now()
    
    filter_query = {
        "is_active": True,
        "status": "OPEN",
        "registration_end": {"$gte": current_date.isoformat()}
    }
    
    admission_calls = await db.admission_calls.find(filter_query).sort("registration_start", 1).to_list(10)
    
    # Enrich with career information
    enriched_calls = []
    for call in admission_calls:
        career_details = []
        for career_id in call.get('available_careers', []):
            career = await db.careers.find_one({"id": career_id})
            if career:
                career_info = {
                    "id": career['id'],
                    "code": career['code'],
                    "name": career['name'],
                    "description": career.get('description'),
                    "duration_years": career['duration_years'],
                    "vacancies": call.get('career_vacancies', {}).get(career_id, 0)
                }
                career_details.append(career_info)
        
        public_call = {
            "id": call['id'],
            "name": call['name'],
            "description": call.get('description'),
            "academic_year": call['academic_year'],
            "academic_period": call['academic_period'],
            "registration_start": call['registration_start'],
            "registration_end": call['registration_end'],
            "exam_date": call.get('exam_date'),
            "results_date": call.get('results_date'),
            "application_fee": call.get('application_fee', 0),
            "minimum_age": call.get('minimum_age', 16),
            "maximum_age": call.get('maximum_age', 35),
            "required_documents": call.get('required_documents', []),
            "careers": career_details
        }
        enriched_calls.append(public_call)
    
    return {
        "admission_calls": enriched_calls,
        "total": len(enriched_calls)
    }

# Mesa de Partes - Procedure Types Management
@api_router.post("/procedure-types", dependencies=[Depends(require_role([UserRole.ADMIN]))])
async def create_procedure_type(procedure_type_data: ProcedureTypeCreate, current_user: User = Depends(get_current_user)):
    """Create a new procedure type"""
    
    # Check if procedure type with same name exists
    existing_type = await db.procedure_types.find_one({"name": procedure_type_data.name})
    if existing_type:
        raise HTTPException(status_code=400, detail="Procedure type with this name already exists")
    
    procedure_type = ProcedureType(**procedure_type_data.dict())
    procedure_type_doc = procedure_type.dict()
    
    await db.procedure_types.insert_one(procedure_type_doc)
    
    logger.info(f"Procedure type {procedure_type.name} created by {current_user.username}")
    
    return {
        "status": "success",
        "procedure_type": procedure_type,
        "message": "Procedure type created successfully"
    }

@api_router.get("/procedure-types")
async def get_procedure_types(
    area: Optional[ProcedureArea] = None,
    is_active: bool = True,
    current_user: User = Depends(get_current_user)
):
    """Get procedure types"""
    filter_query = {"is_active": is_active}
    if area:
        filter_query["area"] = area.value
    
    procedure_types = await db.procedure_types.find(filter_query).sort("name", 1).to_list(100)
    
    return {
        "procedure_types": [ProcedureType(**pt) for pt in procedure_types],
        "total": len(procedure_types)
    }

# Mesa de Partes - Procedures Management
@api_router.post("/procedures")
async def create_procedure(procedure_data: ProcedureCreate, current_user: User = Depends(get_current_user)):
    """Create a new procedure"""
    
    # Verify procedure type exists
    procedure_type = await db.procedure_types.find_one({"id": procedure_data.procedure_type_id})
    if not procedure_type:
        raise HTTPException(status_code=404, detail="Procedure type not found")
    
    # Generate unique tracking code
    tracking_code = generate_tracking_code()
    
    # Calculate deadline
    deadline = calculate_deadline(procedure_type['processing_days'])
    
    # Create procedure data with required fields
    procedure_dict = procedure_data.dict()
    procedure_dict['tracking_code'] = tracking_code
    procedure_dict['created_by'] = current_user.id
    procedure_dict['area'] = ProcedureArea(procedure_type['area'])
    procedure_dict['deadline'] = deadline
    
    # For external users, use their provided info
    if current_user.role == UserRole.EXTERNAL_USER:
        if not procedure_data.applicant_name or not procedure_data.applicant_email:
            # Use user data if not provided
            procedure_dict['applicant_name'] = procedure_dict.get('applicant_name') or current_user.full_name
            procedure_dict['applicant_email'] = procedure_dict.get('applicant_email') or current_user.email
    
    # Create procedure object
    procedure = Procedure(**procedure_dict)
    
    procedure_doc = procedure.dict()
    # Convert datetime objects to ISO format for MongoDB
    if procedure_doc.get('deadline'):
        procedure_doc['deadline'] = procedure_doc['deadline'].isoformat()
    
    await db.procedures.insert_one(procedure_doc)
    
    # Log creation
    await log_procedure_action(
        procedure_id=procedure.id,
        action="CREATED",
        performed_by=current_user.id,
        new_status=procedure.status.value,
        comment=f"Procedure created with tracking code: {tracking_code}"
    )
    
    # Send confirmation notification
    recipient_email = procedure.applicant_email or current_user.email
    if recipient_email:
        await send_procedure_notification(
            procedure_id=procedure.id,
            recipient_email=recipient_email,
            notification_type="PROCEDURE_CREATED",
            subject=f"Trámite Registrado - {tracking_code}",
            content=f"Su trámite '{procedure.subject}' ha sido registrado exitosamente. Código de seguimiento: {tracking_code}"
        )
    
    logger.info(f"Procedure {tracking_code} created by {current_user.username}")
    
    return {
        "status": "success",
        "procedure": procedure,
        "tracking_code": tracking_code,
        "message": "Procedure created successfully"
    }

@api_router.get("/procedures")
async def get_procedures(
    status: Optional[ProcedureStatus] = None,
    area: Optional[ProcedureArea] = None,
    assigned_to_me: bool = False,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get procedures based on user role and filters"""
    
    filter_query = {}
    
    # Role-based filtering
    if current_user.role == UserRole.EXTERNAL_USER:
        # External users can only see their own procedures
        filter_query["created_by"] = current_user.id
    elif current_user.role == UserRole.ADMIN_WORKER:
        if assigned_to_me:
            filter_query["assigned_to"] = current_user.id
        # Admin workers can see procedures from their area or assigned to them
        # For now, they can see all procedures
    # ADMIN can see all procedures
    
    # Apply filters
    if status:
        filter_query["status"] = status.value
    if area:
        filter_query["area"] = area.value
    
    procedures = await db.procedures.find(filter_query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.procedures.count_documents(filter_query)
    
    # Enrich with procedure type and assignee info
    enriched_procedures = []
    for procedure in procedures:
        # Get procedure type
        procedure_type = await db.procedure_types.find_one({"id": procedure["procedure_type_id"]})
        
        # Get assignee info if assigned
        assignee = None
        if procedure.get("assigned_to"):
            assignee = await db.users.find_one({"id": procedure["assigned_to"]})
        
        procedure_obj = Procedure(**procedure)
        enriched_procedure = {
            **procedure_obj.dict(),
            "procedure_type": ProcedureType(**procedure_type) if procedure_type else None,
            "assignee": User(**assignee) if assignee else None
        }
        enriched_procedures.append(enriched_procedure)
    
    return {
        "procedures": enriched_procedures,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/procedures/{procedure_id}")
async def get_procedure(procedure_id: str, current_user: User = Depends(get_current_user)):
    """Get specific procedure details"""
    
    procedure = await db.procedures.find_one({"id": procedure_id})
    if not procedure:
        raise HTTPException(status_code=404, detail="Procedure not found")
    
    # Check permissions
    if (current_user.role == UserRole.EXTERNAL_USER and 
        procedure.get("created_by") != current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get related data
    procedure_type = await db.procedure_types.find_one({"id": procedure["procedure_type_id"]})
    assignee = None
    if procedure.get("assigned_to"):
        assignee = await db.users.find_one({"id": procedure["assigned_to"]})
    
    # Get procedure logs
    logs = await db.procedure_logs.find({"procedure_id": procedure_id}).sort("performed_at", -1).to_list(50)
    
    # Get attachments
    attachments = await db.procedure_attachments.find({"procedure_id": procedure_id}).to_list(20)
    
    return {
        "procedure": Procedure(**procedure),
        "procedure_type": ProcedureType(**procedure_type) if procedure_type else None,
        "assignee": User(**assignee) if assignee else None,
        "logs": [ProcedureLog(**log) for log in logs],
        "attachments": [ProcedureAttachment(**att) for att in attachments]
    }

@api_router.get("/procedures/tracking/{tracking_code}")
async def track_procedure(tracking_code: str):
    """Track procedure by tracking code (public endpoint)"""
    
    procedure = await db.procedures.find_one({"tracking_code": tracking_code})
    if not procedure:
        raise HTTPException(status_code=404, detail="Procedure not found")
    
    # Get procedure type
    procedure_type = await db.procedure_types.find_one({"id": procedure["procedure_type_id"]})
    
    # Get logs (limited info for public tracking)
    logs = await db.procedure_logs.find(
        {"procedure_id": procedure["id"], "action": {"$in": ["CREATED", "STATUS_CHANGED", "COMPLETED"]}}
    ).sort("performed_at", 1).to_list(20)
    
    return {
        "tracking_code": tracking_code,
        "subject": procedure["subject"],
        "status": procedure["status"],
        "created_at": procedure["created_at"],
        "deadline": procedure.get("deadline"),
        "procedure_type": procedure_type["name"] if procedure_type else None,
        "timeline": [
            {
                "action": log["action"],
                "status": log.get("new_status"),
                "date": log["performed_at"],
                "comment": log.get("comment")
            } for log in logs
        ]
    }

@api_router.put("/procedures/{procedure_id}/status", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.ADMIN_WORKER]))])
async def update_procedure_status(
    procedure_id: str, 
    status_update: ProcedureStatusUpdate, 
    current_user: User = Depends(get_current_user)
):
    """Update procedure status"""
    
    procedure = await db.procedures.find_one({"id": procedure_id})
    if not procedure:
        raise HTTPException(status_code=404, detail="Procedure not found")
    
    previous_status = procedure["status"]
    new_status = status_update.status.value
    
    # Update procedure
    update_data = {
        "status": new_status,
        "updated_at": datetime.utcnow()
    }
    
    if new_status == ProcedureStatus.COMPLETED.value:
        update_data["completed_at"] = datetime.utcnow()
    
    await db.procedures.update_one({"id": procedure_id}, {"$set": update_data})
    
    # Log status change
    await log_procedure_action(
        procedure_id=procedure_id,
        action="STATUS_CHANGED",
        performed_by=current_user.id,
        previous_status=previous_status,
        new_status=new_status,
        comment=status_update.comment
    )
    
    # Send notification if requested
    if status_update.notify_applicant and procedure.get("applicant_email"):
        status_names = {
            "RECEIVED": "Recibido",
            "IN_PROCESS": "En Proceso", 
            "COMPLETED": "Finalizado",
            "REJECTED": "Rechazado",
            "PENDING_INFO": "Pendiente de Información"
        }
        
        await send_procedure_notification(
            procedure_id=procedure_id,
            recipient_email=procedure["applicant_email"],
            notification_type="STATUS_UPDATE",
            subject=f"Actualización de Trámite - {procedure['tracking_code']}",
            content=f"Su trámite '{procedure['subject']}' ahora está en estado: {status_names.get(new_status, new_status)}"
        )
    
    return {
        "status": "success",
        "message": "Procedure status updated successfully",
        "previous_status": previous_status,
        "new_status": new_status
    }

@api_router.put("/procedures/{procedure_id}/assign", dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.ADMIN_WORKER]))])
async def assign_procedure(
    procedure_id: str, 
    assign_to_user_id: str, 
    current_user: User = Depends(get_current_user)
):
    """Assign procedure to a user"""
    
    procedure = await db.procedures.find_one({"id": procedure_id})
    if not procedure:
        raise HTTPException(status_code=404, detail="Procedure not found")
    
    # Verify assignee exists and has appropriate role
    assignee = await db.users.find_one({"id": assign_to_user_id})
    if not assignee or assignee["role"] not in [UserRole.ADMIN.value, UserRole.ADMIN_WORKER.value]:
        raise HTTPException(status_code=400, detail="Invalid assignee")
    
    # Update procedure
    await db.procedures.update_one(
        {"id": procedure_id}, 
        {
            "$set": {
                "assigned_to": assign_to_user_id,
                "assigned_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Log assignment
    await log_procedure_action(
        procedure_id=procedure_id,
        action="ASSIGNED",
        performed_by=current_user.id,
        comment=f"Assigned to {assignee['full_name']}"
    )
    
    return {
        "status": "success",
        "message": "Procedure assigned successfully",
        "assigned_to": assignee["full_name"]
    }

# Include router
app.include_router(api_router)

# Initialize default procedure types
@app.on_event("startup")
async def create_default_procedure_types():
    """Create default procedure types if they don't exist"""
    default_types = [
        {
            "name": "Solicitud de Certificado de Estudios",
            "description": "Solicitud de certificado oficial de estudios cursados",
            "area": "ACADEMIC",
            "required_documents": ["DNI", "Comprobante de pago"],
            "processing_days": 5
        },
        {
            "name": "Solicitud de Constancia de Matrícula",
            "description": "Constancia que acredita estar matriculado en el instituto",
            "area": "ACADEMIC", 
            "required_documents": ["DNI"],
            "processing_days": 3
        },
        {
            "name": "Solicitud de Traslado",
            "description": "Solicitud de traslado a otra institución educativa",
            "area": "ACADEMIC",
            "required_documents": ["DNI", "Solicitud", "Certificado de estudios"],
            "processing_days": 15
        },
        {
            "name": "Reclamo o Queja",
            "description": "Presentación de reclamos o quejas sobre servicios",
            "area": "ADMINISTRATIVE",
            "required_documents": ["DNI", "Documento sustentatorio"],
            "processing_days": 10
        },
        {
            "name": "Solicitud de Información",
            "description": "Pedido de acceso a información pública",
            "area": "ADMINISTRATIVE",
            "required_documents": ["DNI"],
            "processing_days": 7
        },
        {
            "name": "Solicitud de Beca",
            "description": "Postulación a programas de becas estudiantiles",
            "area": "FINANCIAL",
            "required_documents": ["DNI", "Declaración jurada", "Comprobantes de ingresos"],
            "processing_days": 20
        }
    ]
    
    try:
        existing_count = await db.procedure_types.count_documents({})
        if existing_count == 0:
            for type_data in default_types:
                procedure_type = ProcedureType(**type_data)
                await db.procedure_types.insert_one(procedure_type.dict())
            logger.info(f"Created {len(default_types)} default procedure types")
    except Exception as e:
        logger.error(f"Error creating default procedure types: {str(e)}")

# Initialize default careers for admission
async def create_default_careers():
    """Create default careers if they don't exist"""
    default_careers = [
        {
            "code": "EINICIAL",
            "name": "Educación Inicial",
            "description": "Formación docente para educación inicial (0-5 años)",
            "duration_years": 5
        },
        {
            "code": "EPRIMARIA", 
            "name": "Educación Primaria",
            "description": "Formación docente para educación primaria (6-11 años)",
            "duration_years": 5
        },
        {
            "code": "EFISICA",
            "name": "Educación Física",
            "description": "Formación docente en educación física y deportes",
            "duration_years": 5
        },
        {
            "code": "EARTISTICA",
            "name": "Educación Artística",
            "description": "Formación docente en artes visuales y música",
            "duration_years": 5
        },
        {
            "code": "ECOMUNICACION",
            "name": "Comunicación",
            "description": "Formación docente en lenguaje y comunicación",
            "duration_years": 5
        },
        {
            "code": "EMATEMATICA",
            "name": "Matemática",
            "description": "Formación docente en matemática",
            "duration_years": 5
        }
    ]
    
    try:
        existing_count = await db.careers.count_documents({})
        if existing_count == 0:
            for career_data in default_careers:
                career = Career(**career_data)
                await db.careers.insert_one(career.dict())
            logger.info(f"Created {len(default_careers)} default careers")
    except Exception as e:
        logger.error(f"Error creating default careers: {str(e)}")

# Initialize default admission call
async def create_default_admission_call():
    """Create a sample admission call if none exist"""
    try:
        existing_count = await db.admission_calls.count_documents({})
        if existing_count == 0:
            # Get all careers
            careers = await db.careers.find({}).to_list(100)
            if not careers:
                return
            
            # Create admission call for 2025
            career_ids = [career["id"] for career in careers]
            career_vacancies = {career["id"]: 30 for career in careers}  # 30 vacancies per career
            
            admission_call_data = {
                "name": "Proceso de Admisión 2025-I",
                "description": "Proceso de admisión para el periodo académico 2025-I del IESPP Gustavo Allende Llavería",
                "academic_year": 2025,
                "academic_period": "I",
                "registration_start": datetime(2024, 11, 1),
                "registration_end": datetime(2024, 12, 15),
                "exam_date": datetime(2024, 12, 20),
                "results_date": datetime(2024, 12, 25),
                "application_fee": 50.0,
                "max_applications_per_career": 2,
                "available_careers": career_ids,
                "career_vacancies": career_vacancies,
                "minimum_age": 16,
                "maximum_age": 35,
                "required_documents": ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY"],
                "created_by": "SYSTEM"
            }
            
            admission_call = AdmissionCall(**admission_call_data)
            admission_call_doc = admission_call.dict()
            
            # Convert datetime objects for MongoDB
            for field in ['registration_start', 'registration_end', 'exam_date', 'results_date']:
                if admission_call_doc.get(field):
                    admission_call_doc[field] = admission_call_doc[field].isoformat()
            
            await db.admission_calls.insert_one(admission_call_doc)
            logger.info("Created default admission call for 2025-I")
            
    except Exception as e:
        logger.error(f"Error creating default admission call: {str(e)}")

# Update startup event to include admission data
@app.on_event("startup") 
async def initialize_default_data():
    """Initialize all default data"""
    await create_default_procedure_types()
    await create_default_careers()
    await create_default_admission_call()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ====================================================================================================
# TESORERÍA Y ADMINISTRACIÓN - CASH & BANKS APIs
# ====================================================================================================

# Bank Accounts Management
@api_router.post("/finance/bank-accounts", dependencies=[Depends(require_role([UserRole.FINANCE_ADMIN]))])
async def create_bank_account(account_data: BankAccountCreate, current_user: User = Depends(get_current_user)):
    """Create a new bank account"""
    
    # Check if account with same number exists
    existing_account = await db.bank_accounts.find_one({"account_number": account_data.account_number})
    if existing_account:
        raise HTTPException(status_code=400, detail="Bank account with this number already exists")
    
    account_dict = account_data.dict()
    account_dict['created_by'] = current_user.id
    account = BankAccount(**account_dict)
    
    account_doc = prepare_for_mongo(account.dict())
    await db.bank_accounts.insert_one(account_doc)
    
    # Log audit trail
    await log_audit_trail(
        db, "bank_accounts", account.id, "CREATE", 
        None, account_doc, current_user.id
    )
    
    logger.info(f"Bank account {account.account_name} created by {current_user.username}")
    
    return {
        "status": "success",
        "account": account,
        "message": "Bank account created successfully"
    }

@api_router.get("/finance/bank-accounts")
async def get_bank_accounts(
    is_active: bool = True,
    current_user: User = Depends(require_role([UserRole.FINANCE_ADMIN, UserRole.CASHIER]))
):
    """Get bank accounts"""
    filter_query = {"is_active": is_active}
    
    accounts = await db.bank_accounts.find(filter_query).sort("account_name", 1).to_list(100)
    
    return {
        "accounts": [BankAccount(**account) for account in accounts],
        "total": len(accounts)
    }

# Cash Sessions Management
@api_router.post("/finance/cash-sessions", dependencies=[Depends(require_role([UserRole.CASHIER, UserRole.FINANCE_ADMIN]))])
async def open_cash_session(session_data: CashSessionCreate, current_user: User = Depends(get_current_user)):
    """Open a new cash session"""
    
    # Check if user already has an open session
    existing_session = await db.cash_sessions.find_one({
        "opened_by": current_user.id,
        "status": CashSessionStatus.OPEN.value
    })
    
    if existing_session:
        raise HTTPException(status_code=400, detail="You already have an open cash session")
    
    session_dict = session_data.dict()
    session_dict['opened_by'] = current_user.id
    session_dict['expected_final_amount'] = session_data.initial_amount
    
    session = CashSession(**session_dict)
    session_doc = prepare_for_mongo(session.dict())
    
    await db.cash_sessions.insert_one(session_doc)
    
    # Log audit trail
    await log_audit_trail(
        db, "cash_sessions", session.id, "CREATE",
        None, session_doc, current_user.id
    )
    
    logger.info(f"Cash session {session.session_number} opened by {current_user.username}")
    
    return {
        "status": "success",
        "session": session,
        "message": "Cash session opened successfully"
    }

@api_router.get("/finance/cash-sessions/current")
async def get_current_cash_session(current_user: User = Depends(require_role([UserRole.CASHIER, UserRole.FINANCE_ADMIN]))):
    """Get current open cash session for user"""
    
    session = await db.cash_sessions.find_one({
        "opened_by": current_user.id,
        "status": CashSessionStatus.OPEN.value
    })
    
    if not session:
        return {"session": None, "message": "No open cash session found"}
    
    # Get movements for this session
    movements = await db.cash_movements.find({"cash_session_id": session["id"]}).to_list(1000)
    
    # Calculate totals
    total_income = sum(m.get('amount', 0) for m in movements if m.get('movement_type') == MovementType.INCOME.value)
    total_expense = sum(m.get('amount', 0) for m in movements if m.get('movement_type') == MovementType.EXPENSE.value)
    expected_final = session.get('initial_amount', 0) + total_income - total_expense
    
    # Update session totals
    await db.cash_sessions.update_one(
        {"id": session["id"]},
        {
            "$set": {
                "total_income": total_income,
                "total_expense": total_expense,
                "expected_final_amount": expected_final
            }
        }
    )
    
    session_obj = CashSession(**session)
    session_obj.total_income = total_income
    session_obj.total_expense = total_expense
    session_obj.expected_final_amount = expected_final
    
    return {
        "session": session_obj,
        "movements": [CashMovement(**m) for m in movements],
        "totals": {
            "initial_amount": session.get('initial_amount', 0),
            "total_income": total_income,
            "total_expense": total_expense,
            "expected_final": expected_final
        }
    }

@api_router.post("/finance/cash-sessions/{session_id}/close")
async def close_cash_session(
    session_id: str,
    close_data: CashSessionCloseRequest,
    current_user: User = Depends(require_role([UserRole.CASHIER, UserRole.FINANCE_ADMIN]))
):
    """Close cash session with final amount"""
    
    session = await db.cash_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Cash session not found")
    
    if session["status"] != CashSessionStatus.OPEN.value:
        raise HTTPException(status_code=400, detail="Cash session is not open")
    
    if session["opened_by"] != current_user.id and current_user.role != UserRole.FINANCE_ADMIN:
        raise HTTPException(status_code=403, detail="Can only close your own cash session")
    
    # Calculate difference
    expected_final = session.get('expected_final_amount', 0)
    difference = close_data.final_amount - expected_final
    
    # Update session
    update_data = {
        "status": CashSessionStatus.CLOSED.value,
        "final_amount": close_data.final_amount,
        "difference": difference,
        "closed_at": datetime.now(timezone.utc).isoformat(),
        "closed_by": current_user.id,
        "closing_notes": close_data.closing_notes
    }
    
    await db.cash_sessions.update_one({"id": session_id}, {"$set": update_data})
    
    # Log audit trail
    await log_audit_trail(
        db, "cash_sessions", session_id, "UPDATE",
        {"status": session["status"]}, update_data, current_user.id
    )
    
    logger.info(f"Cash session {session['session_number']} closed by {current_user.username}")
    
    return {
        "status": "success",
        "message": "Cash session closed successfully",
        "final_amount": close_data.final_amount,
        "expected_amount": expected_final,
        "difference": difference
    }

# Cash Movements Management
@api_router.post("/finance/cash-movements", dependencies=[Depends(require_role([UserRole.CASHIER, UserRole.FINANCE_ADMIN]))])
async def create_cash_movement(movement_data: CashMovementCreate, current_user: User = Depends(get_current_user)):
    """Create a cash movement"""
    
    # Verify cash session exists and is open
    session = await db.cash_sessions.find_one({"id": movement_data.cash_session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Cash session not found")
    
    if session["status"] != CashSessionStatus.OPEN.value:
        raise HTTPException(status_code=400, detail="Cash session is not open")
    
    if session["opened_by"] != current_user.id and current_user.role != UserRole.FINANCE_ADMIN:
        raise HTTPException(status_code=403, detail="Can only add movements to your own cash session")
    
    movement_dict = movement_data.dict()
    movement_dict['created_by'] = current_user.id
    
    movement = CashMovement(**movement_dict)
    movement_doc = prepare_for_mongo(movement.dict())
    
    await db.cash_movements.insert_one(movement_doc)
    
    # Log audit trail
    await log_audit_trail(
        db, "cash_movements", movement.id, "CREATE",
        None, movement_doc, current_user.id
    )
    
    logger.info(f"Cash movement {movement.movement_number} created by {current_user.username}")
    
    return {
        "status": "success",
        "movement": movement,
        "message": "Cash movement created successfully"
    }

@api_router.get("/finance/cash-movements")
async def get_cash_movements(
    cash_session_id: Optional[str] = None,
    movement_type: Optional[MovementType] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([UserRole.CASHIER, UserRole.FINANCE_ADMIN]))
):
    """Get cash movements"""
    
    filter_query = {}
    
    if cash_session_id:
        filter_query["cash_session_id"] = cash_session_id
    
    if movement_type:
        filter_query["movement_type"] = movement_type.value
    
    # If not admin, only show movements from own sessions
    if current_user.role != UserRole.FINANCE_ADMIN:
        user_sessions = await db.cash_sessions.find({"opened_by": current_user.id}).to_list(100)
        session_ids = [s["id"] for s in user_sessions]
        filter_query["cash_session_id"] = {"$in": session_ids}
    
    movements = await db.cash_movements.find(filter_query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.cash_movements.count_documents(filter_query)
    
    # Enrich with session data
    enriched_movements = []
    for movement in movements:
        session = await db.cash_sessions.find_one({"id": movement["cash_session_id"]})
        
        movement_obj = CashMovement(**movement)
        enriched_movement = {
            **movement_obj.dict(),
            "session": CashSession(**session) if session else None
        }
        enriched_movements.append(enriched_movement)
    
    return {
        "movements": enriched_movements,
        "total": total,
        "skip": skip,
        "limit": limit
    }

# Bank Reconciliation
@api_router.post("/finance/bank-reconciliation/upload")
async def upload_bank_statement(
    bank_account_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role([UserRole.FINANCE_ADMIN]))
):
    """Upload bank statement file for reconciliation"""
    
    # Verify bank account exists
    bank_account = await db.bank_accounts.find_one({"id": bank_account_id})
    if not bank_account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    # Validate file type
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")
    
    try:
        # Read file content
        content = await file.read()
        
        # Parse based on file type
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        # Expected columns: Date, Description, Debit, Credit, Balance
        required_columns = ['Date', 'Description', 'Amount', 'Type']  # Simplified format
        
        if not all(col in df.columns for col in required_columns):
            raise HTTPException(
                status_code=400, 
                detail=f"File must contain columns: {', '.join(required_columns)}"
            )
        
        # Process bank movements
        bank_movements = []
        for _, row in df.iterrows():
            movement = {
                "id": str(uuid.uuid4()),
                "bank_account_id": bank_account_id,
                "date": pd.to_datetime(row['Date']).date().isoformat(),
                "description": str(row['Description']),
                "amount": float(row['Amount']),
                "movement_type": str(row['Type']).upper(),  # DEBIT or CREDIT
                "balance": float(row.get('Balance', 0)),
                "is_reconciled": False,
                "uploaded_by": current_user.id,
                "uploaded_at": datetime.now(timezone.utc).isoformat()
            }
            bank_movements.append(movement)
        
        # Save to database
        if bank_movements:
            await db.bank_movements.insert_many(bank_movements)
        
        # Log audit trail
        await log_audit_trail(
            db, "bank_movements", bank_account_id, "BULK_CREATE",
            None, {"count": len(bank_movements)}, current_user.id
        )
        
        logger.info(f"Bank statement uploaded: {len(bank_movements)} movements for account {bank_account['account_name']}")
        
        return {
            "status": "success",
            "message": f"Bank statement uploaded successfully: {len(bank_movements)} movements processed",
            "movements_count": len(bank_movements)
        }
        
    except Exception as e:
        logger.error(f"Error processing bank statement: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@api_router.post("/finance/bank-reconciliation/advanced-upload")
async def advanced_bank_reconciliation(
    reconciliation_data: BankReconciliationUpload,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role([UserRole.FINANCE_ADMIN]))
):
    """Advanced bank reconciliation with duplicate detection and tolerance handling"""
    
    # Verify bank account exists
    bank_account = await db.bank_accounts.find_one({"id": reconciliation_data.bank_account_id})
    if not bank_account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    # Validate file type
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")
    
    try:
        # Read file content
        content = await file.read()
        
        # Parse based on file type
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content), skiprows=1 if reconciliation_data.has_header else 0)
        else:
            df = pd.read_excel(io.BytesIO(content), skiprows=1 if reconciliation_data.has_header else 0)
        
        # Map columns based on configuration
        column_mapping = {
            reconciliation_data.date_column: 'date',
            reconciliation_data.description_column: 'description', 
            reconciliation_data.amount_column: 'amount',
            reconciliation_data.reference_column: 'reference'
        }
        
        # Rename columns
        df = df.rename(columns=column_mapping)
        
        # Validate required columns exist
        required_cols = ['date', 'description', 'amount']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {missing_cols}"
            )
        
        # Process reconciliation with advanced features
        processed_movements = []
        duplicates = []
        errors = []
        tolerance_threshold = 0.02  # 2 centavos tolerance
        
        # Get existing movements for duplicate detection
        existing_movements = await db.bank_movements.find({
            "bank_account_id": reconciliation_data.bank_account_id
        }).to_list(10000)
        
        for index, row in df.iterrows():
            try:
                # Parse and validate date
                movement_date = pd.to_datetime(row['date']).date()
                
                # Check if date is within reconciliation period
                reconciliation_start = reconciliation_data.reconciliation_date - timedelta(days=30)
                reconciliation_end = reconciliation_data.reconciliation_date + timedelta(days=1)
                
                if not (reconciliation_start <= movement_date <= reconciliation_end.date()):
                    errors.append({
                        "row": index + 1,
                        "error": f"Date {movement_date} outside reconciliation period",
                        "data": row.to_dict()
                    })
                    continue
                
                # Parse amount
                amount = float(row['amount'])
                description = str(row['description'])
                reference = str(row.get('reference', ''))
                
                # Check for duplicates (same date, similar amount within tolerance, similar description)
                is_duplicate = False
                for existing in existing_movements:
                    existing_date = datetime.fromisoformat(existing['date']).date()
                    existing_amount = existing['amount']
                    existing_desc = existing.get('description', '')
                    
                    # Check date match
                    if existing_date == movement_date:
                        # Check amount tolerance (2 centavos)
                        amount_diff = abs(existing_amount - amount)
                        if amount_diff <= tolerance_threshold:
                            # Check description similarity (simple contains check)
                            if existing_desc.lower() in description.lower() or description.lower() in existing_desc.lower():
                                is_duplicate = True
                                duplicates.append({
                                    "row": index + 1,
                                    "existing_id": existing['id'],
                                    "new_data": row.to_dict(),
                                    "existing_data": existing
                                })
                                break
                
                if not is_duplicate:
                    movement = {
                        "id": str(uuid.uuid4()),
                        "bank_account_id": reconciliation_data.bank_account_id,
                        "date": movement_date.isoformat(),
                        "description": description,
                        "amount": amount,
                        "reference": reference,
                        "movement_type": "DEBIT" if amount < 0 else "CREDIT",
                        "is_reconciled": False,
                        "reconciliation_id": str(uuid.uuid4()),
                        "uploaded_by": current_user.id,
                        "uploaded_at": datetime.now(timezone.utc).isoformat()
                    }
                    processed_movements.append(movement)
                    
            except Exception as e:
                errors.append({
                    "row": index + 1,
                    "error": str(e),
                    "data": row.to_dict()
                })
        
        # Save processed movements
        if processed_movements:
            await db.bank_movements.insert_many(processed_movements)
        
        # Create reconciliation summary
        reconciliation_summary = {
            "id": str(uuid.uuid4()),
            "bank_account_id": reconciliation_data.bank_account_id,
            "reconciliation_date": reconciliation_data.reconciliation_date.isoformat(),
            "file_format": reconciliation_data.file_format,
            "processed_count": len(processed_movements),
            "duplicate_count": len(duplicates),
            "error_count": len(errors),
            "total_rows": len(df),
            "created_by": current_user.id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.bank_reconciliations.insert_one(reconciliation_summary)
        
        # Log audit trail
        await log_audit_trail(
            db, "bank_reconciliations", reconciliation_summary["id"], "CREATE",
            None, reconciliation_summary, current_user.id
        )
        
        return {
            "status": "success",
            "message": "Bank reconciliation completed",
            "summary": {
                "processed_movements": len(processed_movements),
                "duplicates_found": len(duplicates),
                "errors_found": len(errors),
                "total_rows": len(df)
            },
            "duplicates": duplicates,
            "errors": errors,
            "reconciliation_id": reconciliation_summary["id"]
        }
        
    except Exception as e:
        logger.error(f"Error in advanced bank reconciliation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing reconciliation: {str(e)}")

# ====================================================================================================
# RECEIPTS (BOLETAS INTERNAS) APIs
# ====================================================================================================

@api_router.post("/finance/receipts", dependencies=[Depends(require_role([UserRole.CASHIER, UserRole.FINANCE_ADMIN]))])
async def create_receipt(
    receipt_data: ReceiptCreate, 
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Create internal receipt with QR code"""
    
    # Get series based on concept
    series = RECEIPT_SERIES_MAPPING.get(receipt_data.concept, "999")
    
    # Generate receipt number and correlative
    receipt_number, correlative = generate_receipt_number(series)
    
    # Create receipt
    receipt_dict = receipt_data.dict()
    receipt_dict.update({
        'receipt_number': receipt_number,
        'series': series,
        'correlative': correlative,
        'created_by': current_user.id
    })
    
    receipt = Receipt(**receipt_dict)
    
    # Generate QR code for verification
    base_url = str(request.base_url).rstrip('/')
    verification_url = f"{base_url}/verificar/{receipt.id}"
    qr_code_data = generate_qr_code(verification_url)
    receipt.qr_code = qr_code_data
    
    # Save to database
    receipt_doc = prepare_for_mongo(receipt.dict())
    await db.receipts.insert_one(receipt_doc)
    
    # Generate PDF
    pdf_generator = PDFGenerator()
    pdf_path = f"/tmp/receipt_{receipt.id}.pdf"
    
    try:
        pdf_generator.create_receipt_pdf(receipt_doc, qr_code_data, pdf_path)
        receipt.pdf_path = pdf_path
        await db.receipts.update_one({"id": receipt.id}, {"$set": {"pdf_path": pdf_path}})
    except Exception as e:
        logger.warning(f"Error generating PDF for receipt {receipt.id}: {str(e)}")
    
    # Log audit trail
    await log_audit_trail(
        db, "receipts", receipt.id, "CREATE",
        None, receipt_doc, current_user.id, request.client.host
    )
    
    logger.info(f"Receipt {receipt.receipt_number} created by {current_user.username}")
    
    return {
        "status": "success",
        "receipt": receipt,
        "verification_url": verification_url,
        "message": "Receipt created successfully"
    }

@api_router.get("/finance/receipts")
async def get_receipts(
    status: Optional[ReceiptStatus] = None,
    concept: Optional[ReceiptConcept] = None,
    customer_document: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_role([UserRole.CASHIER, UserRole.FINANCE_ADMIN]))
):
    """Get receipts with filters"""
    
    filter_query = {}
    
    if status:
        filter_query["status"] = status.value
    if concept:
        filter_query["concept"] = concept.value
    if customer_document:
        filter_query["customer_document"] = customer_document
    if date_from:
        filter_query["issued_at"] = {"$gte": date_from.isoformat()}
    if date_to:
        if "issued_at" in filter_query:
            filter_query["issued_at"]["$lte"] = date_to.isoformat()
        else:
            filter_query["issued_at"] = {"$lte": date_to.isoformat()}
    
    receipts = await db.receipts.find(filter_query).sort("issued_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.receipts.count_documents(filter_query)
    
    return {
        "receipts": [Receipt(**receipt) for receipt in receipts],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.post("/finance/receipts/{receipt_id}/pay")
async def pay_receipt(
    receipt_id: str,
    payment_data: PaymentRequest,
    current_user: User = Depends(require_role([UserRole.CASHIER, UserRole.FINANCE_ADMIN]))
):
    """Mark receipt as paid with idempotency support"""
    
    # Check idempotency
    if payment_data.idempotency_key:
        existing_payment = await db.receipt_payments.find_one({
            "receipt_id": receipt_id,
            "idempotency_key": payment_data.idempotency_key
        })
        if existing_payment:
            return {
                "status": "success",
                "message": "Payment already processed",
                "payment_id": existing_payment["id"],
                "idempotent": True
            }
    
    # Get receipt
    receipt = await db.receipts.find_one({"id": receipt_id})
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    if receipt["status"] == ReceiptStatus.PAID.value:
        raise HTTPException(status_code=400, detail="Receipt is already paid")
    
    if receipt["status"] == ReceiptStatus.CANCELLED.value:
        raise HTTPException(status_code=400, detail="Cannot pay cancelled receipt")
    
    # Update receipt
    payment_time = datetime.now(timezone.utc)
    update_data = {
        "status": ReceiptStatus.PAID.value,
        "paid_at": payment_time.isoformat(),
        "payment_method": payment_data.payment_method.value,
        "payment_reference": payment_data.payment_reference,
        "updated_at": payment_time.isoformat(),
        "updated_by": current_user.id
    }
    
    await db.receipts.update_one({"id": receipt_id}, {"$set": update_data})
    
    # Create payment record for idempotency
    payment_record = {
        "id": str(uuid.uuid4()),
        "receipt_id": receipt_id,
        "amount": receipt["amount"],
        "payment_method": payment_data.payment_method.value,
        "payment_reference": payment_data.payment_reference,
        "paid_by": current_user.id,
        "paid_at": payment_time.isoformat(),
        "idempotency_key": payment_data.idempotency_key
    }
    
    await db.receipt_payments.insert_one(payment_record)
    
    # Create cash movement if payment is in cash
    if payment_data.payment_method == PaymentMethod.CASH:
        # Get current open cash session
        cash_session = await db.cash_sessions.find_one({
            "opened_by": current_user.id,
            "status": CashSessionStatus.OPEN.value
        })
        
        if cash_session:
            cash_movement = CashMovement(
                cash_session_id=cash_session["id"],
                movement_type=MovementType.INCOME.value,
                amount=receipt["amount"],
                concept="RECEIPT_PAYMENT",
                description=f"Pago de boleta {receipt['receipt_number']} - {receipt['description']}",
                reference_id=receipt_id,
                created_by=current_user.id
            )
            
            cash_movement_doc = prepare_for_mongo(cash_movement.dict())
            await db.cash_movements.insert_one(cash_movement_doc)
    
    # Log audit trail
    await log_audit_trail(
        db, "receipts", receipt_id, "UPDATE",
        {"status": receipt["status"]}, update_data, current_user.id
    )
    
    logger.info(f"Receipt {receipt['receipt_number']} marked as paid by {current_user.username}")
    
    return {
        "status": "success",
        "message": "Receipt marked as paid successfully",
        "payment_id": payment_record["id"]
    }

@api_router.post("/finance/receipts/{receipt_id}/void")
async def void_receipt(
    receipt_id: str,
    void_data: ReceiptVoidRequest,
    current_user: User = Depends(require_role([UserRole.FINANCE_ADMIN]))
):
    """Void/refund a receipt with proper authorization and time window checks"""
    
    receipt = await db.receipts.find_one({"id": receipt_id})
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    if receipt["status"] != ReceiptStatus.PAID.value:
        raise HTTPException(status_code=400, detail="Can only void paid receipts")
    
    # Check time window (e.g., can only void within 24 hours)
    receipt_paid_at = datetime.fromisoformat(receipt.get("paid_at", ""))
    time_since_payment = datetime.now(timezone.utc) - receipt_paid_at
    if time_since_payment.total_seconds() > 86400:  # 24 hours
        if not void_data.supervisor_approval:
            raise HTTPException(
                status_code=400, 
                detail="Receipts older than 24 hours require supervisor approval"
            )
    
    void_time = datetime.now(timezone.utc)
    
    # Update receipt status
    update_data = {
        "status": ReceiptStatus.VOID.value,
        "voided_at": void_time.isoformat(),
        "void_reason": void_data.reason,
        "void_method": void_data.refund_method.value if void_data.refund_method else None,
        "supervisor_approval": void_data.supervisor_approval,
        "updated_at": void_time.isoformat(),
        "updated_by": current_user.id
    }
    
    await db.receipts.update_one({"id": receipt_id}, {"$set": update_data})
    
    # Create refund cash movement if refund method is cash
    if void_data.refund_method == PaymentMethod.CASH:
        cash_session = await db.cash_sessions.find_one({
            "opened_by": current_user.id,
            "status": CashSessionStatus.OPEN.value
        })
        
        if cash_session:
            refund_movement = CashMovement(
                cash_session_id=cash_session["id"],
                movement_type=MovementType.EXPENSE.value,
                amount=receipt["amount"],
                concept="RECEIPT_REFUND",
                description=f"Devolución boleta {receipt['receipt_number']} - {void_data.reason}",
                reference_id=receipt_id,
                created_by=current_user.id
            )
            
            refund_movement_doc = prepare_for_mongo(refund_movement.dict())
            await db.cash_movements.insert_one(refund_movement_doc)
    
    # Log audit trail
    await log_audit_trail(
        db, "receipts", receipt_id, "VOID",
        {"status": receipt["status"]}, update_data, current_user.id
    )
    
    logger.info(f"Receipt {receipt['receipt_number']} voided by {current_user.username}")
    
    return {
        "status": "success",
        "message": "Receipt voided successfully",
        "void_time": void_time.isoformat(),
        "refund_amount": receipt["amount"]
    }

@api_router.post("/finance/receipts/{receipt_id}/cancel")
async def cancel_receipt(
    receipt_id: str,
    reason: str,
    current_user: User = Depends(require_role([UserRole.FINANCE_ADMIN]))
):
    """Cancel a receipt (FINANCE_ADMIN only)"""
    
    receipt = await db.receipts.find_one({"id": receipt_id})
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    if receipt["status"] == ReceiptStatus.CANCELLED.value:
        raise HTTPException(status_code=400, detail="Receipt is already cancelled")
    
    # Update receipt
    update_data = {
        "status": ReceiptStatus.CANCELLED.value,
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.id,
        "cancellation_reason": reason
    }
    
    await db.receipts.update_one({"id": receipt_id}, {"$set": update_data})
    
    # If receipt was paid, create refund cash movement
    if receipt["status"] == ReceiptStatus.PAID.value:
        cash_session = await db.cash_sessions.find_one({
            "opened_by": current_user.id,
            "status": CashSessionStatus.OPEN.value
        })
        
        if cash_session:
            refund_movement = CashMovement(
                cash_session_id=cash_session["id"],
                movement_type=MovementType.EXPENSE.value,
                amount=receipt["amount"],
                concept="RECEIPT_REFUND",
                description=f"Reembolso por anulación de boleta {receipt['receipt_number']} - {reason}",
                reference_id=receipt_id,
                created_by=current_user.id
            )
            
            refund_movement_doc = prepare_for_mongo(refund_movement.dict())
            await db.cash_movements.insert_one(refund_movement_doc)
    
    # Log audit trail
    await log_audit_trail(
        db, "receipts", receipt_id, "UPDATE",
        {"status": receipt["status"]}, update_data, current_user.id
    )
    
    logger.info(f"Receipt {receipt['receipt_number']} cancelled by {current_user.username}: {reason}")
    
    return {
        "status": "success",
        "message": "Receipt cancelled successfully"
    }

# Public receipt verification endpoint
@api_router.get("/verificar/{receipt_id}")
async def verify_receipt(receipt_id: str):
    """Public endpoint to verify receipt (no authentication required)"""
    
    receipt = await db.receipts.find_one({"id": receipt_id})
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    # Return only public, non-sensitive information
    return {
        "receipt_number": receipt["receipt_number"],
        "series": receipt["series"],
        "issued_date": receipt.get("issued_at", "")[:10],  # Only date, not time
        "amount": receipt["amount"],
        "status": receipt["status"],
        "is_valid": receipt["status"] in [ReceiptStatus.PAID.value, ReceiptStatus.PENDING.value],
        "verification_time": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/finance/receipts/{receipt_id}/pdf")
async def download_receipt_pdf(
    receipt_id: str,
    current_user: User = Depends(require_role([UserRole.CASHIER, UserRole.FINANCE_ADMIN]))
):
    """Download receipt PDF"""
    
    receipt = await db.receipts.find_one({"id": receipt_id})
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    if not receipt.get("pdf_path") or not os.path.exists(receipt["pdf_path"]):
        # Regenerate PDF if not exists
        pdf_generator = PDFGenerator()
        pdf_path = f"/tmp/receipt_{receipt_id}.pdf"
        
        try:
            pdf_generator.create_receipt_pdf(receipt, receipt.get("qr_code"), pdf_path)
            await db.receipts.update_one({"id": receipt_id}, {"$set": {"pdf_path": pdf_path}})
        except Exception as e:
            logger.error(f"Error generating PDF for receipt {receipt_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Error generating PDF")
    
    return FileResponse(
        receipt["pdf_path"],
        media_type="application/pdf",
        filename=f"boleta_{receipt['receipt_number']}.pdf"
    )

# ====================================================================================================
# INCOME/EXPENSE & INVENTORY APIs
# ====================================================================================================

@api_router.post("/finance/gl-concepts", dependencies=[Depends(require_role([UserRole.FINANCE_ADMIN]))])
async def create_gl_concept(concept_data: GLConceptCreate, current_user: User = Depends(get_current_user)):
    """Create GL concept for income/expense tracking"""
    
    existing_concept = await db.gl_concepts.find_one({"code": concept_data.code})
    if existing_concept:
        raise HTTPException(status_code=400, detail="GL concept with this code already exists")
    
    concept_dict = concept_data.dict()
    concept_dict['created_by'] = current_user.id
    concept = GLConcept(**concept_dict)
    
    concept_doc = prepare_for_mongo(concept.dict())
    await db.gl_concepts.insert_one(concept_doc)
    
    await log_audit_trail(db, "gl_concepts", concept.id, "CREATE", None, concept_doc, current_user.id)
    
    return {"status": "success", "concept": concept}

@api_router.get("/finance/gl-concepts")
async def get_gl_concepts(
    concept_type: Optional[str] = None,
    is_active: bool = True,
    current_user: User = Depends(require_role([UserRole.FINANCE_ADMIN, UserRole.CASHIER]))
):
    """Get GL concepts"""
    filter_query = {"is_active": is_active}
    if concept_type:
        filter_query["concept_type"] = concept_type
    
    concepts = await db.gl_concepts.find(filter_query).sort("code", 1).to_list(100)
    return {"concepts": [GLConcept(**c) for c in concepts]}

@api_router.post("/inventory/items", dependencies=[Depends(require_role([UserRole.WAREHOUSE, UserRole.FINANCE_ADMIN]))])
async def create_inventory_item(item_data: InventoryItemCreate, current_user: User = Depends(get_current_user)):
    """Create inventory item"""
    
    existing_item = await db.inventory_items.find_one({"code": item_data.code})
    if existing_item:
        raise HTTPException(status_code=400, detail="Item with this code already exists")
    
    item_dict = item_data.dict()
    item_dict['created_by'] = current_user.id
    item = InventoryItem(**item_dict)
    
    item_doc = prepare_for_mongo(item.dict())
    await db.inventory_items.insert_one(item_doc)
    
    await log_audit_trail(db, "inventory_items", item.id, "CREATE", None, item_doc, current_user.id)
    
    return {"status": "success", "item": item}

@api_router.get("/inventory/items")
async def get_inventory_items(
    category: Optional[str] = None,
    is_active: bool = True,
    low_stock_only: bool = False,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([UserRole.WAREHOUSE, UserRole.FINANCE_ADMIN, UserRole.LOGISTICS]))
):
    """Get inventory items"""
    
    filter_query = {"is_active": is_active}
    
    if category:
        filter_query["category"] = category
    
    if low_stock_only:
        filter_query["$expr"] = {"$lte": ["$current_stock", "$min_stock"]}
    
    items = await db.inventory_items.find(filter_query).sort("code", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.inventory_items.count_documents(filter_query)
    
    return {
        "items": [InventoryItem(**item) for item in items],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.post("/inventory/movements", dependencies=[Depends(require_role([UserRole.WAREHOUSE, UserRole.FINANCE_ADMIN]))])
async def create_inventory_movement(movement_data: InventoryMovementCreate, current_user: User = Depends(get_current_user)):
    """Create inventory movement with FIFO cost calculation"""
    
    # Get inventory item
    item = await db.inventory_items.find_one({"id": movement_data.item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    current_stock = item.get("current_stock", 0)
    
    # For exits, check stock availability and calculate FIFO cost
    if movement_data.movement_type == InventoryMovementType.EXIT.value:
        # Check if negative stock is allowed (configurable per item)
        allow_negative_stock = item.get("allow_negative_stock", False)
        
        if not allow_negative_stock and current_stock < movement_data.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock. Available: {current_stock}, Requested: {movement_data.quantity}"
            )
        
        # Even if negative stock is allowed, warn about it
        if current_stock < movement_data.quantity:
            logger.warning(
                f"Negative stock warning: Item {item['item_code']} will have negative stock "
                f"({current_stock - movement_data.quantity}) after this movement"
            )
        
        # Get ALL movements for FIFO calculation (entries and exits)
        all_movements = await db.inventory_movements.find({
            "item_id": movement_data.item_id
        }).sort("created_at", 1).to_list(1000)
        
        total_cost, cost_breakdown = calculate_inventory_fifo(
            current_stock, all_movements, movement_data.quantity
        )
        
        # Use calculated cost if not provided
        if not movement_data.unit_cost:
            movement_data.unit_cost = total_cost / movement_data.quantity if movement_data.quantity > 0 else 0
    
    # Create movement
    movement_dict = movement_data.dict()
    movement_dict.update({
        'stock_before': current_stock,
        'created_by': current_user.id
    })
    
    # Calculate new stock
    if movement_data.movement_type == InventoryMovementType.ENTRY.value:
        new_stock = current_stock + movement_data.quantity
    elif movement_data.movement_type == InventoryMovementType.EXIT.value:
        new_stock = current_stock - movement_data.quantity
    else:  # ADJUSTMENT
        new_stock = movement_data.quantity  # Quantity represents the new total
    
    movement_dict['stock_after'] = new_stock
    
    if movement_data.unit_cost:
        movement_dict['total_cost'] = movement_data.quantity * movement_data.unit_cost
    
    movement = InventoryMovement(**movement_dict)
    movement_doc = prepare_for_mongo(movement.dict())
    
    await db.inventory_movements.insert_one(movement_doc)
    
    # Update inventory item stock
    update_data = {"current_stock": new_stock}
    
    # Update unit cost for entries (weighted average)
    if movement_data.movement_type == InventoryMovementType.ENTRY.value and movement_data.unit_cost:
        current_value = item.get("total_value", 0)
        new_value = current_value + movement_dict['total_cost']
        new_unit_cost = new_value / new_stock if new_stock > 0 else 0
        
        update_data.update({
            "unit_cost": new_unit_cost,
            "total_value": new_value
        })
    
    # Update available stock (current - reserved)
    update_data["available_stock"] = max(0, new_stock - item.get("reserved_stock", 0))
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.inventory_items.update_one({"id": movement_data.item_id}, {"$set": update_data})
    
    await log_audit_trail(
        db, "inventory_movements", movement.id, "CREATE", 
        None, movement_doc, current_user.id
    )
    
    logger.info(f"Inventory movement {movement.movement_number} created by {current_user.username}")
    
    return {
        "status": "success",
        "movement": movement,
        "new_stock": new_stock
    }

@api_router.get("/inventory/movements")
async def get_inventory_movements(
    item_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([UserRole.WAREHOUSE, UserRole.FINANCE_ADMIN]))
):
    """Get inventory movements"""
    
    filter_query = {}
    
    if item_id:
        filter_query["item_id"] = item_id
    if movement_type:
        filter_query["movement_type"] = movement_type
    if date_from:
        filter_query["created_at"] = {"$gte": date_from.isoformat()}
    if date_to:
        if "created_at" in filter_query:
            filter_query["created_at"]["$lte"] = date_to.isoformat()
        else:
            filter_query["created_at"] = {"$lte": date_to.isoformat()}
    
    movements = await db.inventory_movements.find(filter_query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.inventory_movements.count_documents(filter_query)
    
    # Enrich with item data
    enriched_movements = []
    for movement in movements:
        item = await db.inventory_items.find_one({"id": movement["item_id"]})
        
        movement_obj = InventoryMovement(**movement)
        enriched_movement = {
            **movement_obj.dict(),
            "item": InventoryItem(**item) if item else None
        }
        enriched_movements.append(enriched_movement)
    
    return {
        "movements": enriched_movements,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/inventory/items/{item_id}/kardex")
async def get_item_kardex(
    item_id: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: User = Depends(require_role([UserRole.WAREHOUSE, UserRole.FINANCE_ADMIN]))
):
    """Get item kardex (movement history) with FIFO cost tracking"""
    
    item = await db.inventory_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    filter_query = {"item_id": item_id}
    
    if date_from:
        filter_query["created_at"] = {"$gte": date_from.isoformat()}
    if date_to:
        if "created_at" in filter_query:
            filter_query["created_at"]["$lte"] = date_to.isoformat()
        else:
            filter_query["created_at"] = {"$lte": date_to.isoformat()}
    
    movements = await db.inventory_movements.find(filter_query).sort("created_at", 1).to_list(1000)
    
    # Calculate running totals and costs
    kardex_entries = []
    running_stock = 0
    running_value = 0.0
    
    for movement in movements:
        movement_obj = InventoryMovement(**movement)
        
        if movement["movement_type"] == InventoryMovementType.ENTRY.value:
            entry_value = movement.get("total_cost", 0)
            running_value += entry_value
            running_stock += movement["quantity"]
        elif movement["movement_type"] == InventoryMovementType.EXIT.value:
            exit_cost = movement.get("total_cost", 0)
            running_value -= exit_cost
            running_stock -= movement["quantity"]
        else:  # ADJUSTMENT
            # For adjustments, recalculate based on new quantity
            if running_stock != 0:
                unit_cost = running_value / running_stock
            else:
                unit_cost = movement.get("unit_cost", 0)
            
            running_stock = movement["stock_after"]
            running_value = running_stock * unit_cost
        
        average_cost = running_value / running_stock if running_stock > 0 else 0
        
        kardex_entry = {
            **movement_obj.dict(),
            "running_stock": running_stock,
            "running_value": running_value,
            "average_unit_cost": average_cost
        }
        kardex_entries.append(kardex_entry)
    
    return {
        "item": InventoryItem(**item),
        "kardex": kardex_entries,
        "current_stock": running_stock,
        "current_value": running_value,
        "current_average_cost": running_value / running_stock if running_stock > 0 else 0
    }

@api_router.get("/inventory/alerts")
async def get_inventory_alerts(
    current_user: User = Depends(require_role([UserRole.WAREHOUSE, UserRole.FINANCE_ADMIN]))
):
    """Get inventory alerts (low stock, expired items, etc.)"""
    
    alerts = []
    
    # Low stock items
    low_stock_items = await db.inventory_items.find({
        "is_active": True,
        "$expr": {"$lte": ["$current_stock", "$min_stock"]}
    }).to_list(100)
    
    for item in low_stock_items:
        alerts.append({
            "type": "LOW_STOCK",
            "severity": "HIGH" if item["current_stock"] == 0 else "MEDIUM",
            "item_id": item["id"],
            "item_code": item["code"],
            "item_name": item["name"],
            "current_stock": item["current_stock"],
            "min_stock": item["min_stock"],
            "message": f"Stock bajo: {item['name']} ({item['current_stock']} unidades)"
        })
    
    return {
        "alerts": alerts,
        "total": len(alerts),
        "summary": {
            "low_stock": len([a for a in alerts if a["type"] == "LOW_STOCK"])
        }
    }

# ====================================================================================================
# HR MANAGEMENT APIs
# ====================================================================================================

@api_router.post("/hr/employees", dependencies=[Depends(require_role([UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN]))])
async def create_employee(employee_data: EmployeeCreate, current_user: User = Depends(get_current_user)):
    """Create employee record"""
    
    # Check if employee with same document exists
    existing_employee = await db.employees.find_one({"document_number": employee_data.document_number})
    if existing_employee:
        raise HTTPException(status_code=400, detail="Employee with this document number already exists")
    
    employee_dict = employee_data.dict()
    employee_dict['created_by'] = current_user.id
    
    # Auto-generate employee code if not provided
    if not employee_data.employee_code:
        employee_dict['employee_code'] = f"EMP{datetime.now().year}{str(uuid.uuid4())[:6].upper()}"
    
    employee = Employee(**employee_dict)
    employee_doc = prepare_for_mongo(employee.dict())
    
    await db.employees.insert_one(employee_doc)
    
    await log_audit_trail(db, "employees", employee.id, "CREATE", None, employee_doc, current_user.id)
    
    logger.info(f"Employee {employee.employee_code} created by {current_user.username}")
    
    return {"status": "success", "employee": employee}

@api_router.get("/hr/employees")
async def get_employees(
    status: Optional[str] = None,
    department: Optional[str] = None,
    contract_type: Optional[str] = None,
    is_active: bool = True,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN]))
):
    """Get employees with filters"""
    
    filter_query = {"is_active": is_active}
    
    if status:
        filter_query["status"] = status
    if department:
        filter_query["department"] = department
    if contract_type:
        filter_query["contract_type"] = contract_type
    
    employees = await db.employees.find(filter_query).sort("employee_code", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.employees.count_documents(filter_query)
    
    return {
        "employees": [Employee(**emp) for emp in employees],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.put("/hr/employees/{employee_id}", dependencies=[Depends(require_role([UserRole.HR_ADMIN]))])
async def update_employee(
    employee_id: str,
    employee_data: EmployeeCreate,
    current_user: User = Depends(get_current_user)
):
    """Update employee record"""
    
    employee = await db.employees.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    update_data = employee_data.dict()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Convert dates to ISO strings for MongoDB
    update_data = prepare_for_mongo(update_data)
    
    # Store old values for audit
    old_values = {k: employee.get(k) for k in update_data.keys() if k in employee}
    
    await db.employees.update_one({"id": employee_id}, {"$set": update_data})
    
    await log_audit_trail(
        db, "employees", employee_id, "UPDATE", 
        old_values, update_data, current_user.id
    )
    
    return {"status": "success", "message": "Employee updated successfully"}

# ====================================================================================================
# AUDIT LOGS APIs
# ====================================================================================================

@api_router.get("/audit/logs")
async def get_audit_logs(
    table_name: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.FINANCE_ADMIN]))
):
    """Get audit logs with filters (admin only)"""
    
    filter_query = {}
    
    if table_name:
        filter_query["table_name"] = table_name
    if action:
        filter_query["action"] = action.upper()
    if user_id:
        filter_query["user_id"] = user_id
    if date_from:
        filter_query["timestamp"] = {"$gte": date_from.isoformat()}
    if date_to:
        if "timestamp" in filter_query:
            filter_query["timestamp"]["$lte"] = (date_to + timedelta(days=1)).isoformat()
        else:
            filter_query["timestamp"] = {"$lte": (date_to + timedelta(days=1)).isoformat()}
    
    audit_logs = await db.audit_logs.find(filter_query).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.audit_logs.count_documents(filter_query)
    
    # Enrich with user data
    enriched_logs = []
    for log in audit_logs:
        user = await db.users.find_one({"id": log.get("user_id")}) if log.get("user_id") else None
        
        enriched_log = {
            **log,
            "user": User(**user) if user else None
        }
        enriched_logs.append(enriched_log)
    
    return {
        "audit_logs": enriched_logs,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.post("/hr/attendance", dependencies=[Depends(require_role([UserRole.HR_ADMIN]))])
async def create_attendance(attendance_data: AttendanceCreate, current_user: User = Depends(get_current_user)):
    """Create attendance record"""
    
    # Check if employee exists
    employee = await db.employees.find_one({"id": attendance_data.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check if attendance already exists for this date
    existing_attendance = await db.attendance.find_one({
        "employee_id": attendance_data.employee_id,
        "date": attendance_data.date.isoformat()
    })
    
    if existing_attendance:
        raise HTTPException(status_code=400, detail="Attendance already exists for this date")
    
    attendance_dict = attendance_data.dict()
    attendance_dict['created_by'] = current_user.id
    
    # Calculate worked hours if check_in and check_out provided
    if attendance_data.check_in and attendance_data.check_out:
        time_diff = attendance_data.check_out - attendance_data.check_in
        worked_minutes = time_diff.total_seconds() / 60 - attendance_data.break_minutes
        attendance_dict['worked_hours'] = max(0, worked_minutes / 60)
        
        # Check if late (assuming 8:00 AM start time)
        expected_start = attendance_data.check_in.replace(hour=8, minute=0, second=0, microsecond=0)
        attendance_dict['is_late'] = attendance_data.check_in > expected_start
    
    # Check if absent
    attendance_dict['is_absent'] = not attendance_data.check_in
    
    attendance = Attendance(**attendance_dict)
    attendance_doc = prepare_for_mongo(attendance.dict())
    
    await db.attendance.insert_one(attendance_doc)
    
    await log_audit_trail(db, "attendance", attendance.id, "CREATE", None, attendance_doc, current_user.id)
    
    return {"status": "success", "attendance": attendance}

@api_router.get("/hr/attendance")
async def get_attendance(
    employee_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    is_absent: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN]))
):
    """Get attendance records with filters"""
    
    filter_query = {}
    
    if employee_id:
        filter_query["employee_id"] = employee_id
    if date_from:
        filter_query["date"] = {"$gte": date_from.isoformat()}
    if date_to:
        if "date" in filter_query:
            filter_query["date"]["$lte"] = date_to.isoformat()
        else:
            filter_query["date"] = {"$lte": date_to.isoformat()}
    if is_absent is not None:
        filter_query["is_absent"] = is_absent
    
    attendance_records = await db.attendance.find(filter_query).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.attendance.count_documents(filter_query)
    
    # Enrich with employee data
    enriched_records = []
    for record in attendance_records:
        employee = await db.employees.find_one({"id": record["employee_id"]})
        
        attendance_obj = Attendance(**record)
        enriched_record = {
            **attendance_obj.dict(),
            "employee": Employee(**employee) if employee else None
        }
        enriched_records.append(enriched_record)
    
    return {
        "attendance": enriched_records,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.post("/hr/attendance/bulk-import")
async def bulk_import_attendance(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role([UserRole.HR_ADMIN]))
):
    """Bulk import attendance data from CSV with strict validation"""
    
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    try:
        # Read CSV content
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        
        # Validate required columns
        required_columns = ['employee_id', 'attendance_date', 'check_in_time', 'check_out_time']
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {missing_cols}"
            )
        
        # Process import with validation
        successful_imports = []
        errors = []
        duplicates = []
        
        # Get all employees for validation
        employees = await db.employees.find({"is_active": True}).to_list(1000)
        employee_ids = {emp["id"]: emp for emp in employees}
        
        for index, row in df.iterrows():
            try:
                # Validate employee exists
                employee_id = str(row['employee_id']).strip()
                if employee_id not in employee_ids:
                    errors.append({
                        "row": index + 1,
                        "error": f"Employee ID {employee_id} not found",
                        "data": row.to_dict()
                    })
                    continue
                
                # Parse and validate date
                try:
                    attendance_date = pd.to_datetime(row['attendance_date']).date()
                except:
                    errors.append({
                        "row": index + 1,
                        "error": f"Invalid date format: {row['attendance_date']}",
                        "data": row.to_dict()
                    })
                    continue
                
                # Check for duplicates
                existing_attendance = await db.attendance.find_one({
                    "employee_id": employee_id,
                    "date": attendance_date.isoformat()
                })
                
                if existing_attendance:
                    duplicates.append({
                        "row": index + 1,
                        "employee_id": employee_id,
                        "date": attendance_date.isoformat(),
                        "existing_id": existing_attendance["id"]
                    })
                    continue
                
                # Parse times with timezone safety
                check_in_time = None
                check_out_time = None
                
                try:
                    if pd.notna(row['check_in_time']):
                        check_in_str = str(row['check_in_time']).strip()
                        if check_in_str and check_in_str != '':
                            # Parse HH:MM format
                            time_parts = check_in_str.split(':')
                            if len(time_parts) == 2:
                                check_in_time = f"{time_parts[0].zfill(2)}:{time_parts[1].zfill(2)}:00"
                    
                    if pd.notna(row['check_out_time']):
                        check_out_str = str(row['check_out_time']).strip()
                        if check_out_str and check_out_str != '':
                            # Parse HH:MM format
                            time_parts = check_out_str.split(':')
                            if len(time_parts) == 2:
                                check_out_time = f"{time_parts[0].zfill(2)}:{time_parts[1].zfill(2)}:00"
                
                except Exception as e:
                    errors.append({
                        "row": index + 1,
                        "error": f"Invalid time format: {str(e)}",
                        "data": row.to_dict()
                    })
                    continue
                
                # Create attendance record
                break_minutes = int(row.get('break_minutes', 60))
                notes = str(row.get('notes', '')).strip() if pd.notna(row.get('notes')) else None
                
                # Calculate hours worked (timezone-safe)
                hours_worked = 0.0
                if check_in_time and check_out_time:
                    # Create datetime objects for calculation (use UTC)
                    check_in_dt = datetime.combine(attendance_date, datetime.strptime(check_in_time, "%H:%M:%S").time())
                    check_out_dt = datetime.combine(attendance_date, datetime.strptime(check_out_time, "%H:%M:%S").time())
                    
                    # Handle overnight shifts
                    if check_out_dt < check_in_dt:
                        check_out_dt += timedelta(days=1)
                    
                    # Calculate total time and subtract break
                    total_minutes = (check_out_dt - check_in_dt).total_seconds() / 60
                    work_minutes = total_minutes - break_minutes
                    hours_worked = max(0, work_minutes / 60)
                
                attendance_data = AttendanceBulkImport(
                    employee_id=employee_id,
                    attendance_date=attendance_date,
                    check_in_time=check_in_time,
                    check_out_time=check_out_time,
                    break_minutes=break_minutes,
                    notes=notes
                )
                
                # Create attendance record
                attendance = Attendance(
                    employee_id=employee_id,
                    date=attendance_date,
                    check_in_time=check_in_time,
                    check_out_time=check_out_time,
                    break_minutes=break_minutes,
                    hours_worked=hours_worked,
                    is_absent=not (check_in_time or check_out_time),
                    notes=notes,
                    created_by=current_user.id
                )
                
                # Save to database
                attendance_doc = prepare_for_mongo(attendance.dict())
                await db.attendance.insert_one(attendance_doc)
                
                successful_imports.append({
                    "row": index + 1,
                    "employee_id": employee_id,
                    "employee_name": f"{employee_ids[employee_id]['first_name']} {employee_ids[employee_id]['last_name']}",
                    "date": attendance_date.isoformat(),
                    "hours_worked": hours_worked
                })
                
            except Exception as e:
                errors.append({
                    "row": index + 1,
                    "error": f"Processing error: {str(e)}",
                    "data": row.to_dict()
                })
        
        # Create import summary
        import_summary = {
            "id": str(uuid.uuid4()),
            "filename": file.filename,
            "total_rows": len(df),
            "successful_imports": len(successful_imports),
            "duplicates_found": len(duplicates),
            "errors_found": len(errors),
            "imported_by": current_user.id,
            "imported_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.attendance_imports.insert_one(import_summary)
        
        # Log audit trail
        await log_audit_trail(
            db, "attendance_imports", import_summary["id"], "CREATE",
            None, import_summary, current_user.id
        )
        
        logger.info(f"Bulk attendance import completed: {len(successful_imports)} records by {current_user.username}")
        
        return {
            "status": "success",
            "message": f"Bulk import completed: {len(successful_imports)} records imported",
            "summary": {
                "total_rows": len(df),
                "successful_imports": len(successful_imports),
                "duplicates_found": len(duplicates),
                "errors_found": len(errors)
            },
            "successful_imports": successful_imports,
            "duplicates": duplicates,
            "errors": errors,
            "import_id": import_summary["id"]
        }
        
    except Exception as e:
        logger.error(f"Error in bulk attendance import: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

# ====================================================================================================
# LOGISTICS MANAGEMENT APIs
# ====================================================================================================

@api_router.post("/logistics/suppliers", dependencies=[Depends(require_role([UserRole.LOGISTICS, UserRole.FINANCE_ADMIN]))])
async def create_supplier(supplier_data: SupplierCreate, current_user: User = Depends(get_current_user)):
    """Create supplier record"""
    
    # Validate RUC
    if not validate_ruc(supplier_data.ruc):
        raise HTTPException(status_code=400, detail="Invalid RUC number")
    
    # Check if supplier with same RUC exists
    existing_supplier = await db.suppliers.find_one({"ruc": supplier_data.ruc})
    if existing_supplier:
        raise HTTPException(status_code=400, detail="Supplier with this RUC already exists")
    
    supplier_dict = supplier_data.dict()
    supplier_dict['created_by'] = current_user.id
    
    supplier = Supplier(**supplier_dict)
    supplier_doc = prepare_for_mongo(supplier.dict())
    
    await db.suppliers.insert_one(supplier_doc)
    
    await log_audit_trail(db, "suppliers", supplier.id, "CREATE", None, supplier_doc, current_user.id)
    
    logger.info(f"Supplier {supplier.supplier_code} created by {current_user.username}")
    
    return {"status": "success", "supplier": supplier}

@api_router.get("/logistics/suppliers")
async def get_suppliers(
    status: Optional[str] = None,
    is_active: bool = True,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([UserRole.LOGISTICS, UserRole.FINANCE_ADMIN]))
):
    """Get suppliers with filters"""
    
    filter_query = {"is_active": is_active}
    
    if status:
        filter_query["status"] = status
    
    suppliers = await db.suppliers.find(filter_query).sort("company_name", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.suppliers.count_documents(filter_query)
    
    return {
        "suppliers": [Supplier(**sup) for sup in suppliers],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.post("/logistics/requirements", dependencies=[Depends(require_role([UserRole.LOGISTICS, UserRole.FINANCE_ADMIN]))])
async def create_requirement(requirement_data: RequirementCreate, current_user: User = Depends(get_current_user)):
    """Create purchase requirement"""
    
    requirement_dict = requirement_data.dict()
    requirement_dict['requested_by'] = current_user.id
    
    # Calculate estimated total
    estimated_total = sum(
        (item.estimated_unit_price or 0) * item.quantity 
        for item in requirement_data.items
    )
    requirement_dict['estimated_total'] = estimated_total
    
    # Remove items from requirement dict as they'll be stored separately
    items_data = requirement_dict.pop('items')
    
    requirement = Requirement(**requirement_dict)
    requirement_doc = prepare_for_mongo(requirement.dict())
    
    await db.requirements.insert_one(requirement_doc)
    
    # Create requirement items
    for item_data in items_data:
        item_dict = item_data.copy()
        item_dict['requirement_id'] = requirement.id
        
        req_item = RequirementItem(**item_dict)
        req_item_doc = prepare_for_mongo(req_item.dict())
        await db.requirement_items.insert_one(req_item_doc)
    
    await log_audit_trail(db, "requirements", requirement.id, "CREATE", None, requirement_doc, current_user.id)
    
    logger.info(f"Requirement {requirement.requirement_number} created by {current_user.username}")
    
    return {"status": "success", "requirement": requirement}

@api_router.get("/logistics/requirements")
async def get_requirements(
    status: Optional[str] = None,
    requested_by: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_role([UserRole.LOGISTICS, UserRole.FINANCE_ADMIN]))
):
    """Get requirements with filters"""
    
    filter_query = {}
    
    if status:
        filter_query["status"] = status
    if requested_by:
        filter_query["requested_by"] = requested_by
    
    requirements = await db.requirements.find(filter_query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.requirements.count_documents(filter_query)
    
    # Enrich with items and user data
    enriched_requirements = []
    for req in requirements:
        # Get requirement items
        items = await db.requirement_items.find({"requirement_id": req["id"]}).to_list(100)
        
        # Get requester info
        requester = await db.users.find_one({"id": req["requested_by"]})
        
        requirement_obj = Requirement(**req)
        enriched_req = {
            **requirement_obj.dict(),
            "items": [RequirementItem(**item) for item in items],
            "requester": User(**requester) if requester else None
        }
        enriched_requirements.append(enriched_req)
    
    return {
        "requirements": enriched_requirements,
        "total": total,
        "skip": skip,
        "limit": limit
    }

# ====================================================================================================
# PURCHASE ORDER LIFECYCLE APIs
# ====================================================================================================

@api_router.post("/logistics/purchase-orders")
async def create_purchase_order(
    po_data: PurchaseOrderCreate,
    current_user: User = Depends(require_role([UserRole.LOGISTICS, UserRole.FINANCE_ADMIN]))
):
    """Create purchase order from requirement"""
    
    # Validate supplier exists
    supplier = await db.suppliers.find_one({"id": po_data.supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Validate requirement if provided
    requirement = None
    if po_data.requirement_id:
        requirement = await db.requirements.find_one({"id": po_data.requirement_id})
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
    
    # Create PO
    po = PurchaseOrder(
        supplier_id=po_data.supplier_id,
        requirement_id=po_data.requirement_id,
        delivery_date=po_data.delivery_date,
        delivery_address=po_data.delivery_address,
        payment_terms=po_data.payment_terms,
        notes=po_data.notes,
        created_by=current_user.id
    )
    
    # Create PO items and calculate totals
    total_items = []
    subtotal = 0.0
    
    for item_data in po_data.items:
        po_item = PurchaseOrderItem(
            purchase_order_id=po.id,
            requirement_item_id=item_data.requirement_item_id,
            item_id=item_data.item_id,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_of_measure=item_data.unit_of_measure,
            unit_price=item_data.unit_price,
            discount_percentage=item_data.discount_percentage,
            subtotal=item_data.quantity * item_data.unit_price * (1 - item_data.discount_percentage / 100),
            pending_quantity=item_data.quantity
        )
        total_items.append(po_item)
        subtotal += po_item.subtotal
    
    # Calculate totals
    po.subtotal = subtotal
    po.discount_amount = sum(item.quantity * item.unit_price * (item.discount_percentage / 100) for item in total_items)
    po.tax_amount = po.subtotal * 0.18  # 18% IGV
    po.total_amount = po.subtotal + po.tax_amount
    
    # Save PO
    po_doc = prepare_for_mongo(po.dict())
    await db.purchase_orders.insert_one(po_doc)
    
    # Save PO items
    items_docs = [prepare_for_mongo(item.dict()) for item in total_items]
    await db.purchase_order_items.insert_many(items_docs)
    
    # Update requirement if linked
    if requirement:
        await db.requirements.update_one(
            {"id": po_data.requirement_id},
            {"$set": {
                "purchase_order_id": po.id,
                "status": "ORDERED",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # Log audit trail
    await log_audit_trail(
        db, "purchase_orders", po.id, "CREATE",
        None, po_doc, current_user.id
    )
    
    logger.info(f"Purchase order {po.po_number} created by {current_user.username}")
    
    return {
        "status": "success",
        "purchase_order": po,
        "items": total_items
    }

@api_router.get("/logistics/purchase-orders")
async def get_purchase_orders(
    status: Optional[str] = None,
    supplier_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([UserRole.LOGISTICS, UserRole.FINANCE_ADMIN]))
):
    """Get purchase orders with filters"""
    
    filter_query = {}
    if status:
        filter_query["status"] = status
    if supplier_id:
        filter_query["supplier_id"] = supplier_id
    
    pos = await db.purchase_orders.find(filter_query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.purchase_orders.count_documents(filter_query)
    
    # Enrich with supplier and items
    enriched_pos = []
    for po in pos:
        supplier = await db.suppliers.find_one({"id": po["supplier_id"]})
        items = await db.purchase_order_items.find({"purchase_order_id": po["id"]}).to_list(100)
        
        po_obj = PurchaseOrder(**po)
        enriched_po = {
            **po_obj.dict(),
            "supplier": Supplier(**supplier) if supplier else None,
            "items": [PurchaseOrderItem(**item) for item in items]
        }
        enriched_pos.append(enriched_po)
    
    return {
        "purchase_orders": enriched_pos,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.post("/logistics/purchase-orders/{po_id}/issue")
async def issue_purchase_order(
    po_id: str,
    current_user: User = Depends(require_role([UserRole.LOGISTICS, UserRole.FINANCE_ADMIN]))
):
    """Issue purchase order (send to supplier)"""
    
    po = await db.purchase_orders.find_one({"id": po_id})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if po["status"] != "DRAFT":
        raise HTTPException(status_code=400, detail="Can only issue draft purchase orders")
    
    issue_time = datetime.now(timezone.utc)
    update_data = {
        "status": "ISSUED",
        "issued_at": issue_time.isoformat(),
        "updated_at": issue_time.isoformat()
    }
    
    await db.purchase_orders.update_one({"id": po_id}, {"$set": update_data})
    
    # Log audit trail
    await log_audit_trail(
        db, "purchase_orders", po_id, "ISSUE",
        {"status": po["status"]}, update_data, current_user.id
    )
    
    logger.info(f"Purchase order {po['po_number']} issued by {current_user.username}")
    
    return {
        "status": "success",
        "message": "Purchase order issued successfully",
        "issued_at": issue_time.isoformat()
    }

# ====================================================================================================
# RECEPTION WORKFLOW APIs  
# ====================================================================================================

@api_router.post("/logistics/receptions")
async def create_reception(
    reception_data: ReceptionCreate,
    current_user: User = Depends(require_role([UserRole.WAREHOUSE, UserRole.LOGISTICS]))
):
    """Create reception for purchase order (partial or complete)"""
    
    # Get purchase order
    po = await db.purchase_orders.find_one({"id": reception_data.purchase_order_id})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if po["status"] not in ["ISSUED", "PARTIALLY_RECEIVED"]:
        raise HTTPException(status_code=400, detail="Purchase order is not available for reception")
    
    # Get PO items
    po_items = await db.purchase_order_items.find({"purchase_order_id": reception_data.purchase_order_id}).to_list(100)
    po_items_dict = {item["id"]: item for item in po_items}
    
    # Create reception
    reception = Reception(
        purchase_order_id=reception_data.purchase_order_id,
        supplier_id=po["supplier_id"],
        reception_date=reception_data.reception_date,
        received_by=reception_data.received_by,
        notes=reception_data.notes
    )
    
    # Process reception items
    reception_items = []
    has_discrepancies = False
    
    for item_data in reception_data.items:
        po_item_id = item_data["item_id"]
        received_qty = item_data["received_quantity"]
        condition = item_data.get("condition", "GOOD")
        item_notes = item_data.get("notes")
        
        if po_item_id not in po_items_dict:
            raise HTTPException(status_code=400, detail=f"PO item {po_item_id} not found")
        
        po_item = po_items_dict[po_item_id]
        
        # Check for over-receipts
        if received_qty > po_item["pending_quantity"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot receive {received_qty} of item {po_item['description']}. Only {po_item['pending_quantity']} pending."
            )
        
        # Check for discrepancies
        if received_qty != po_item["pending_quantity"] or condition != "GOOD":
            has_discrepancies = True
        
        reception_item = ReceptionItem(
            reception_id=reception.id,
            purchase_order_item_id=po_item_id,
            item_id=po_item.get("item_id"),
            ordered_quantity=po_item["quantity"],
            received_quantity=received_qty,
            condition=condition,
            quality_notes=item_notes
        )
        reception_items.append(reception_item)
        
        # Update PO item received quantities
        new_received = po_item["received_quantity"] + received_qty
        new_pending = po_item["quantity"] - new_received
        is_fully_received = new_pending == 0
        
        await db.purchase_order_items.update_one(
            {"id": po_item_id},
            {"$set": {
                "received_quantity": new_received,
                "pending_quantity": new_pending,
                "is_fully_received": is_fully_received
            }}
        )
    
    reception.has_discrepancies = has_discrepancies
    
    # Save reception and items
    reception_doc = prepare_for_mongo(reception.dict())
    await db.receptions.insert_one(reception_doc)
    
    reception_items_docs = [prepare_for_mongo(item.dict()) for item in reception_items]
    await db.reception_items.insert_many(reception_items_docs)
    
    # Check if PO is fully received
    remaining_po_items = await db.purchase_order_items.find({
        "purchase_order_id": reception_data.purchase_order_id,
        "is_fully_received": False
    }).to_list(100)
    
    if not remaining_po_items:
        # PO is fully received
        await db.purchase_orders.update_one(
            {"id": reception_data.purchase_order_id},
            {"$set": {
                "status": "FULLY_RECEIVED",
                "fully_received_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # PO is partially received
        await db.purchase_orders.update_one(
            {"id": reception_data.purchase_order_id},
            {"$set": {
                "status": "PARTIALLY_RECEIVED",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # Create inventory movements for received items in good condition
    for item in reception_items:
        if item.condition == "GOOD" and item.item_id and item.received_quantity > 0:
            po_item = po_items_dict[item.purchase_order_item_id]
            
            # Create inventory entry movement
            inventory_movement = InventoryMovement(
                item_id=item.item_id,
                movement_type=InventoryMovementType.ENTRY.value,
                quantity=item.received_quantity,
                unit_cost=po_item["unit_price"],
                reference_id=reception.id,
                notes=f"Recepción PO {po['po_number']} - {item.notes or ''}",
                created_by=current_user.id
            )
            
            movement_doc = prepare_for_mongo(inventory_movement.dict())
            await db.inventory_movements.insert_one(movement_doc)
            
            # Update inventory item stock
            inventory_item = await db.inventory_items.find_one({"id": item.item_id})
            if inventory_item:
                new_stock = inventory_item.get("current_stock", 0) + item.received_quantity
                await db.inventory_items.update_one(
                    {"id": item.item_id},
                    {"$set": {
                        "current_stock": new_stock,
                        "available_stock": new_stock - inventory_item.get("reserved_stock", 0),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
            
            # Mark reception item as processed
            await db.reception_items.update_one(
                {"id": item.id},
                {"$set": {
                    "processed_to_inventory": True,
                    "inventory_movement_id": inventory_movement.id
                }}
            )
    
    # Log audit trail
    await log_audit_trail(
        db, "receptions", reception.id, "CREATE",
        None, reception_doc, current_user.id
    )
    
    logger.info(f"Reception {reception.reception_number} created for PO {po['po_number']} by {current_user.username}")
    
    return {
        "status": "success",
        "reception": reception,
        "items": reception_items,
        "has_discrepancies": has_discrepancies
    }

@api_router.get("/logistics/receptions")
async def get_receptions(
    po_id: Optional[str] = None,
    supplier_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([UserRole.WAREHOUSE, UserRole.LOGISTICS]))
):
    """Get receptions with filters"""
    
    filter_query = {}
    if po_id:
        filter_query["purchase_order_id"] = po_id
    if supplier_id:
        filter_query["supplier_id"] = supplier_id
    
    receptions = await db.receptions.find(filter_query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.receptions.count_documents(filter_query)
    
    # Enrich with items and related data
    enriched_receptions = []
    for reception in receptions:
        items = await db.reception_items.find({"reception_id": reception["id"]}).to_list(100)
        po = await db.purchase_orders.find_one({"id": reception["purchase_order_id"]})
        supplier = await db.suppliers.find_one({"id": reception["supplier_id"]})
        
        reception_obj = Reception(**reception)
        enriched_reception = {
            **reception_obj.dict(),
            "items": [ReceptionItem(**item) for item in items],
            "purchase_order": PurchaseOrder(**po) if po else None,
            "supplier": Supplier(**supplier) if supplier else None
        }
        enriched_receptions.append(enriched_reception)
    
    return {
        "receptions": enriched_receptions,
        "total": total,
        "skip": skip,
        "limit": limit
    }

# Include API router
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)