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
    def __init__(self, base_url="https://gal-edusystem.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.teacher_token = None
        self.student_token = None
        self.registrar_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'users': [],
            'students': [],
            'courses': [],
            'enrollments': []
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
        course_data = {
            "code": "EDI101",
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
            
            self.log_test("Student Cannot Create Student", not success, "- Access properly denied")

        # Test teacher trying to create course (should fail - only ADMIN can)
        if self.teacher_token:
            success, data = self.make_request('POST', 'courses', {
                "code": "UNAUTH", "name": "Unauthorized Course", "credits": 1,
                "semester": 1, "program": "Test"
            }, token=self.teacher_token, expected_status=403)
            
            self.log_test("Teacher Cannot Create Course", not success, "- Access properly denied")

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

        # 10. Final Results
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
    print("🌐 Testing Backend: https://gal-edusystem.preview.emergentagent.com/api")
    print()
    
    tester = AcademicSystemTester()
    success = tester.run_comprehensive_test()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())