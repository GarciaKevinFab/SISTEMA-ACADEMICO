#!/usr/bin/env python3
"""
Specific Academic System Validation Test
Focus: Dashboard stats, CRUD operations, Grades 0-20 conversion, Attendance percentages, Reports
"""

import requests
import sys
import json
from datetime import datetime

class AcademicValidationTester:
    def __init__(self, base_url="https://academic-sys-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.teacher_token = None
        self.student_token = None
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

    def make_request(self, method: str, endpoint: str, data: dict = None, 
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

    def authenticate_users(self):
        """Authenticate with predefined demo credentials"""
        print("🔐 Authenticating with demo credentials...")
        
        # Admin: admin / password123
        success, data = self.make_request('POST', 'auth/login', {
            "username": "admin", 
            "password": "password123"
        })
        if success and 'access_token' in data:
            self.admin_token = data['access_token']
            self.log_test("Admin Authentication", True, "- admin / password123")
        else:
            self.log_test("Admin Authentication", False, f"- Error: {data}")

        # Teacher: teacher1 / password123
        success, data = self.make_request('POST', 'auth/login', {
            "username": "teacher1", 
            "password": "password123"
        })
        if success and 'access_token' in data:
            self.teacher_token = data['access_token']
            self.log_test("Teacher Authentication", True, "- teacher1 / password123")
        else:
            self.log_test("Teacher Authentication", False, f"- Error: {data}")

        # Student: student1 / password123
        success, data = self.make_request('POST', 'auth/login', {
            "username": "student1", 
            "password": "password123"
        })
        if success and 'access_token' in data:
            self.student_token = data['access_token']
            self.log_test("Student Authentication", True, "- student1 / password123")
        else:
            self.log_test("Student Authentication", False, f"- Error: {data}")

    def test_dashboard_stats_functionality(self):
        """Test dashboard stats for all roles"""
        print("\n📊 Testing Dashboard Stats Functionality...")
        
        if self.admin_token:
            success, data = self.make_request('GET', 'dashboard/stats', token=self.admin_token)
            if success:
                expected_keys = ['total_students', 'total_courses', 'total_enrollments']
                has_expected = all(key in data for key in expected_keys)
                self.log_test("Admin Dashboard Stats", has_expected, 
                             f"- Keys: {list(data.keys())}")
            else:
                self.log_test("Admin Dashboard Stats", False, f"- Error: {data}")

        if self.teacher_token:
            success, data = self.make_request('GET', 'dashboard/stats', token=self.teacher_token)
            if success:
                expected_keys = ['my_courses', 'pending_grades']
                has_expected = all(key in data for key in expected_keys)
                self.log_test("Teacher Dashboard Stats", has_expected,
                             f"- Keys: {list(data.keys())}")
            else:
                self.log_test("Teacher Dashboard Stats", False, f"- Error: {data}")

        if self.student_token:
            success, data = self.make_request('GET', 'dashboard/stats', token=self.student_token)
            if success:
                expected_keys = ['my_enrollments', 'approved_courses']
                has_expected = all(key in data for key in expected_keys)
                self.log_test("Student Dashboard Stats", has_expected,
                             f"- Keys: {list(data.keys())}")
            else:
                self.log_test("Student Dashboard Stats", False, f"- Error: {data}")

    def test_crud_operations(self):
        """Test complete CRUD operations"""
        print("\n📝 Testing CRUD Operations...")
        
        if not self.admin_token:
            print("❌ No admin token available for CRUD testing")
            return

        # Test Students CRUD
        timestamp = datetime.now().strftime('%H%M%S')
        student_data = {
            "first_name": "Ana María",
            "last_name": "González",
            "second_last_name": "López",
            "birth_date": "1998-03-15",
            "gender": "F",
            "document_type": "DNI",
            "document_number": f"8765432{timestamp[-1]}",
            "email": f"ana.gonzalez{timestamp}@iespp.edu.pe",
            "phone": "987654321",
            "address": "Jr. Los Olivos 456, Urbanización Las Flores",
            "district": "San Martín de Porres",
            "province": "Lima",
            "department": "Lima",
            "program": "Educación Primaria",
            "entry_year": 2024,
            "has_disability": False
        }

        success, data = self.make_request('POST', 'students', student_data, token=self.admin_token)
        student_id = None
        if success and 'student' in data:
            student_id = data['student']['id']
            self.log_test("Create Student", True, f"- ID: {student_id}")
        else:
            self.log_test("Create Student", False, f"- Error: {data}")

        # Test Courses CRUD
        course_data = {
            "code": f"EPR{timestamp}",
            "name": "Metodología de la Enseñanza Primaria",
            "credits": 5,
            "semester": 2,
            "program": "Educación Primaria",
            "description": "Curso sobre metodologías específicas para la educación primaria",
            "prerequisites": []
        }

        success, data = self.make_request('POST', 'courses', course_data, token=self.admin_token)
        course_id = None
        if success and 'course' in data:
            course_id = data['course']['id']
            self.log_test("Create Course", True, f"- Code: {course_data['code']}")
        else:
            self.log_test("Create Course", False, f"- Error: {data}")

        # Test Enrollments CRUD
        if student_id and course_id:
            enrollment_data = {
                "student_id": student_id,
                "course_id": course_id,
                "academic_year": 2024,
                "academic_period": "II",
                "teacher_id": None
            }

            success, data = self.make_request('POST', 'enrollments', enrollment_data, token=self.admin_token)
            enrollment_id = None
            if success and 'enrollment' in data:
                enrollment_id = data['enrollment']['id']
                self.log_test("Create Enrollment", True, f"- ID: {enrollment_id}")
                return enrollment_id
            else:
                self.log_test("Create Enrollment", False, f"- Error: {data}")

        return None

    def test_grades_0_20_conversion(self, enrollment_id: str):
        """Test grades 0-20 scale with AD/A/B/C conversion"""
        print("\n📊 Testing Grades 0-20 Scale with AD/A/B/C Conversion...")
        
        if not self.admin_token or not enrollment_id:
            print("❌ No admin token or enrollment ID available for grades testing")
            return

        # Test different grade ranges
        test_cases = [
            (19.5, "AD", "Excelente desempeño - AD"),
            (17.0, "AD", "Muy bueno - AD"),
            (15.5, "A", "Bueno - A"),
            (12.0, "B", "Regular - B"),
            (10.5, "C", "Deficiente - C"),
            (8.0, "C", "Muy deficiente - C")
        ]

        for numerical_grade, expected_literal, description in test_cases:
            grade_data = {
                "numerical_grade": numerical_grade,
                "grade_status": "APPROVED" if numerical_grade >= 11 else "FAILED",
                "comments": description
            }

            success, data = self.make_request('PUT', f'enrollments/{enrollment_id}/grade', 
                                            grade_data, token=self.admin_token)
            
            if success:
                self.log_test(f"Grade {numerical_grade} → {expected_literal}", True, 
                             f"- {description}")
            else:
                self.log_test(f"Grade {numerical_grade} → {expected_literal}", False, 
                             f"- Error: {data}")

    def test_attendance_percentages(self, enrollment_id: str):
        """Test attendance with automatic percentage calculation"""
        print("\n📈 Testing Attendance with Percentage Calculation...")
        
        if not self.admin_token or not enrollment_id:
            print("❌ No admin token or enrollment ID available for attendance testing")
            return

        # Test different attendance scenarios
        test_cases = [
            (20, 18, 90.0, "Excelente asistencia"),
            (25, 20, 80.0, "Buena asistencia"),
            (30, 21, 70.0, "Asistencia regular"),
            (15, 10, 66.67, "Asistencia deficiente")
        ]

        for total_classes, attended_classes, expected_percentage, description in test_cases:
            attendance_data = {
                "total_classes": total_classes,
                "attended_classes": attended_classes
            }

            success, data = self.make_request('PUT', f'enrollments/{enrollment_id}/attendance', 
                                            attendance_data, token=self.admin_token)
            
            if success:
                self.log_test(f"Attendance {attended_classes}/{total_classes}", True, 
                             f"- Expected: {expected_percentage}% ({description})")
            else:
                self.log_test(f"Attendance {attended_classes}/{total_classes}", False, 
                             f"- Error: {data}")

    def test_student_and_course_reports(self):
        """Test student and course reports"""
        print("\n📋 Testing Student and Course Reports...")
        
        if not self.admin_token:
            print("❌ No admin token available for reports testing")
            return

        # Get existing students for report testing
        success, data = self.make_request('GET', 'students?limit=1', token=self.admin_token)
        if success and data.get('students'):
            student_id = data['students'][0]['id']
            
            # Test student grades report
            success, report_data = self.make_request('GET', f'reports/student-grades/{student_id}', 
                                                   token=self.admin_token)
            if success:
                has_required_fields = all(key in report_data for key in ['student', 'enrollments', 'gpa'])
                self.log_test("Student Grades Report", has_required_fields,
                             f"- GPA: {report_data.get('gpa', 'N/A')}")
            else:
                self.log_test("Student Grades Report", False, f"- Error: {report_data}")

        # Get existing courses for report testing
        success, data = self.make_request('GET', 'courses?limit=1', token=self.admin_token)
        if success and data.get('courses'):
            course_id = data['courses'][0]['id']
            
            # Test course enrollment report
            success, report_data = self.make_request('GET', f'reports/course-enrollment/{course_id}', 
                                                   token=self.admin_token)
            if success:
                has_required_fields = all(key in report_data for key in ['course', 'enrollments', 'total_enrolled'])
                self.log_test("Course Enrollment Report", has_required_fields,
                             f"- Total enrolled: {report_data.get('total_enrolled', 'N/A')}")
            else:
                self.log_test("Course Enrollment Report", False, f"- Error: {report_data}")

    def run_validation_test(self):
        """Run specific academic validation test"""
        print("🎯 ACADEMIC SYSTEM SPECIFIC VALIDATION TEST")
        print("Focus: Dashboard, CRUD, Grades 0-20, Attendance %, Reports")
        print("=" * 70)
        
        # 1. Authentication
        self.authenticate_users()
        
        # 2. Dashboard Stats
        self.test_dashboard_stats_functionality()
        
        # 3. CRUD Operations
        enrollment_id = self.test_crud_operations()
        
        # 4. Grades 0-20 with AD/A/B/C conversion
        if enrollment_id:
            self.test_grades_0_20_conversion(enrollment_id)
        
        # 5. Attendance with percentage calculation
        if enrollment_id:
            self.test_attendance_percentages(enrollment_id)
        
        # 6. Reports
        self.test_student_and_course_reports()
        
        # Results
        print("\n" + "=" * 70)
        print(f"📊 VALIDATION TEST RESULTS")
        print("=" * 70)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        success_rate = (self.tests_passed/self.tests_run)*100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 90:
            print("🎉 ACADEMIC SYSTEM VALIDATION: EXCELLENT")
        elif success_rate >= 80:
            print("✅ ACADEMIC SYSTEM VALIDATION: GOOD")
        elif success_rate >= 70:
            print("⚠️  ACADEMIC SYSTEM VALIDATION: ACCEPTABLE")
        else:
            print("❌ ACADEMIC SYSTEM VALIDATION: NEEDS IMPROVEMENT")
        
        return success_rate >= 80

if __name__ == "__main__":
    tester = AcademicValidationTester()
    success = tester.run_validation_test()
    sys.exit(0 if success else 1)