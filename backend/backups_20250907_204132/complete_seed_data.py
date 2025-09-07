# Complete Seed Data for Academic System - Production Ready Demo

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, date, timezone, timedelta
from dotenv import load_dotenv
import uuid
import hashlib
import json
from passlib.context import CryptContext

# Load environment
load_dotenv()

# Database connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

def prepare_for_mongo(data):
    """Convert datetime objects to ISO strings for MongoDB"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, (datetime, date)):
                data[key] = value.isoformat()
            elif isinstance(value, dict):
                data[key] = prepare_for_mongo(value)
            elif isinstance(value, list):
                data[key] = [prepare_for_mongo(item) if isinstance(item, dict) else item for item in value]
    return data

async def clear_database():
    """Clear all collections for fresh seeding"""
    collections = [
        'users', 'students', 'courses', 'careers', 'enrollments', 
        'academic_periods', 'class_schedules', 'procedure_types', 'procedures',
        'admission_calls', 'applicants', 'applications', 'bank_accounts',
        'cash_sessions', 'receipts', 'gl_concepts', 'cost_centers',
        'inventory_items', 'suppliers', 'employees', 'audit_logs'
    ]
    
    for collection in collections:
        await db[collection].delete_many({})
    print("✅ Database cleared")

async def seed_users():
    """Create demo users for all roles"""
    users = [
        {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "email": "admin@universidad.edu",
            "password": hash_password("password123"),
            "full_name": "Administrador Sistema",
            "role": "ADMIN",
            "phone": "+51 987654321",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_login": None
        },
        {
            "id": str(uuid.uuid4()),
            "username": "registrar",
            "email": "registrar@universidad.edu", 
            "password": hash_password("password123"),
            "full_name": "María Registradora",
            "role": "REGISTRAR",
            "phone": "+51 987654322",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_login": None
        },
        {
            "id": str(uuid.uuid4()),
            "username": "teacher1",
            "email": "teacher@universidad.edu",
            "password": hash_password("password123"),
            "full_name": "Carlos Profesor Martínez",
            "role": "TEACHER",
            "phone": "+51 987654323",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_login": None
        },
        {
            "id": str(uuid.uuid4()),
            "username": "student1",
            "email": "student@universidad.edu",
            "password": hash_password("password123"),
            "full_name": "Ana Estudiante García",
            "role": "STUDENT",
            "phone": "+51 987654324",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_login": None
        },
        {
            "id": str(uuid.uuid4()),
            "username": "applicant1",
            "email": "applicant@universidad.edu",
            "password": hash_password("password123"),
            "full_name": "Luis Postulante Pérez",
            "role": "APPLICANT",
            "phone": "+51 987654325",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_login": None
        },
        {
            "id": str(uuid.uuid4()),
            "username": "finance_admin",
            "email": "finance@universidad.edu",
            "password": hash_password("password123"),
            "full_name": "Patricia Finanzas López",
            "role": "FINANCE_ADMIN",
            "phone": "+51 987654326",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_login": None
        },
        {
            "id": str(uuid.uuid4()),
            "username": "cashier",
            "email": "cashier@universidad.edu",
            "password": hash_password("password123"),
            "full_name": "Rosa Cajera Morales",
            "role": "CASHIER",
            "phone": "+51 987654327",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_login": None
        }
    ]
    
    for user in users:
        user = prepare_for_mongo(user)
        await db.users.insert_one(user)
    
    print("✅ Users seeded: 7 demo users created")

async def seed_careers():
    """Create academic careers"""
    careers = [
        {
            "id": str(uuid.uuid4()),
            "code": "EDI",
            "name": "Educación Inicial",
            "description": "Formación de docentes especializados en educación de niños de 0 a 5 años",
            "duration_years": 5,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "code": "EDP",
            "name": "Educación Primaria",
            "description": "Preparación de educadores para la enseñanza integral de niños de 6 a 12 años",
            "duration_years": 5,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "code": "EDF",
            "name": "Educación Física",
            "description": "Formación de profesionales en educación física y promoción de la salud",
            "duration_years": 5,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "code": "EDM",
            "name": "Educación Matemática",
            "description": "Especialización en enseñanza de matemáticas para educación secundaria",
            "duration_years": 5,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "code": "EDA",
            "name": "Educación Artística",
            "description": "Formación en artes y educación estética para todos los niveles",
            "duration_years": 5,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    for career in careers:
        career = prepare_for_mongo(career)
        await db.careers.insert_one(career)
    
    print("✅ Careers seeded: 5 academic programs created")
    return careers

async def seed_courses(careers):
    """Create courses for academic programs"""
    courses = []
    
    # Base courses for all programs
    base_courses = [
        {"code": "GEN001", "name": "Comunicación Oral y Escrita", "credits": 3, "semester": 1},
        {"code": "GEN002", "name": "Matemática Básica", "credits": 4, "semester": 1},
        {"code": "GEN003", "name": "Psicología del Desarrollo", "credits": 3, "semester": 2},
        {"code": "GEN004", "name": "Filosofía de la Educación", "credits": 3, "semester": 2},
        {"code": "GEN005", "name": "Metodología de la Investigación", "credits": 4, "semester": 3},
        {"code": "GEN006", "name": "Currículo y Planificación", "credits": 4, "semester": 3},
        {"code": "GEN007", "name": "Evaluación de los Aprendizajes", "credits": 3, "semester": 4},
        {"code": "GEN008", "name": "Práctica Pre-Profesional I", "credits": 6, "semester": 4},
    ]
    
    # Specific courses by career
    specific_courses = {
        "EDI": [
            {"code": "EDI001", "name": "Desarrollo Infantil Temprano", "credits": 4, "semester": 5},
            {"code": "EDI002", "name": "Juego y Aprendizaje", "credits": 3, "semester": 5},
            {"code": "EDI003", "name": "Literatura Infantil", "credits": 3, "semester": 6},
            {"code": "EDI004", "name": "Estimulación Temprana", "credits": 4, "semester": 6},
        ],
        "EDP": [
            {"code": "EDP001", "name": "Didáctica de la Matemática", "credits": 4, "semester": 5},
            {"code": "EDP002", "name": "Didáctica de Comunicación", "credits": 4, "semester": 5},
            {"code": "EDP003", "name": "Ciencias Naturales", "credits": 3, "semester": 6},
            {"code": "EDP004", "name": "Ciencias Sociales", "credits": 3, "semester": 6},
        ],
        "EDF": [
            {"code": "EDF001", "name": "Anatomía y Fisiología", "credits": 4, "semester": 5},
            {"code": "EDF002", "name": "Deportes Individuales", "credits": 3, "semester": 5},
            {"code": "EDF003", "name": "Deportes Colectivos", "credits": 3, "semester": 6},
            {"code": "EDF004", "name": "Recreación y Tiempo Libre", "credits": 3, "semester": 6},
        ]
    }
    
    for career in careers:
        # Add base courses
        for course_data in base_courses:
            course = {
                "id": str(uuid.uuid4()),
                "code": course_data["code"],
                "name": course_data["name"],
                "credits": course_data["credits"],
                "semester": course_data["semester"],
                "program": career["name"],
                "description": f"Curso de {course_data['name']} para {career['name']}",
                "prerequisites": [],
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            }
            courses.append(course)
        
        # Add specific courses if available
        if career["code"] in specific_courses:
            for course_data in specific_courses[career["code"]]:
                course = {
                    "id": str(uuid.uuid4()),
                    "code": course_data["code"],
                    "name": course_data["name"],
                    "credits": course_data["credits"],
                    "semester": course_data["semester"],
                    "program": career["name"],
                    "description": f"Curso especializado de {course_data['name']}",
                    "prerequisites": [],
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc)
                }
                courses.append(course)
    
    for course in courses:
        course = prepare_for_mongo(course)
        await db.courses.insert_one(course)
    
    print(f"✅ Courses seeded: {len(courses)} courses created")
    return courses

async def seed_students():
    """Create sample students"""
    students = [
        {
            "id": str(uuid.uuid4()),
            "student_code": f"EST2024{str(uuid.uuid4())[:6].upper()}",
            "first_name": "María",
            "last_name": "González",
            "second_last_name": "Pérez",
            "birth_date": date(2000, 3, 15),
            "gender": "F",
            "document_type": "DNI",
            "document_number": "75849621",
            "email": "maria.gonzalez@estudiante.edu",
            "phone": "+51 987123456",
            "address": "Av. Los Olivos 123, San Juan de Lurigancho",
            "district": "San Juan de Lurigancho",
            "province": "Lima",
            "department": "Lima",
            "program": "Educación Inicial",
            "entry_year": 2024,
            "status": "ENROLLED",
            "has_disability": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "student_code": f"EST2024{str(uuid.uuid4())[:6].upper()}",
            "first_name": "José",
            "last_name": "Rodríguez",
            "second_last_name": "Silva",
            "birth_date": date(1999, 8, 22),
            "gender": "M",
            "document_type": "DNI",
            "document_number": "76234891",
            "email": "jose.rodriguez@estudiante.edu",
            "phone": "+51 987123457",
            "address": "Jr. Las Flores 456, Cercado de Lima",
            "district": "Cercado de Lima",
            "province": "Lima",
            "department": "Lima",
            "program": "Educación Primaria",
            "entry_year": 2024,
            "status": "ENROLLED",
            "has_disability": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "student_code": f"EST2023{str(uuid.uuid4())[:6].upper()}",
            "first_name": "Carmen",
            "last_name": "Torres",
            "second_last_name": "Mendoza",
            "birth_date": date(2001, 1, 10),
            "gender": "F",
            "document_type": "DNI",
            "document_number": "77891234",
            "email": "carmen.torres@estudiante.edu",
            "phone": "+51 987123458",
            "address": "Calle Los Cedros 789, Villa El Salvador",
            "district": "Villa El Salvador",
            "province": "Lima",
            "department": "Lima",
            "program": "Educación Física",
            "entry_year": 2023,
            "status": "ENROLLED",
            "has_disability": True,
            "disability_description": "Discapacidad auditiva leve",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
    ]
    
    for student in students:
        student = prepare_for_mongo(student)
        await db.students.insert_one(student)
    
    print(f"✅ Students seeded: {len(students)} students created")
    return students

async def seed_academic_periods():
    """Create academic periods"""
    periods = [
        {
            "id": str(uuid.uuid4()),
            "year": 2024,
            "period": "III",
            "period_name": "Tercer Semestre 2024",
            "start_date": date(2024, 9, 1),
            "end_date": date(2024, 12, 20),
            "enrollment_start": date(2024, 8, 15),
            "enrollment_end": date(2024, 8, 30),
            "is_active": True,
            "is_current": False,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "year": 2025,
            "period": "I",
            "period_name": "Primer Semestre 2025",
            "start_date": date(2025, 3, 1),
            "end_date": date(2025, 7, 15),
            "enrollment_start": date(2025, 2, 1),
            "enrollment_end": date(2025, 2, 20),
            "is_active": True,
            "is_current": True,
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    for period in periods:
        period = prepare_for_mongo(period)
        await db.academic_periods.insert_one(period)
    
    print(f"✅ Academic periods seeded: {len(periods)} periods created")
    return periods

async def seed_procedure_types():
    """Create procedure types for Mesa de Partes"""
    procedure_types = [
        {
            "id": str(uuid.uuid4()),
            "name": "Constancia de Matrícula",
            "description": "Solicitud de constancia que acredite la matrícula del estudiante",
            "area": "ACADEMIC",
            "required_documents": ["DNI", "FOTO"],
            "processing_days": 3,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Constancia de Notas",
            "description": "Certificado oficial de calificaciones obtenidas",
            "area": "ACADEMIC", 
            "required_documents": ["DNI", "RECIBO_PAGO"],
            "processing_days": 5,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Constancia de Egresado",
            "description": "Certificado que acredita la culminación de estudios",
            "area": "ACADEMIC",
            "required_documents": ["DNI", "FOTO", "RECIBO_PAGO"],
            "processing_days": 7,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Traslado Externo",
            "description": "Solicitud de traslado a otra institución educativa",
            "area": "ADMINISTRATIVE",
            "required_documents": ["DNI", "CARTA_MOTIVOS", "CONSTANCIA_NOTAS"],
            "processing_days": 10,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Rectificación de Datos",
            "description": "Corrección de información personal en registros académicos",
            "area": "ADMINISTRATIVE",
            "required_documents": ["DNI", "PARTIDA_NACIMIENTO", "DECLARACION_JURADA"],
            "processing_days": 15,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    for ptype in procedure_types:
        ptype = prepare_for_mongo(ptype)
        await db.procedure_types.insert_one(ptype)
    
    print(f"✅ Procedure types seeded: {len(procedure_types)} types created")
    return procedure_types

async def seed_admission_calls():
    """Create admission calls"""
    calls = [
        {
            "id": str(uuid.uuid4()),
            "name": "Proceso de Admisión 2025-I",
            "description": "Convocatoria para el primer semestre académico 2025",
            "academic_year": 2025,
            "academic_period": "I",
            "registration_start": datetime(2024, 11, 1, 8, 0),
            "registration_end": datetime(2024, 12, 15, 18, 0),
            "exam_date": datetime(2024, 12, 22, 9, 0),
            "results_date": datetime(2024, 12, 28, 15, 0),
            "application_fee": 50.0,
            "max_applications_per_career": 2,
            "available_careers": [],  # Will be filled with career IDs
            "career_vacancies": {
                "EDI": 30,
                "EDP": 35,
                "EDF": 25,
                "EDM": 20,
                "EDA": 15
            },
            "minimum_age": 16,
            "maximum_age": 35,
            "required_documents": ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY"],
            "status": "OPEN",
            "is_active": True,
            "total_applications": 145,
            "created_at": datetime.now(timezone.utc),
            "created_by": "admin",
            "updated_at": datetime.now(timezone.utc)
        }
    ]
    
    # Get career IDs to populate available_careers
    careers = await db.careers.find({}).to_list(10)
    career_ids = [career["id"] for career in careers]
    calls[0]["available_careers"] = career_ids
    
    for call in calls:
        call = prepare_for_mongo(call)
        await db.admission_calls.insert_one(call)
    
    print(f"✅ Admission calls seeded: {len(calls)} calls created")
    return calls

async def seed_finance_data():
    """Seed finance module data"""
    # Bank Accounts
    bank_accounts = [
        {
            "id": str(uuid.uuid4()),
            "bank_name": "Banco de Crédito del Perú",
            "account_number": "191-1234567-0-89",
            "account_type": "CURRENT",
            "currency": "PEN",
            "balance": 125000.50,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "bank_name": "Interbank",
            "account_number": "898-3001234567",
            "account_type": "SAVINGS",
            "currency": "PEN", 
            "balance": 85000.75,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    for account in bank_accounts:
        account = prepare_for_mongo(account)
        await db.bank_accounts.insert_one(account)
    
    # GL Concepts
    gl_concepts = [
        {
            "id": str(uuid.uuid4()),
            "concept_code": "ING001",
            "concept_name": "Matrículas",
            "concept_type": "INCOME",
            "description": "Ingresos por pagos de matrícula de estudiantes",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "concept_code": "ING002", 
            "concept_name": "Pensiones",
            "concept_type": "INCOME",
            "description": "Ingresos por pensiones mensuales",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "concept_code": "GAS001",
            "concept_name": "Servicios Básicos",
            "concept_type": "EXPENSE",
            "description": "Gastos en luz, agua, internet y teléfono",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    for concept in gl_concepts:
        concept = prepare_for_mongo(concept)
        await db.gl_concepts.insert_one(concept)
    
    # Cost Centers
    cost_centers = [
        {
            "id": str(uuid.uuid4()),
            "center_code": "CC001",
            "center_name": "Académico",
            "description": "Centro de costos para actividades académicas",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "center_code": "CC002",
            "center_name": "Administrativo", 
            "description": "Centro de costos para actividades administrativas",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    for center in cost_centers:
        center = prepare_for_mongo(center)
        await db.cost_centers.insert_one(center)
    
    print("✅ Finance data seeded: Bank accounts, GL concepts, and cost centers created")

async def seed_complete_demo_data():
    """Seed complete demo data for production-ready system"""
    print("🚀 Starting complete demo data seeding...")
    
    # Clear existing data
    await clear_database()
    
    # Seed core data
    await seed_users()
    careers = await seed_careers()
    courses = await seed_courses(careers)
    students = await seed_students()
    periods = await seed_academic_periods()
    procedure_types = await seed_procedure_types()
    admission_calls = await seed_admission_calls()
    await seed_finance_data()
    
    print("\n🎉 Complete demo data seeding finished!")
    print("=" * 50)
    print("DEMO CREDENTIALS:")
    print("Admin: admin / password123")
    print("Teacher: teacher1 / password123") 
    print("Student: student1 / password123")
    print("Applicant: applicant1 / password123")
    print("Finance: finance_admin / password123")
    print("Cashier: cashier / password123")
    print("=" * 50)
    print("✅ System ready for production demo!")

if __name__ == "__main__":
    asyncio.run(seed_complete_demo_data())