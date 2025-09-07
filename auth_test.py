#!/usr/bin/env python3
"""
URGENT Authentication Testing for IESPP Gustavo Allende Llavería Academic System
Focus: Testing login authentication issue reported by user
Issue: User cannot login using provided credentials (admin/password123)
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class AuthenticationTester:
    def __init__(self, base_url="https://academic-admin-sys.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.tokens = {}
        
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

    def test_predefined_user_login(self, username: str, password: str, expected_role: str = None) -> Optional[str]:
        """Test login with predefined user credentials"""
        login_data = {"username": username, "password": password}
        success, data = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        
        if success and 'access_token' in data:
            token = data['access_token']
            user_role = data.get('user', {}).get('role', 'UNKNOWN')
            user_full_name = data.get('user', {}).get('full_name', 'Unknown')
            
            # Store token for later use
            self.tokens[username] = {
                'token': token,
                'role': user_role,
                'full_name': user_full_name
            }
            
            role_match = expected_role is None or user_role == expected_role
            self.log_test(
                f"Login {username}", 
                role_match,
                f"- Role: {user_role}, Name: {user_full_name}"
            )
            return token if role_match else None
        else:
            error_detail = data.get('detail', str(data))
            self.log_test(f"Login {username}", False, f"- Error: {error_detail}")
            return None

    def test_jwt_token_validation(self, username: str, token: str):
        """Test JWT token validation by accessing protected endpoint"""
        success, data = self.make_request('GET', 'auth/me', token=token)
        
        if success:
            token_username = data.get('username', '')
            token_role = data.get('role', '')
            self.log_test(
                f"JWT Token Validation ({username})", 
                True,
                f"- Username: {token_username}, Role: {token_role}"
            )
        else:
            self.log_test(f"JWT Token Validation ({username})", False, f"- Error: {data}")
        
        return success

    def test_dashboard_access(self, username: str, token: str):
        """Test dashboard stats access with JWT token"""
        success, data = self.make_request('GET', 'dashboard/stats', token=token)
        
        if success:
            stats_keys = list(data.keys()) if isinstance(data, dict) else []
            self.log_test(
                f"Dashboard Access ({username})", 
                True,
                f"- Stats available: {len(stats_keys)} metrics"
            )
        else:
            self.log_test(f"Dashboard Access ({username})", False, f"- Error: {data}")
        
        return success

    def test_role_based_permissions(self, username: str, token: str, role: str):
        """Test role-based access to specific endpoints"""
        
        # Test students endpoint (should work for ADMIN, REGISTRAR, TEACHER)
        success, data = self.make_request('GET', 'students', token=token)
        
        if role in ['ADMIN', 'REGISTRAR', 'TEACHER']:
            expected_success = True
            expected_msg = "- Access granted as expected"
        else:
            expected_success = success == False  # Should fail for other roles
            expected_msg = "- Access denied as expected" if not success else "- Unexpected access granted"
        
        self.log_test(
            f"Students Access ({username}/{role})", 
            expected_success,
            expected_msg
        )

    def test_password_hashing_verification(self):
        """Test that password hashing is working correctly"""
        print("\n🔐 Testing Password Hashing...")
        
        # Try to login with wrong password
        wrong_login_data = {"username": "admin", "password": "wrongpassword"}
        success, data = self.make_request('POST', 'auth/login', wrong_login_data, expected_status=401)
        
        # Success here means we got 401 (unauthorized), which is correct
        self.log_test(
            "Password Hashing (Wrong Password)", 
            success,
            "- Wrong password properly rejected"
        )

    def verify_seed_data_users(self):
        """Verify that seed data users exist by attempting login"""
        print("\n👥 Verifying Seed Data Users...")
        
        # Test all predefined users from the review request
        predefined_users = [
            ("admin", "password123", "ADMIN"),
            ("teacher1", "password123", "TEACHER"), 
            ("student1", "password123", "STUDENT"),
            ("registrar", "password123", "REGISTRAR")
        ]
        
        successful_logins = 0
        
        for username, password, expected_role in predefined_users:
            token = self.test_predefined_user_login(username, password, expected_role)
            if token:
                successful_logins += 1
                
                # Test JWT token validation
                self.test_jwt_token_validation(username, token)
                
                # Test dashboard access
                self.test_dashboard_access(username, token)
                
                # Test role-based permissions
                self.test_role_based_permissions(username, token, expected_role)
        
        return successful_logins

    def test_authentication_endpoints(self):
        """Test all authentication-related endpoints"""
        print("\n🔑 Testing Authentication Endpoints...")
        
        # Test with admin credentials first
        admin_token = self.test_predefined_user_login("admin", "password123", "ADMIN")
        
        if admin_token:
            # Test authenticated endpoints
            endpoints_to_test = [
                ('GET', 'auth/me', 'Current User Info'),
                ('GET', 'dashboard/stats', 'Dashboard Statistics'),
                ('GET', 'students', 'Students List'),
                ('GET', 'courses', 'Courses List'),
                ('GET', 'careers', 'Careers List')
            ]
            
            for method, endpoint, description in endpoints_to_test:
                success, data = self.make_request(method, endpoint, token=admin_token)
                self.log_test(
                    f"Authenticated Endpoint: {description}",
                    success,
                    f"- {endpoint} accessible"
                )

    def run_authentication_tests(self):
        """Run comprehensive authentication tests"""
        print("🚨 URGENT: AUTHENTICATION TESTING")
        print("Issue: User cannot login using provided credentials")
        print("Testing credentials: admin/password123, teacher1/password123, student1/password123, registrar/password123")
        print("=" * 80)
        
        # 1. Health Check
        print("\n🏥 System Health Check...")
        if not self.test_health_check():
            print("❌ System health check failed. Backend may be down.")
            return False

        # 2. Password Hashing Verification
        self.test_password_hashing_verification()

        # 3. Verify Seed Data Users
        successful_logins = self.verify_seed_data_users()

        # 4. Test Authentication Endpoints
        if successful_logins > 0:
            self.test_authentication_endpoints()

        # 5. Results Summary
        print("\n" + "=" * 80)
        print(f"🔍 AUTHENTICATION TEST RESULTS")
        print("=" * 80)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        success_rate = (self.tests_passed/self.tests_run)*100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        # Specific findings
        print(f"\n🔑 LOGIN STATUS:")
        for username, info in self.tokens.items():
            print(f"✅ {username}: {info['role']} - {info['full_name']}")
        
        if successful_logins == 0:
            print("\n❌ CRITICAL ISSUE: No users can login!")
            print("Possible causes:")
            print("- Seed data not loaded")
            print("- Password hashing mismatch")
            print("- Database connection issues")
            print("- Authentication endpoint malfunction")
        elif successful_logins < 4:
            print(f"\n⚠️  PARTIAL ISSUE: Only {successful_logins}/4 users can login")
        else:
            print(f"\n✅ SUCCESS: All {successful_logins}/4 users can login successfully")
        
        return successful_logins > 0

if __name__ == "__main__":
    tester = AuthenticationTester()
    success = tester.run_authentication_tests()
    sys.exit(0 if success else 1)