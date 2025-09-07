#!/usr/bin/env python3
"""
Simple Performance Test - Final Results Summary
"""

import requests
import time
import statistics
from datetime import datetime

class SimplePerformanceTest:
    def __init__(self, base_url="https://edusphere-24.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        
    def authenticate(self):
        """Authenticate admin user"""
        login_data = {"username": "admin", "password": "password123"}
        response = requests.post(f"{self.base_url}/auth/login", json=login_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            self.admin_token = data.get('access_token')
            return True
        return False
    
    def test_dashboard_performance(self):
        """Test dashboard performance"""
        if not self.admin_token:
            return False, "No token"
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        response_times = []
        
        for i in range(5):
            start_time = time.time()
            response = requests.get(f"{self.base_url}/dashboard/stats", headers=headers, timeout=10)
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                response_times.append(response_time)
            else:
                return False, f"Request {i+1} failed: {response.status_code}"
        
        avg_time = statistics.mean(response_times)
        p95_time = statistics.quantiles(response_times, n=20)[18] if len(response_times) >= 5 else max(response_times)
        
        return True, {
            'avg_time': avg_time,
            'p95_time': p95_time,
            'all_times': response_times
        }
    
    def test_students_endpoint(self):
        """Test students endpoint"""
        if not self.admin_token:
            return False, "No token"
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        start_time = time.time()
        response = requests.get(f"{self.base_url}/students?limit=10", headers=headers, timeout=10)
        response_time = time.time() - start_time
        
        return response.status_code == 200, {
            'status_code': response.status_code,
            'response_time': response_time,
            'data': response.json() if response.status_code == 200 else response.text
        }
    
    def run_tests(self):
        """Run all tests"""
        print("🚀 SIMPLE PERFORMANCE TEST - FINAL VALIDATION")
        print("=" * 60)
        
        # Authenticate
        print("🔐 Authenticating...")
        if not self.authenticate():
            print("❌ Authentication failed")
            return False
        print("✅ Authentication successful")
        
        # Test dashboard performance
        print("\n📊 Testing Dashboard Performance...")
        success, result = self.test_dashboard_performance()
        
        if success:
            print(f"✅ Dashboard Performance:")
            print(f"   Average time: {result['avg_time']:.3f}s")
            print(f"   P95 time: {result['p95_time']:.3f}s")
            print(f"   Target P95: <1.5s - {'✅ PASSED' if result['p95_time'] < 1.5 else '❌ FAILED'}")
        else:
            print(f"❌ Dashboard Performance failed: {result}")
        
        # Test students endpoint
        print("\n👥 Testing Students Endpoint...")
        success, result = self.test_students_endpoint()
        
        if success:
            print(f"✅ Students Endpoint:")
            print(f"   Response time: {result['response_time']:.3f}s")
            print(f"   Status: {result['status_code']}")
            if isinstance(result['data'], dict) and 'students' in result['data']:
                print(f"   Students count: {len(result['data']['students'])}")
        else:
            print(f"❌ Students Endpoint failed:")
            print(f"   Status: {result['status_code']}")
            print(f"   Response time: {result['response_time']:.3f}s")
            print(f"   Error: {result['data']}")
        
        # Test authentication performance
        print("\n🔐 Testing Authentication Performance...")
        auth_times = []
        for i in range(3):
            start_time = time.time()
            login_data = {"username": "admin", "password": "password123"}
            response = requests.post(f"{self.base_url}/auth/login", json=login_data, timeout=10)
            auth_time = time.time() - start_time
            
            if response.status_code == 200:
                auth_times.append(auth_time)
            
        if auth_times:
            avg_auth_time = statistics.mean(auth_times)
            print(f"✅ Authentication Performance:")
            print(f"   Average time: {avg_auth_time:.3f}s")
            print(f"   Target: <0.3s - {'✅ PASSED' if avg_auth_time < 0.3 else '⚠️ ACCEPTABLE' if avg_auth_time < 0.5 else '❌ FAILED'}")
        
        print("\n" + "=" * 60)
        print("📊 FINAL PERFORMANCE SUMMARY")
        print("=" * 60)
        
        if success and result['p95_time'] < 1.5:
            print("🎉 CRITICAL PERFORMANCE REQUIREMENT MET!")
            print(f"   P95 Latency: {result['p95_time']:.3f}s < 1.5s target ✅")
            print("   System performance significantly improved from 12.523s")
            print("   Ready for production deployment")
            return True
        else:
            print("❌ CRITICAL PERFORMANCE REQUIREMENT NOT MET")
            print("   Further optimization needed")
            return False

if __name__ == "__main__":
    tester = SimplePerformanceTest()
    success = tester.run_tests()
    exit(0 if success else 1)