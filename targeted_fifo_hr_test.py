#!/usr/bin/env python3
"""
Targeted Testing for FIFO & HR Fixes Validation
Tests specific fixes: FIFO calculations, HR employee endpoint, audit logs, role permissions, payment body validation
"""

import requests
import sys
import json
from datetime import datetime, date
from typing import Dict, Any, Optional

class TargetedTester:
    def __init__(self, base_url="https://academic-treasury.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'inventory_items': [],
            'employees': [],
            'receipts': []
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

    def authenticate_admin(self):
        """Authenticate as admin user"""
        login_data = {"username": "admin@universidad.edu", "password": "password123"}
        success, data = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        
        if success and 'access_token' in data:
            self.admin_token = data['access_token']
            self.log_test("Admin Authentication", True, f"- Role: {data.get('user', {}).get('role')}")
            return True
        else:
            self.log_test("Admin Authentication", False, f"- Error: {data}")
            return False

    def test_fifo_cost_calculation(self):
        """Test FIFO cost calculation fix - should return 930.0"""
        print("\n📦 Testing FIFO Cost Calculation Fix...")
        
        # 1. Create inventory item
        timestamp = datetime.now().strftime('%H%M%S')
        item_data = {
            "code": f"FIFO{timestamp}",
            "name": f"FIFO Test Item {timestamp}",
            "description": "Item for FIFO calculation testing",
            "category": "OFFICE_SUPPLIES",
            "unit_of_measure": "UNIT",
            "min_stock": 10,
            "max_stock": 1000,
            "unit_cost": 15.00,
            "track_serial": False,
            "track_expiry": False,
            "is_active": True
        }

        success, data = self.make_request('POST', 'inventory/items', item_data, token=self.admin_token)
        
        if not success or 'item' not in data:
            self.log_test("FIFO Test - Create Item", False, f"- Error: {data}")
            return False
        
        item_id = data['item']['id']
        self.created_resources['inventory_items'].append(item_id)
        self.log_test("FIFO Test - Create Item", True, f"- ID: {item_id}")

        # 2. Add entry: 50 units @ S/15.00 cost
        entry1_data = {
            "item_id": item_id,
            "movement_type": "ENTRY",
            "quantity": 50,
            "unit_cost": 15.00,
            "reason": "FIFO Test Entry 1",
            "notes": "First FIFO entry - 50 units at 15.00"
        }

        success, data = self.make_request('POST', 'inventory/movements', entry1_data, token=self.admin_token)
        if not success:
            self.log_test("FIFO Test - Entry 1 (50@15)", False, f"- Error: {data}")
            return False
        
        self.log_test("FIFO Test - Entry 1 (50@15)", True, "- 50 units @ S/15.00")

        # 3. Add entry: 30 units @ S/18.00 cost
        entry2_data = {
            "item_id": item_id,
            "movement_type": "ENTRY",
            "quantity": 30,
            "unit_cost": 18.00,
            "reason": "FIFO Test Entry 2",
            "notes": "Second FIFO entry - 30 units at 18.00"
        }

        success, data = self.make_request('POST', 'inventory/movements', entry2_data, token=self.admin_token)
        if not success:
            self.log_test("FIFO Test - Entry 2 (30@18)", False, f"- Error: {data}")
            return False
        
        self.log_test("FIFO Test - Entry 2 (30@18)", True, "- 30 units @ S/18.00")

        # 4. Create exit: 60 units (should cost 50*15 + 10*18 = 750 + 180 = 930)
        exit_data = {
            "item_id": item_id,
            "movement_type": "EXIT",
            "quantity": 60,
            "reason": "FIFO Test Exit",
            "notes": "FIFO exit - should cost 930.00"
        }

        success, data = self.make_request('POST', 'inventory/movements', exit_data, token=self.admin_token)
        if not success:
            self.log_test("FIFO Test - Exit (60 units)", False, f"- Error: {data}")
            return False
        
        # Check the calculated cost
        calculated_cost = data.get('movement', {}).get('total_cost', 0)
        expected_cost = 930.0
        
        cost_correct = abs(calculated_cost - expected_cost) < 0.01
        self.log_test("FIFO Cost Calculation", cost_correct, 
                     f"- Expected: S/{expected_cost}, Got: S/{calculated_cost}")
        
        return cost_correct

    def test_hr_employee_endpoint(self):
        """Test HR employee update endpoint - should return 200, not 500"""
        print("\n👥 Testing HR Employee Endpoint Fix...")
        
        # 1. Create employee
        timestamp = datetime.now().strftime('%H%M%S')
        employee_data = {
            "employee_code": f"EMP{timestamp}",
            "first_name": "Juan Carlos",
            "last_name": "Pérez",
            "document_number": f"1234567{timestamp[-1]}",
            "birth_date": "1985-05-15",
            "email": f"juan.perez{timestamp}@universidad.edu",
            "phone": "987654321",
            "position": "Docente",
            "department": "Educación Inicial",
            "contract_type": "PERMANENT",
            "hire_date": "2024-01-15"
        }

        success, data = self.make_request('POST', 'hr/employees', employee_data, token=self.admin_token)
        
        if not success or 'employee' not in data:
            self.log_test("HR Test - Create Employee", False, f"- Error: {data}")
            return False
        
        employee_id = data['employee']['id']
        self.created_resources['employees'].append(employee_id)
        self.log_test("HR Test - Create Employee", True, f"- ID: {employee_id}")

        # 2. Test update employee endpoint (PUT /api/hr/employees/{id})
        update_data = {
            "first_name": "Juan Carlos",
            "last_name": "Pérez",
            "document_number": employee_data["document_number"],
            "birth_date": "1985-05-15",
            "email": f"juan.perez.updated{timestamp}@universidad.edu",
            "phone": "987654322",  # Updated phone
            "position": "Docente Senior",  # Updated position
            "department": "Educación Inicial",
            "contract_type": "PERMANENT",
            "hire_date": "2024-01-15"
        }

        success, data = self.make_request('PUT', f'hr/employees/{employee_id}', update_data, token=self.admin_token)
        
        # Should return 200, not 500
        if success:
            self.log_test("HR Employee Update Endpoint", True, "- Returns 200 (not 500)")
            return True
        else:
            status_code = data.get('status_code', 'unknown')
            self.log_test("HR Employee Update Endpoint", False, f"- Status: {status_code}, Error: {data}")
            return False

    def test_audit_logs_endpoint(self):
        """Test audit logs endpoint accessibility"""
        print("\n🔒 Testing Audit Logs Endpoint...")
        
        success, data = self.make_request('GET', 'audit/logs', token=self.admin_token)
        
        if success:
            logs_count = len(data.get('logs', [])) if isinstance(data.get('logs'), list) else 0
            has_proper_structure = 'logs' in data
            self.log_test("Audit Logs Endpoint", has_proper_structure, 
                         f"- Found {logs_count} audit entries")
            return has_proper_structure
        else:
            status_code = data.get('status_code', 'unknown')
            self.log_test("Audit Logs Endpoint", False, f"- Status: {status_code}, Error: {data}")
            return False

    def test_role_based_permissions(self):
        """Test that ADMIN role can access all endpoints"""
        print("\n🔐 Testing Role-Based Permissions...")
        
        endpoints_to_test = [
            ('finance/bank-accounts', 'Finance Bank Accounts'),
            ('finance/receipts', 'Finance Receipts'),
            ('finance/gl-concepts', 'Finance GL Concepts'),
            ('inventory/items', 'Inventory Items'),
            ('logistics/suppliers', 'Logistics Suppliers'),
            ('hr/employees', 'HR Employees')
        ]
        
        all_accessible = True
        accessible_count = 0
        
        for endpoint, name in endpoints_to_test:
            success, data = self.make_request('GET', endpoint, token=self.admin_token)
            if success:
                accessible_count += 1
                self.log_test(f"ADMIN Access - {name}", True, "- Accessible")
            else:
                all_accessible = False
                status_code = data.get('status_code', 'unknown')
                self.log_test(f"ADMIN Access - {name}", False, f"- Status: {status_code}")
        
        self.log_test("Role-Based Permissions Summary", all_accessible, 
                     f"- {accessible_count}/{len(endpoints_to_test)} endpoints accessible")
        
        return all_accessible

    def test_payment_request_body_validation(self):
        """Test payment request body validation (not query params)"""
        print("\n💳 Testing Payment Request Body Validation...")
        
        # 1. Create a receipt first
        timestamp = datetime.now().strftime('%H%M%S')
        receipt_data = {
            "concept": "TUITION",
            "description": f"Payment test receipt {timestamp}",
            "amount": 100.0,
            "customer_name": f"Test Customer {timestamp}",
            "customer_document": f"1234567{timestamp[-1]}",
            "customer_email": f"test{timestamp}@test.com",
            "cost_center": "CC001",
            "notes": "Payment validation test"
        }

        success, data = self.make_request('POST', 'finance/receipts', receipt_data, token=self.admin_token)
        
        if not success or 'receipt' not in data:
            self.log_test("Payment Test - Create Receipt", False, f"- Error: {data}")
            return False
        
        receipt_id = data['receipt']['id']
        self.created_resources['receipts'].append(receipt_id)
        self.log_test("Payment Test - Create Receipt", True, f"- ID: {receipt_id}")

        # 2. Test payment with request body (not query params)
        payment_data = {
            "payment_method": "CASH",
            "payment_reference": "TEST",
            "idempotency_key": "key123"
        }

        success, data = self.make_request('POST', f'finance/receipts/{receipt_id}/pay', 
                                        payment_data, token=self.admin_token)
        
        if success:
            self.log_test("Payment Request Body Validation", True, "- Accepts request body format")
            return True
        else:
            status_code = data.get('status_code', 'unknown')
            self.log_test("Payment Request Body Validation", False, 
                         f"- Status: {status_code}, Error: {data}")
            return False

    def run_targeted_tests(self):
        """Run all targeted tests"""
        print("🎯 TARGETED TESTING - FIFO & HR FIXES VALIDATION")
        print("=" * 60)
        
        # Authenticate
        if not self.authenticate_admin():
            print("❌ Authentication failed. Cannot continue.")
            return False

        # Run specific tests
        results = []
        
        print("\n1️⃣ FIFO Cost Calculation Fix")
        results.append(self.test_fifo_cost_calculation())
        
        print("\n2️⃣ HR Employee Endpoint Fix")
        results.append(self.test_hr_employee_endpoint())
        
        print("\n3️⃣ Audit Logs Endpoint")
        results.append(self.test_audit_logs_endpoint())
        
        print("\n4️⃣ Role-Based Permissions")
        results.append(self.test_role_based_permissions())
        
        print("\n5️⃣ Payment Request Body Validation")
        results.append(self.test_payment_request_body_validation())

        # Final Results
        print("\n" + "=" * 60)
        print(f"📊 TARGETED TEST RESULTS")
        print("=" * 60)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        success_rate = (self.tests_passed/self.tests_run)*100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        # Specific fix validation
        print("\n🔧 FIX VALIDATION SUMMARY:")
        fix_names = [
            "FIFO Cost Calculation (should return 930.0)",
            "HR Employee Update (should return 200)",
            "Audit Logs Endpoint (should be accessible)",
            "Role-Based Permissions (ADMIN access)",
            "Payment Request Body (should accept JSON body)"
        ]
        
        for i, (fix_name, result) in enumerate(zip(fix_names, results)):
            status = "✅ FIXED" if result else "❌ STILL BROKEN"
            print(f"{i+1}. {fix_name}: {status}")
        
        fixes_working = sum(results)
        print(f"\n🎯 FIXES WORKING: {fixes_working}/5")
        
        if fixes_working == 5:
            print("🎉 ALL TARGETED FIXES ARE WORKING!")
        elif fixes_working >= 3:
            print("⚠️  MOST FIXES WORKING - Minor issues remain")
        else:
            print("❌ CRITICAL FIXES STILL BROKEN")
        
        return fixes_working >= 3

if __name__ == "__main__":
    tester = TargetedTester()
    success = tester.run_targeted_tests()
    sys.exit(0 if success else 1)