#!/usr/bin/env python3
"""
Focused Finance Module Testing - Production Readiness Test
Tests specific issues found in previous testing
"""

import requests
import sys
import json
from datetime import datetime, date

class FocusedFinanceTester:
    def __init__(self, base_url="https://academic-treasury.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.logistics_token = None
        self.hr_token = None
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

    def setup_tokens(self):
        """Setup authentication tokens"""
        print("🔑 Setting up authentication tokens...")
        
        # Register admin user
        timestamp = datetime.now().strftime('%H%M%S')
        admin_data = {
            "username": f"test_admin_{timestamp}",
            "email": f"test_admin_{timestamp}@iespp.edu.pe",
            "password": "TestPass123!",
            "full_name": f"Test Admin {timestamp}",
            "role": "ADMIN"
        }
        
        success, data = self.make_request('POST', 'auth/register', admin_data)
        if success and 'access_token' in data:
            self.admin_token = data['access_token']
            print(f"✅ Admin token obtained")
        else:
            print(f"❌ Failed to get admin token: {data}")
            return False

        # Register logistics user
        logistics_data = {
            "username": f"test_logistics_{timestamp}",
            "email": f"test_logistics_{timestamp}@iespp.edu.pe", 
            "password": "TestPass123!",
            "full_name": f"Test Logistics {timestamp}",
            "role": "LOGISTICS"
        }
        
        success, data = self.make_request('POST', 'auth/register', logistics_data)
        if success and 'access_token' in data:
            self.logistics_token = data['access_token']
            print(f"✅ Logistics token obtained")
        else:
            print(f"❌ Failed to get logistics token: {data}")

        # Register HR user
        hr_data = {
            "username": f"test_hr_{timestamp}",
            "email": f"test_hr_{timestamp}@iespp.edu.pe",
            "password": "TestPass123!", 
            "full_name": f"Test HR {timestamp}",
            "role": "HR_ADMIN"
        }
        
        success, data = self.make_request('POST', 'auth/register', hr_data)
        if success and 'access_token' in data:
            self.hr_token = data['access_token']
            print(f"✅ HR token obtained")
        else:
            print(f"❌ Failed to get HR token: {data}")

        return True

    def test_ruc_validation_detailed(self):
        """Test RUC validation in detail"""
        print("\n🔍 Testing RUC Validation Issues...")
        
        token = self.logistics_token or self.admin_token
        if not token:
            print("❌ No token available for RUC testing")
            return
        
        # Test 1: Valid RUC (should work)
        valid_ruc_data = {
            "ruc": "20123456786",  # Valid RUC format
            "company_name": "Empresa Test Válida SAC",
            "trade_name": "Test Company",
            "contact_person": "Juan Pérez",
            "email": "contacto@testcompany.com",
            "phone": "987654321",
            "address": "Av. Test 123, Lima",
            "is_active": True
        }
        
        success, data = self.make_request('POST', 'logistics/suppliers', valid_ruc_data, token=token)
        self.log_test("Create Supplier with Valid RUC", success, f"- RUC: {valid_ruc_data['ruc']}")
        
        # Test 2: Invalid RUC (10 digits - should fail)
        invalid_ruc_10_data = {
            "ruc": "2010007097",  # 10 digits - invalid
            "company_name": "Empresa Test Inválida 10",
            "trade_name": "Test Invalid 10",
            "contact_person": "María García",
            "email": "contacto@testinvalid10.com",
            "phone": "987654322",
            "address": "Av. Invalid 456, Lima",
            "is_active": True
        }
        
        success, data = self.make_request('POST', 'logistics/suppliers', invalid_ruc_10_data, token=token, expected_status=400)
        self.log_test("Reject Supplier with 10-digit RUC", success, f"- Should reject RUC: {invalid_ruc_10_data['ruc']}")
        
        # Test 3: Invalid RUC (12 digits - should fail)
        invalid_ruc_12_data = {
            "ruc": "201000709701",  # 12 digits - invalid
            "company_name": "Empresa Test Inválida 12",
            "trade_name": "Test Invalid 12", 
            "contact_person": "Carlos López",
            "email": "contacto@testinvalid12.com",
            "phone": "987654323",
            "address": "Av. Invalid 789, Lima",
            "is_active": True
        }
        
        success, data = self.make_request('POST', 'logistics/suppliers', invalid_ruc_12_data, token=token, expected_status=400)
        self.log_test("Reject Supplier with 12-digit RUC", success, f"- Should reject RUC: {invalid_ruc_12_data['ruc']}")
        
        # Test 4: Invalid RUC (letters - should fail)
        invalid_ruc_letters_data = {
            "ruc": "2010007097A",  # Contains letter - invalid
            "company_name": "Empresa Test Inválida Letters",
            "trade_name": "Test Invalid Letters",
            "contact_person": "Ana Rodríguez", 
            "email": "contacto@testinvalidletters.com",
            "phone": "987654324",
            "address": "Av. Invalid 101, Lima",
            "is_active": True
        }
        
        success, data = self.make_request('POST', 'logistics/suppliers', invalid_ruc_letters_data, token=token, expected_status=400)
        self.log_test("Reject Supplier with Letter in RUC", success, f"- Should reject RUC: {invalid_ruc_letters_data['ruc']}")

    def test_hr_employee_update_issue(self):
        """Test HR employee update endpoint issue"""
        print("\n👥 Testing HR Employee Update Issue...")
        
        token = self.hr_token or self.admin_token
        if not token:
            print("❌ No token available for HR testing")
            return
        
        # First create an employee
        timestamp = datetime.now().strftime('%H%M%S')
        employee_data = {
            "first_name": "Juan Carlos",
            "last_name": "Pérez",
            "document_number": f"1234567{timestamp[-1]}",
            "birth_date": "1985-05-15",
            "email": f"juan.perez{timestamp}@iespp.edu.pe",
            "phone": "987654321",
            "address": "Av. Los Héroes 123",
            "position": "Docente",
            "department": "Educación Inicial",
            "hire_date": "2024-01-15",
            "contract_type": "PERMANENT",
            "is_active": True
        }
        
        success, data = self.make_request('POST', 'hr/employees', employee_data, token=token)
        if not success or 'employee' not in data:
            self.log_test("Create Employee for Update Test", False, f"- Error: {data}")
            return
        
        employee_id = data['employee']['id']
        self.log_test("Create Employee for Update Test", True, f"- ID: {employee_id}")
        
        # Now try to update the employee
        update_data = {
            "first_name": "Juan Carlos Updated",
            "last_name": "Pérez García",
            "document_number": employee_data['document_number'],
            "birth_date": "1985-05-15",
            "email": f"juan.perez.updated{timestamp}@iespp.edu.pe",
            "phone": "987654322",
            "address": "Av. Los Héroes 456 - Updated",
            "position": "Docente Senior",
            "department": "Educación Inicial",
            "hire_date": "2024-01-15",
            "contract_type": "PERMANENT",
            "is_active": True
        }
        
        success, data = self.make_request('PUT', f'hr/employees/{employee_id}', update_data, token=token)
        self.log_test("Update Employee", success, f"- Updated successfully" if success else f"- Error: {data}")

    def test_receipt_parameter_issues(self):
        """Test receipt payment parameter format issues"""
        print("\n🧾 Testing Receipt Payment Parameter Issues...")
        
        # Register cashier user for receipt operations
        timestamp = datetime.now().strftime('%H%M%S')
        cashier_data = {
            "username": f"test_cashier_{timestamp}",
            "email": f"test_cashier_{timestamp}@iespp.edu.pe",
            "password": "TestPass123!",
            "full_name": f"Test Cashier {timestamp}",
            "role": "CASHIER"
        }
        
        success, data = self.make_request('POST', 'auth/register', cashier_data)
        if success and 'access_token' in data:
            token = data['access_token']
        else:
            token = self.admin_token
        if not token:
            print("❌ No token available for receipt testing")
            return
        
        # First create a receipt
        timestamp = datetime.now().strftime('%H%M%S')
        receipt_data = {
            "concept": "TUITION",
            "description": f"Test receipt for parameter testing {timestamp}",
            "amount": 150.0,
            "customer_name": f"Test Customer {timestamp}",
            "customer_document": f"8765432{timestamp[-1]}",
            "customer_email": f"customer{timestamp}@test.com",
            "cost_center": "CC001",
            "notes": "Test receipt for parameter validation"
        }
        
        success, data = self.make_request('POST', 'finance/receipts', receipt_data, token=token)
        if not success or 'receipt' not in data:
            self.log_test("Create Receipt for Payment Test", False, f"- Error: {data}")
            return
        
        receipt_id = data['receipt']['id']
        self.log_test("Create Receipt for Payment Test", True, f"- ID: {receipt_id}")
        
        # Test payment with query parameters (current expected format)
        payment_ref = f"PAY{timestamp}"
        idempotency_key = f"IDEM{timestamp}"
        
        success, data = self.make_request('POST', 
            f'finance/receipts/{receipt_id}/pay?payment_method=CASH&payment_reference={payment_ref}&idempotency_key={idempotency_key}',
            {}, token=token)
        self.log_test("Pay Receipt with Query Parameters", success, f"- Payment successful" if success else f"- Error: {data}")

    def test_cash_session_parameter_issues(self):
        """Test cash session close parameter format issues"""
        print("\n💰 Testing Cash Session Close Parameter Issues...")
        
        # Register cashier user for cash session operations
        timestamp = datetime.now().strftime('%H%M%S')
        cashier_data = {
            "username": f"test_cashier2_{timestamp}",
            "email": f"test_cashier2_{timestamp}@iespp.edu.pe",
            "password": "TestPass123!",
            "full_name": f"Test Cashier2 {timestamp}",
            "role": "CASHIER"
        }
        
        success, data = self.make_request('POST', 'auth/register', cashier_data)
        if success and 'access_token' in data:
            token = data['access_token']
        else:
            token = self.admin_token
        if not token:
            print("❌ No token available for cash session testing")
            return
        
        # First open a cash session
        session_data = {
            "initial_amount": 500.0,
            "cashier_notes": "Test session for parameter validation"
        }
        
        success, data = self.make_request('POST', 'finance/cash-sessions', session_data, token=token)
        if not success or 'session' not in data:
            self.log_test("Open Cash Session for Close Test", False, f"- Error: {data}")
            return
        
        session_id = data['session']['id']
        self.log_test("Open Cash Session for Close Test", True, f"- ID: {session_id}")
        
        # Test closing with query parameters (current expected format)
        final_amount = 550.0
        closing_notes = "Session closed for testing"
        
        success, data = self.make_request('POST', 
            f'finance/cash-sessions/{session_id}/close?final_amount={final_amount}&closing_notes={closing_notes}',
            {}, token=token)
        self.log_test("Close Cash Session with Query Parameters", success, f"- Closed successfully" if success else f"- Error: {data}")

    def test_receipt_verification_endpoint(self):
        """Test receipt verification endpoint specifically"""
        print("\n🔍 Testing Receipt Verification Endpoint...")
        
        # Register finance admin for receipt operations
        timestamp = datetime.now().strftime('%H%M%S')
        finance_data = {
            "username": f"test_finance_{timestamp}",
            "email": f"test_finance_{timestamp}@iespp.edu.pe",
            "password": "TestPass123!",
            "full_name": f"Test Finance {timestamp}",
            "role": "FINANCE_ADMIN"
        }
        
        success, data = self.make_request('POST', 'auth/register', finance_data)
        if success and 'access_token' in data:
            token = data['access_token']
        else:
            token = self.admin_token
        if not token:
            print("❌ No token available for verification testing")
            return
        
        # Get existing receipts to test verification
        success, data = self.make_request('GET', 'finance/receipts', token=token)
        if not success or not data.get('receipts'):
            self.log_test("Get Receipts for Verification Test", False, f"- No receipts found")
            return
        
        receipt_id = data['receipts'][0]['id']
        self.log_test("Get Receipt for Verification", True, f"- Using receipt ID: {receipt_id}")
        
        # Test public verification endpoint
        success, data = self.make_request('GET', f'verificar/{receipt_id}')
        has_verification_data = success and 'receipt_number' in data and 'is_valid' in data
        self.log_test("Public Receipt Verification", has_verification_data, 
                     f"- Valid: {data.get('is_valid', False)}, Number: {data.get('receipt_number', 'N/A')}" if success else f"- Error: {data}")

    def run_focused_tests(self):
        """Run focused tests for production readiness"""
        print("🎯 FOCUSED FINANCE MODULE TESTING - Production Readiness")
        print("=" * 70)
        
        # Setup authentication
        if not self.setup_tokens():
            print("❌ Failed to setup authentication tokens. Aborting tests.")
            return False
        
        # Run focused tests
        self.test_ruc_validation_detailed()
        self.test_hr_employee_update_issue()
        self.test_receipt_parameter_issues()
        self.test_cash_session_parameter_issues()
        self.test_receipt_verification_endpoint()
        
        # Final Results
        print("\n" + "=" * 70)
        print(f"📊 FOCUSED TEST RESULTS")
        print("=" * 70)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = FocusedFinanceTester()
    success = tester.run_focused_tests()
    sys.exit(0 if success else 1)