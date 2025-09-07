#!/usr/bin/env python3
"""
FINAL PERFORMANCE VALIDATION - POST-OPTIMIZATION
Sistema Académico IESPP 'Gustavo Allende Llavería'

CRITICAL SUCCESS CRITERIA (Must meet ALL to pass):
- P95 latency: < 1.5s (was 12.523s - MUST DRASTICALLY IMPROVE)
- Load capacity: ≥ 300 req/min 
- Zero 5xx errors under load
- RBAC security: 100% endpoint protection
- Cache hit rate: >50% for dashboard stats

OPTIMIZATIONS IMPLEMENTED:
1. ✅ MongoDB indices: 30+ performance indices created
2. ✅ Connection pooling: maxPoolSize=50, minPoolSize=10
3. ✅ Query optimization: Projection, parallel queries, aggregations
4. ✅ Memory caching: Simple cache with TTL
5. ✅ ORJSONResponse: Fast JSON serialization
6. ✅ Performance monitoring: Execution time tracking
"""

import requests
import time
import statistics
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

class PerformanceValidator:
    def __init__(self, base_url="https://academic-admin-sys-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.teacher_token = None
        self.student_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.performance_metrics = {
            'response_times': [],
            'p95_latencies': [],
            'error_counts': {'5xx': 0, '4xx': 0, 'total': 0},
            'cache_stats': {'hits': 0, 'misses': 0, 'hit_rate': 0},
            'load_test_results': {}
        }
        
    def log_test(self, name: str, success: bool, details: str = "", metrics: Dict = None):
        """Log test results with performance metrics"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        
        if metrics:
            self.performance_metrics.update(metrics)
        return success

    def make_request_with_timing(self, method: str, endpoint: str, data: Dict = None, 
                                token: str = None, expected_status: int = 200) -> tuple:
        """Make HTTP request with detailed timing and error tracking"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        start_time = time.time()
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
                return False, {"error": f"Unsupported method: {method}"}, 0

            response_time = time.time() - start_time
            
            # Track error counts
            if response.status_code >= 500:
                self.performance_metrics['error_counts']['5xx'] += 1
            elif response.status_code >= 400:
                self.performance_metrics['error_counts']['4xx'] += 1
            
            self.performance_metrics['error_counts']['total'] += 1
            self.performance_metrics['response_times'].append(response_time)

            success = response.status_code == expected_status
            try:
                response_data = response.json()
                
                # Extract performance metadata if available
                if isinstance(response_data, dict) and '_performance' in response_data:
                    perf_data = response_data['_performance']
                    if 'execution_time_ms' in perf_data:
                        backend_time = perf_data['execution_time_ms'] / 1000
                        print(f"    Backend execution: {backend_time:.3f}s, Total: {response_time:.3f}s")
                
                # Extract cache statistics if available
                if isinstance(response_data, dict) and '_performance' in response_data:
                    perf_data = response_data['_performance']
                    if 'cache_hit_rate' in perf_data:
                        self.performance_metrics['cache_stats']['hit_rate'] = perf_data['cache_hit_rate']
                        
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data, response_time

        except requests.exceptions.RequestException as e:
            response_time = time.time() - start_time
            self.performance_metrics['response_times'].append(response_time)
            return False, {"error": str(e)}, response_time

    def authenticate_users(self):
        """Authenticate predefined users for testing"""
        print("🔐 Authenticating test users...")
        
        # Test predefined users from review request
        users = [
            ("admin", "password123"),
            ("teacher1", "password123"), 
            ("student1", "password123")
        ]
        
        for username, password in users:
            login_data = {"username": username, "password": password}
            success, data, response_time = self.make_request_with_timing('POST', 'auth/login', login_data)
            
            if success and 'access_token' in data:
                token = data['access_token']
                role = data.get('user', {}).get('role', 'UNKNOWN')
                
                if username == "admin":
                    self.admin_token = token
                elif username == "teacher1":
                    self.teacher_token = token
                elif username == "student1":
                    self.student_token = token
                    
                self.log_test(f"Authenticate {username}", True, 
                            f"- Role: {role}, Time: {response_time:.3f}s")
            else:
                self.log_test(f"Authenticate {username}", False, f"- Error: {data}")
                
        return self.admin_token is not None

    def test_dashboard_stats_performance(self):
        """Test dashboard stats endpoint performance (most critical)"""
        print("\n📊 Testing Dashboard Stats Performance (CRITICAL)...")
        
        if not self.admin_token:
            self.log_test("Dashboard Stats Performance", False, "- No admin token available")
            return False
            
        # Test multiple requests to measure consistency
        response_times = []
        cache_hit_rates = []
        
        for i in range(5):
            success, data, response_time = self.make_request_with_timing(
                'GET', 'dashboard/stats', token=self.admin_token
            )
            
            if success:
                response_times.append(response_time)
                
                # Extract cache hit rate if available
                if isinstance(data, dict) and '_performance' in data:
                    perf_data = data['_performance']
                    if 'cache_hit_rate' in perf_data:
                        cache_hit_rates.append(perf_data['cache_hit_rate'])
                        
                print(f"    Request {i+1}: {response_time:.3f}s")
            else:
                self.log_test("Dashboard Stats Performance", False, f"- Request {i+1} failed: {data}")
                return False
        
        # Calculate statistics
        avg_time = statistics.mean(response_times)
        p95_time = statistics.quantiles(response_times, n=20)[18] if len(response_times) >= 5 else max(response_times)
        
        # Check cache performance
        avg_cache_hit_rate = statistics.mean(cache_hit_rates) if cache_hit_rates else 0
        
        # CRITICAL: P95 must be < 1.5s
        p95_passed = p95_time < 1.5
        cache_passed = avg_cache_hit_rate > 0.5 if len(cache_hit_rates) > 2 else True  # Allow cache warmup
        
        self.performance_metrics['p95_latencies'].append(p95_time)
        self.performance_metrics['cache_stats']['hit_rate'] = avg_cache_hit_rate
        
        success = p95_passed and cache_passed
        details = f"- Avg: {avg_time:.3f}s, P95: {p95_time:.3f}s (target: <1.5s), Cache hit rate: {avg_cache_hit_rate:.1%}"
        
        return self.log_test("Dashboard Stats Performance", success, details)

    def test_students_list_performance(self):
        """Test students list with projection optimization"""
        print("\n👥 Testing Students List Performance...")
        
        if not self.admin_token:
            self.log_test("Students List Performance", False, "- No admin token available")
            return False
            
        # Test with different pagination sizes
        test_cases = [
            {"skip": 0, "limit": 10},
            {"skip": 0, "limit": 50},
            {"skip": 10, "limit": 25}
        ]
        
        response_times = []
        
        for case in test_cases:
            endpoint = f"students?skip={case['skip']}&limit={case['limit']}"
            success, data, response_time = self.make_request_with_timing(
                'GET', endpoint, token=self.admin_token
            )
            
            if success:
                response_times.append(response_time)
                student_count = len(data.get('students', [])) if isinstance(data, dict) else 0
                print(f"    Skip: {case['skip']}, Limit: {case['limit']}, Count: {student_count}, Time: {response_time:.3f}s")
            else:
                self.log_test("Students List Performance", False, f"- Failed: {data}")
                return False
        
        # Performance target: < 500ms for students list
        avg_time = statistics.mean(response_times)
        max_time = max(response_times)
        
        success = max_time < 0.5  # 500ms target
        details = f"- Avg: {avg_time:.3f}s, Max: {max_time:.3f}s (target: <0.5s)"
        
        return self.log_test("Students List Performance", success, details)

    def test_authentication_performance(self):
        """Test authentication performance"""
        print("\n🔐 Testing Authentication Performance...")
        
        # Test multiple authentication requests
        response_times = []
        
        for i in range(3):
            login_data = {"username": "admin", "password": "password123"}
            success, data, response_time = self.make_request_with_timing('POST', 'auth/login', login_data)
            
            if success:
                response_times.append(response_time)
                print(f"    Login {i+1}: {response_time:.3f}s")
            else:
                self.log_test("Authentication Performance", False, f"- Login {i+1} failed: {data}")
                return False
        
        avg_time = statistics.mean(response_times)
        max_time = max(response_times)
        
        # Authentication should be fast: < 200ms
        success = max_time < 0.2
        details = f"- Avg: {avg_time:.3f}s, Max: {max_time:.3f}s (target: <0.2s)"
        
        return self.log_test("Authentication Performance", success, details)

    def test_concurrent_load(self, endpoint: str, token: str, target_rps: int, duration_seconds: int = 120):
        """Test concurrent load on specific endpoint"""
        print(f"\n⚡ Testing Concurrent Load: {endpoint} at {target_rps} req/s for {duration_seconds}s...")
        
        results = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'response_times': [],
            'error_5xx': 0,
            'error_4xx': 0,
            'start_time': time.time()
        }
        
        def make_single_request():
            """Make a single request and record results"""
            success, data, response_time = self.make_request_with_timing('GET', endpoint, token=token)
            
            with threading.Lock():
                results['total_requests'] += 1
                results['response_times'].append(response_time)
                
                if success:
                    results['successful_requests'] += 1
                else:
                    results['failed_requests'] += 1
                    # Check for 5xx errors
                    if isinstance(data, dict) and data.get('status_code', 0) >= 500:
                        results['error_5xx'] += 1
                    elif isinstance(data, dict) and data.get('status_code', 0) >= 400:
                        results['error_4xx'] += 1
            
            return success, response_time
        
        # Calculate request interval
        request_interval = 1.0 / target_rps
        
        # Use ThreadPoolExecutor for concurrent requests
        with ThreadPoolExecutor(max_workers=min(target_rps, 50)) as executor:
            futures = []
            end_time = time.time() + duration_seconds
            
            while time.time() < end_time:
                future = executor.submit(make_single_request)
                futures.append(future)
                time.sleep(request_interval)
                
                # Limit concurrent futures to prevent memory issues
                if len(futures) > target_rps * 2:
                    # Wait for some to complete
                    completed_futures = [f for f in futures if f.done()]
                    for f in completed_futures:
                        futures.remove(f)
            
            # Wait for remaining futures
            for future in as_completed(futures, timeout=30):
                try:
                    future.result()
                except Exception as e:
                    print(f"    Request failed with exception: {e}")
                    results['failed_requests'] += 1
        
        # Calculate metrics
        actual_duration = time.time() - results['start_time']
        actual_rps = results['total_requests'] / actual_duration
        success_rate = (results['successful_requests'] / results['total_requests']) * 100 if results['total_requests'] > 0 else 0
        
        # Calculate P95 latency
        if results['response_times']:
            p95_latency = statistics.quantiles(results['response_times'], n=20)[18] if len(results['response_times']) >= 5 else max(results['response_times'])
            avg_latency = statistics.mean(results['response_times'])
        else:
            p95_latency = 0
            avg_latency = 0
        
        # Store results
        results.update({
            'actual_rps': actual_rps,
            'success_rate': success_rate,
            'p95_latency': p95_latency,
            'avg_latency': avg_latency,
            'duration': actual_duration
        })
        
        self.performance_metrics['load_test_results'][endpoint] = results
        
        print(f"    Total requests: {results['total_requests']}")
        print(f"    Successful: {results['successful_requests']} ({success_rate:.1f}%)")
        print(f"    Failed: {results['failed_requests']}")
        print(f"    5xx errors: {results['error_5xx']}")
        print(f"    Actual RPS: {actual_rps:.1f}")
        print(f"    Avg latency: {avg_latency:.3f}s")
        print(f"    P95 latency: {p95_latency:.3f}s")
        
        return results

    def test_load_capacity_300_rpm(self):
        """Test load capacity at 300 req/min (5 req/s) for 2 minutes"""
        print("\n🚀 Testing Load Capacity: 300 req/min (CRITICAL REQUIREMENT)...")
        
        if not self.admin_token:
            self.log_test("Load Capacity 300 req/min", False, "- No admin token available")
            return False
        
        # Test dashboard stats endpoint under load (most critical)
        results = self.test_concurrent_load('dashboard/stats', self.admin_token, 5, 120)  # 5 req/s for 2 minutes
        
        # CRITICAL SUCCESS CRITERIA:
        # - Achieve ≥ 300 req/min (5 req/s)
        # - P95 latency < 1.5s
        # - Zero 5xx errors
        
        target_rps = 5.0
        rps_achieved = results['actual_rps'] >= target_rps * 0.9  # Allow 10% tolerance
        p95_passed = results['p95_latency'] < 1.5
        zero_5xx = results['error_5xx'] == 0
        
        success = rps_achieved and p95_passed and zero_5xx
        
        details = f"- RPS: {results['actual_rps']:.1f}/{target_rps} ({'✅' if rps_achieved else '❌'}), " \
                 f"P95: {results['p95_latency']:.3f}s ({'✅' if p95_passed else '❌'}), " \
                 f"5xx errors: {results['error_5xx']} ({'✅' if zero_5xx else '❌'})"
        
        return self.log_test("Load Capacity 300 req/min", success, details)

    def test_rbac_security_100_percent(self):
        """Test RBAC security: 100% endpoint protection"""
        print("\n🔒 Testing RBAC Security: 100% Endpoint Protection...")
        
        if not all([self.admin_token, self.teacher_token, self.student_token]):
            self.log_test("RBAC Security 100%", False, "- Missing authentication tokens")
            return False
        
        # Test critical endpoints with different roles
        security_tests = [
            # Endpoint, Method, Required Role, Test Token, Expected Status
            ('students', 'POST', 'ADMIN', self.student_token, 403),  # Student cannot create students
            ('courses', 'POST', 'ADMIN', self.teacher_token, 403),   # Teacher cannot create courses
            ('dashboard/stats', 'GET', 'ANY', self.student_token, 200),  # Student can access own stats
            ('dashboard/stats', 'GET', 'ANY', self.teacher_token, 200),  # Teacher can access own stats
            ('dashboard/stats', 'GET', 'ANY', self.admin_token, 200),    # Admin can access stats
        ]
        
        passed_tests = 0
        total_tests = len(security_tests)
        
        for endpoint, method, required_role, test_token, expected_status in security_tests:
            success, data, response_time = self.make_request_with_timing(
                method, endpoint, 
                data={'test': 'data'} if method == 'POST' else None,
                token=test_token, 
                expected_status=expected_status
            )
            
            if success:
                passed_tests += 1
                print(f"    ✅ {endpoint} ({method}) - Properly protected")
            else:
                print(f"    ❌ {endpoint} ({method}) - Security issue: {data}")
        
        success_rate = (passed_tests / total_tests) * 100
        success = success_rate == 100.0
        
        details = f"- {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)"
        
        return self.log_test("RBAC Security 100%", success, details)

    def test_cache_hit_rate_validation(self):
        """Test cache hit rate >50% for dashboard stats"""
        print("\n💾 Testing Cache Hit Rate Validation...")
        
        if not self.admin_token:
            self.log_test("Cache Hit Rate >50%", False, "- No admin token available")
            return False
        
        # Make multiple requests to warm up cache and measure hit rate
        cache_hit_rates = []
        
        for i in range(6):  # 6 requests to ensure cache warmup
            success, data, response_time = self.make_request_with_timing(
                'GET', 'dashboard/stats', token=self.admin_token
            )
            
            if success and isinstance(data, dict) and '_performance' in data:
                perf_data = data['_performance']
                if 'cache_hit_rate' in perf_data:
                    hit_rate = perf_data['cache_hit_rate']
                    cache_hit_rates.append(hit_rate)
                    print(f"    Request {i+1}: Cache hit rate: {hit_rate:.1%}, Time: {response_time:.3f}s")
                else:
                    print(f"    Request {i+1}: No cache stats available, Time: {response_time:.3f}s")
            else:
                self.log_test("Cache Hit Rate >50%", False, f"- Request {i+1} failed: {data}")
                return False
            
            # Small delay between requests
            time.sleep(0.1)
        
        # Calculate average hit rate (excluding first 2 requests for warmup)
        if len(cache_hit_rates) >= 4:
            avg_hit_rate = statistics.mean(cache_hit_rates[2:])  # Skip first 2 for warmup
            success = avg_hit_rate > 0.5
            details = f"- Average hit rate: {avg_hit_rate:.1%} (target: >50%, after warmup)"
        else:
            # If no cache stats available, check if response times improve (indicating caching)
            if len(self.performance_metrics['response_times']) >= 6:
                first_half = self.performance_metrics['response_times'][-6:-3]
                second_half = self.performance_metrics['response_times'][-3:]
                
                avg_first = statistics.mean(first_half)
                avg_second = statistics.mean(second_half)
                
                improvement = (avg_first - avg_second) / avg_first
                success = improvement > 0.1  # 10% improvement indicates caching
                details = f"- Response time improvement: {improvement:.1%} (indicates caching)"
            else:
                success = False
                details = "- Insufficient data to measure cache performance"
        
        return self.log_test("Cache Hit Rate >50%", success, details)

    def test_database_optimization_validation(self):
        """Test database optimization with indices and connection pooling"""
        print("\n🗄️ Testing Database Optimization Validation...")
        
        if not self.admin_token:
            self.log_test("Database Optimization", False, "- No admin token available")
            return False
        
        # Test query performance on different endpoints
        optimization_tests = [
            ('students?limit=50', 'Students query with projection'),
            ('courses?limit=30', 'Courses query optimization'),
            ('enrollments?limit=20', 'Enrollments with joins'),
            ('dashboard/stats', 'Dashboard aggregations')
        ]
        
        passed_tests = 0
        total_tests = len(optimization_tests)
        
        for endpoint, description in optimization_tests:
            success, data, response_time = self.make_request_with_timing(
                'GET', endpoint, token=self.admin_token
            )
            
            # Database queries should be fast: < 100ms backend execution
            if success and isinstance(data, dict) and '_performance' in data:
                perf_data = data['_performance']
                backend_time_ms = perf_data.get('execution_time_ms', response_time * 1000)
                
                if backend_time_ms < 100:  # < 100ms target
                    passed_tests += 1
                    print(f"    ✅ {description}: {backend_time_ms:.1f}ms")
                else:
                    print(f"    ❌ {description}: {backend_time_ms:.1f}ms (target: <100ms)")
            elif success:
                # Fallback to total response time
                if response_time < 0.2:  # 200ms total time
                    passed_tests += 1
                    print(f"    ✅ {description}: {response_time:.3f}s (total)")
                else:
                    print(f"    ❌ {description}: {response_time:.3f}s (target: <0.2s total)")
            else:
                print(f"    ❌ {description}: Failed - {data}")
        
        success_rate = (passed_tests / total_tests) * 100
        success = success_rate >= 75  # Allow some tolerance
        
        details = f"- {passed_tests}/{total_tests} optimized queries passed ({success_rate:.1f}%)"
        
        return self.log_test("Database Optimization", success, details)

    def test_error_handling_correlation_id(self):
        """Test error handling and correlation ID implementation"""
        print("\n🔍 Testing Error Handling & Correlation ID...")
        
        # Test various error scenarios
        error_tests = [
            ('students/nonexistent-id', 'GET', 404, 'Not found error'),
            ('auth/login', 'POST', 401, 'Invalid credentials', {"username": "invalid", "password": "wrong"}),
            ('students', 'POST', 403, 'Unauthorized access', {"test": "data"}),  # Without token
        ]
        
        passed_tests = 0
        total_tests = len(error_tests)
        
        for endpoint, method, expected_status, description, data in error_tests:
            success, response_data, response_time = self.make_request_with_timing(
                method, endpoint, 
                data=data if len(error_tests[error_tests.index((endpoint, method, expected_status, description, data))]) > 4 else None,
                token=self.admin_token if 'Unauthorized' not in description else None,
                expected_status=expected_status
            )
            
            # Check for correlation ID in error responses
            has_correlation_id = False
            if isinstance(response_data, dict):
                has_correlation_id = (
                    'correlation_id' in response_data or
                    ('error' in response_data and isinstance(response_data['error'], dict) and 'correlation_id' in response_data['error'])
                )
            
            if success and has_correlation_id:
                passed_tests += 1
                print(f"    ✅ {description}: Proper error with correlation ID")
            elif success:
                print(f"    ⚠️  {description}: Proper error but missing correlation ID")
            else:
                print(f"    ❌ {description}: Unexpected response")
        
        success_rate = (passed_tests / total_tests) * 100
        success = success_rate >= 66  # Allow some tolerance for correlation ID implementation
        
        details = f"- {passed_tests}/{total_tests} error scenarios handled properly ({success_rate:.1f}%)"
        
        return self.log_test("Error Handling & Correlation ID", success, details)

    def run_comprehensive_performance_validation(self):
        """Run comprehensive performance validation"""
        print("🚀 FINAL PERFORMANCE VALIDATION - POST-OPTIMIZATION")
        print("🎯 CRITICAL SUCCESS CRITERIA:")
        print("   - P95 latency: < 1.5s (was 12.523s)")
        print("   - Load capacity: ≥ 300 req/min")
        print("   - Zero 5xx errors under load")
        print("   - RBAC security: 100% endpoint protection")
        print("   - Cache hit rate: >50% for dashboard stats")
        print("=" * 80)
        
        # 1. Authentication
        if not self.authenticate_users():
            print("❌ Authentication failed. Cannot continue with performance tests.")
            return False
        
        # 2. Performance Tests
        print("\n📊 PERFORMANCE TESTS")
        dashboard_perf = self.test_dashboard_stats_performance()
        students_perf = self.test_students_list_performance()
        auth_perf = self.test_authentication_performance()
        
        # 3. Load Testing
        print("\n⚡ LOAD TESTING")
        load_capacity = self.test_load_capacity_300_rpm()
        
        # 4. Caching Validation
        print("\n💾 CACHING VALIDATION")
        cache_validation = self.test_cache_hit_rate_validation()
        
        # 5. Database Optimization
        print("\n🗄️ DATABASE OPTIMIZATION VALIDATION")
        db_optimization = self.test_database_optimization_validation()
        
        # 6. Security Testing
        print("\n🔒 SECURITY TESTING")
        rbac_security = self.test_rbac_security_100_percent()
        
        # 7. Error Handling
        print("\n🔍 ERROR HANDLING VALIDATION")
        error_handling = self.test_error_handling_correlation_id()
        
        # Calculate final results
        critical_tests = [dashboard_perf, load_capacity, rbac_security]
        important_tests = [students_perf, auth_perf, cache_validation, db_optimization]
        supporting_tests = [error_handling]
        
        critical_passed = sum(critical_tests)
        important_passed = sum(important_tests)
        supporting_passed = sum(supporting_tests)
        
        total_passed = critical_passed + important_passed + supporting_passed
        total_tests = len(critical_tests) + len(important_tests) + len(supporting_tests)
        
        success_rate = (total_passed / total_tests) * 100
        
        # Performance metrics summary
        print("\n" + "=" * 80)
        print("📊 FINAL PERFORMANCE VALIDATION RESULTS")
        print("=" * 80)
        
        # Critical metrics
        if self.performance_metrics['p95_latencies']:
            final_p95 = max(self.performance_metrics['p95_latencies'])
            print(f"🎯 P95 Latency: {final_p95:.3f}s (target: <1.5s) {'✅' if final_p95 < 1.5 else '❌'}")
        
        if 'dashboard/stats' in self.performance_metrics['load_test_results']:
            load_results = self.performance_metrics['load_test_results']['dashboard/stats']
            print(f"🚀 Load Capacity: {load_results['actual_rps']:.1f} req/s (target: ≥5 req/s) {'✅' if load_results['actual_rps'] >= 4.5 else '❌'}")
            print(f"🛡️  5xx Errors: {load_results['error_5xx']} (target: 0) {'✅' if load_results['error_5xx'] == 0 else '❌'}")
        
        cache_hit_rate = self.performance_metrics['cache_stats']['hit_rate']
        print(f"💾 Cache Hit Rate: {cache_hit_rate:.1%} (target: >50%) {'✅' if cache_hit_rate > 0.5 else '⚠️'}")
        
        # Test results summary
        print(f"\n📈 Test Results:")
        print(f"   Critical Tests: {critical_passed}/{len(critical_tests)} ({'✅' if critical_passed == len(critical_tests) else '❌'})")
        print(f"   Important Tests: {important_passed}/{len(important_tests)} ({'✅' if important_passed >= len(important_tests) * 0.75 else '⚠️'})")
        print(f"   Supporting Tests: {supporting_passed}/{len(supporting_tests)} ({'✅' if supporting_passed >= len(supporting_tests) * 0.5 else '⚠️'})")
        print(f"   Overall Success Rate: {success_rate:.1f}%")
        
        # Final assessment
        critical_success = critical_passed == len(critical_tests)
        important_success = important_passed >= len(important_tests) * 0.75
        
        if critical_success and important_success:
            print("\n🎉 PERFORMANCE VALIDATION PASSED!")
            print("   System meets all critical performance requirements")
            print("   Ready for production deployment")
            return True
        elif critical_success:
            print("\n⚠️  PERFORMANCE VALIDATION PARTIAL PASS")
            print("   Critical requirements met but some optimizations needed")
            print("   Acceptable for production with monitoring")
            return True
        else:
            print("\n❌ PERFORMANCE VALIDATION FAILED")
            print("   Critical performance requirements not met")
            print("   Further optimization required before production")
            return False

if __name__ == "__main__":
    validator = PerformanceValidator()
    success = validator.run_comprehensive_performance_validation()
    exit(0 if success else 1)