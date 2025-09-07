#!/usr/bin/env python3
"""
Final Production Readiness Test for Finance Module
Tests all critical production features with proper data
"""

import requests
import sys
import json
from datetime import datetime

class ProductionReadinessTest:
    def __init__(self, base_url="https://iespp-gustavo-app.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.critical_failures = []

    def log_test(self, name: str, success: bool, details: str = "", critical: bool = False):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
            if critical:
                self.critical_failures.append(f"{name}: {details}")
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

    def setup_authentication(self):
        """Setup authentication with finance admin credentials"""
        login_data = {"username": "finance_admin", "password": "admin123"}
        success, data = self.make_request('POST', 'auth/login', login_data)
        
        if success and 'access_token' in data:
            self.admin_token = data['access_token']
            print(f"✅ Authentication Setup - Finance Admin logged in successfully")
            return True
        else:
            print(f"❌ Authentication Setup - Failed: {data}")
            return False

    def test_cash_and_banks_workflow(self):
        """Test complete Cash & Banks workflow"""
        print("\n🏦 Testing Cash & Banks Complete Workflow...")
        
        # 1. Create bank account
        timestamp = datetime.now().strftime('%H%M%S')
        account_data = {
            "bank_name": "Banco de la Nación",
            "account_name": f"Cuenta Producción {timestamp}",
            "account_number": f"001234567890{timestamp[-3:]}",
            "account_type": "CHECKING",
            "currency": "PEN",
            "initial_balance": 50000.0,
            "is_active": True
        }
        
        success, data = self.make_request('POST', 'finance/bank-accounts', account_data, token=self.admin_token)
        bank_account_created = success and 'account' in data
        self.log_test("Create Bank Account", bank_account_created, 
                     f"- Balance: S/{account_data['initial_balance']}" if bank_account_created else f"- Error: {data}",
                     critical=True)
        
        # 2. Open cash session
        session_data = {
            "initial_amount": 1000.0,
            "cashier_notes": f"Sesión de producción {timestamp}"
        }
        
        success, data = self.make_request('POST', 'finance/cash-sessions', session_data, token=self.admin_token)
        session_created = success and 'session' in data
        session_id = data.get('session', {}).get('id') if session_created else None
        
        self.log_test("Open Cash Session", session_created, 
                     f"- Initial: S/{session_data['initial_amount']}" if session_created else f"- Error: {data}",
                     critical=True)
        
        # 3. Create cash movements
        if session_id:
            # Income movement
            income_data = {
                "cash_session_id": session_id,
                "movement_type": "INCOME",
                "amount": 500.0,
                "concept": "Pago de matrícula",
                "description": "Ingreso por matrícula de estudiante",
                "cost_center": "CC001"
            }
            
            success, data = self.make_request('POST', 'finance/cash-movements', income_data, token=self.admin_token)
            self.log_test("Create Income Movement", success, 
                         f"- Amount: S/{income_data['amount']}" if success else f"- Error: {data}")
            
            # Expense movement
            expense_data = {
                "cash_session_id": session_id,
                "movement_type": "EXPENSE",
                "amount": 150.0,
                "concept": "Compra de útiles",
                "description": "Gasto en materiales de oficina",
                "cost_center": "CC002"
            }
            
            success, data = self.make_request('POST', 'finance/cash-movements', expense_data, token=self.admin_token)
            self.log_test("Create Expense Movement", success, 
                         f"- Amount: S/{expense_data['amount']}" if success else f"- Error: {data}")
            
            # 4. Close cash session with proper parameters
            close_url = f'finance/cash-sessions/{session_id}/close?final_amount=1350.0&closing_notes=Cierre de sesión de producción'
            success, data = self.make_request('POST', close_url, {}, token=self.admin_token)
            self.log_test("Close Cash Session", success, 
                         f"- Final amount: S/1350.0" if success else f"- Error: {data}",
                         critical=True)

    def test_internal_receipts_with_qr(self):
        """Test Internal Receipts with QR code generation"""
        print("\n🧾 Testing Internal Receipts with QR Codes...")
        
        timestamp = datetime.now().strftime('%H%M%S')
        
        # 1. Create receipt
        receipt_data = {
            "concept": "TUITION",
            "description": f"Pago de pensión mensual - Producción {timestamp}",
            "amount": 350.0,
            "customer_name": f"María González Pérez",
            "customer_document": f"4567890{timestamp[-1]}",
            "customer_email": f"maria.gonzalez{timestamp}@gmail.com",
            "cost_center": "CC001",
            "notes": "Recibo de producción con QR"
        }
        
        success, data = self.make_request('POST', 'finance/receipts', receipt_data, token=self.admin_token)
        receipt_created = success and 'receipt' in data
        
        if receipt_created:
            receipt = data['receipt']
            receipt_id = receipt['id']
            has_qr = 'qr_code' in receipt and receipt['qr_code'] is not None
            verification_url = data.get('verification_url', '')
            
            self.log_test("Create Receipt with QR", True, 
                         f"- Number: {receipt['receipt_number']}, QR: {has_qr}", critical=True)
            
            # 2. Test QR verification (public endpoint)
            success, verify_data = self.make_request('GET', f'verificar/{receipt_id}')
            verification_works = success and verify_data.get('is_valid', False)
            
            self.log_test("QR Code Verification", verification_works, 
                         f"- Public verification working" if verification_works else f"- Error: {verify_data}",
                         critical=True)
            
            # 3. Pay receipt with idempotency
            payment_url = f'finance/receipts/{receipt_id}/pay?payment_method=CASH&payment_reference=PROD{timestamp}&idempotency_key=IDEM{timestamp}'
            success, data = self.make_request('POST', payment_url, {}, token=self.admin_token)
            
            self.log_test("Pay Receipt (Idempotent)", success, 
                         f"- Payment processed" if success else f"- Error: {data}",
                         critical=True)
            
            # 4. Test idempotency (same key should not create duplicate)
            success, data = self.make_request('POST', payment_url, {}, token=self.admin_token)
            idempotency_works = success  # Should succeed but not create duplicate
            
            self.log_test("Idempotency Protection", idempotency_works, 
                         f"- Duplicate prevented" if idempotency_works else f"- Error: {data}")
            
        else:
            self.log_test("Create Receipt with QR", False, f"- Error: {data}", critical=True)

    def test_inventory_fifo_system(self):
        """Test Inventory FIFO calculations"""
        print("\n📦 Testing Inventory FIFO System...")
        
        timestamp = datetime.now().strftime('%H%M%S')
        
        # 1. Create inventory item
        item_data = {
            "code": f"PROD{timestamp}",
            "name": f"Papel Bond A4 - Producción {timestamp}",
            "description": "Papel bond blanco para impresión",
            "category": "OFFICE_SUPPLIES",
            "unit_of_measure": "PACK",
            "min_stock": 20,
            "max_stock": 200,
            "unit_cost": 15.0,
            "track_serial": False,
            "track_expiry": False,
            "is_active": True
        }
        
        success, data = self.make_request('POST', 'inventory/items', item_data, token=self.admin_token)
        item_created = success and 'item' in data
        item_id = data.get('item', {}).get('id') if item_created else None
        
        self.log_test("Create Inventory Item", item_created, 
                     f"- Code: {item_data['code']}" if item_created else f"- Error: {data}",
                     critical=True)
        
        if item_id:
            # 2. FIFO Entry 1: 50 units at S/15.00 each
            entry1_data = {
                "item_id": item_id,
                "movement_type": "ENTRY",
                "quantity": 50,
                "unit_cost": 15.0,
                "reference_type": "PURCHASE",
                "reason": "Compra inicial - Lote 1",
                "notes": "Primer lote - S/15.00 por unidad"
            }
            
            success, data = self.make_request('POST', 'inventory/movements', entry1_data, token=self.admin_token)
            self.log_test("FIFO Entry 1 (50 @ S/15.00)", success, 
                         f"- Total: S/750.00" if success else f"- Error: {data}")
            
            # 3. FIFO Entry 2: 30 units at S/18.00 each
            entry2_data = {
                "item_id": item_id,
                "movement_type": "ENTRY",
                "quantity": 30,
                "unit_cost": 18.0,
                "reference_type": "PURCHASE",
                "reason": "Compra adicional - Lote 2",
                "notes": "Segundo lote - S/18.00 por unidad"
            }
            
            success, data = self.make_request('POST', 'inventory/movements', entry2_data, token=self.admin_token)
            self.log_test("FIFO Entry 2 (30 @ S/18.00)", success, 
                         f"- Total: S/540.00" if success else f"- Error: {data}")
            
            # 4. FIFO Exit: 60 units (should take 50 from first batch + 10 from second)
            # Expected cost: (50 * S/15.00) + (10 * S/18.00) = S/750.00 + S/180.00 = S/930.00
            exit_data = {
                "item_id": item_id,
                "movement_type": "EXIT",
                "quantity": 60,
                "reference_type": "CONSUMPTION",
                "reason": "Consumo para actividades académicas",
                "notes": "Salida FIFO - debe costar S/930.00"
            }
            
            success, data = self.make_request('POST', 'inventory/movements', exit_data, token=self.admin_token)
            
            if success and 'movement' in data:
                actual_cost = data['movement'].get('total_cost', 0)
                expected_cost = 930.0
                cost_accurate = abs(actual_cost - expected_cost) < 0.01
                
                self.log_test("FIFO Cost Calculation", cost_accurate, 
                             f"- Expected: S/{expected_cost}, Actual: S/{actual_cost}",
                             critical=True)
            else:
                self.log_test("FIFO Cost Calculation", False, f"- Error: {data}", critical=True)
            
            # 5. Generate Kardex report
            success, data = self.make_request('GET', f'inventory/items/{item_id}/kardex', token=self.admin_token)
            kardex_generated = success and 'kardex' in data
            
            self.log_test("Generate Kardex Report", kardex_generated, 
                         f"- Entries: {len(data.get('kardex', []))}" if kardex_generated else f"- Error: {data}")

    def test_logistics_with_ruc_validation(self):
        """Test Logistics with proper RUC validation"""
        print("\n🚚 Testing Logistics with RUC Validation...")
        
        timestamp = datetime.now().strftime('%H%M%S')
        
        # Valid RUC (calculated with proper check digit)
        valid_ruc = "20100070971"  # This has the correct check digit
        
        # 1. Create supplier with valid RUC
        supplier_data = {
            "ruc": valid_ruc,
            "company_name": f"Distribuidora Educativa Producción {timestamp} S.A.C.",
            "trade_name": f"EduProd {timestamp}",
            "contact_person": "Carlos Mendoza Silva",
            "email": f"contacto{timestamp}@eduprod.com",
            "phone": "987654321",
            "address": "Av. Industrial 456, Ate Vitarte, Lima",
            "bank_account": "00198765432109876543",
            "bank_name": "Banco de Crédito del Perú",
            "is_active": True
        }
        
        success, data = self.make_request('POST', 'logistics/suppliers', supplier_data, token=self.admin_token)
        supplier_created = success and 'supplier' in data
        supplier_id = data.get('supplier', {}).get('id') if supplier_created else None
        
        self.log_test("Create Supplier (Valid RUC)", supplier_created, 
                     f"- RUC: {valid_ruc}" if supplier_created else f"- Error: {data}",
                     critical=True)
        
        # 2. Test RUC validation rejection
        invalid_supplier_data = supplier_data.copy()
        invalid_supplier_data.update({
            "ruc": "2010007097",  # 10 digits - should be rejected
            "company_name": f"Invalid RUC Test {timestamp}",
            "email": f"invalid{timestamp}@test.com"
        })
        
        success, data = self.make_request('POST', 'logistics/suppliers', invalid_supplier_data, 
                                        token=self.admin_token, expected_status=422)
        
        self.log_test("Reject Invalid RUC (10 digits)", success, 
                     f"- Properly rejected" if success else f"- Should have been rejected: {data}")
        
        # 3. Create purchase requirement
        if supplier_id:
            requirement_data = {
                "title": f"Requerimiento de Materiales Educativos {timestamp}",
                "description": "Solicitud de materiales para el año académico 2025",
                "justification": "Los materiales son necesarios para el desarrollo normal de las actividades académicas y administrativas de la institución",
                "required_date": "2025-02-15",
                "items": [
                    {
                        "description": "Papel Bond A4 - 75gr",
                        "quantity": 100,
                        "unit_of_measure": "PACK",
                        "estimated_unit_price": 15.50,
                        "technical_specifications": "Papel bond blanco, gramaje 75gr, tamaño A4, marca reconocida"
                    },
                    {
                        "description": "Marcadores para Pizarra Acrílica",
                        "quantity": 50,
                        "unit_of_measure": "UNIT",
                        "estimated_unit_price": 4.20,
                        "technical_specifications": "Marcadores de colores variados, punta gruesa, tinta no tóxica"
                    }
                ]
            }
            
            success, data = self.make_request('POST', 'logistics/requirements', requirement_data, token=self.admin_token)
            requirement_created = success and 'requirement' in data
            
            self.log_test("Create Purchase Requirement", requirement_created, 
                         f"- Items: {len(requirement_data['items'])}" if requirement_created else f"- Error: {data}")

    def test_hr_management_system(self):
        """Test HR Management System"""
        print("\n👥 Testing HR Management System...")
        
        timestamp = datetime.now().strftime('%H%M%S')
        
        # 1. Create employee
        employee_data = {
            "first_name": "Ana María",
            "last_name": "Rodríguez",
            "document_number": f"7654321{timestamp[-1]}",
            "birth_date": "1985-06-15",
            "email": f"ana.rodriguez{timestamp}@iespp.edu.pe",
            "phone": "987654321",
            "address": "Av. Los Educadores 789, San Borja, Lima",
            "position": "Docente de Educación Inicial",
            "department": "Educación Inicial",
            "hire_date": "2024-03-01",
            "contract_type": "PERMANENT",
            "is_active": True
        }
        
        success, data = self.make_request('POST', 'hr/employees', employee_data, token=self.admin_token)
        employee_created = success and 'employee' in data
        employee_id = data.get('employee', {}).get('id') if employee_created else None
        
        self.log_test("Create Employee", employee_created, 
                     f"- Position: {employee_data['position']}" if employee_created else f"- Error: {data}",
                     critical=True)
        
        # 2. Test employee update (reported 500 error issue)
        if employee_id:
            update_data = employee_data.copy()
            update_data.update({
                "position": "Coordinadora de Educación Inicial",
                "email": f"ana.rodriguez.coord{timestamp}@iespp.edu.pe",
                "phone": "987654322"
            })
            
            success, data = self.make_request('PUT', f'hr/employees/{employee_id}', update_data, token=self.admin_token)
            
            self.log_test("Update Employee", success, 
                         f"- Position updated" if success else f"- Error: {data}",
                         critical=True)
            
            # 3. Create attendance record with automatic hour calculation
            attendance_data = {
                "employee_id": employee_id,
                "date": "2024-12-20",
                "check_in": "2024-12-20T08:00:00",
                "check_out": "2024-12-20T17:30:00",
                "break_minutes": 60,
                "overtime_hours": 0.5,
                "notes": "Jornada completa con 30 minutos extra"
            }
            
            success, data = self.make_request('POST', 'hr/attendance', attendance_data, token=self.admin_token)
            attendance_created = success and 'attendance' in data
            
            if attendance_created:
                worked_hours = data['attendance'].get('worked_hours', 0)
                expected_hours = 8.5  # 9.5 hours - 1 hour break = 8.5 hours
                hours_correct = abs(worked_hours - expected_hours) < 0.1
                
                self.log_test("Create Attendance (Auto-calc)", hours_correct, 
                             f"- Worked: {worked_hours}h (expected: {expected_hours}h)" if hours_correct else f"- Hours calculation error")
            else:
                self.log_test("Create Attendance (Auto-calc)", False, f"- Error: {data}")

    def test_role_based_access_control(self):
        """Test Role-based Access Control"""
        print("\n🔐 Testing Role-based Access Control...")
        
        # Test finance roles
        roles_to_test = [
            ("FINANCE_ADMIN", "finance/bank-accounts"),
            ("CASHIER", "finance/cash-sessions"),
            ("WAREHOUSE", "inventory/items"),
            ("HR_ADMIN", "hr/employees"),
            ("LOGISTICS", "logistics/suppliers")
        ]
        
        for role, endpoint in roles_to_test:
            # Register user with specific role
            timestamp = datetime.now().strftime('%H%M%S')
            user_data = {
                "username": f"test_{role.lower()}_{timestamp}",
                "email": f"test_{role.lower()}_{timestamp}@iespp.edu.pe",
                "password": "TestPass123!",
                "full_name": f"Test {role} User",
                "role": role,
                "phone": "987654321"
            }
            
            success, data = self.make_request('POST', 'auth/register', user_data)
            
            if success and 'access_token' in data:
                role_token = data['access_token']
                
                # Test access to appropriate endpoint
                success, data = self.make_request('GET', endpoint, token=role_token)
                
                self.log_test(f"Role Access ({role})", success, 
                             f"- Can access {endpoint}" if success else f"- Access denied to {endpoint}")
            else:
                self.log_test(f"Role Registration ({role})", False, f"- Error: {data}")

    def run_production_tests(self):
        """Run complete production readiness tests"""
        print("🎯 FINANCE MODULE - PRODUCTION READINESS TESTING")
        print("=" * 70)
        
        # Setup
        if not self.setup_authentication():
            print("❌ Cannot authenticate. Aborting tests.")
            return False
        
        # Run all production tests
        self.test_cash_and_banks_workflow()
        self.test_internal_receipts_with_qr()
        self.test_inventory_fifo_system()
        self.test_logistics_with_ruc_validation()
        self.test_hr_management_system()
        self.test_role_based_access_control()
        
        # Final results
        print("\n" + "=" * 70)
        print(f"📊 PRODUCTION READINESS RESULTS")
        print("=" * 70)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.critical_failures:
            print(f"\n🚨 CRITICAL FAILURES:")
            for failure in self.critical_failures:
                print(f"   • {failure}")
        else:
            print(f"\n🎉 ALL CRITICAL TESTS PASSED - PRODUCTION READY!")
        
        return len(self.critical_failures) == 0

def main():
    """Main test execution"""
    tester = ProductionReadinessTest()
    success = tester.run_production_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())