#!/usr/bin/env python3
"""
Backend API Testing for IESPP Gustavo Allende Llavería Academic System
Tests all CRUD operations, authentication, and role-based permissions
"""

import requests
import sys
import json
from datetime import datetime, date
from typing import Dict, Any, Optional

class AcademicSystemTester:
    def __init__(self, base_url="https://iespp-gustavo-app.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.teacher_token = None
        self.student_token = None
        self.registrar_token = None
        self.admin_worker_token = None
        self.external_user_token = None
        self.applicant_token = None
        self.academic_staff_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'users': [],
            'students': [],
            'courses': [],
            'enrollments': [],
            'procedure_types': [],
            'procedures': [],
            'careers': [],
            'admission_calls': [],
            'applicants': [],
            'applications': [],
            'evaluations': []
        }

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                    token: str = None, expected_status: int = 200) -> tuple:
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}

    def test_health_check(self):
        """Test API health endpoint"""
        success, data = self.make_request('GET', 'health')
        return self.log_test(
            "Health Check", 
            success and 'status' in data,
            f"- Status: {data.get('status', 'unknown')}"
        )

    def test_user_registration(self, role: str) -> Optional[str]:
        """Test user registration and return token"""
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "username": f"test_{role.lower()}_{timestamp}",
            "email": f"test_{role.lower()}_{timestamp}@iespp.edu.pe",
            "password": "TestPass123!",
            "full_name": f"Test {role} User {timestamp}",
            "role": role,
            "phone": "987654321"
        }

        success, data = self.make_request('POST', 'auth/register', user_data, expected_status=200)
        
        if success and 'access_token' in data:
            token = data['access_token']
            self.created_resources['users'].append({
                'username': user_data['username'],
                'role': role,
                'token': token
            })
            self.log_test(f"Register {role} User", True, f"- Username: {user_data['username']}")
            return token
        else:
            self.log_test(f"Register {role} User", False, f"- Error: {data}")
            return None

    def test_user_login(self, username: str, password: str = "TestPass123!") -> Optional[str]:
        """Test user login"""
        login_data = {"username": username, "password": password}
        success, data = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        
        if success and 'access_token' in data:
            self.log_test(f"Login User {username}", True, f"- Role: {data.get('user', {}).get('role')}")
            return data['access_token']
        else:
            self.log_test(f"Login User {username}", False, f"- Error: {data}")
            return None

    def test_get_current_user(self, token: str, expected_role: str):
        """Test getting current user info"""
        success, data = self.make_request('GET', 'auth/me', token=token)
        
        role_match = data.get('role') == expected_role if success else False
        return self.log_test(
            f"Get Current User ({expected_role})", 
            success and role_match,
            f"- Role: {data.get('role') if success else 'N/A'}"
        )

    def test_create_student(self, token: str) -> Optional[str]:
        """Test student creation with Peruvian validations"""
        timestamp = datetime.now().strftime('%H%M%S')
        student_data = {
            "first_name": "Juan Carlos",
            "last_name": "Pérez",
            "second_last_name": "García",
            "birth_date": "1995-05-15",
            "gender": "M",
            "document_type": "DNI",
            "document_number": f"1234567{timestamp[-1]}",  # Valid 8-digit DNI
            "email": f"juan.perez{timestamp}@gmail.com",
            "phone": "987654321",
            "address": "Av. Los Héroes 123, Urbanización San José",
            "district": "Lima",
            "province": "Lima",
            "department": "Lima",
            "program": "Educación Inicial",
            "entry_year": 2024,
            "has_disability": False,
            "disability_description": None,
            "support_needs": []
        }

        success, data = self.make_request('POST', 'students', student_data, token=token, expected_status=200)
        
        if success and 'student' in data:
            student_id = data['student']['id']
            self.created_resources['students'].append(student_id)
            self.log_test("Create Student", True, f"- ID: {student_id}, DNI: {student_data['document_number']}")
            return student_id
        else:
            self.log_test("Create Student", False, f"- Error: {data}")
            return None

    def test_create_student_with_disability(self, token: str) -> Optional[str]:
        """Test student creation with CONADIS support"""
        timestamp = datetime.now().strftime('%H%M%S')
        student_data = {
            "first_name": "María Elena",
            "last_name": "Rodríguez",
            "second_last_name": "Vásquez",
            "birth_date": "1996-08-20",
            "gender": "F",
            "document_type": "CONADIS_CARD",
            "document_number": f"CON{timestamp}001",
            "email": f"maria.rodriguez{timestamp}@gmail.com",
            "phone": "987654322",
            "address": "Jr. Las Flores 456, Pueblo Joven El Progreso",
            "district": "San Juan de Lurigancho",
            "province": "Lima",
            "department": "Lima",
            "program": "Educación Primaria",
            "entry_year": 2024,
            "has_disability": True,
            "disability_description": "Discapacidad visual parcial",
            "support_needs": ["Material en braille", "Asistencia tecnológica", "Ubicación preferencial"]
        }

        success, data = self.make_request('POST', 'students', student_data, token=token, expected_status=200)
        
        if success and 'student' in data:
            student_id = data['student']['id']
            self.created_resources['students'].append(student_id)
            self.log_test("Create Student with Disability", True, f"- ID: {student_id}, CONADIS: {student_data['document_number']}")
            return student_id
        else:
            self.log_test("Create Student with Disability", False, f"- Error: {data}")
            return None

    def test_get_students(self, token: str):
        """Test getting students list"""
        success, data = self.make_request('GET', 'students', token=token)
        
        students_count = len(data.get('students', [])) if success else 0
        return self.log_test(
            "Get Students List", 
            success,
            f"- Found {students_count} students"
        )

    def test_get_student_by_id(self, token: str, student_id: str):
        """Test getting specific student"""
        success, data = self.make_request('GET', f'students/{student_id}', token=token)
        
        return self.log_test(
            "Get Student by ID", 
            success and 'id' in data,
            f"- Student: {data.get('first_name', '')} {data.get('last_name', '')}" if success else ""
        )

    def test_create_course(self, token: str) -> Optional[str]:
        """Test course creation"""
        timestamp = datetime.now().strftime('%H%M%S')
        course_data = {
            "code": f"EDI{timestamp}",
            "name": "Fundamentos de Educación Inicial",
            "credits": 4,
            "semester": 1,
            "program": "Educación Inicial",
            "description": "Curso introductorio sobre los fundamentos teóricos y metodológicos de la educación inicial",
            "prerequisites": []
        }

        success, data = self.make_request('POST', 'courses', course_data, token=token, expected_status=200)
        
        if success and 'course' in data:
            course_id = data['course']['id']
            self.created_resources['courses'].append(course_id)
            self.log_test("Create Course", True, f"- Code: {course_data['code']}, ID: {course_id}")
            return course_id
        else:
            self.log_test("Create Course", False, f"- Error: {data}")
            return None

    def test_get_courses(self, token: str):
        """Test getting courses list"""
        success, data = self.make_request('GET', 'courses', token=token)
        
        courses_count = len(data.get('courses', [])) if success else 0
        return self.log_test(
            "Get Courses List", 
            success,
            f"- Found {courses_count} courses"
        )

    def test_create_enrollment(self, token: str, student_id: str, course_id: str) -> Optional[str]:
        """Test enrollment creation"""
        enrollment_data = {
            "student_id": student_id,
            "course_id": course_id,
            "academic_year": 2024,
            "academic_period": "I",
            "teacher_id": None
        }

        success, data = self.make_request('POST', 'enrollments', enrollment_data, token=token, expected_status=200)
        
        if success and 'enrollment' in data:
            enrollment_id = data['enrollment']['id']
            self.created_resources['enrollments'].append(enrollment_id)
            self.log_test("Create Enrollment", True, f"- ID: {enrollment_id}")
            return enrollment_id
        else:
            self.log_test("Create Enrollment", False, f"- Error: {data}")
            return None

    def test_get_enrollments(self, token: str):
        """Test getting enrollments list"""
        success, data = self.make_request('GET', 'enrollments', token=token)
        
        enrollments_count = len(data.get('enrollments', [])) if success else 0
        return self.log_test(
            "Get Enrollments List", 
            success,
            f"- Found {enrollments_count} enrollments"
        )

    def test_update_grade(self, token: str, enrollment_id: str):
        """Test grade update"""
        grade_data = {
            "numerical_grade": 16.5,
            "grade_status": "APPROVED",
            "comments": "Excelente desempeño académico"
        }

        success, data = self.make_request('PUT', f'enrollments/{enrollment_id}/grade', grade_data, token=token)
        
        return self.log_test(
            "Update Grade", 
            success,
            f"- Grade: {grade_data['numerical_grade']}" if success else f"- Error: {data}"
        )

    def test_update_attendance(self, token: str, enrollment_id: str):
        """Test attendance update"""
        attendance_data = {
            "total_classes": 20,
            "attended_classes": 18
        }

        success, data = self.make_request('PUT', f'enrollments/{enrollment_id}/attendance', attendance_data, token=token)
        
        return self.log_test(
            "Update Attendance", 
            success,
            f"- Attendance: {attendance_data['attended_classes']}/{attendance_data['total_classes']}" if success else f"- Error: {data}"
        )

    def test_dashboard_stats(self, token: str, role: str):
        """Test dashboard statistics"""
        success, data = self.make_request('GET', 'dashboard/stats', token=token)
        
        return self.log_test(
            f"Dashboard Stats ({role})", 
            success,
            f"- Stats keys: {list(data.keys()) if success else 'N/A'}"
        )

    def test_role_permissions(self):
        """Test role-based access control"""
        print("\n🔐 Testing Role-Based Permissions...")
        
        # Test student trying to create another student (should fail)
        if self.student_token:
            success, data = self.make_request('POST', 'students', {
                "first_name": "Test", "last_name": "Unauthorized", "birth_date": "1990-01-01",
                "gender": "M", "document_type": "DNI", "document_number": "12345678",
                "address": "Test Address", "district": "Test", "province": "Test", 
                "department": "Test", "program": "Test", "entry_year": 2024
            }, token=self.student_token, expected_status=403)
            
            # Success means we got 403 (access denied), which is correct
            self.log_test("Student Cannot Create Student", success, "- Access properly denied")

        # Test teacher trying to create course (should fail - only ADMIN can)
        if self.teacher_token:
            success, data = self.make_request('POST', 'courses', {
                "code": "UNAUTH", "name": "Unauthorized Course", "credits": 1,
                "semester": 1, "program": "Test"
            }, token=self.teacher_token, expected_status=403)
            
            # Success means we got 403 (access denied), which is correct
            self.log_test("Teacher Cannot Create Course", success, "- Access properly denied")

    def test_get_procedure_types(self, token: str):
        """Test getting procedure types (should have 6 predefined types)"""
        success, data = self.make_request('GET', 'procedure-types', token=token)
        
        types_count = len(data.get('procedure_types', [])) if success else 0
        expected_types = [
            "Solicitud de Certificado de Estudios",
            "Solicitud de Constancia de Matrícula", 
            "Solicitud de Traslado",
            "Reclamo o Queja",
            "Solicitud de Información",
            "Solicitud de Beca"
        ]
        
        has_expected_types = False
        if success and data.get('procedure_types'):
            type_names = [pt['name'] for pt in data['procedure_types']]
            has_expected_types = all(name in type_names for name in expected_types)
        
        return self.log_test(
            "Get Procedure Types", 
            success and types_count >= 6 and has_expected_types,
            f"- Found {types_count} types, Expected types present: {has_expected_types}"
        )

    def test_create_procedure_type(self, token: str) -> Optional[str]:
        """Test creating a new procedure type (ADMIN only)"""
        timestamp = datetime.now().strftime('%H%M%S')
        procedure_type_data = {
            "name": f"Test Procedure Type {timestamp}",
            "description": "Test procedure type for automated testing",
            "area": "ADMINISTRATIVE",
            "required_documents": ["DNI", "Test Document"],
            "processing_days": 5,
            "is_active": True
        }

        success, data = self.make_request('POST', 'procedure-types', procedure_type_data, token=token, expected_status=200)
        
        if success and 'procedure_type' in data:
            procedure_type_id = data['procedure_type']['id']
            self.created_resources['procedure_types'].append(procedure_type_id)
            self.log_test("Create Procedure Type", True, f"- ID: {procedure_type_id}")
            return procedure_type_id
        else:
            self.log_test("Create Procedure Type", False, f"- Error: {data}")
            return None

    def test_create_procedure(self, token: str, procedure_type_id: str, role: str) -> Optional[str]:
        """Test creating a new procedure"""
        timestamp = datetime.now().strftime('%H%M%S')
        procedure_data = {
            "procedure_type_id": procedure_type_id,
            "subject": f"Test Procedure {timestamp}",
            "description": f"This is a test procedure created for automated testing at {datetime.now()}",
            "applicant_name": f"Test Applicant {timestamp}",
            "applicant_email": f"test.applicant{timestamp}@iespp.edu.pe",
            "applicant_phone": "987654321",
            "applicant_document": f"1234567{timestamp[-1]}",
            "priority": "NORMAL",
            "observations": "Test observations"
        }

        success, data = self.make_request('POST', 'procedures', procedure_data, token=token, expected_status=200)
        
        if success and 'procedure' in data:
            procedure_id = data['procedure']['id']
            tracking_code = data.get('tracking_code', '')
            self.created_resources['procedures'].append({
                'id': procedure_id,
                'tracking_code': tracking_code,
                'role': role
            })
            self.log_test(f"Create Procedure ({role})", True, f"- ID: {procedure_id}, Code: {tracking_code}")
            return procedure_id
        else:
            self.log_test(f"Create Procedure ({role})", False, f"- Error: {data}")
            return None

    def test_get_procedures(self, token: str, role: str):
        """Test getting procedures list"""
        success, data = self.make_request('GET', 'procedures', token=token)
        
        procedures_count = len(data.get('procedures', [])) if success else 0
        return self.log_test(
            f"Get Procedures ({role})", 
            success,
            f"- Found {procedures_count} procedures"
        )

    def test_track_procedure_public(self, tracking_code: str):
        """Test public procedure tracking (no auth required)"""
        success, data = self.make_request('GET', f'procedures/tracking/{tracking_code}')
        
        has_tracking_info = success and 'tracking_code' in data and 'status' in data
        return self.log_test(
            "Track Procedure (Public)", 
            has_tracking_info,
            f"- Code: {tracking_code}, Status: {data.get('status', 'N/A') if success else 'N/A'}"
        )

    def test_update_procedure_status(self, token: str, procedure_id: str, role: str):
        """Test updating procedure status (ADMIN/ADMIN_WORKER only)"""
        status_update_data = {
            "status": "IN_PROCESS",
            "comment": "Procedure is now being processed",
            "notify_applicant": True
        }

        success, data = self.make_request('PUT', f'procedures/{procedure_id}/status', status_update_data, token=token, expected_status=200)
        
        return self.log_test(
            f"Update Procedure Status ({role})", 
            success,
            f"- New Status: IN_PROCESS" if success else f"- Error: {data}"
        )

    def test_assign_procedure(self, token: str, procedure_id: str, assignee_user_id: str, role: str):
        """Test assigning procedure to a user"""
        success, data = self.make_request('PUT', f'procedures/{procedure_id}/assign', None, token=token, expected_status=200)
        
        # Note: The endpoint expects assign_to_user_id as a parameter, but let's test the basic endpoint first
        return self.log_test(
            f"Assign Procedure ({role})", 
            success,
            f"- Assigned successfully" if success else f"- Error: {data}"
        )

    def test_procedure_dashboard_stats(self, token: str, role: str):
        """Test Mesa de Partes dashboard statistics"""
        success, data = self.make_request('GET', 'dashboard/procedure-stats', token=token)
        
        has_stats = success and any(key in data for key in ['status_distribution', 'area_distribution', 'total_procedures'])
        return self.log_test(
            f"Procedure Dashboard Stats ({role})", 
            has_stats,
            f"- Stats available: {list(data.keys()) if success else 'N/A'}"
        )

    def test_get_careers(self, token: str):
        """Test getting careers"""
        success, data = self.make_request('GET', 'careers', token=token)
        
        careers_count = len(data.get('careers', [])) if success else 0
        expected_careers = [
            "Educación Inicial", "Educación Primaria", "Educación Física", 
            "Educación Artística", "Comunicación", "Matemática"
        ]
        
        has_expected_careers = False
        if success and data.get('careers'):
            career_names = [career['name'] for career in data['careers']]
            has_expected_careers = any(name in career_names for name in expected_careers)
        
        return self.log_test(
            "Get Careers", 
            success and careers_count >= 6 and has_expected_careers,
            f"- Found {careers_count} careers, Expected careers present: {has_expected_careers}"
        )

    def test_get_public_admission_calls(self):
        """Test getting public admission calls (no auth required)"""
        success, data = self.make_request('GET', 'public/admission-calls')
        
        calls_count = len(data.get('admission_calls', [])) if success else 0
        return self.log_test(
            "Get Public Admission Calls", 
            success,
            f"- Found {calls_count} public admission calls"
        )

    def test_create_admission_call(self, token: str) -> Optional[str]:
        """Test creating admission call (ADMIN only)"""
        # First get available careers
        success, careers_data = self.make_request('GET', 'careers', token=token)
        if not success or not careers_data.get('careers'):
            self.log_test("Create Admission Call", False, "- No careers available")
            return None
        
        career_ids = [career['id'] for career in careers_data['careers'][:3]]  # Use first 3 careers
        
        timestamp = datetime.now().strftime('%H%M%S')
        admission_call_data = {
            "name": f"Proceso de Admisión Test {timestamp}",
            "description": "Convocatoria de prueba para testing automatizado",
            "academic_year": 2025,
            "academic_period": "I",
            "registration_start": "2025-01-15T08:00:00",
            "registration_end": "2025-02-15T18:00:00",
            "exam_date": "2025-03-01T09:00:00",
            "results_date": "2025-03-15T14:00:00",
            "application_fee": 50.0,
            "max_applications_per_career": 2,
            "available_careers": career_ids,
            "career_vacancies": {
                career_ids[0]: 30,
                career_ids[1]: 25,
                career_ids[2]: 20
            },
            "minimum_age": 16,
            "maximum_age": 35,
            "required_documents": ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY"],
            "is_active": True
        }

        success, data = self.make_request('POST', 'admission-calls', admission_call_data, token=token, expected_status=200)
        
        if success and 'admission_call' in data:
            admission_call_id = data['admission_call']['id']
            self.created_resources.setdefault('admission_calls', []).append(admission_call_id)
            self.log_test("Create Admission Call", True, f"- ID: {admission_call_id}")
            return admission_call_id
        else:
            self.log_test("Create Admission Call", False, f"- Error: {data}")
            return None

    def test_create_applicant(self, token: str) -> Optional[str]:
        """Test creating applicant with Peruvian validations"""
        timestamp = datetime.now().strftime('%H%M%S')
        applicant_data = {
            "first_name": "Ana María",
            "last_name": "González",
            "second_last_name": "Pérez",
            "birth_date": "1998-03-15",
            "gender": "F",
            "document_type": "DNI",
            "document_number": f"7654321{timestamp[-1]}",  # Valid 8-digit DNI
            "email": f"ana.gonzalez{timestamp}@gmail.com",
            "phone": "987654321",
            "address": "Jr. Los Olivos 456, Urbanización Las Flores",
            "district": "San Martín de Porres",
            "province": "Lima",
            "department": "Lima",
            "high_school_name": "I.E. José María Eguren",
            "high_school_year": 2016,
            "has_disability": False,
            "guardian_name": "Carlos González Ruiz",
            "guardian_phone": "987654322",
            "monthly_family_income": "1000-1500"
        }

        success, data = self.make_request('POST', 'applicants', applicant_data, token=token, expected_status=200)
        
        if success and 'applicant' in data:
            applicant_id = data['applicant']['id']
            self.created_resources.setdefault('applicants', []).append(applicant_id)
            self.log_test("Create Applicant", True, f"- ID: {applicant_id}, DNI: {applicant_data['document_number']}")
            return applicant_id
        else:
            self.log_test("Create Applicant", False, f"- Error: {data}")
            return None

    def test_create_applicant_with_conadis(self, token: str) -> Optional[str]:
        """Test creating applicant with CONADIS card"""
        timestamp = datetime.now().strftime('%H%M%S')
        applicant_data = {
            "first_name": "Luis Alberto",
            "last_name": "Mendoza",
            "second_last_name": "Silva",
            "birth_date": "1997-07-22",
            "gender": "M",
            "document_type": "DNI",
            "document_number": f"5432109{timestamp[-1]}",
            "email": f"luis.mendoza{timestamp}@gmail.com",
            "phone": "987654323",
            "address": "Av. Universitaria 789, Pueblo Joven El Porvenir",
            "district": "Los Olivos",
            "province": "Lima",
            "department": "Lima",
            "high_school_name": "I.E. César Vallejo",
            "high_school_year": 2015,
            "has_disability": True,
            "disability_description": "Discapacidad auditiva parcial",
            "conadis_number": f"CON{timestamp}002",
            "guardian_name": "Rosa Silva Vega",
            "guardian_phone": "987654324"
        }

        success, data = self.make_request('POST', 'applicants', applicant_data, token=token, expected_status=200)
        
        if success and 'applicant' in data:
            applicant_id = data['applicant']['id']
            self.created_resources.setdefault('applicants', []).append(applicant_id)
            self.log_test("Create Applicant with CONADIS", True, f"- ID: {applicant_id}, CONADIS: {applicant_data['conadis_number']}")
            return applicant_id
        else:
            self.log_test("Create Applicant with CONADIS", False, f"- Error: {data}")
            return None

    def test_create_application(self, token: str, admission_call_id: str, applicant_id: str) -> Optional[str]:
        """Test creating application with career preferences"""
        # Get available careers from admission call
        success, call_data = self.make_request('GET', f'admission-calls', token=token)
        if not success:
            self.log_test("Create Application", False, "- Cannot get admission calls")
            return None
        
        # Find our admission call
        admission_call = None
        for call in call_data.get('admission_calls', []):
            if call['id'] == admission_call_id:
                admission_call = call
                break
        
        if not admission_call or not admission_call.get('available_careers'):
            self.log_test("Create Application", False, "- No available careers in admission call")
            return None
        
        career_preferences = admission_call['available_careers'][:2]  # Select first 2 careers
        
        application_data = {
            "admission_call_id": admission_call_id,
            "applicant_id": applicant_id,
            "career_preferences": career_preferences,
            "motivation_letter": "Deseo estudiar en esta institución porque considero que tiene la mejor formación pedagógica del país. Mi vocación es enseñar y formar a las nuevas generaciones.",
            "career_interest_reason": "Siempre he tenido pasión por la educación y creo que puedo contribuir significativamente al desarrollo educativo del país."
        }

        success, data = self.make_request('POST', 'applications', application_data, token=token, expected_status=200)
        
        if success and 'application' in data:
            application_id = data['application']['id']
            self.created_resources.setdefault('applications', []).append(application_id)
            self.log_test("Create Application", True, f"- ID: {application_id}, Careers: {len(career_preferences)}")
            return application_id
        else:
            self.log_test("Create Application", False, f"- Error: {data}")
            return None

    def test_create_evaluation(self, token: str, application_id: str) -> Optional[str]:
        """Test creating evaluation for application"""
        evaluation_data = {
            "application_id": application_id,
            "exam_score": 16.5,
            "interview_score": 18.0,
            "observations": "Excelente desempeño en el examen escrito y muy buena presentación en la entrevista personal."
        }

        success, data = self.make_request('POST', 'evaluations', evaluation_data, token=token, expected_status=200)
        
        if success and 'evaluation' in data:
            evaluation_id = data['evaluation']['id']
            final_score = data['evaluation'].get('final_score', 0)
            self.created_resources.setdefault('evaluations', []).append(evaluation_id)
            self.log_test("Create Evaluation", True, f"- ID: {evaluation_id}, Final Score: {final_score}")
            return evaluation_id
        else:
            self.log_test("Create Evaluation", False, f"- Error: {data}")
            return None

    def test_admission_dashboard_stats(self, token: str, role: str):
        """Test admission dashboard statistics"""
        success, data = self.make_request('GET', 'dashboard/admission-stats', token=token)
        
        has_stats = success and any(key in data for key in ['status_distribution', 'career_distribution', 'total_applicants'])
        return self.log_test(
            f"Admission Dashboard Stats ({role})", 
            has_stats,
            f"- Stats available: {list(data.keys()) if success else 'N/A'}"
        )

    def test_dni_validation(self, token: str):
        """Test DNI validation (must be exactly 8 digits)"""
        print("\n🔍 Testing DNI Validation...")
        
        # Test invalid DNI (7 digits)
        invalid_applicant_data = {
            "first_name": "Test", "last_name": "Invalid", "birth_date": "1990-01-01",
            "gender": "M", "document_type": "DNI", "document_number": "1234567",  # 7 digits
            "email": "test.invalid@gmail.com", "phone": "987654321",
            "address": "Test Address", "district": "Test", "province": "Test", 
            "department": "Test", "high_school_name": "Test School", "high_school_year": 2015
        }
        
        success, data = self.make_request('POST', 'applicants', invalid_applicant_data, token=token, expected_status=422)
        self.log_test("DNI Validation (7 digits)", success, "- Properly rejected invalid DNI")
        
        # Test invalid DNI (9 digits)
        invalid_applicant_data["document_number"] = "123456789"  # 9 digits
        success, data = self.make_request('POST', 'applicants', invalid_applicant_data, token=token, expected_status=422)
        self.log_test("DNI Validation (9 digits)", success, "- Properly rejected invalid DNI")
        
        # Test invalid DNI (letters)
        invalid_applicant_data["document_number"] = "1234567A"  # Contains letter
        success, data = self.make_request('POST', 'applicants', invalid_applicant_data, token=token, expected_status=422)
        self.log_test("DNI Validation (letters)", success, "- Properly rejected invalid DNI")

    def test_age_validation(self, token: str):
        """Test age validation (15-50 years)"""
        print("\n🎂 Testing Age Validation...")
        
        # Test too young (14 years old)
        young_applicant_data = {
            "first_name": "Test", "last_name": "Young", "birth_date": "2010-01-01",
            "gender": "M", "document_type": "DNI", "document_number": "12345678",
            "email": "test.young@gmail.com", "phone": "987654321",
            "address": "Test Address", "district": "Test", "province": "Test", 
            "department": "Test", "high_school_name": "Test School", "high_school_year": 2023
        }
        
        success, data = self.make_request('POST', 'applicants', young_applicant_data, token=token, expected_status=400)
        self.log_test("Age Validation (too young)", success, "- Properly rejected applicant under 15")
        
        # Test too old (51 years old)
        old_applicant_data = young_applicant_data.copy()
        old_applicant_data.update({
            "last_name": "Old", "birth_date": "1973-01-01",
            "email": "test.old@gmail.com", "document_number": "87654321"
        })
        
        success, data = self.make_request('POST', 'applicants', old_applicant_data, token=token, expected_status=400)
        self.log_test("Age Validation (too old)", success, "- Properly rejected applicant over 50")

    def test_scoring_system(self, token: str, application_id: str):
        """Test scoring system (80% exam + 20% interview)"""
        print("\n📊 Testing Scoring System...")
        
        # Test with known scores
        evaluation_data = {
            "application_id": application_id,
            "exam_score": 15.0,  # 80% weight
            "interview_score": 20.0,  # 20% weight
            "observations": "Testing scoring calculation"
        }
        # Expected final score: (15.0 * 0.8) + (20.0 * 0.2) = 12.0 + 4.0 = 16.0
        
        success, data = self.make_request('POST', 'evaluations', evaluation_data, token=token, expected_status=200)
        
        if success and 'evaluation' in data:
            final_score = data['evaluation'].get('final_score', 0)
            expected_score = 16.0
            score_correct = abs(final_score - expected_score) < 0.1
            self.log_test("Scoring System Calculation", score_correct, f"- Expected: {expected_score}, Got: {final_score}")
        else:
            self.log_test("Scoring System Calculation", False, f"- Error: {data}")

    def test_admission_comprehensive(self):
        """Comprehensive Admission Module testing"""
        print("\n🎓 Testing Admission Module...")
        
        # 1. Test getting careers
        if self.admin_token:
            self.test_get_careers(self.admin_token)
        
        # 2. Test public admission calls
        self.test_get_public_admission_calls()
        
        # 3. Test creating admission call (ADMIN only)
        admission_call_id = None
        if self.admin_token:
            admission_call_id = self.test_create_admission_call(self.admin_token)
        
        # 4. Test creating applicants with validations
        applicant_id = None
        applicant_conadis_id = None
        if self.admin_token:
            applicant_id = self.test_create_applicant(self.admin_token)
            applicant_conadis_id = self.test_create_applicant_with_conadis(self.admin_token)
        
        # 5. Test DNI and age validations
        if self.admin_token:
            self.test_dni_validation(self.admin_token)
            self.test_age_validation(self.admin_token)
        
        # 6. Test creating applications
        application_id = None
        if admission_call_id and applicant_id:
            application_id = self.test_create_application(self.admin_token, admission_call_id, applicant_id)
        
        # 7. Test evaluation system
        evaluation_id = None
        if application_id and self.admin_token:
            evaluation_id = self.test_create_evaluation(self.admin_token, application_id)
            
        # 8. Test scoring system
        if application_id and self.admin_token:
            self.test_scoring_system(self.admin_token, application_id)
        
        # 9. Test admission dashboard statistics
        if self.admin_token:
            self.test_admission_dashboard_stats(self.admin_token, "ADMIN")
        
        # 10. Test role permissions for Admission
        print("\n🔐 Testing Admission Permissions...")
        
        # Test STUDENT cannot create admission calls
        if self.student_token:
            success, data = self.make_request('POST', 'admission-calls', {
                "name": "Unauthorized Call",
                "academic_year": 2025,
                "academic_period": "I",
                "registration_start": "2025-01-01T00:00:00",
                "registration_end": "2025-02-01T00:00:00",
                "available_careers": [],
                "career_vacancies": {}
            }, token=self.student_token, expected_status=403)
            self.log_test("Student Cannot Create Admission Call", success, "- Access properly denied")
        
        # Test EXTERNAL_USER cannot access admission dashboard stats
        if self.external_user_token:
            success, data = self.make_request('GET', 'dashboard/admission-stats', token=self.external_user_token, expected_status=403)
            self.log_test("External User Cannot Access Admission Stats", success, "- Access properly denied")

    def test_mesa_de_partes_comprehensive(self):
        """Comprehensive Mesa de Partes testing"""
        print("\n📋 Testing Mesa de Partes Virtual Module...")
        
        # 1. Test getting predefined procedure types
        if self.admin_token:
            self.test_get_procedure_types(self.admin_token)
        
        # 2. Test creating new procedure type (ADMIN only)
        procedure_type_id = None
        if self.admin_token:
            procedure_type_id = self.test_create_procedure_type(self.admin_token)
        
        # 3. Get first available procedure type for testing
        if not procedure_type_id and self.admin_token:
            success, data = self.make_request('GET', 'procedure-types', token=self.admin_token)
            if success and data.get('procedure_types'):
                procedure_type_id = data['procedure_types'][0]['id']
                print(f"ℹ️  Using existing procedure type: {procedure_type_id}")
        
        # 4. Test creating procedures with different roles
        procedure_ids = []
        if procedure_type_id:
            if self.external_user_token:
                proc_id = self.test_create_procedure(self.external_user_token, procedure_type_id, "EXTERNAL_USER")
                if proc_id:
                    procedure_ids.append(proc_id)
            
            if self.admin_token:
                proc_id = self.test_create_procedure(self.admin_token, procedure_type_id, "ADMIN")
                if proc_id:
                    procedure_ids.append(proc_id)
        
        # 5. Test getting procedures with different roles
        if self.external_user_token:
            self.test_get_procedures(self.external_user_token, "EXTERNAL_USER")
        if self.admin_worker_token:
            self.test_get_procedures(self.admin_worker_token, "ADMIN_WORKER")
        if self.admin_token:
            self.test_get_procedures(self.admin_token, "ADMIN")
        
        # 6. Test public tracking
        if self.created_resources['procedures']:
            tracking_code = self.created_resources['procedures'][0]['tracking_code']
            if tracking_code:
                self.test_track_procedure_public(tracking_code)
        
        # 7. Test status updates (ADMIN/ADMIN_WORKER only)
        if procedure_ids and self.admin_token:
            self.test_update_procedure_status(self.admin_token, procedure_ids[0], "ADMIN")
        
        if procedure_ids and self.admin_worker_token:
            if len(procedure_ids) > 1:
                self.test_update_procedure_status(self.admin_worker_token, procedure_ids[1], "ADMIN_WORKER")
        
        # 8. Test dashboard statistics
        if self.admin_token:
            self.test_procedure_dashboard_stats(self.admin_token, "ADMIN")
        if self.admin_worker_token:
            self.test_procedure_dashboard_stats(self.admin_worker_token, "ADMIN_WORKER")
        
        # 9. Test role permissions for Mesa de Partes
        print("\n🔐 Testing Mesa de Partes Permissions...")
        
        # Test EXTERNAL_USER cannot create procedure types
        if self.external_user_token:
            success, data = self.make_request('POST', 'procedure-types', {
                "name": "Unauthorized Type",
                "area": "ADMINISTRATIVE",
                "processing_days": 5
            }, token=self.external_user_token, expected_status=403)
            self.log_test("External User Cannot Create Procedure Type", success, "- Access properly denied")
        
        # Test EXTERNAL_USER cannot access procedure dashboard stats
        if self.external_user_token:
            success, data = self.make_request('GET', 'dashboard/procedure-stats', token=self.external_user_token, expected_status=403)
            self.log_test("External User Cannot Access Procedure Stats", success, "- Access properly denied")
        
        # Test STUDENT cannot update procedure status
        if self.student_token and procedure_ids:
            success, data = self.make_request('PUT', f'procedures/{procedure_ids[0]}/status', {
                "status": "COMPLETED"
            }, token=self.student_token, expected_status=403)
            self.log_test("Student Cannot Update Procedure Status", success, "- Access properly denied")

    def run_comprehensive_test(self):
        """Run all tests in sequence"""
        print("🚀 Starting Comprehensive Backend API Testing")
        print("=" * 60)
        
        # 1. Health Check
        print("\n🏥 Testing System Health...")
        if not self.test_health_check():
            print("❌ System health check failed. Aborting tests.")
            return False

        # 2. User Registration & Authentication
        print("\n👥 Testing User Management...")
        self.admin_token = self.test_user_registration("ADMIN")
        self.teacher_token = self.test_user_registration("TEACHER")
        self.student_token = self.test_user_registration("STUDENT")
        self.registrar_token = self.test_user_registration("REGISTRAR")
        self.admin_worker_token = self.test_user_registration("ADMIN_WORKER")
        self.external_user_token = self.test_user_registration("EXTERNAL_USER")
        self.applicant_token = self.test_user_registration("APPLICANT")
        self.academic_staff_token = self.test_user_registration("ACADEMIC_STAFF")

        if not self.admin_token:
            print("❌ Admin registration failed. Cannot continue with admin-required tests.")
            return False

        # 3. Test authentication endpoints
        print("\n🔑 Testing Authentication...")
        self.test_get_current_user(self.admin_token, "ADMIN")
        if self.teacher_token:
            self.test_get_current_user(self.teacher_token, "TEACHER")
        if self.student_token:
            self.test_get_current_user(self.student_token, "STUDENT")

        # 4. Student Management
        print("\n🎓 Testing Student Management...")
        student_id = self.test_create_student(self.admin_token)
        student_with_disability_id = self.test_create_student_with_disability(self.admin_token)
        self.test_get_students(self.admin_token)
        
        if student_id:
            self.test_get_student_by_id(self.admin_token, student_id)

        # 5. Course Management
        print("\n📚 Testing Course Management...")
        course_id = self.test_create_course(self.admin_token)
        self.test_get_courses(self.admin_token)

        # 6. Enrollment Management
        print("\n📝 Testing Enrollment Management...")
        enrollment_id = None
        if student_id and course_id:
            enrollment_id = self.test_create_enrollment(self.admin_token, student_id, course_id)
            self.test_get_enrollments(self.admin_token)

        # 7. Grades and Attendance
        print("\n📊 Testing Grades and Attendance...")
        if enrollment_id and self.admin_token:
            self.test_update_grade(self.admin_token, enrollment_id)
            self.test_update_attendance(self.admin_token, enrollment_id)

        # 8. Dashboard Statistics
        print("\n📈 Testing Dashboard Statistics...")
        self.test_dashboard_stats(self.admin_token, "ADMIN")
        if self.teacher_token:
            self.test_dashboard_stats(self.teacher_token, "TEACHER")
        if self.student_token:
            self.test_dashboard_stats(self.student_token, "STUDENT")

        # 9. Role-based Permissions
        self.test_role_permissions()

        # 10. Admission Module Testing
        print("\n🎓 Testing Admission Module...")
        self.test_admission_comprehensive()

        # 11. Mesa de Partes Testing
        print("\n📋 Testing Mesa de Partes Virtual...")
        self.test_mesa_de_partes_comprehensive()

        # 12. Final Results
        print("\n" + "=" * 60)
        print(f"📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.created_resources['students']:
            print(f"👥 Created Students: {len(self.created_resources['students'])}")
        if self.created_resources['courses']:
            print(f"📚 Created Courses: {len(self.created_resources['courses'])}")
        if self.created_resources['enrollments']:
            print(f"📝 Created Enrollments: {len(self.created_resources['enrollments'])}")

        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    print("🎯 IESPP Gustavo Allende Llavería - Academic System API Testing")
    print("🌐 Testing Backend: https://iespp-gustavo-app.preview.emergentagent.com/api")
    print()
    
    tester = AcademicSystemTester()
    success = tester.run_comprehensive_test()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())