#!/usr/bin/env python3
"""
Finance Module Seed Data Script
Creates initial data for the Finance and Administration module
"""

import asyncio
import os
from datetime import datetime, date, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import uuid

# Load environment variables
load_dotenv()

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/iespp_system')

async def create_seed_data():
    """Create seed data for the finance module"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.get_default_database()
    
    print("🌱 Creating Finance Module Seed Data...")
    
    # 1. Create Bank Accounts
    print("📊 Creating Bank Accounts...")
    
    bank_accounts = [
        {
            "id": str(uuid.uuid4()),
            "account_name": "Cuenta Corriente Principal",
            "bank_name": "Banco de la Nación",
            "account_number": "00123456789012345678",
            "account_type": "CHECKING",
            "currency": "PEN",
            "initial_balance": 50000.0,
            "current_balance": 50000.0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "account_name": "Cuenta de Ahorros Institucional",
            "bank_name": "Banco de Crédito del Perú",
            "account_number": "19456789123456789012",
            "account_type": "SAVINGS",
            "currency": "PEN",
            "initial_balance": 25000.0,
            "current_balance": 25000.0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        }
    ]
    
    await db.bank_accounts.insert_many(bank_accounts)
    print(f"✅ Created {len(bank_accounts)} bank accounts")
    
    # 2. Create Cost Centers
    print("🏢 Creating Cost Centers...")
    
    cost_centers = [
        {
            "id": str(uuid.uuid4()),
            "code": "CC001",
            "name": "Dirección Académica",
            "description": "Centro de costo para actividades académicas",
            "budget": 100000.0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "code": "CC002",
            "name": "Administración",
            "description": "Centro de costo para actividades administrativas", 
            "budget": 50000.0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "code": "CC003",
            "name": "Infraestructura",
            "description": "Centro de costo para mantenimiento e infraestructura",
            "budget": 75000.0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "code": "CC004",
            "name": "Tecnología",
            "description": "Centro de costo para equipos y tecnología",
            "budget": 30000.0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        }
    ]
    
    await db.cost_centers.insert_many(cost_centers)
    print(f"✅ Created {len(cost_centers)} cost centers")
    
    # 3. Create GL Concepts
    print("📝 Creating GL Concepts...")
    
    gl_concepts = [
        {
            "id": str(uuid.uuid4()),
            "code": "ING001",
            "name": "Ingresos por Matrícula",
            "concept_type": "INCOME",
            "description": "Ingresos generados por matrículas de estudiantes",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "code": "ING002",
            "name": "Ingresos por Pensiones",
            "concept_type": "INCOME",
            "description": "Ingresos mensuales por pensiones estudiantiles",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "code": "ING003",
            "name": "Ingresos por Certificados",
            "concept_type": "INCOME",
            "description": "Ingresos por emisión de certificados y constancias",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "code": "EGR001",
            "name": "Gastos de Personal",
            "concept_type": "EXPENSE",
            "description": "Gastos relacionados con sueldos y beneficios del personal",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "code": "EGR002",
            "name": "Gastos Operativos",
            "concept_type": "EXPENSE",
            "description": "Gastos operativos generales de la institución",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        }
    ]
    
    await db.gl_concepts.insert_many(gl_concepts)
    print(f"✅ Created {len(gl_concepts)} GL concepts")
    
    # 4. Create Inventory Items
    print("📦 Creating Inventory Items...")
    
    inventory_items = [
        {
            "id": str(uuid.uuid4()),
            "code": "MAT001",
            "name": "Papel Bond A4 80gr",
            "description": "Papel bond blanco tamaño A4 de 80 gramos",
            "category": "Materiales de Oficina",
            "unit_of_measure": "PKG",
            "current_stock": 50,
            "min_stock": 10,
            "max_stock": 100,
            "unit_cost": 12.50,
            "total_value": 625.0,
            "available_stock": 50,
            "reserved_stock": 0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "code": "MAT002",
            "name": "Marcadores de Pizarra",
            "description": "Marcadores para pizarra acrílica colores surtidos",
            "category": "Materiales Educativos",
            "unit_of_measure": "UNIT",
            "current_stock": 24,
            "min_stock": 5,
            "max_stock": 50,
            "unit_cost": 3.50,
            "total_value": 84.0,
            "available_stock": 24,
            "reserved_stock": 0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "code": "TEC001",
            "name": "Tóner Impresora HP",
            "description": "Cartucho de tóner para impresora HP LaserJet",
            "category": "Tecnología",
            "unit_of_measure": "UNIT",
            "current_stock": 8,
            "min_stock": 2,
            "max_stock": 15,
            "unit_cost": 185.00,
            "total_value": 1480.0,
            "available_stock": 8,
            "reserved_stock": 0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "code": "LIM001",
            "name": "Detergente Multiusos",
            "description": "Detergente líquido multiusos para limpieza general",
            "category": "Limpieza",
            "unit_of_measure": "L",
            "current_stock": 15,
            "min_stock": 5,
            "max_stock": 30,
            "unit_cost": 8.90,
            "total_value": 133.5,
            "available_stock": 15,
            "reserved_stock": 0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "code": "MOB001",
            "name": "Sillas de Escritorio",
            "description": "Sillas ergonómicas para escritorio con ruedas",
            "category": "Mobiliario",
            "unit_of_measure": "UNIT",
            "current_stock": 3,
            "min_stock": 2,
            "max_stock": 10,
            "unit_cost": 250.00,
            "total_value": 750.0,
            "available_stock": 3,
            "reserved_stock": 0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        }
    ]
    
    await db.inventory_items.insert_many(inventory_items)
    print(f"✅ Created {len(inventory_items)} inventory items")
    
    # 5. Create Suppliers
    print("🏢 Creating Suppliers...")
    
    suppliers = [
        {
            "id": str(uuid.uuid4()),
            "supplier_code": f"PROV{datetime.now().year}001",
            "ruc": "20556789011",
            "company_name": "Distribuidora Educativa Lima S.A.C.",
            "trade_name": "EduLima",
            "contact_person": "Carlos Mendoza García",
            "email": "ventas@edulima.com",
            "phone": "987654321",
            "address": "Av. La Marina 2355, San Miguel, Lima",
            "bank_account": "00123456789012345678",
            "bank_name": "Banco de Crédito del Perú",
            "total_orders": 0,
            "completed_orders": 0,
            "average_rating": 0.0,
            "status": "ACTIVE",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_code": f"PROV{datetime.now().year}002",
            "ruc": "20789654123",
            "company_name": "Tecnología y Equipos del Perú S.R.L.",
            "trade_name": "TecEquipos",
            "contact_person": "Ana Patricia Silva",
            "email": "contacto@tecequipos.com.pe",
            "phone": "945123678",
            "address": "Jirón Huancavelica 1234, Cercado de Lima",
            "bank_account": "19456789123456789012",
            "bank_name": "Banco de la Nación",
            "total_orders": 0,
            "completed_orders": 0,
            "average_rating": 0.0,
            "status": "ACTIVE",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_code": f"PROV{datetime.now().year}003",
            "ruc": "20345678901",
            "company_name": "Limpieza Total Corporativa E.I.R.L.",
            "trade_name": "LimpiezaTotal",
            "contact_person": "Roberto Vásquez León",
            "email": "ventas@limpiezatotal.pe",
            "phone": "923456789",
            "address": "Av. Industrial 567, Villa El Salvador, Lima",
            "bank_account": "00987654321098765432",
            "bank_name": "Interbank",
            "total_orders": 0,
            "completed_orders": 0,
            "average_rating": 0.0,
            "status": "ACTIVE",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_code": f"PROV{datetime.now().year}004",
            "ruc": "20123987456",
            "company_name": "Mobiliario Educativo Moderno S.A.",
            "trade_name": "MobiliarioEdu",
            "contact_person": "María Elena Torres",
            "email": "proyectos@mobiliarioedu.com",
            "phone": "912345987",
            "address": "Av. Argentina 2890, Callao",
            "bank_account": "19123456789012345679",
            "bank_name": "BBVA",
            "total_orders": 0,
            "completed_orders": 0,
            "average_rating": 0.0,
            "status": "ACTIVE",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_code": f"PROV{datetime.now().year}005",
            "ruc": "20987123654",
            "company_name": "Servicios Generales y Mantenimiento S.A.C.",
            "trade_name": "ServiManten",
            "contact_person": "Luis Alberto Ramírez",
            "email": "servicios@servimanten.pe",
            "phone": "934567821",
            "address": "Jirón Ancash 888, Breña, Lima",
            "bank_account": "00555666777888999000",
            "bank_name": "Scotiabank",
            "total_orders": 0,
            "completed_orders": 0,
            "average_rating": 0.0,
            "status": "ACTIVE",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        }
    ]
    
    await db.suppliers.insert_many(suppliers)
    print(f"✅ Created {len(suppliers)} suppliers")
    
    # 6. Create Employees
    print("👥 Creating Employees...")
    
    employees = [
        {
            "id": str(uuid.uuid4()),
            "employee_code": f"EMP{datetime.now().year}001",
            "first_name": "María Elena",
            "last_name": "Rodríguez Sánchez",
            "document_number": "45678901",
            "birth_date": "1985-03-15",
            "email": "maria.rodriguez@iesppgal.edu.pe",
            "phone": "987123456",
            "address": "Av. Los Maestros 456, Urbanización Magisterial, Lima",
            "position": "Directora Académica",
            "department": "Dirección",
            "hire_date": "2020-01-15",
            "contract_type": "PERMANENT",
            "salary": 4500.0,
            "emergency_contact_name": "Carlos Rodríguez",
            "emergency_contact_phone": "998765432",
            "status": "ACTIVE",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "employee_code": f"EMP{datetime.now().year}002",
            "first_name": "José Luis",
            "last_name": "García Mendoza",
            "document_number": "12345678",
            "birth_date": "1980-07-22",
            "email": "jose.garcia@iesppgal.edu.pe",
            "phone": "945678321",
            "address": "Jirón Educación 789, Distrito Educativo, Lima",
            "position": "Docente de Educación Inicial",
            "department": "Educación Inicial",
            "hire_date": "2019-03-01",
            "contract_type": "PERMANENT",
            "salary": 3200.0,
            "emergency_contact_name": "Ana García",
            "emergency_contact_phone": "912456789",
            "status": "ACTIVE",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "employee_code": f"EMP{datetime.now().year}003",
            "first_name": "Carmen Rosa",
            "last_name": "López Villanueva",
            "document_number": "98765432",
            "birth_date": "1987-11-10",
            "email": "carmen.lopez@iesppgal.edu.pe",
            "phone": "923789654",
            "address": "Av. Pedagógica 321, Zona Educativa, Lima",
            "position": "Docente de Educación Primaria",
            "department": "Educación Primaria",
            "hire_date": "2021-02-15",
            "contract_type": "TEMPORARY",
            "salary": 2800.0,
            "emergency_contact_name": "Pedro López",
            "emergency_contact_phone": "987321654",
            "status": "ACTIVE",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "employee_code": f"EMP{datetime.now().year}004",
            "first_name": "Roberto Carlos",
            "last_name": "Vásquez Torres",
            "document_number": "56789012",
            "birth_date": "1983-04-18",
            "email": "roberto.vasquez@iesppgal.edu.pe",
            "phone": "934567890",
            "address": "Calle Deportiva 654, Villa Atleta, Lima",
            "position": "Docente de Educación Física",
            "department": "Educación Física",
            "hire_date": "2020-08-01",
            "contract_type": "PERMANENT",
            "salary": 3000.0,
            "emergency_contact_name": "Lucía Vásquez",
            "emergency_contact_phone": "945123789",
            "status": "ACTIVE",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "employee_code": f"EMP{datetime.now().year}005",
            "first_name": "Patricia Beatriz",
            "last_name": "Flores Quispe",
            "document_number": "34567890",
            "birth_date": "1979-09-25",
            "email": "patricia.flores@iesppgal.edu.pe",
            "phone": "912678345",
            "address": "Av. Administrativa 987, Centro Empresarial, Lima",
            "position": "Secretaria Académica",
            "department": "Secretaría Académica",
            "hire_date": "2018-05-10",
            "contract_type": "PERMANENT",
            "salary": 2500.0,
            "emergency_contact_name": "Miguel Flores",
            "emergency_contact_phone": "923456123",
            "status": "ACTIVE",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        }
    ]
    
    await db.employees.insert_many(employees)
    print(f"✅ Created {len(employees)} employees")
    
    # 7. Create Sample Receipts
    print("🧾 Creating Sample Receipts...")
    
    receipts = [
        {
            "id": str(uuid.uuid4()),
            "receipt_number": "001-000001",
            "series": "001",
            "correlative": 1,
            "concept": "ENROLLMENT",
            "description": "Matrícula Semestre 2024-I",
            "amount": 350.0,
            "customer_name": "Juan Carlos Pérez López",
            "customer_document": "12345678",
            "customer_email": "juan.perez@student.iesppgal.edu.pe",
            "status": "PAID",
            "issued_at": datetime.now(timezone.utc).isoformat(),
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "payment_method": "CASH",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "receipt_number": "002-000001",
            "series": "002",
            "correlative": 1,
            "concept": "TUITION",
            "description": "Pensión Marzo 2024",
            "amount": 280.0,
            "customer_name": "María Isabel García Silva",
            "customer_document": "87654321",
            "customer_email": "maria.garcia@student.iesppgal.edu.pe",
            "status": "PENDING",
            "issued_at": datetime.now(timezone.utc).isoformat(),
            "due_date": (datetime.now(timezone.utc).date() + timedelta(days=15)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        },
        {
            "id": str(uuid.uuid4()),
            "receipt_number": "003-000001",
            "series": "003",
            "correlative": 1,
            "concept": "CERTIFICATE",
            "description": "Certificado de Estudios",
            "amount": 50.0,
            "customer_name": "Ana Lucía Rodríguez Torres",
            "customer_document": "45678901",
            "customer_email": "ana.rodriguez@alumni.iesppgal.edu.pe",
            "status": "PAID",
            "issued_at": datetime.now(timezone.utc).isoformat(),
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "payment_method": "BANK_TRANSFER",
            "payment_reference": "TRF123456789",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        }
    ]
    
    await db.receipts.insert_many(receipts)
    print(f"✅ Created {len(receipts)} sample receipts")
    
    # Create indexes for performance
    print("🔍 Creating database indexes...")
    
    # Bank accounts indexes
    await db.bank_accounts.create_index("account_number", unique=True)
    await db.bank_accounts.create_index("is_active")
    
    # Cost centers indexes
    await db.cost_centers.create_index("code", unique=True)
    await db.cost_centers.create_index("is_active")
    
    # GL concepts indexes
    await db.gl_concepts.create_index("code", unique=True)
    await db.gl_concepts.create_index([("concept_type", 1), ("is_active", 1)])
    
    # Inventory items indexes
    await db.inventory_items.create_index("code", unique=True)
    await db.inventory_items.create_index([("category", 1), ("is_active", 1)])
    await db.inventory_items.create_index("current_stock")
    
    # Suppliers indexes
    await db.suppliers.create_index("ruc", unique=True)
    await db.suppliers.create_index("supplier_code", unique=True)
    await db.suppliers.create_index([("status", 1), ("is_active", 1)])
    
    # Employees indexes
    await db.employees.create_index("document_number", unique=True)
    await db.employees.create_index("employee_code", unique=True)
    await db.employees.create_index([("department", 1), ("status", 1)])
    
    # Receipts indexes
    await db.receipts.create_index("receipt_number", unique=True)
    await db.receipts.create_index([("status", 1), ("issued_at", -1)])
    await db.receipts.create_index("customer_document")
    
    # Audit logs indexes
    await db.audit_logs.create_index([("table_name", 1), ("timestamp", -1)])
    await db.audit_logs.create_index("user_id")
    
    print("✅ Created database indexes")
    
    client.close()
    print("\n🎉 Finance Module Seed Data Created Successfully!")
    print("=" * 60)
    print("Summary:")
    print(f"✅ {len(bank_accounts)} Bank Accounts")
    print(f"✅ {len(cost_centers)} Cost Centers")
    print(f"✅ {len(gl_concepts)} GL Concepts")
    print(f"✅ {len(inventory_items)} Inventory Items")
    print(f"✅ {len(suppliers)} Suppliers")
    print(f"✅ {len(employees)} Employees")
    print(f"✅ {len(receipts)} Sample Receipts")
    print("✅ Database Indexes")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(create_seed_data())