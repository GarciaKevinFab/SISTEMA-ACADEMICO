from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
import logging
import uuid
from pathlib import Path
import hashlib

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
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied. Required roles: {[role.value for role in allowed_roles]}"
            )
        return current_user
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)