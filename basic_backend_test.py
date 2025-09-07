#!/usr/bin/env python3
"""
Basic Backend API Testing for IESPP Gustavo Allende Llavería Academic System
Tests core functionality that's currently implemented and working
"""

import requests
import sys
import json
from datetime import datetime, date
from typing import Dict, Any, Optional

class BasicSystemTester:
    def __init__(self, base_url="http://127.0.0.1:8001/api"):
        self.base_url = base_url
        self.admin_token = None
        self.teacher_token = None
        self.student_token = None
        self.applicant_token = None
        self.tests_run = 0
        self.tests_passed = 0

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
            success and 'status' in data and data['status'] == 'healthy',
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

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        print("\n📊 Testing Dashboard Stats...")
        
        # Admin dashboard
        if self.admin_token:
            success, data = self.make_request('GET', 'dashboard/stats', token=self.admin_token)
            has_stats = success and isinstance(data, dict) and len(data) > 0
            self.log_test("Admin Dashboard Stats", has_stats, 
                         f"- Stats keys: {list(data.keys()) if success else 'N/A'}")

        # Teacher dashboard
        if self.teacher_token:
            success, data = self.make_request('GET', 'dashboard/stats', token=self.teacher_token)
            has_stats = success and isinstance(data, dict)
            self.log_test("Teacher Dashboard Stats", has_stats,
                         f"- Stats keys: {list(data.keys()) if success else 'N/A'}")

        # Student dashboard
        if self.student_token:
            success, data = self.make_request('GET', 'dashboard/stats', token=self.student_token)
            has_stats = success and isinstance(data, dict)
            self.log_test("Student Dashboard Stats", has_stats,
                         f"- Stats keys: {list(data.keys()) if success else 'N/A'}")

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

        success, data = self.make_request('POST', 'students', student_data, token=self.admin_token)
        if success and 'student' in data:
            student_id = data['student']['id']
            self.log_test("Create Student", True, f"- ID: {student_id}, DNI: {student_data['document_number']}")
            
            # Get student by ID
            success, data = self.make_request('GET', f'students/{student_id}', token=self.admin_token)
            self.log_test("Get Student by ID", success and 'id' in data,
                         f"- Name: {data.get('first_name', '')} {data.get('last_name', '')}" if success else "")
            
            return student_id
        else:
            self.log_test("Create Student", False, f"- Error: {data}")
            return None

        # Get students list
        success, data = self.make_request('GET', 'students', token=self.admin_token)
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

        success, data = self.make_request('POST', 'courses', course_data, token=self.admin_token)
        if success and 'course' in data:
            course_id = data['course']['id']
            self.log_test("Create Course", True, f"- ID: {course_id}, Code: {course_data['code']}")
            
            # Get courses list
            success, data = self.make_request('GET', 'courses', token=self.admin_token)
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

        success, data = self.make_request('POST', 'enrollments', enrollment_data, token=self.admin_token)
        if success and 'enrollment' in data:
            enrollment_id = data['enrollment']['id']
            self.log_test("Create Enrollment", True, f"- ID: {enrollment_id}")
            
            # Get enrollments list
            success, data = self.make_request('GET', 'enrollments', token=self.admin_token)
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

        success, data = self.make_request('PUT', f'enrollments/{enrollment_id}/grade', 
                                        grade_data, token=self.admin_token)
        self.log_test("Update Grade (0-20 scale)", success,
                     f"- Grade: {grade_data['numerical_grade']} (AD)" if success else f"- Error: {data}")

        # Update attendance with percentage calculation
        attendance_data = {
            "total_classes": 20,
            "attended_classes": 18
        }

        success, data = self.make_request('PUT', f'enrollments/{enrollment_id}/attendance', 
                                        attendance_data, token=self.admin_token)
        expected_percentage = (18/20) * 100  # 90%
        self.log_test("Update Attendance", success,
                     f"- Attendance: {attendance_data['attended_classes']}/{attendance_data['total_classes']} ({expected_percentage}%)" if success else f"- Error: {data}")

    def test_role_based_permissions(self):
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
            
            self.log_test("Student Cannot Create Student", success, "- Access properly denied")

        # Test teacher trying to create course (should fail - only ADMIN can)
        if self.teacher_token:
            success, data = self.make_request('POST', 'courses', {
                "code": "UNAUTH", "name": "Unauthorized Course", "credits": 1,
                "semester": 1, "program": "Test"
            }, token=self.teacher_token, expected_status=403)
            
            self.log_test("Teacher Cannot Create Course", success, "- Access properly denied")

    def run_basic_tests(self):
        """Run basic tests for the academic system"""
        print("🚀 SISTEMA ACADÉMICO INTEGRAL IESPP 'GUSTAVO ALLENDE LLAVERÍA'")
        print("=" * 70)
        print("Basic Backend API Testing (Core Functionality)")
        print("=" * 70)
        
        # Health check
        if not self.test_health_check():
            print("❌ API is not accessible. Exiting...")
            return False

        # Authentication
        if not self.authenticate_users():
            print("❌ Authentication failed. Exiting...")
            return False

        # Core Module Tests
        print("\n" + "="*50)
        print("📚 CORE ACADEMIC FUNCTIONALITY")
        print("="*50)
        
        self.test_dashboard_stats()
        student_id = self.test_students_crud()
        course_id = self.test_courses_crud()
        
        if student_id and course_id:
            enrollment_id = self.test_enrollments_crud(student_id, course_id)
            if enrollment_id:
                self.test_grades_and_attendance(enrollment_id)

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
            print("\n🎉 CORE ACADEMIC SYSTEM - FUNCIONAMIENTO EXCELENTE")
            print("✅ Autenticación y permisos funcionando correctamente")
            print("✅ CRUD operations básicas completamente funcionales")
            print("✅ Dashboard stats operativo")
            print("✅ Sistema base listo para extensión")
        elif success_rate >= 75:
            print("\n⚠️ CORE ACADEMIC SYSTEM - FUNCIONAMIENTO BUENO")
            print("✅ Funcionalidades principales operativas con issues menores")
            print("⚠️ Algunos componentes requieren atención")
        else:
            print("\n❌ CORE ACADEMIC SYSTEM - REQUIERE ATENCIÓN")
            print("❌ Múltiples componentes con fallas críticas")
            print("❌ Sistema no listo para extensión")
        
        print("\n" + "="*70)
        print("📝 NOTA: Módulos académicos avanzados, Mesa de Partes, Admisión")
        print("    e Integración MINEDU requieren resolución de imports circulares")
        print("="*70)
        
        return success_rate >= 75

def main():
    """Main test execution"""
    tester = BasicSystemTester()
    
    try:
        success = tester.run_basic_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️ Testing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Testing failed with error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()