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
    email: Optional[str] = Field(None, regex=r'^[\w\.-]+@[\w\.-]+\.\w+$')
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
    academic_period: str = Field(..., regex="^(I|II|III)$")
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
    literal_grade: Optional[str] = Field(None, regex="^(AD|A|B|C)$")
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
    
    return stats

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Include router
app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)