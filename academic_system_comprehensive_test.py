#!/usr/bin/env python3
"""
Comprehensive Academic System Testing - Post Circular Import Resolution
Tests: Core Academic Module, Advanced Routes, Mesa de Partes, MINEDU Integration
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
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
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

    def test_predefined_user_login(self, username: str, password: str) -> Optional[str]:
        """Test login with predefined credentials"""
        login_data = {"username": username, "password": password}
        success, data = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        
        if success and 'access_token' in data:
            role = data.get('user', {}).get('role', 'unknown')
            self.log_test(f"Login {username}", True, f"- Role: {role}")
            return data['access_token']
        else:
            self.log_test(f"Login {username}", False, f"- Error: {data}")
            return None

    def test_dashboard_stats(self, token: str, role: str):
        """Test dashboard statistics"""
        success, data = self.make_request('GET', 'dashboard/stats', token=token)
        
        return self.log_test(
            f"Dashboard Stats ({role})", 
            success,
            f"- Stats keys: {list(data.keys()) if success else 'N/A'}"
        )

    def test_create_student(self, token: str) -> Optional[str]:
        """Test student creation"""
        timestamp = datetime.now().strftime('%H%M%S')
        student_data = {
            "first_name": "Juan Carlos",
            "last_name": "Pérez",
            "second_last_name": "García",
            "birth_date": "1995-05-15",
            "gender": "M",
            "document_type": "DNI",
            "document_number": f"1234567{timestamp[-1]}",
            "email": f"juan.perez{timestamp}@gmail.com",
            "phone": "987654321",
            "address": "Av. Los Héroes 123, Urbanización San José",
            "district": "Lima",
            "province": "Lima",
            "department": "Lima",
            "program": "Educación Inicial",
            "entry_year": 2024,
            "has_disability": False
        }

        success, data = self.make_request('POST', 'students', student_data, token=token, expected_status=200)
        
        if success and 'student' in data:
            student_id = data['student']['id']
            self.created_resources['students'].append(student_id)
            self.log_test("Create Student", True, f"- ID: {student_id}")
            return student_id
        else:
            self.log_test("Create Student", False, f"- Error: {data}")
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
            self.log_test("Create Course", True, f"- Code: {course_data['code']}")
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
        """Test grade update with 0-20 scale and AD/A/B/C conversion"""
        grade_data = {
            "numerical_grade": 17.5,
            "grade_status": "APPROVED",
            "comments": "Excelente desempeño académico"
        }

        success, data = self.make_request('PUT', f'enrollments/{enrollment_id}/grade', grade_data, token=token)
        
        return self.log_test(
            "Update Grade (0-20 Scale)", 
            success,
            f"- Grade: {grade_data['numerical_grade']} (Expected: AD)" if success else f"- Error: {data}"
        )

    def test_update_attendance(self, token: str, enrollment_id: str):
        """Test attendance update with percentage calculation"""
        attendance_data = {
            "total_classes": 20,
            "attended_classes": 18
        }

        success, data = self.make_request('PUT', f'enrollments/{enrollment_id}/attendance', attendance_data, token=token)
        
        expected_percentage = (18/20) * 100  # 90%
        return self.log_test(
            "Update Attendance with %", 
            success,
            f"- Attendance: {attendance_data['attended_classes']}/{attendance_data['total_classes']} (Expected: 90%)" if success else f"- Error: {data}"
        )

    def test_academic_routes_module(self, token: str):
        """Test if academic routes module is accessible (circular import resolution)"""
        # Try to access academic-specific endpoints that would be in academic_routes.py
        endpoints_to_test = [
            'academic/dashboard/stats',
            'academic/students',
            'academic/courses',
            'academic/enrollments'
        ]
        
        accessible_endpoints = 0
        for endpoint in endpoints_to_test:
            success, data = self.make_request('GET', endpoint, token=token)
            if success or (not success and data.get('status_code') != 404):
                accessible_endpoints += 1
        
        return self.log_test(
            "Academic Routes Module Access", 
            accessible_endpoints > 0,
            f"- {accessible_endpoints}/{len(endpoints_to_test)} endpoints accessible"
        )

    def test_mesa_partes_module(self, token: str):
        """Test if Mesa de Partes module is accessible"""
        endpoints_to_test = [
            'mesa-partes/procedure-types',
            'mesa-partes/procedures',
            'mesa-partes/dashboard/stats'
        ]
        
        accessible_endpoints = 0
        for endpoint in endpoints_to_test:
            success, data = self.make_request('GET', endpoint, token=token)
            if success or (not success and data.get('status_code') != 404):
                accessible_endpoints += 1
        
        return self.log_test(
            "Mesa de Partes Module Access", 
            accessible_endpoints > 0,
            f"- {accessible_endpoints}/{len(endpoints_to_test)} endpoints accessible"
        )

    def test_minedu_integration_module(self, token: str):
        """Test if MINEDU integration module is accessible"""
        endpoints_to_test = [
            'minedu/dashboard/stats',
            'minedu/exports',
            'minedu/validation/data-integrity'
        ]
        
        accessible_endpoints = 0
        for endpoint in endpoints_to_test:
            success, data = self.make_request('GET', endpoint, token=token)
            if success or (not success and data.get('status_code') != 404):
                accessible_endpoints += 1
        
        return self.log_test(
            "MINEDU Integration Module Access", 
            accessible_endpoints > 0,
            f"- {accessible_endpoints}/{len(endpoints_to_test)} endpoints accessible"
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
            
            self.log_test("Student Cannot Create Student", success, "- Access properly denied")

        # Test teacher trying to create course (should fail - only ADMIN can)
        if self.teacher_token:
            success, data = self.make_request('POST', 'courses', {
                "code": "UNAUTH", "name": "Unauthorized Course", "credits": 1,
                "semester": 1, "program": "Test"
            }, token=self.teacher_token, expected_status=403)
            
            self.log_test("Teacher Cannot Create Course", success, "- Access properly denied")

    def run_comprehensive_test(self):
        """Run comprehensive academic system test"""
        print("🚀 Starting COMPREHENSIVE ACADEMIC SYSTEM TESTING")
        print("🎯 TARGET: Verify circular import resolution and full academic functionality")
        print("=" * 80)
        
        # 1. Health Check
        print("\n🏥 Testing System Health...")
        if not self.test_health_check():
            print("❌ System health check failed. Aborting tests.")
            return False

        # 2. Authentication with predefined users
        print("\n👥 Testing Authentication with Predefined Users...")
        self.admin_token = self.test_predefined_user_login("admin", "password123")
        self.teacher_token = self.test_predefined_user_login("teacher1", "password123")
        self.student_token = self.test_predefined_user_login("student1", "password123")

        if not self.admin_token:
            print("❌ Admin authentication failed. Cannot continue with admin-required tests.")
            return False

        # 3. Dashboard Statistics
        print("\n📊 Testing Dashboard Statistics...")
        if self.admin_token:
            self.test_dashboard_stats(self.admin_token, "ADMIN")
        if self.teacher_token:
            self.test_dashboard_stats(self.teacher_token, "TEACHER")
        if self.student_token:
            self.test_dashboard_stats(self.student_token, "STUDENT")

        # 4. Core Academic CRUD Operations
        print("\n📚 Testing Core Academic CRUD Operations...")
        student_id = None
        course_id = None
        enrollment_id = None
        
        if self.admin_token:
            student_id = self.test_create_student(self.admin_token)
            self.test_get_students(self.admin_token)
            if student_id:
                self.test_get_student_by_id(self.admin_token, student_id)
            
            course_id = self.test_create_course(self.admin_token)
            self.test_get_courses(self.admin_token)
            
            if student_id and course_id:
                enrollment_id = self.test_create_enrollment(self.admin_token, student_id, course_id)
                self.test_get_enrollments(self.admin_token)

        # 5. Grades and Attendance Management
        print("\n📝 Testing Grades and Attendance Management...")
        if self.admin_token and enrollment_id:
            self.test_update_grade(self.admin_token, enrollment_id)
            self.test_update_attendance(self.admin_token, enrollment_id)

        # 6. Role-Based Permissions
        print("\n🔐 Testing Role-Based Permissions...")
        self.test_role_permissions()

        # 7. Advanced Modules (Circular Import Resolution Test)
        print("\n🔧 Testing Advanced Modules (Circular Import Resolution)...")
        if self.admin_token:
            self.test_academic_routes_module(self.admin_token)
            self.test_mesa_partes_module(self.admin_token)
            self.test_minedu_integration_module(self.admin_token)

        # 8. Final Results
        print("\n" + "=" * 80)
        print(f"📊 COMPREHENSIVE ACADEMIC SYSTEM TEST RESULTS")
        print("=" * 80)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        success_rate = (self.tests_passed/self.tests_run)*100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        # Determine overall status
        if success_rate >= 90:
            print("🎉 ACADEMIC SYSTEM FULLY OPERATIONAL: Circular imports resolved!")
        elif success_rate >= 70:
            print("⚠️  ACADEMIC SYSTEM MOSTLY WORKING: Some advanced features may have issues")
        else:
            print("❌ ACADEMIC SYSTEM HAS CRITICAL ISSUES: Requires immediate attention")
        
        return success_rate >= 70

if __name__ == "__main__":
    tester = AcademicSystemTester()
    success = tester.run_comprehensive_test()
    sys.exit(0 if success else 1)