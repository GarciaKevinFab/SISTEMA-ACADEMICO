#!/usr/bin/env python3
"""
Quick Performance Validation Test
Focus on critical metrics: P95 latency, RBAC security, basic performance
"""

import requests
import time
import statistics
from datetime import datetime

class QuickPerformanceTester:
    def __init__(self, base_url="https://academic-admin-sys-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.teacher_token = None
        self.student_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.response_times = []
        self.error_5xx_count = 0
        
    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def make_request(self, method: str, endpoint: str, data=None, token=None, expected_status=200):
        """Make HTTP request with performance tracking"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        start_time = time.time()
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=15)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=15)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            response_time = time.time() - start_time
            self.response_times.append(response_time)
            
            if 500 <= response.status_code < 600:
                self.error_5xx_count += 1
            
            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except Exception as e:
            response_time = time.time() - start_time
            self.response_times.append(response_time)
            return False, {"error": str(e)}

    def authenticate_users(self):
        """Authenticate test users"""
        print("🔐 Authenticating users...")
        
        credentials = [
            ("admin", "password123"),
            ("teacher1", "password123"),
            ("student1", "password123")
        ]
        
        tokens = []
        for username, password in credentials:
            login_data = {"username": username, "password": password}
            success, data = self.make_request('POST', 'auth/login', login_data)
            
            if success and 'access_token' in data:
                token = data['access_token']
                role = data.get('user', {}).get('role')
                
                if username == "admin":
                    self.admin_token = token
                elif username == "teacher1":
                    self.teacher_token = token
                elif username == "student1":
                    self.student_token = token
                    
                tokens.append(token)
                self.log_test(f"Authenticate {username}", True, f"- Role: {role}")
            else:
                self.log_test(f"Authenticate {username}", False, f"- Error: {data}")
                
        return len(tokens) >= 2  # Need at least 2 tokens

    def test_dashboard_performance(self):
        """Test dashboard performance with multiple requests"""
        print("\n📊 Testing Dashboard Performance...")
        
        if not self.admin_token:
            return False
            
        # Test 10 dashboard requests to measure performance
        dashboard_times = []
        
        for i in range(10):
            start_time = time.time()
            success, data = self.make_request('GET', 'dashboard/stats', token=self.admin_token)
            response_time = time.time() - start_time
            dashboard_times.append(response_time)
            
            if not success:
                self.log_test(f"Dashboard Request {i+1}", False, f"- Error: {data}")
                return False
                
        # Calculate P95 latency
        sorted_times = sorted(dashboard_times)
        p95_index = int(0.95 * len(sorted_times))
        p95_latency = sorted_times[p95_index] if p95_index < len(sorted_times) else sorted_times[-1]
        avg_latency = statistics.mean(dashboard_times)
        
        # Target: P95 < 1.5s
        performance_ok = p95_latency < 1.5
        
        self.log_test("Dashboard Performance", performance_ok,
                     f"- P95: {p95_latency:.3f}s, Avg: {avg_latency:.3f}s (target P95 < 1.5s)")
        
        return performance_ok

    def test_rbac_security(self):
        """Test RBAC security with key endpoints"""
        print("\n🔐 Testing RBAC Security...")
        
        rbac_tests = [
            # (endpoint, method, data, token, role, should_succeed)
            ('students', 'GET', None, self.admin_token, 'ADMIN', True),
            ('students', 'GET', None, self.teacher_token, 'TEACHER', True),
            ('students', 'GET', None, self.student_token, 'STUDENT', False),  # Students can't list all students
            ('courses', 'POST', {'code': 'TEST', 'name': 'Test', 'credits': 3, 'semester': 1, 'program': 'Test'}, 
             self.admin_token, 'ADMIN', True),
            ('courses', 'POST', {'code': 'TEST2', 'name': 'Test2', 'credits': 3, 'semester': 1, 'program': 'Test'}, 
             self.teacher_token, 'TEACHER', False),  # Teachers can't create courses
        ]
        
        rbac_results = []
        
        for endpoint, method, data, token, role, should_succeed in rbac_tests:
            if not token:
                continue
                
            expected_status = 200 if should_succeed else 403
            success, response_data = self.make_request(method, endpoint, data, token, expected_status)
            
            rbac_results.append(success)
            status_text = "ALLOWED" if should_succeed else "DENIED"
            
            self.log_test(f"RBAC {role} {method} {endpoint}", success, f"- {status_text}")
        
        # Calculate RBAC success rate
        rbac_success_rate = (sum(rbac_results) / len(rbac_results)) * 100 if rbac_results else 0
        rbac_ok = rbac_success_rate >= 80  # 80% threshold
        
        self.log_test("RBAC Security Overall", rbac_ok, f"- Success rate: {rbac_success_rate:.1f}%")
        
        return rbac_ok

    def test_load_capacity(self):
        """Test basic load capacity"""
        print("\n🚀 Testing Load Capacity...")
        
        if not self.admin_token:
            return False
            
        # Test 50 concurrent requests to health endpoint
        import threading
        
        results = []
        
        def make_load_request():
            start_time = time.time()
            success, data = self.make_request('GET', 'health')
            response_time = time.time() - start_time
            results.append({'success': success, 'time': response_time})
        
        # Create and start threads
        threads = []
        start_time = time.time()
        
        for i in range(50):
            thread = threading.Thread(target=make_load_request)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
            
        total_time = time.time() - start_time
        
        # Calculate metrics
        successful_requests = sum(1 for r in results if r['success'])
        success_rate = (successful_requests / len(results)) * 100
        requests_per_second = len(results) / total_time
        
        # Target: Handle requests efficiently
        load_ok = success_rate >= 95 and requests_per_second >= 10
        
        self.log_test("Load Capacity", load_ok,
                     f"- {successful_requests}/50 successful ({success_rate:.1f}%), {requests_per_second:.1f} req/s")
        
        return load_ok

    def run_quick_test(self):
        """Run quick performance validation"""
        print("🚀 QUICK PERFORMANCE VALIDATION - HARDENING TEST")
        print("🎯 TARGETS: P95 < 1.5s, RBAC ≥ 80%, Load capacity ≥ 10 req/s")
        print("=" * 60)
        
        # Health check
        success, data = self.make_request('GET', 'health')
        if not success:
            print("❌ Health check failed. Backend not responding.")
            return False
            
        self.log_test("Health Check", True, "- Backend responding")
        
        # Authentication
        if not self.authenticate_users():
            print("❌ Authentication failed.")
            return False
        
        # Performance tests
        dashboard_ok = self.test_dashboard_performance()
        rbac_ok = self.test_rbac_security()
        load_ok = self.test_load_capacity()
        
        # Calculate overall metrics
        if self.response_times:
            sorted_times = sorted(self.response_times)
            p95_index = int(0.95 * len(sorted_times))
            overall_p95 = sorted_times[p95_index] if p95_index < len(sorted_times) else sorted_times[-1]
            avg_response = statistics.mean(self.response_times)
        else:
            overall_p95 = 0
            avg_response = 0
        
        # Results
        print("\n" + "=" * 60)
        print("📊 QUICK PERFORMANCE TEST RESULTS")
        print("=" * 60)
        
        print(f"\n🎯 CRITICAL METRICS:")
        print(f"   Overall P95 Latency: {overall_p95:.3f}s (Target: < 1.5s) {'✅' if overall_p95 < 1.5 else '❌'}")
        print(f"   Average Response: {avg_response:.3f}s")
        print(f"   Total Requests: {len(self.response_times)}")
        print(f"   5xx Errors: {self.error_5xx_count} (Target: 0) {'✅' if self.error_5xx_count == 0 else '❌'}")
        
        print(f"\n📈 TEST SUMMARY:")
        print(f"   Tests Passed: {self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed/self.tests_run)*100 if self.tests_run > 0 else 0
        print(f"   Success Rate: {success_rate:.1f}%")
        
        # Critical targets
        critical_ok = (
            overall_p95 < 1.5 and
            self.error_5xx_count == 0 and
            dashboard_ok and
            rbac_ok and
            load_ok
        )
        
        print(f"\n🎯 PRODUCTION READINESS:")
        if critical_ok:
            print("🎉 PERFORMANCE TARGETS MET!")
            print("✅ P95 latency < 1.5s")
            print("✅ Zero 5xx errors")
            print("✅ Dashboard performance OK")
            print("✅ RBAC security working")
            print("✅ Load capacity adequate")
        else:
            print("❌ PERFORMANCE TARGETS NOT MET")
            if overall_p95 >= 1.5:
                print(f"❌ P95 latency {overall_p95:.3f}s exceeds 1.5s")
            if self.error_5xx_count > 0:
                print(f"❌ {self.error_5xx_count} 5xx errors detected")
            if not dashboard_ok:
                print("❌ Dashboard performance issues")
            if not rbac_ok:
                print("❌ RBAC security issues")
            if not load_ok:
                print("❌ Load capacity issues")
        
        return critical_ok

if __name__ == "__main__":
    tester = QuickPerformanceTester()
    success = tester.run_quick_test()
    exit(0 if success else 1)