#!/usr/bin/env python3
"""
PRIORITY TESTING - MINEDU Integration, Security & Academic Reports
Comprehensive testing for new modules as requested in review
"""

import requests
import sys
import json
from datetime import datetime, date
from typing import Dict, Any, Optional

class NewModulesTester:
    def __init__(self, base_url="https://academic-sys-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.teacher_token = None
        self.student_token = None
        self.registrar_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'minedu_events': [],
            'security_tests': [],
            'reports': []
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

    def authenticate_users(self):
        """Authenticate with predefined users"""
        print("🔐 Authenticating with predefined users...")
        
        # Use admin@universidad.edu credentials as specified in review request
        self.admin_token = self.test_user_login("admin@universidad.edu", "password123")
        
        # Try other predefined users
        self.teacher_token = self.test_user_login("teacher1", "password123")
        self.student_token = self.test_user_login("student1", "password123")
        
        if not self.admin_token:
            print("❌ Failed to authenticate admin user. Cannot continue.")
            return False
        
        return True

    def test_user_login(self, username: str, password: str) -> Optional[str]:
        """Test user login"""
        login_data = {"username": username, "password": password}
        success, data = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        
        if success and 'access_token' in data:
            self.log_test(f"Login User {username}", True, f"- Role: {data.get('user', {}).get('role')}")
            return data['access_token']
        else:
            self.log_test(f"Login User {username}", False, f"- Error: {data}")
            return None

    # ====================================================================================================
    # MINEDU INTEGRATION MODULE TESTING
    # ====================================================================================================

    def test_minedu_integration_module(self):
        """Test MINEDU Integration Module endpoints"""
        print("\n🎓 Testing MINEDU Integration Module...")
        
        if not self.admin_token:
            print("❌ No admin token available for MINEDU testing")
            return
        
        # 1. Test POST /api/minedu/events (create outbox event)
        event_id = self.test_create_minedu_event()
        
        # 2. Test GET /api/minedu/events/{event_id} (get specific event)
        if event_id:
            self.test_get_minedu_event(event_id)
        
        # 3. Test GET /api/minedu/events (list events with filters)
        self.test_list_minedu_events()
        
        # 4. Test GET /api/minedu/stats (integration statistics)
        self.test_get_minedu_stats()
        
        # 5. Test POST /api/minedu/reconcile (reconciliation process)
        self.test_minedu_reconcile()
        
        # 6. Test POST /api/minedu/reprocess (reprocess failed events)
        self.test_minedu_reprocess()
        
        # 7. Test POST /api/minedu/enrollments/sync (sync enrollment)
        self.test_minedu_sync_enrollment()
        
        # 8. Test POST /api/minedu/grades/sync (sync grade)
        self.test_minedu_sync_grade()

    def test_create_minedu_event(self) -> Optional[str]:
        """Test creating MINEDU outbox event"""
        timestamp = datetime.now().strftime('%H%M%S')
        event_data = {
            "entity_type": "ENROLLMENT",
            "entity_id": f"test_entity_{timestamp}",
            "period_id": "2024-I",
            "payload": {
                "student_id": f"student_{timestamp}",
                "course_id": f"course_{timestamp}",
                "enrollment_date": "2024-03-15T10:00:00Z",
                "status": "ACTIVE"
            },
            "version": 1
        }

        success, data = self.make_request('POST', 'minedu/events', event_data, token=self.admin_token, expected_status=200)
        
        if success and 'event_id' in data:
            event_id = data['event_id']
            self.created_resources['minedu_events'].append(event_id)
            self.log_test("Create MINEDU Event", True, f"- Event ID: {event_id}")
            return event_id
        else:
            self.log_test("Create MINEDU Event", False, f"- Error: {data}")
            return None

    def test_get_minedu_event(self, event_id: str):
        """Test getting specific MINEDU event"""
        success, data = self.make_request('GET', f'minedu/events/{event_id}', token=self.admin_token)
        
        has_event_data = success and 'id' in data and 'status' in data
        return self.log_test(
            "Get MINEDU Event", 
            has_event_data,
            f"- Status: {data.get('status', 'N/A')}" if success else f"- Error: {data}"
        )

    def test_list_minedu_events(self):
        """Test listing MINEDU events with filters"""
        # Test without filters
        success, data = self.make_request('GET', 'minedu/events', token=self.admin_token)
        
        events_count = len(data) if success and isinstance(data, list) else 0
        list_success = self.log_test(
            "List MINEDU Events", 
            success,
            f"- Found {events_count} events"
        )
        
        # Test with filters
        success, data = self.make_request('GET', 'minedu/events?status=PENDING&limit=10', token=self.admin_token)
        
        filtered_count = len(data) if success and isinstance(data, list) else 0
        return self.log_test(
            "List MINEDU Events (Filtered)", 
            success,
            f"- Found {filtered_count} pending events"
        )

    def test_get_minedu_stats(self):
        """Test getting MINEDU integration statistics"""
        success, data = self.make_request('GET', 'minedu/stats', token=self.admin_token)
        
        has_stats = success and any(key in data for key in ['pending', 'sent', 'failed'])
        return self.log_test(
            "Get MINEDU Stats", 
            has_stats,
            f"- Stats keys: {list(data.keys()) if success else 'N/A'}"
        )

    def test_minedu_reconcile(self):
        """Test MINEDU reconciliation process"""
        reconcile_data = {
            "period_id": "2024-I",
            "auto_reprocess": True
        }

        success, data = self.make_request('POST', 'minedu/reconcile', reconcile_data, token=self.admin_token)
        
        return self.log_test(
            "MINEDU Reconcile", 
            success,
            f"- Message: {data.get('message', 'N/A')}" if success else f"- Error: {data}"
        )

    def test_minedu_reprocess(self):
        """Test MINEDU reprocess failed events"""
        reprocess_data = {
            "status_filter": "FAILED",
            "limit": 5
        }

        success, data = self.make_request('POST', 'minedu/reprocess', reprocess_data, token=self.admin_token)
        
        return self.log_test(
            "MINEDU Reprocess", 
            success,
            f"- Reprocessed: {data.get('reprocessed_count', 0)}" if success else f"- Error: {data}"
        )

    def test_minedu_sync_enrollment(self):
        """Test syncing enrollment to MINEDU"""
        timestamp = datetime.now().strftime('%H%M%S')
        
        # Use query parameters as expected by the endpoint
        endpoint = f"minedu/enrollments/sync?student_id=test_student_{timestamp}&course_id=test_course_{timestamp}&period_id=2024-I"
        
        success, data = self.make_request('POST', endpoint, {}, token=self.admin_token, expected_status=404)  # Expect 404 for non-existent enrollment
        
        # Success here means we got proper error handling for non-existent enrollment
        return self.log_test(
            "MINEDU Sync Enrollment", 
            success,
            "- Endpoint accessible, proper error handling"
        )

    def test_minedu_sync_grade(self):
        """Test syncing grade to MINEDU"""
        timestamp = datetime.now().strftime('%H%M%S')
        
        # Use query parameters as expected by the endpoint
        endpoint = f"minedu/grades/sync?student_id=test_student_{timestamp}&course_id=test_course_{timestamp}&period_id=2024-I"
        
        success, data = self.make_request('POST', endpoint, {}, token=self.admin_token, expected_status=404)  # Expect 404 for non-existent grade
        
        # Success here means we got proper error handling for non-existent grade
        return self.log_test(
            "MINEDU Sync Grade", 
            success,
            "- Endpoint accessible, proper error handling"
        )

    # ====================================================================================================
    # SECURITY & COMPLIANCE MODULE TESTING
    # ====================================================================================================

    def test_security_compliance_module(self):
        """Test Security & Compliance Module endpoints"""
        print("\n🔒 Testing Security & Compliance Module...")
        
        if not self.admin_token:
            print("❌ No admin token available for Security testing")
            return
        
        # 1. Test GET /api/security/rbac/test (RBAC denial tests)
        self.test_rbac_denial_tests()
        
        # 2. Test POST /api/security/secrets/rotate (secret rotation)
        self.test_secret_rotation()
        
        # 3. Test GET /api/security/audit-logs (audit logs)
        self.test_get_audit_logs()
        
        # 4. Test GET /api/security/compliance/report (compliance report)
        self.test_compliance_report()

    def test_rbac_denial_tests(self):
        """Test RBAC denial validation"""
        success, data = self.make_request('GET', 'security/rbac/test', token=self.admin_token)
        
        has_test_results = success and 'total_tests' in data and 'results' in data
        if has_test_results:
            total_tests = data.get('total_tests', 0)
            passed_tests = data.get('passed_tests', 0)
            success_rate = data.get('success_rate', 0)
            
            self.created_resources['security_tests'].append({
                'type': 'RBAC_DENIAL',
                'total_tests': total_tests,
                'passed_tests': passed_tests,
                'success_rate': success_rate
            })
            
            return self.log_test(
                "RBAC Denial Tests", 
                has_test_results,
                f"- {passed_tests}/{total_tests} passed ({success_rate:.1f}%)"
            )
        else:
            return self.log_test(
                "RBAC Denial Tests", 
                False,
                f"- Error: {data}"
            )

    def test_secret_rotation(self):
        """Test secret rotation functionality"""
        rotation_data = {
            "secret_type": "jwt",
            "force_rotation": False
        }

        success, data = self.make_request('POST', 'security/secrets/rotate', rotation_data, token=self.admin_token)
        
        return self.log_test(
            "Secret Rotation", 
            success,
            f"- Type: jwt, Version: {data.get('new_version', 'N/A')}" if success else f"- Error: {data}"
        )

    def test_get_audit_logs(self):
        """Test getting audit logs"""
        success, data = self.make_request('GET', 'security/audit-logs?limit=10', token=self.admin_token)
        
        logs_count = len(data) if success and isinstance(data, list) else 0
        return self.log_test(
            "Get Audit Logs", 
            success,
            f"- Found {logs_count} audit log entries"
        )

    def test_compliance_report(self):
        """Test generating compliance report"""
        success, data = self.make_request('GET', 'security/compliance/report', token=self.admin_token)
        
        has_report_data = success and any(key in data for key in ['rbac_compliance', 'secret_rotation_status', 'vulnerability_scan'])
        return self.log_test(
            "Compliance Report", 
            has_report_data,
            f"- RBAC Compliance: {data.get('rbac_compliance', 'N/A')}%" if success else f"- Error: {data}"
        )

    # ====================================================================================================
    # ACADEMIC REPORTS MODULE TESTING
    # ====================================================================================================

    def test_academic_reports_module(self):
        """Test Academic Reports Module endpoints"""
        print("\n📊 Testing Academic Reports Module...")
        
        if not self.admin_token:
            print("❌ No admin token available for Reports testing")
            return
        
        # 1. Test POST /api/reports/student-history (student history report)
        self.test_student_history_report()
        
        # 2. Test POST /api/reports/course-outcomes (course outcomes report)
        self.test_course_outcomes_report()
        
        # 3. Test GET /api/reports/consistency-check (consistency check)
        self.test_consistency_check()
        
        # 4. Test GET /api/reports/dashboard/analytics (academic analytics)
        self.test_academic_analytics()

    def test_student_history_report(self):
        """Test generating student history report"""
        timestamp = datetime.now().strftime('%H%M%S')
        report_data = {
            "student_id": f"test_student_{timestamp}",
            "include_periods": ["2024-I", "2024-II"],
            "format_type": "PDF"
        }

        success, data = self.make_request('POST', 'reports/student-history', report_data, token=self.admin_token, expected_status=404)  # Expect 404 for non-existent student
        
        # Success here means we got proper error handling for non-existent student
        return self.log_test(
            "Student History Report", 
            success,
            "- Endpoint accessible, proper error handling for non-existent student"
        )

    def test_course_outcomes_report(self):
        """Test generating course outcomes report"""
        timestamp = datetime.now().strftime('%H%M%S')
        report_data = {
            "course_id": f"test_course_{timestamp}",
            "period_id": "2024-I",
            "format_type": "PDF"
        }

        success, data = self.make_request('POST', 'reports/course-outcomes', report_data, token=self.admin_token, expected_status=404)  # Expect 404 for non-existent course
        
        # Success here means we got proper error handling for non-existent course
        return self.log_test(
            "Course Outcomes Report", 
            success,
            "- Endpoint accessible, proper error handling for non-existent course"
        )

    def test_consistency_check(self):
        """Test academic consistency check"""
        success, data = self.make_request('GET', 'reports/consistency-check', token=self.admin_token)
        
        has_consistency_data = success and 'total_anomalies' in data and 'consistency_score' in data
        return self.log_test(
            "Consistency Check", 
            has_consistency_data,
            f"- Anomalies: {data.get('total_anomalies', 'N/A')}, Score: {data.get('consistency_score', 'N/A')}" if success else f"- Error: {data}"
        )

    def test_academic_analytics(self):
        """Test academic dashboard analytics"""
        success, data = self.make_request('GET', 'reports/dashboard/analytics', token=self.admin_token)
        
        has_analytics_data = success and 'overview' in data
        if has_analytics_data:
            overview = data.get('overview', {})
            total_students = overview.get('total_students', 0)
            total_courses = overview.get('total_courses', 0)
            approval_rate = overview.get('approval_rate', 0)
            
            return self.log_test(
                "Academic Analytics", 
                has_analytics_data,
                f"- Students: {total_students}, Courses: {total_courses}, Approval: {approval_rate}%"
            )
        else:
            return self.log_test(
                "Academic Analytics", 
                False,
                f"- Error: {data}"
            )

    # ====================================================================================================
    # COMPREHENSIVE TEST SCENARIOS
    # ====================================================================================================

    def test_comprehensive_scenarios(self):
        """Test comprehensive scenarios as requested"""
        print("\n🎯 Testing Comprehensive Scenarios...")
        
        # Create MINEDU events for enrollment/grade/certificate
        self.test_create_minedu_enrollment_event()
        self.test_create_minedu_grade_event()
        self.test_create_minedu_certificate_event()
        
        # Execute RBAC denial tests for security validation
        self.test_rbac_comprehensive_validation()
        
        # Generate student and course reports
        self.test_generate_comprehensive_reports()
        
        # Check consistency and analytics
        self.test_check_system_consistency()

    def test_create_minedu_enrollment_event(self):
        """Create MINEDU event for enrollment"""
        timestamp = datetime.now().strftime('%H%M%S')
        event_data = {
            "entity_type": "ENROLLMENT",
            "entity_id": f"enrollment_{timestamp}",
            "period_id": "2024-I",
            "payload": {
                "student_id": f"student_{timestamp}",
                "course_id": f"course_{timestamp}",
                "enrollment_date": datetime.now().isoformat(),
                "status": "ACTIVE",
                "credits": 4
            },
            "version": 1
        }

        success, data = self.make_request('POST', 'minedu/events', event_data, token=self.admin_token)
        
        return self.log_test(
            "Create MINEDU Enrollment Event", 
            success,
            f"- Event ID: {data.get('event_id', 'N/A')}" if success else f"- Error: {data}"
        )

    def test_create_minedu_grade_event(self):
        """Create MINEDU event for grade"""
        timestamp = datetime.now().strftime('%H%M%S')
        event_data = {
            "entity_type": "GRADE",
            "entity_id": f"grade_{timestamp}",
            "period_id": "2024-I",
            "payload": {
                "student_id": f"student_{timestamp}",
                "course_id": f"course_{timestamp}",
                "numerical_grade": 16.5,
                "literal_grade": "A",
                "status": "APPROVED",
                "evaluation_date": datetime.now().isoformat()
            },
            "version": 1
        }

        success, data = self.make_request('POST', 'minedu/events', event_data, token=self.admin_token)
        
        return self.log_test(
            "Create MINEDU Grade Event", 
            success,
            f"- Event ID: {data.get('event_id', 'N/A')}" if success else f"- Error: {data}"
        )

    def test_create_minedu_certificate_event(self):
        """Create MINEDU event for certificate"""
        timestamp = datetime.now().strftime('%H%M%S')
        event_data = {
            "entity_type": "CERTIFICATE",
            "entity_id": f"certificate_{timestamp}",
            "period_id": "2024-I",
            "payload": {
                "student_id": f"student_{timestamp}",
                "certificate_type": "COMPLETION",
                "issue_date": datetime.now().isoformat(),
                "status": "ISSUED"
            },
            "version": 1
        }

        success, data = self.make_request('POST', 'minedu/events', event_data, token=self.admin_token)
        
        return self.log_test(
            "Create MINEDU Certificate Event", 
            success,
            f"- Event ID: {data.get('event_id', 'N/A')}" if success else f"- Error: {data}"
        )

    def test_rbac_comprehensive_validation(self):
        """Execute comprehensive RBAC validation"""
        print("\n🔐 Executing RBAC Comprehensive Validation...")
        
        # Test with different user roles if available
        test_scenarios = [
            {"role": "STUDENT", "token": self.student_token, "should_deny": ["minedu/events", "security/rbac/test"]},
            {"role": "TEACHER", "token": self.teacher_token, "should_deny": ["minedu/reprocess", "security/secrets/rotate"]},
        ]
        
        for scenario in test_scenarios:
            if scenario["token"]:
                for endpoint in scenario["should_deny"]:
                    success, data = self.make_request('GET', endpoint, token=scenario["token"], expected_status=403)
                    self.log_test(
                        f"RBAC Deny {scenario['role']} -> {endpoint}", 
                        success,
                        "- Access properly denied"
                    )

    def test_generate_comprehensive_reports(self):
        """Generate comprehensive reports"""
        print("\n📊 Generating Comprehensive Reports...")
        
        # Test analytics endpoint
        success, data = self.make_request('GET', 'reports/dashboard/analytics?period_id=2024-I', token=self.admin_token)
        
        self.log_test(
            "Generate Analytics Report", 
            success,
            f"- Period: 2024-I" if success else f"- Error: {data}"
        )

    def test_check_system_consistency(self):
        """Check system consistency and analytics"""
        print("\n🔍 Checking System Consistency...")
        
        # Run consistency check
        success, data = self.make_request('GET', 'reports/consistency-check?period_id=2024-I', token=self.admin_token)
        
        if success:
            anomalies = data.get('total_anomalies', 0)
            score = data.get('consistency_score', 0)
            
            self.log_test(
                "System Consistency Check", 
                True,
                f"- Anomalies: {anomalies}, Consistency Score: {score}%"
            )
        else:
            self.log_test(
                "System Consistency Check", 
                False,
                f"- Error: {data}"
            )

    def run_comprehensive_test(self):
        """Run all new module tests"""
        print("🚀 Starting PRIORITY TESTING - MINEDU Integration, Security & Academic Reports")
        print("🎯 TARGET: Test ALL new implementations with admin@universidad.edu credentials")
        print("=" * 80)
        
        # 1. Authentication
        if not self.authenticate_users():
            return False
        
        # 2. MINEDU Integration Module
        self.test_minedu_integration_module()
        
        # 3. Security & Compliance Module
        self.test_security_compliance_module()
        
        # 4. Academic Reports Module
        self.test_academic_reports_module()
        
        # 5. Comprehensive Scenarios
        self.test_comprehensive_scenarios()
        
        # 6. Final Results
        print("\n" + "=" * 80)
        print(f"📊 NEW MODULES TEST RESULTS")
        print("=" * 80)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        success_rate = (self.tests_passed/self.tests_run)*100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        # Summary by module
        print(f"\n📋 MODULE SUMMARY:")
        print(f"🎓 MINEDU Integration: Tested 8 endpoints")
        print(f"🔒 Security & Compliance: Tested 4 endpoints") 
        print(f"📊 Academic Reports: Tested 4 endpoints")
        print(f"🎯 Comprehensive Scenarios: Tested integration workflows")
        
        if success_rate >= 80:
            print("🎉 NEW MODULES TESTING SUCCESSFUL!")
        else:
            print("⚠️  NEW MODULES NEED ATTENTION")
        
        return success_rate >= 80

if __name__ == "__main__":
    tester = NewModulesTester()
    success = tester.run_comprehensive_test()
    sys.exit(0 if success else 1)