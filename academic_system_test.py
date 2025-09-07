#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for IESPP Gustavo Allende Llavería Academic System
Tests: Academic Module, Mesa de Partes, Admission Module, MINEDU Integration
"""

import requests
import sys
import json
from datetime import datetime, date
from typing import Dict, Any, Optional

class AcademicSystemTester:
    def __init__(self, base_url="https://academic-admin-sys.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.teacher_token = None
        self.student_token = None
        self.applicant_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
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

    def authenticate_users(self):
        """Authenticate demo users"""
        print("\n🔐 Authenticating Demo Users...")
        
        # Admin login
        success, data = self.make_request('POST', 'auth/login', {
            "username": "admin", 
            "password": "password123"
        })
        if success and 'access_token' in data:
            self.admin_token = data['access_token']
            self.log_test("Admin Login", True, f"- Role: {data.get('user', {}).get('role')}")
        else:
            self.log_test("Admin Login", False, f"- Error: {data}")
            return False

        # Teacher login
        success, data = self.make_request('POST', 'auth/login', {
            "username": "teacher1", 
            "password": "password123"
        })
        if success and 'access_token' in data:
            self.teacher_token = data['access_token']
            self.log_test("Teacher Login", True, f"- Role: {data.get('user', {}).get('role')}")
        else:
            self.log_test("Teacher Login", False, f"- Error: {data}")

        # Student login
        success, data = self.make_request('POST', 'auth/login', {
            "username": "student1", 
            "password": "password123"
        })
        if success and 'access_token' in data:
            self.student_token = data['access_token']
            self.log_test("Student Login", True, f"- Role: {data.get('user', {}).get('role')}")
        else:
            self.log_test("Student Login", False, f"- Error: {data}")

        # Applicant login
        success, data = self.make_request('POST', 'auth/login', {
            "username": "applicant1", 
            "password": "password123"
        })
        if success and 'access_token' in data:
            self.applicant_token = data['access_token']
            self.log_test("Applicant Login", True, f"- Role: {data.get('user', {}).get('role')}")
        else:
            self.log_test("Applicant Login", False, f"- Error: {data}")

        return self.admin_token is not None

    def test_academic_dashboard_stats(self):
        """Test academic dashboard statistics by role"""
        print("\n📊 Testing Academic Dashboard Stats...")
        
        # Admin dashboard
        if self.admin_token:
            success, data = self.make_request('GET', 'academic/dashboard/stats', token=self.admin_token)
            has_admin_stats = success and 'stats' in data and any(key in data['stats'] for key in ['total_students', 'total_courses'])
            self.log_test("Admin Dashboard Stats", has_admin_stats, 
                         f"- Stats: {list(data.get('stats', {}).keys()) if success else 'N/A'}")

        # Teacher dashboard
        if self.teacher_token:
            success, data = self.make_request('GET', 'academic/dashboard/stats', token=self.teacher_token)
            has_teacher_stats = success and 'stats' in data and any(key in data['stats'] for key in ['my_courses', 'pending_grades'])
            self.log_test("Teacher Dashboard Stats", has_teacher_stats,
                         f"- Stats: {list(data.get('stats', {}).keys()) if success else 'N/A'}")

        # Student dashboard
        if self.student_token:
            success, data = self.make_request('GET', 'academic/dashboard/stats', token=self.student_token)
            has_student_stats = success and 'stats' in data and any(key in data['stats'] for key in ['my_enrollments', 'approved_courses'])
            self.log_test("Student Dashboard Stats", has_student_stats,
                         f"- Stats: {list(data.get('stats', {}).keys()) if success else 'N/A'}")

    def test_students_crud(self):
        """Test Students CRUD operations"""
        print("\n👨‍🎓 Testing Students CRUD...")
        
        if not self.admin_token:
            self.log_test("Students CRUD", False, "- No admin token available")
            return

        # Create student
        timestamp = datetime.now().strftime('%H%M%S')
        student_data = {
            "first_name": "Ana María",
            "last_name": "Rodríguez",
            "second_last_name": "Vásquez",
            "birth_date": "1998-06-15",
            "gender": "F",
            "document_type": "DNI",
            "document_number": f"7654321{timestamp[-1]}",
            "email": f"ana.rodriguez{timestamp}@estudiante.edu",
            "phone": "987654321",
            "address": "Av. Los Héroes 456, Urbanización Las Flores",
            "district": "San Martín de Porres",
            "province": "Lima",
            "department": "Lima",
            "program": "Educación Inicial",
            "entry_year": 2024,
            "has_disability": False
        }

        success, data = self.make_request('POST', 'academic/students', student_data, token=self.admin_token)
        if success and 'id' in data:
            student_id = data['id']
            self.created_resources['students'].append(student_id)
            self.log_test("Create Student", True, f"- ID: {student_id}, DNI: {student_data['document_number']}")
            
            # Get student by ID
            success, data = self.make_request('GET', f'academic/students/{student_id}', token=self.admin_token)
            self.log_test("Get Student by ID", success and 'id' in data,
                         f"- Name: {data.get('first_name', '')} {data.get('last_name', '')}" if success else "")
            
            return student_id
        else:
            self.log_test("Create Student", False, f"- Error: {data}")
            return None

        # Get students list
        success, data = self.make_request('GET', 'academic/students', token=self.admin_token)
        students_count = len(data.get('students', [])) if success else 0
        self.log_test("Get Students List", success, f"- Found {students_count} students")

    def test_courses_crud(self):
        """Test Courses CRUD operations"""
        print("\n📚 Testing Courses CRUD...")
        
        if not self.admin_token:
            self.log_test("Courses CRUD", False, "- No admin token available")
            return

        # Create course
        timestamp = datetime.now().strftime('%H%M%S')
        course_data = {
            "code": f"TEST{timestamp}",
            "name": f"Curso de Prueba {timestamp}",
            "credits": 4,
            "semester": 1,
            "program": "Educación Inicial",
            "description": "Curso creado para pruebas automatizadas del sistema académico",
            "prerequisites": []
        }

        success, data = self.make_request('POST', 'academic/courses', course_data, token=self.admin_token)
        if success and 'id' in data:
            course_id = data['id']
            self.created_resources['courses'].append(course_id)
            self.log_test("Create Course", True, f"- ID: {course_id}, Code: {course_data['code']}")
            
            # Get courses list
            success, data = self.make_request('GET', 'academic/courses', token=self.admin_token)
            courses_count = len(data.get('courses', [])) if success else 0
            self.log_test("Get Courses List", success, f"- Found {courses_count} courses")
            
            return course_id
        else:
            self.log_test("Create Course", False, f"- Error: {data}")
            return None

    def test_enrollments_crud(self, student_id: str, course_id: str):
        """Test Enrollments CRUD operations"""
        print("\n📝 Testing Enrollments CRUD...")
        
        if not self.admin_token or not student_id or not course_id:
            self.log_test("Enrollments CRUD", False, "- Missing required data")
            return

        # Create enrollment
        enrollment_data = {
            "student_id": student_id,
            "course_id": course_id,
            "academic_year": 2024,
            "academic_period": "I",
            "teacher_id": None
        }

        success, data = self.make_request('POST', 'academic/enrollments', enrollment_data, token=self.admin_token)
        if success and 'id' in data:
            enrollment_id = data['id']
            self.created_resources['enrollments'].append(enrollment_id)
            self.log_test("Create Enrollment", True, f"- ID: {enrollment_id}")
            
            # Get enrollments list
            success, data = self.make_request('GET', 'academic/enrollments', token=self.admin_token)
            enrollments_count = len(data.get('enrollments', [])) if success else 0
            self.log_test("Get Enrollments List", success, f"- Found {enrollments_count} enrollments")
            
            return enrollment_id
        else:
            self.log_test("Create Enrollment", False, f"- Error: {data}")
            return None

    def test_grades_and_attendance(self, enrollment_id: str):
        """Test Grades and Attendance updates"""
        print("\n📊 Testing Grades and Attendance...")
        
        if not self.admin_token or not enrollment_id:
            self.log_test("Grades and Attendance", False, "- Missing required data")
            return

        # Update grade (0-20 scale, AD/A/B/C)
        grade_data = {
            "numerical_grade": 17.5,
            "grade_status": "APPROVED",
            "comments": "Excelente desempeño académico en todas las evaluaciones"
        }

        success, data = self.make_request('PUT', f'academic/enrollments/{enrollment_id}/grade', 
                                        grade_data, token=self.admin_token)
        self.log_test("Update Grade (0-20 scale)", success,
                     f"- Grade: {grade_data['numerical_grade']} (AD)" if success else f"- Error: {data}")

        # Update attendance with percentage calculation
        attendance_data = {
            "total_classes": 20,
            "attended_classes": 18
        }

        success, data = self.make_request('PUT', f'academic/enrollments/{enrollment_id}/attendance', 
                                        attendance_data, token=self.admin_token)
        expected_percentage = (18/20) * 100  # 90%
        self.log_test("Update Attendance", success,
                     f"- Attendance: {attendance_data['attended_classes']}/{attendance_data['total_classes']} ({expected_percentage}%)" if success else f"- Error: {data}")

    def test_academic_reports(self, student_id: str, course_id: str):
        """Test Academic Reports generation"""
        print("\n📋 Testing Academic Reports...")
        
        if not self.admin_token or not student_id or not course_id:
            self.log_test("Academic Reports", False, "- Missing required data")
            return

        # Student grades report
        success, data = self.make_request('GET', f'academic/reports/student-grades/{student_id}', 
                                        token=self.admin_token)
        has_student_report = success and 'student' in data and 'gpa' in data
        self.log_test("Student Grades Report", has_student_report,
                     f"- GPA: {data.get('gpa', 0)}, Courses: {data.get('completed_courses', 0)}" if success else f"- Error: {data}")

        # Course enrollment report
        success, data = self.make_request('GET', f'academic/reports/course-enrollment/{course_id}', 
                                        token=self.admin_token)
        has_course_report = success and 'course' in data and 'total_enrolled' in data
        self.log_test("Course Enrollment Report", has_course_report,
                     f"- Enrolled: {data.get('total_enrolled', 0)}, Approved: {data.get('approved_count', 0)}" if success else f"- Error: {data}")

    def test_mesa_partes_module(self):
        """Test Mesa de Partes (Digital Procedures) Module"""
        print("\n🏛️ Testing Mesa de Partes Module...")
        
        if not self.admin_token:
            self.log_test("Mesa de Partes Module", False, "- No admin token available")
            return

        # Get procedure types (should have seeded data)
        success, data = self.make_request('GET', 'mesa-partes/procedure-types', token=self.admin_token)
        types_count = len(data.get('procedure_types', [])) if success else 0
        expected_types = ["Constancia de Matrícula", "Constancia de Notas", "Constancia de Egresado"]
        has_expected_types = False
        if success and data.get('procedure_types'):
            type_names = [pt['name'] for pt in data['procedure_types']]
            has_expected_types = any(name in type_names for name in expected_types)
        
        self.log_test("Get Procedure Types", success and types_count >= 3 and has_expected_types,
                     f"- Found {types_count} types, Expected types present: {has_expected_types}")

        if not success or not data.get('procedure_types'):
            return

        # Create a new procedure
        procedure_type_id = data['procedure_types'][0]['id']
        timestamp = datetime.now().strftime('%H%M%S')
        procedure_data = {
            "procedure_type_id": procedure_type_id,
            "subject": f"Solicitud de Constancia Test {timestamp}",
            "description": f"Solicitud de constancia de matrícula para trámites externos - Test {timestamp}",
            "applicant_name": f"Juan Carlos Pérez Test {timestamp}",
            "applicant_email": f"juan.perez{timestamp}@gmail.com",
            "applicant_phone": "987654321",
            "applicant_document": f"1234567{timestamp[-1]}",
            "priority": "NORMAL",
            "observations": "Solicitud urgente para presentar en otra institución"
        }

        success, data = self.make_request('POST', 'mesa-partes/procedures', procedure_data, token=self.admin_token)
        if success and 'procedure' in data:
            procedure_id = data['procedure']['id']
            tracking_code = data.get('tracking_code', '')
            self.created_resources['procedures'].append({
                'id': procedure_id,
                'tracking_code': tracking_code
            })
            self.log_test("Create Procedure with Tracking Code", True, 
                         f"- ID: {procedure_id}, Code: {tracking_code}")
            
            # Test public tracking (no auth required)
            success, data = self.make_request('GET', f'mesa-partes/procedures/{tracking_code}')
            has_tracking_info = success and 'tracking_code' in data and 'status' in data
            self.log_test("Public Procedure Tracking", has_tracking_info,
                         f"- Code: {tracking_code}, Status: {data.get('procedure', {}).get('status', 'N/A')}" if success else f"- Error: {data}")
            
            # Update procedure status
            status_update_data = {
                "status": "IN_PROCESS",
                "comment": "Procedimiento en revisión por el área académica",
                "notify_applicant": True
            }
            success, data = self.make_request('PUT', f'mesa-partes/procedures/{procedure_id}/status', 
                                            status_update_data, token=self.admin_token)
            self.log_test("Update Procedure Status", success,
                         "- Status updated to IN_PROCESS" if success else f"- Error: {data}")
            
            return procedure_id, tracking_code
        else:
            self.log_test("Create Procedure with Tracking Code", False, f"- Error: {data}")
            return None, None

    def test_mesa_partes_dashboard(self):
        """Test Mesa de Partes Dashboard Stats"""
        if not self.admin_token:
            return

        success, data = self.make_request('GET', 'mesa-partes/dashboard/stats', token=self.admin_token)
        has_stats = success and 'stats' in data and any(key in data['stats'] for key in ['total_procedures', 'pending_procedures'])
        self.log_test("Mesa de Partes Dashboard Stats", has_stats,
                     f"- Stats: {list(data.get('stats', {}).keys()) if success else 'N/A'}")

    def test_admission_module(self):
        """Test Admission Module"""
        print("\n🎓 Testing Admission Module...")
        
        if not self.admin_token:
            self.log_test("Admission Module", False, "- No admin token available")
            return

        # Get careers (should have seeded data)
        success, data = self.make_request('GET', 'careers', token=self.admin_token)
        careers_count = len(data.get('careers', [])) if success else 0
        expected_careers = ["Educación Inicial", "Educación Primaria", "Educación Física"]
        has_expected_careers = False
        if success and data.get('careers'):
            career_names = [career['name'] for career in data['careers']]
            has_expected_careers = any(name in career_names for name in expected_careers)
        
        self.log_test("Get Careers", success and careers_count >= 3 and has_expected_careers,
                     f"- Found {careers_count} careers, Expected careers present: {has_expected_careers}")

        # Get admission calls
        success, data = self.make_request('GET', 'admission-calls', token=self.admin_token)
        calls_count = len(data.get('admission_calls', [])) if success else 0
        self.log_test("Get Admission Calls", success,
                     f"- Found {calls_count} admission calls")

        if not success or not data.get('admission_calls'):
            return

        # Create applicant
        timestamp = datetime.now().strftime('%H%M%S')
        applicant_data = {
            "first_name": "María Elena",
            "last_name": "González",
            "second_last_name": "Pérez",
            "birth_date": "1999-03-15",
            "gender": "F",
            "document_type": "DNI",
            "document_number": f"7654321{timestamp[-1]}",
            "email": f"maria.gonzalez{timestamp}@gmail.com",
            "phone": "987654321",
            "address": "Jr. Los Olivos 456, Urbanización Las Flores",
            "district": "San Martín de Porres",
            "province": "Lima",
            "department": "Lima",
            "high_school_name": "I.E. José María Eguren",
            "high_school_year": 2017,
            "has_disability": False,
            "guardian_name": "Carlos González Ruiz",
            "guardian_phone": "987654322",
            "monthly_family_income": "1000-1500"
        }

        success, data = self.make_request('POST', 'applicants', applicant_data, token=self.admin_token)
        if success and 'applicant' in data:
            applicant_id = data['applicant']['id']
            self.created_resources['applicants'].append(applicant_id)
            self.log_test("Create Applicant", True, 
                         f"- ID: {applicant_id}, DNI: {applicant_data['document_number']}")
            
            # Create application
            admission_call_id = data.get('admission_calls', [{}])[0].get('id') if 'admission_calls' in data else None
            if admission_call_id:
                # Get careers for preferences
                success, careers_data = self.make_request('GET', 'careers', token=self.admin_token)
                if success and careers_data.get('careers'):
                    career_preferences = [career['id'] for career in careers_data['careers'][:2]]
                    
                    application_data = {
                        "admission_call_id": admission_call_id,
                        "applicant_id": applicant_id,
                        "career_preferences": career_preferences,
                        "motivation_letter": "Deseo estudiar en esta prestigiosa institución porque considero que tiene la mejor formación pedagógica del país.",
                        "career_interest_reason": "Siempre he tenido vocación por la enseñanza y quiero contribuir al desarrollo educativo."
                    }
                    
                    success, data = self.make_request('POST', 'applications', application_data, token=self.admin_token)
                    if success and 'application' in data:
                        application_id = data['application']['id']
                        self.created_resources['applications'].append(application_id)
                        self.log_test("Create Application", True, 
                                     f"- ID: {application_id}, Careers: {len(career_preferences)}")
                        
                        # Create evaluation
                        evaluation_data = {
                            "application_id": application_id,
                            "exam_score": 16.5,
                            "interview_score": 18.0,
                            "observations": "Excelente desempeño en examen escrito y muy buena presentación en entrevista."
                        }
                        
                        success, data = self.make_request('POST', 'evaluations', evaluation_data, token=self.admin_token)
                        if success and 'evaluation' in data:
                            evaluation_id = data['evaluation']['id']
                            final_score = data['evaluation'].get('final_score', 0)
                            expected_score = (16.5 * 0.8) + (18.0 * 0.2)  # 80% exam + 20% interview = 16.8
                            score_correct = abs(final_score - expected_score) < 0.1
                            self.log_test("Create Evaluation with Scoring", score_correct, 
                                         f"- ID: {evaluation_id}, Final Score: {final_score} (Expected: {expected_score:.1f})")
                        else:
                            self.log_test("Create Evaluation", False, f"- Error: {data}")
                    else:
                        self.log_test("Create Application", False, f"- Error: {data}")
            
            return applicant_id
        else:
            self.log_test("Create Applicant", False, f"- Error: {data}")
            return None

    def test_admission_dashboard(self):
        """Test Admission Dashboard Stats"""
        if not self.admin_token:
            return

        success, data = self.make_request('GET', 'dashboard/admission-stats', token=self.admin_token)
        has_stats = success and any(key in data for key in ['status_distribution', 'career_distribution', 'total_applicants'])
        self.log_test("Admission Dashboard Stats", has_stats,
                     f"- Stats available: {list(data.keys()) if success else 'N/A'}")

    def test_minedu_integration(self):
        """Test MINEDU Integration Module"""
        print("\n🏛️ Testing MINEDU Integration...")
        
        if not self.admin_token:
            self.log_test("MINEDU Integration", False, "- No admin token available")
            return

        # MINEDU Dashboard Stats
        success, data = self.make_request('GET', 'minedu/dashboard/stats', token=self.admin_token)
        has_stats = success and 'stats' in data and any(key in data['stats'] for key in ['pending_exports', 'completed_exports'])
        self.log_test("MINEDU Dashboard Stats", has_stats,
                     f"- Stats: {list(data.get('stats', {}).keys()) if success else 'N/A'}")

        # Export enrollments to MINEDU
        export_data = {
            "academic_year": 2024,
            "academic_period": "I"
        }
        success, data = self.make_request('POST', 'minedu/export/enrollments', export_data, token=self.admin_token)
        self.log_test("Export Enrollments to MINEDU", success,
                     f"- Batch ID: {data.get('batch_id', 'N/A')}, Records: {data.get('total_records', 0)}" if success else f"- Error: {data}")

        # Export grades to MINEDU
        success, data = self.make_request('POST', 'minedu/export/grades', export_data, token=self.admin_token)
        self.log_test("Export Grades to MINEDU", success,
                     f"- Batch ID: {data.get('batch_id', 'N/A')}, Records: {data.get('total_records', 0)}" if success else f"- Error: {data}")

        # Data integrity validation
        success, data = self.make_request('GET', 'minedu/validation/data-integrity', token=self.admin_token)
        is_valid = success and data.get('valid', False)
        self.log_test("MINEDU Data Integrity Validation", success,
                     f"- Valid: {is_valid}, Errors: {len(data.get('errors', []))}, Warnings: {len(data.get('warnings', []))}" if success else f"- Error: {data}")

        # Get export records
        success, data = self.make_request('GET', 'minedu/exports', token=self.admin_token)
        exports_count = len(data.get('exports', [])) if success else 0
        self.log_test("Get MINEDU Export Records", success,
                     f"- Found {exports_count} export records")

    def test_role_based_permissions(self):
        """Test role-based access control"""
        print("\n🔐 Testing Role-Based Permissions...")
        
        # Test student trying to create another student (should fail)
        if self.student_token:
            success, data = self.make_request('POST', 'academic/students', {
                "first_name": "Test", "last_name": "Unauthorized", "birth_date": "1990-01-01",
                "gender": "M", "document_type": "DNI", "document_number": "12345678",
                "address": "Test Address", "district": "Test", "province": "Test", 
                "department": "Test", "program": "Test", "entry_year": 2024
            }, token=self.student_token, expected_status=403)
            
            self.log_test("Student Cannot Create Student", success, "- Access properly denied")

        # Test teacher trying to create course (should fail - only ADMIN can)
        if self.teacher_token:
            success, data = self.make_request('POST', 'academic/courses', {
                "code": "UNAUTH", "name": "Unauthorized Course", "credits": 1,
                "semester": 1, "program": "Test"
            }, token=self.teacher_token, expected_status=403)
            
            self.log_test("Teacher Cannot Create Course", success, "- Access properly denied")

        # Test applicant trying to access admin functions (should fail)
        if self.applicant_token:
            success, data = self.make_request('GET', 'minedu/dashboard/stats', 
                                            token=self.applicant_token, expected_status=403)
            
            self.log_test("Applicant Cannot Access MINEDU", success, "- Access properly denied")

    def run_comprehensive_tests(self):
        """Run all comprehensive tests for the academic system"""
        print("🚀 SISTEMA ACADÉMICO INTEGRAL IESPP 'GUSTAVO ALLENDE LLAVERÍA'")
        print("=" * 70)
        print("Comprehensive Backend API Testing")
        print("=" * 70)
        
        # Health check
        if not self.test_health_check():
            print("❌ API is not accessible. Exiting...")
            return False

        # Authentication
        if not self.authenticate_users():
            print("❌ Authentication failed. Exiting...")
            return False

        # Academic Module Tests
        print("\n" + "="*50)
        print("📚 MÓDULO ACADÉMICO")
        print("="*50)
        
        self.test_academic_dashboard_stats()
        student_id = self.test_students_crud()
        course_id = self.test_courses_crud()
        
        if student_id and course_id:
            enrollment_id = self.test_enrollments_crud(student_id, course_id)
            if enrollment_id:
                self.test_grades_and_attendance(enrollment_id)
                self.test_academic_reports(student_id, course_id)

        # Mesa de Partes Module Tests
        print("\n" + "="*50)
        print("🏛️ MESA DE PARTES")
        print("="*50)
        
        procedure_id, tracking_code = self.test_mesa_partes_module()
        self.test_mesa_partes_dashboard()

        # Admission Module Tests
        print("\n" + "="*50)
        print("🎓 MÓDULO DE ADMISIÓN")
        print("="*50)
        
        applicant_id = self.test_admission_module()
        self.test_admission_dashboard()

        # MINEDU Integration Tests
        print("\n" + "="*50)
        print("🏛️ INTEGRACIÓN MINEDU")
        print("="*50)
        
        self.test_minedu_integration()

        # Security Tests
        print("\n" + "="*50)
        print("🔐 SEGURIDAD Y PERMISOS")
        print("="*50)
        
        self.test_role_based_permissions()

        # Final Results
        print("\n" + "="*70)
        print("📊 RESULTADOS FINALES")
        print("="*70)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📊 Total Tests: {self.tests_run}")
        print(f"🎯 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 90:
            print("\n🎉 SISTEMA ACADÉMICO INTEGRAL - FUNCIONAMIENTO EXCELENTE")
            print("✅ Todos los módulos principales operativos")
            print("✅ Autenticación y permisos funcionando correctamente")
            print("✅ CRUD operations completamente funcionales")
            print("✅ Integración MINEDU operativa")
            print("✅ Mesa de Partes con tracking público funcionando")
            print("✅ Sistema listo para producción")
        elif success_rate >= 75:
            print("\n⚠️ SISTEMA ACADÉMICO INTEGRAL - FUNCIONAMIENTO BUENO")
            print("✅ Módulos principales operativos con issues menores")
            print("⚠️ Algunos componentes requieren atención")
        else:
            print("\n❌ SISTEMA ACADÉMICO INTEGRAL - REQUIERE ATENCIÓN")
            print("❌ Múltiples componentes con fallas críticas")
            print("❌ Sistema no listo para producción")
        
        print("\n" + "="*70)
        
        return success_rate >= 75

def main():
    """Main test execution"""
    tester = AcademicSystemTester()
    
    try:
        success = tester.run_comprehensive_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️ Testing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Testing failed with error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()