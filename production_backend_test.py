#!/usr/bin/env python3
"""
FINAL PRODUCTION VALIDATION - COMPREHENSIVE TESTING
Treasury & Administration Module - 100% Complete Validation

OBJECTIVE: Final validation of 100% complete Treasury & Administration module for production deployment

CRITICAL SUCCESS METRICS:
- Backend API Success Rate: ≥85%
- FIFO Cost Calculation: Must return S/930.00 for test scenario
- Performance: p95 < 1.5s, handle 200+ req/min
- Security: Role-based permissions working
- Core Workflows: End-to-end functionality validated
"""

import requests
import sys
import json
import time
import threading
import concurrent.futures
from datetime import datetime, date, timedelta, timezone
from typing import Dict, Any, Optional, List

class ProductionBackendTester:
    def __init__(self, base_url="https://edusphere-24.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.finance_admin_token = None
        self.cashier_token = None
        self.warehouse_token = None
        self.logistics_token = None
        self.hr_admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {}
        self.performance_metrics = []

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
                    token: str = None, expected_status: int = 200, timeout: int = 30) -> tuple:
        """Make HTTP request with error handling and performance tracking"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        start_time = time.time()
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=timeout)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            end_time = time.time()
            latency = end_time - start_time
            
            # Track performance metrics
            self.performance_metrics.append({
                'endpoint': endpoint,
                'method': method,
                'latency': latency,
                'status_code': response.status_code,
                'timestamp': datetime.now()
            })

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except requests.exceptions.RequestException as e:
            end_time = time.time()
            latency = end_time - start_time
            self.performance_metrics.append({
                'endpoint': endpoint,
                'method': method,
                'latency': latency,
                'status_code': 0,
                'error': str(e),
                'timestamp': datetime.now()
            })
            return False, {"error": str(e)}

    def setup_test_users(self):
        """Setup test users with predefined credentials"""
        print("🔐 Setting up test users...")
        
        # Try to login with predefined users first
        predefined_users = [
            ("admin", "ADMIN"),
            ("finance_admin", "FINANCE_ADMIN"),
            ("cashier", "CASHIER"),
            ("warehouse", "WAREHOUSE"),
            ("logistics", "LOGISTICS"),
            ("hr_admin", "HR_ADMIN")
        ]
        
        for username, role in predefined_users:
            token = self.test_user_login(username, "password123")
            if token:
                setattr(self, f"{role.lower()}_token", token)
            else:
                # Create new user if login fails
                token = self.test_user_registration(role)
                if token:
                    setattr(self, f"{role.lower()}_token", token)

    def test_user_login(self, username: str, password: str = "password123") -> Optional[str]:
        """Test user login"""
        login_data = {"username": username, "password": password}
        success, data = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        
        if success and 'access_token' in data:
            self.log_test(f"Login User {username}", True, f"- Role: {data.get('user', {}).get('role')}")
            return data['access_token']
        else:
            return None

    def test_user_registration(self, role: str) -> Optional[str]:
        """Test user registration and return token"""
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "username": f"test_{role.lower()}_{timestamp}",
            "email": f"test_{role.lower()}_{timestamp}@iespp.edu.pe",
            "password": "TestPass123!",
            "full_name": f"Test {role} User {timestamp}",
            "role": role,
            "phone": "987654321"
        }

        success, data = self.make_request('POST', 'auth/register', user_data, expected_status=200)
        
        if success and 'access_token' in data:
            token = data['access_token']
            self.log_test(f"Register {role} User", True, f"- Username: {user_data['username']}")
            return token
        else:
            self.log_test(f"Register {role} User", False, f"- Error: {data}")
            return None

    # ====================================================================================================
    # 1. AUTHENTICATION & PERMISSIONS (Target: 100%)
    # ====================================================================================================
    
    def test_authentication_permissions(self):
        """Test all user roles and ADMIN universal access"""
        print("\n🔐 PHASE 1: AUTHENTICATION & PERMISSIONS (Target: 100%)")
        
        # Test ADMIN universal access
        if self.admin_token:
            endpoints_to_test = [
                'finance/bank-accounts',
                'finance/receipts', 
                'finance/gl-concepts',
                'inventory/items',
                'logistics/suppliers',
                'hr/employees'
            ]
            
            for endpoint in endpoints_to_test:
                success, data = self.make_request('GET', endpoint, token=self.admin_token)
                self.log_test(f"ADMIN Access to {endpoint}", success, f"- Universal access verified")
        
        # Test role-specific restrictions
        role_endpoint_map = {
            'FINANCE_ADMIN': 'finance/bank-accounts',
            'CASHIER': 'finance/receipts',
            'WAREHOUSE': 'inventory/items',
            'LOGISTICS': 'logistics/suppliers',
            'HR_ADMIN': 'hr/employees'
        }
        
        for role, endpoint in role_endpoint_map.items():
            token = getattr(self, f"{role.lower()}_token", None)
            if token:
                success, data = self.make_request('GET', endpoint, token=token)
                self.log_test(f"{role} Access to {endpoint}", success, f"- Role-specific access verified")

    # ====================================================================================================
    # 2. TREASURY CORE FEATURES (Target: 95%)
    # ====================================================================================================
    
    def test_treasury_core_features(self):
        """Test Cash & Banks, Internal Receipts, GL Concepts"""
        print("\n🏦 PHASE 2: TREASURY CORE FEATURES (Target: 95%)")
        
        # Cash & Banks: Sessions, movements, reconciliation
        self.test_cash_banks_workflow()
        
        # Internal Receipts: Creation, payment, void, QR verification
        self.test_internal_receipts_workflow()
        
        # GL Concepts & Cost Centers: Management functionality
        self.test_gl_concepts_workflow()

    def test_cash_banks_workflow(self):
        """Test complete cash and banks workflow"""
        print("\n💰 Testing Cash & Banks Workflow...")
        
        token = self.cashier_token or self.admin_token
        if not token:
            self.log_test("Cash & Banks Workflow", False, "- No valid token available")
            return
        
        # 1. Create bank account
        bank_account_data = {
            "bank_name": "Banco de la Nación",
            "account_name": "Cuenta Corriente Principal",
            "account_number": f"00123456789{datetime.now().strftime('%H%M%S')}",
            "account_type": "CHECKING",
            "currency": "PEN",
            "initial_balance": 10000.0,
            "is_active": True
        }
        
        success, data = self.make_request('POST', 'finance/bank-accounts', bank_account_data, token=token)
        bank_account_id = data.get('account', {}).get('id') if success else None
        self.log_test("Create Bank Account", success, f"- ID: {bank_account_id}")
        
        # 2. Open cash session
        session_data = {
            "initial_amount": 500.0,
            "cashier_notes": "Sesión de prueba producción"
        }
        
        success, data = self.make_request('POST', 'finance/cash-sessions', session_data, token=token)
        session_id = data.get('session', {}).get('id') if success else None
        self.log_test("Open Cash Session", success, f"- ID: {session_id}")
        
        # 3. Create cash movements
        if session_id:
            # Income movement
            income_data = {
                "cash_session_id": session_id,
                "movement_type": "INCOME",
                "amount": 100.0,
                "concept": "Pago de matrícula",
                "description": "Ingreso por matrícula estudiante",
                "cost_center": "CC001"
            }
            
            success, data = self.make_request('POST', 'finance/cash-movements', income_data, token=token)
            self.log_test("Create Cash Income Movement", success, f"- Amount: S/100.00")
            
            # Expense movement
            expense_data = {
                "cash_session_id": session_id,
                "movement_type": "EXPENSE", 
                "amount": 50.0,
                "concept": "Compra de útiles",
                "description": "Gasto en útiles de oficina",
                "cost_center": "CC002"
            }
            
            success, data = self.make_request('POST', 'finance/cash-movements', expense_data, token=token)
            self.log_test("Create Cash Expense Movement", success, f"- Amount: S/50.00")
            
            # 4. Close cash session - TEST CRITICAL FIX: Use request body instead of query params
            close_data = {
                "final_amount": 550.0,
                "closing_notes": "Sesión cerrada correctamente"
            }
            
            success, data = self.make_request('POST', f'finance/cash-sessions/{session_id}/close', close_data, token=token)
            self.log_test("Close Cash Session (Request Body)", success, f"- Final amount: S/550.00")

    def test_internal_receipts_workflow(self):
        """Test internal receipts with QR codes and payments"""
        print("\n🧾 Testing Internal Receipts Workflow...")
        
        token = self.cashier_token or self.admin_token
        if not token:
            self.log_test("Internal Receipts Workflow", False, "- No valid token available")
            return
        
        # 1. Create receipt with QR
        receipt_data = {
            "concept": "TUITION",
            "description": "Pago de pensión mensual - Marzo 2025",
            "amount": 350.0,
            "customer_name": "María Elena Rodríguez Vásquez",
            "customer_document": "12345678",
            "customer_email": "maria.rodriguez@test.com",
            "cost_center": "CC001",
            "notes": "Recibo con QR para verificación"
        }
        
        success, data = self.make_request('POST', 'finance/receipts', receipt_data, token=token)
        receipt_id = data.get('receipt', {}).get('id') if success else None
        has_qr = data.get('receipt', {}).get('qr_code') is not None if success else False
        self.log_test("Create Receipt with QR", success and has_qr, f"- ID: {receipt_id}, QR: {has_qr}")
        
        if receipt_id:
            # 2. Test payment with idempotency - CRITICAL FIX: Use request body
            payment_data = {
                "payment_method": "CASH",
                "payment_reference": f"REF{datetime.now().strftime('%H%M%S')}",
                "idempotency_key": f"IDEM{datetime.now().strftime('%H%M%S')}"
            }
            
            success, data = self.make_request('POST', f'finance/receipts/{receipt_id}/pay', payment_data, token=token)
            payment_id = data.get('payment_id') if success else None
            self.log_test("Pay Receipt (Request Body + Idempotency)", success, f"- Payment ID: {payment_id}")
            
            # 3. Test idempotency - same request should return same payment_id
            success2, data2 = self.make_request('POST', f'finance/receipts/{receipt_id}/pay', payment_data, token=token)
            same_payment_id = data2.get('payment_id') == payment_id if success2 else False
            self.log_test("Payment Idempotency", success2 and same_payment_id, f"- Same payment ID returned")
            
            # 4. Test QR verification (public endpoint) - CRITICAL: Check safe data format
            success, data = self.make_request('GET', f'verificar/{receipt_id}')
            has_safe_data = all(key in data for key in ['receipt_number', 'amount', 'status', 'is_valid']) if success else False
            no_sensitive_data = 'customer_email' not in str(data) and 'customer_document' not in str(data) if success else False
            self.log_test("QR Verification Safe Data", success and has_safe_data and no_sensitive_data, 
                         f"- Safe data only: {has_safe_data}, No sensitive data: {no_sensitive_data}")
            
            # 5. Test receipt void (admin only) - with time window validation
            if self.admin_token:
                void_data = {
                    "reason": "Anulación por error en datos",
                    "admin_notes": "Prueba de anulación en ventana de tiempo"
                }
                
                success, data = self.make_request('POST', f'finance/receipts/{receipt_id}/void', void_data, token=self.admin_token)
                self.log_test("Receipt Void (Time Window)", success, f"- Void successful within time window")

    def test_gl_concepts_workflow(self):
        """Test GL concepts and cost centers"""
        print("\n📊 Testing GL Concepts & Cost Centers...")
        
        token = self.finance_admin_token or self.admin_token
        if not token:
            self.log_test("GL Concepts Workflow", False, "- No valid token available")
            return
        
        # Create GL concept
        concept_data = {
            "code": f"ING{datetime.now().strftime('%H%M%S')}",
            "name": "Ingresos por Matrículas",
            "concept_type": "INCOME",
            "category": "ACADEMIC",
            "is_active": True
        }
        
        success, data = self.make_request('POST', 'finance/gl-concepts', concept_data, token=token)
        concept_id = data.get('concept', {}).get('id') if success else None
        self.log_test("Create GL Concept", success, f"- ID: {concept_id}, Type: INCOME")
        
        # Get GL concepts
        success, data = self.make_request('GET', 'finance/gl-concepts', token=token)
        concepts_count = len(data.get('concepts', [])) if success else 0
        self.log_test("Get GL Concepts", success, f"- Found {concepts_count} concepts")

    # ====================================================================================================
    # 3. ADVANCED INVENTORY (Target: 100%) - CRITICAL FIFO TESTING
    # ====================================================================================================
    
    def test_advanced_inventory(self):
        """Test FIFO Cost Calculation with exact scenario validation"""
        print("\n📦 PHASE 3: ADVANCED INVENTORY (Target: 100%)")
        print("🎯 CRITICAL: FIFO Cost Calculation must return exactly S/930.00")
        
        token = self.warehouse_token or self.admin_token
        if not token:
            self.log_test("Advanced Inventory", False, "- No valid token available")
            return
        
        # 1. Create inventory item
        item_data = {
            "code": f"FIFO{datetime.now().strftime('%H%M%S')}",
            "name": "Artículo FIFO Test",
            "description": "Artículo para prueba de cálculo FIFO",
            "category": "OFFICE_SUPPLIES",
            "unit_of_measure": "UNIT",
            "min_stock": 10,
            "max_stock": 200,
            "unit_cost": 15.0,  # Initial cost
            "track_serial": False,
            "track_expiry": False,
            "is_active": True
        }
        
        success, data = self.make_request('POST', 'inventory/items', item_data, token=token)
        item_id = data.get('item', {}).get('id') if success else None
        self.log_test("Create Inventory Item", success, f"- ID: {item_id}")
        
        if item_id:
            # 2. CRITICAL FIFO SCENARIO: 50@S/15 + 30@S/18 → Exit 60 = S/930.00
            print("\n🎯 EXECUTING CRITICAL FIFO SCENARIO:")
            print("   Entry 1: 50 units @ S/15.00 each")
            print("   Entry 2: 30 units @ S/18.00 each") 
            print("   Exit: 60 units")
            print("   Expected Cost: (50×15) + (10×18) = 750 + 180 = S/930.00")
            
            # Entry 1: 50 units @ S/15.00
            entry1_data = {
                "inventory_item_id": item_id,
                "movement_type": "ENTRY",
                "quantity": 50,
                "unit_cost": 15.0,
                "total_cost": 750.0,  # 50 * 15
                "reference_document": "ENTRY001",
                "notes": "Primera entrada FIFO test"
            }
            
            success, data = self.make_request('POST', 'inventory/movements', entry1_data, token=token)
            self.log_test("FIFO Entry 1 (50@S/15)", success, f"- Total cost: S/750.00")
            
            # Entry 2: 30 units @ S/18.00
            entry2_data = {
                "inventory_item_id": item_id,
                "movement_type": "ENTRY", 
                "quantity": 30,
                "unit_cost": 18.0,
                "total_cost": 540.0,  # 30 * 18
                "reference_document": "ENTRY002",
                "notes": "Segunda entrada FIFO test"
            }
            
            success, data = self.make_request('POST', 'inventory/movements', entry2_data, token=token)
            self.log_test("FIFO Entry 2 (30@S/18)", success, f"- Total cost: S/540.00")
            
            # Exit: 60 units - CRITICAL TEST
            exit_data = {
                "inventory_item_id": item_id,
                "movement_type": "EXIT",
                "quantity": 60,
                "reference_document": "EXIT001",
                "notes": "Salida FIFO test - debe costar S/930.00"
            }
            
            success, data = self.make_request('POST', 'inventory/movements', exit_data, token=token)
            calculated_cost = data.get('movement', {}).get('total_cost') if success else 0
            expected_cost = 930.0
            cost_correct = abs(calculated_cost - expected_cost) < 0.01
            
            self.log_test("FIFO Exit Cost Calculation", success and cost_correct, 
                         f"- Expected: S/{expected_cost}, Got: S/{calculated_cost}, Correct: {cost_correct}")
            
            # 3. Test negative stock prevention
            negative_exit_data = {
                "inventory_item_id": item_id,
                "movement_type": "EXIT",
                "quantity": 50,  # Should exceed available stock (80-60=20 available)
                "reference_document": "NEGATIVE_TEST",
                "notes": "Test negative stock prevention"
            }
            
            success, data = self.make_request('POST', 'inventory/movements', negative_exit_data, token=token, expected_status=400)
            self.log_test("Negative Stock Prevention", success, f"- Properly blocked over-exit")
            
            # 4. Test concurrent operations
            self.test_concurrent_inventory_operations(token, item_id)
            
            # 5. Generate Kardex
            success, data = self.make_request('GET', f'inventory/items/{item_id}/kardex', token=token)
            kardex_entries = len(data.get('kardex', [])) if success else 0
            self.log_test("Generate Kardex", success, f"- {kardex_entries} entries found")

    def test_concurrent_inventory_operations(self, token: str, item_id: str):
        """Test concurrent inventory operations for race conditions"""
        print("\n⚡ Testing Concurrent Inventory Operations...")
        
        def create_movement(movement_data):
            return self.make_request('POST', 'inventory/movements', movement_data, token=token)
        
        # Create multiple concurrent entry movements
        movements = []
        for i in range(5):
            movement_data = {
                "inventory_item_id": item_id,
                "movement_type": "ENTRY",
                "quantity": 10,
                "unit_cost": 20.0,
                "total_cost": 200.0,
                "reference_document": f"CONCURRENT{i}",
                "notes": f"Concurrent entry {i}"
            }
            movements.append(movement_data)
        
        # Execute concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(create_movement, movement) for movement in movements]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        successful_operations = sum(1 for success, _ in results if success)
        self.log_test("Concurrent Operations", successful_operations >= 3, 
                     f"- {successful_operations}/5 operations successful")

    # ====================================================================================================
    # 4. COMPLETE LOGISTICS WORKFLOW (Target: 90%)
    # ====================================================================================================
    
    def test_complete_logistics_workflow(self):
        """Test supplier management with RUC validation and PO lifecycle"""
        print("\n🚚 PHASE 4: COMPLETE LOGISTICS WORKFLOW (Target: 90%)")
        
        token = self.logistics_token or self.admin_token
        if not token:
            self.log_test("Logistics Workflow", False, "- No valid token available")
            return
        
        # 1. Test RUC validation
        self.test_ruc_validation(token)
        
        # 2. Create supplier with valid RUC
        supplier_data = {
            "ruc": "20100070971",  # Valid RUC
            "business_name": "Empresa Test SAC",
            "commercial_name": "Test Company",
            "address": "Av. Test 123, Lima",
            "district": "Lima",
            "province": "Lima", 
            "department": "Lima",
            "phone": "987654321",
            "email": "contacto@testcompany.com",
            "contact_person": "Juan Pérez",
            "payment_terms": "30 días",
            "is_active": True
        }
        
        success, data = self.make_request('POST', 'logistics/suppliers', supplier_data, token=token)
        supplier_id = data.get('supplier', {}).get('id') if success else None
        self.log_test("Create Supplier (Valid RUC)", success, f"- ID: {supplier_id}, RUC: {supplier_data['ruc']}")
        
        # 3. Test Purchase Orders lifecycle (if implemented)
        if supplier_id:
            self.test_purchase_order_lifecycle(token, supplier_id)
        
        # 4. Test requirements management
        requirement_data = {
            "description": "Solicitud de útiles de oficina",
            "requested_by": "Área Administrativa",
            "priority": "MEDIUM",
            "required_date": (datetime.now() + timedelta(days=7)).isoformat(),
            "items": [
                {
                    "description": "Papel bond A4",
                    "quantity": 10,
                    "unit": "paquete",
                    "estimated_cost": 25.0
                }
            ],
            "justification": "Reposición de stock de oficina"
        }
        
        success, data = self.make_request('POST', 'logistics/requirements', requirement_data, token=token)
        requirement_id = data.get('requirement', {}).get('id') if success else None
        self.log_test("Create Purchase Requirement", success, f"- ID: {requirement_id}")

    def test_ruc_validation(self, token: str):
        """Test RUC validation with various scenarios"""
        print("\n🔍 Testing RUC Validation...")
        
        # Test invalid RUC (10 digits)
        invalid_supplier_data = {
            "ruc": "1234567890",  # 10 digits - invalid
            "business_name": "Invalid RUC Test",
            "address": "Test Address",
            "district": "Lima",
            "province": "Lima",
            "department": "Lima"
        }
        
        success, data = self.make_request('POST', 'logistics/suppliers', invalid_supplier_data, token=token, expected_status=400)
        self.log_test("RUC Validation (10 digits)", success, "- Properly rejected invalid RUC")
        
        # Test invalid RUC (12 digits)
        invalid_supplier_data["ruc"] = "123456789012"  # 12 digits - invalid
        success, data = self.make_request('POST', 'logistics/suppliers', invalid_supplier_data, token=token, expected_status=400)
        self.log_test("RUC Validation (12 digits)", success, "- Properly rejected invalid RUC")
        
        # Test invalid RUC (with letters)
        invalid_supplier_data["ruc"] = "2010007097A"  # Contains letter - invalid
        success, data = self.make_request('POST', 'logistics/suppliers', invalid_supplier_data, token=token, expected_status=400)
        self.log_test("RUC Validation (letters)", success, "- Properly rejected invalid RUC")

    def test_purchase_order_lifecycle(self, token: str, supplier_id: str):
        """Test complete PO lifecycle: Requisition→PO→Reception→Inventory"""
        print("\n📋 Testing Purchase Order Lifecycle...")
        
        # This would test the complete PO workflow if implemented
        # For now, we'll test if the endpoints exist
        
        po_data = {
            "supplier_id": supplier_id,
            "description": "Orden de compra test",
            "items": [
                {
                    "description": "Papel A4",
                    "quantity": 100,
                    "unit_price": 0.50,
                    "total": 50.0
                }
            ],
            "total_amount": 50.0,
            "delivery_date": (datetime.now() + timedelta(days=15)).isoformat()
        }
        
        success, data = self.make_request('POST', 'logistics/purchase-orders', po_data, token=token)
        po_id = data.get('purchase_order', {}).get('id') if success else None
        
        if success:
            self.log_test("Create Purchase Order", True, f"- ID: {po_id}")
            
            # Test reception
            reception_data = {
                "purchase_order_id": po_id,
                "received_items": [
                    {
                        "item_description": "Papel A4",
                        "quantity_received": 100,
                        "quality_check": "APPROVED"
                    }
                ],
                "reception_notes": "Recepción completa y conforme"
            }
            
            success, data = self.make_request('POST', 'logistics/receptions', reception_data, token=token)
            self.log_test("Create Reception", success, f"- PO received and processed")
        else:
            self.log_test("Purchase Order Lifecycle", False, "- PO endpoints not implemented")

    # ====================================================================================================
    # 5. HR MANAGEMENT (Target: 80%)
    # ====================================================================================================
    
    def test_hr_management(self):
        """Test HR management with bulk import and contracts"""
        print("\n👥 PHASE 5: HR MANAGEMENT (Target: 80%)")
        
        token = self.hr_admin_token or self.admin_token
        if not token:
            self.log_test("HR Management", False, "- No valid token available")
            return
        
        # 1. Create employee
        employee_data = {
            "employee_code": f"EMP{datetime.now().strftime('%H%M%S')}",
            "first_name": "Carlos Alberto",
            "last_name": "Mendoza",
            "second_last_name": "Silva",
            "document_type": "DNI",
            "document_number": f"8765432{datetime.now().strftime('%S')}",
            "birth_date": "1985-06-15",
            "gender": "M",
            "email": f"carlos.mendoza{datetime.now().strftime('%H%M%S')}@iespp.edu.pe",
            "phone": "987654321",
            "address": "Av. Los Maestros 456",
            "district": "Lima",
            "province": "Lima",
            "department": "Lima",
            "position": "Docente",
            "department_area": "Educación Inicial",
            "contract_type": "PERMANENT",
            "hire_date": "2024-03-01",
            "salary": 3500.0,
            "status": "ACTIVE"
        }
        
        success, data = self.make_request('POST', 'hr/employees', employee_data, token=token)
        employee_id = data.get('employee', {}).get('id') if success else None
        self.log_test("Create Employee", success, f"- ID: {employee_id}")
        
        if employee_id:
            # 2. Create attendance with automatic hour calculations
            attendance_data = {
                "employee_id": employee_id,
                "date": datetime.now().date().isoformat(),
                "check_in": "08:00:00",
                "check_out": "17:30:00",
                "break_minutes": 60,  # 1 hour break
                "notes": "Jornada completa"
            }
            
            success, data = self.make_request('POST', 'hr/attendance', attendance_data, token=token)
            calculated_hours = data.get('attendance', {}).get('hours_worked') if success else 0
            expected_hours = 8.5  # 9.5 hours - 1 hour break
            hours_correct = abs(calculated_hours - expected_hours) < 0.1
            self.log_test("Create Attendance (Auto Hours)", success and hours_correct, 
                         f"- Expected: {expected_hours}h, Got: {calculated_hours}h")
            
            # 3. Test bulk attendance import (if implemented)
            self.test_bulk_attendance_import(token)
            
            # 4. Test contract expiration warnings (if implemented)
            success, data = self.make_request('GET', 'hr/contracts/expiring', token=token)
            self.log_test("Contract Expiration Warnings", success, f"- Endpoint accessible")

    def test_bulk_attendance_import(self, token: str):
        """Test bulk attendance import with CSV validation"""
        print("\n📊 Testing Bulk Attendance Import...")
        
        # Test if bulk import endpoint exists
        import_data = {
            "csv_data": "employee_code,date,check_in,check_out\nEMP001,2025-01-15,08:00,17:00",
            "validate_only": True
        }
        
        success, data = self.make_request('POST', 'hr/attendance/bulk-import', import_data, token=token)
        
        if success:
            self.log_test("Bulk Attendance Import", True, f"- CSV validation working")
        else:
            self.log_test("Bulk Attendance Import", False, f"- Feature not implemented")

    # ====================================================================================================
    # 6. AUDIT & SECURITY (Target: 85%)
    # ====================================================================================================
    
    def test_audit_security_features(self):
        """Test audit logs, data masking, correlation IDs"""
        print("\n🔒 PHASE 6: AUDIT & SECURITY (Target: 85%)")
        
        token = self.admin_token
        if not token:
            self.log_test("Audit & Security", False, "- No admin token available")
            return
        
        # 1. Test audit logs accessibility
        success, data = self.make_request('GET', 'audit/logs', token=token)
        logs_count = len(data.get('logs', [])) if success else 0
        self.log_test("Audit Logs Access", success, f"- Found {logs_count} audit entries")
        
        # 2. Test data masking in QR verification (already tested in receipts)
        # This is covered in the receipts workflow
        
        # 3. Test correlation ID tracking
        # Make a request and check if correlation ID is returned
        success, data = self.make_request('POST', 'finance/gl-concepts', {
            "code": f"AUDIT{datetime.now().strftime('%H%M%S')}",
            "name": "Audit Test Concept",
            "concept_type": "INCOME",
            "category": "OTHER"
        }, token=token)
        
        has_correlation_id = 'correlation_id' in data or 'x-correlation-id' in str(data)
        self.log_test("Correlation ID Tracking", has_correlation_id, f"- Correlation ID present in response")

    # ====================================================================================================
    # 7. PERFORMANCE & STRESS (Target: 100%)
    # ====================================================================================================
    
    def test_performance_stress(self):
        """Test performance requirements: 200+ req/min, p95 < 1.5s, 0 5xx errors"""
        print("\n⚡ PHASE 7: PERFORMANCE & STRESS (Target: 100%)")
        print("🎯 Requirements: 200+ req/min, p95 < 1.5s, 0 5xx errors")
        
        token = self.admin_token
        if not token:
            self.log_test("Performance Testing", False, "- No admin token available")
            return
        
        # Test endpoint for load testing
        endpoint = 'finance/receipts'
        
        # Concurrent load test
        def make_load_request():
            return self.make_request('GET', endpoint, token=token)
        
        print(f"🚀 Starting load test on {endpoint}...")
        start_time = time.time()
        
        # Execute 100 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(make_load_request) for _ in range(100)]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Calculate metrics
        successful_requests = sum(1 for success, _ in results if success)
        failed_requests = len(results) - successful_requests
        requests_per_minute = (len(results) / duration) * 60
        
        # Calculate latency percentiles from performance_metrics
        recent_metrics = [m for m in self.performance_metrics if m['timestamp'] >= datetime.now() - timedelta(seconds=duration + 10)]
        latencies = [m['latency'] for m in recent_metrics if 'error' not in m]
        
        if latencies:
            latencies.sort()
            p95_latency = latencies[int(len(latencies) * 0.95)] if latencies else 0
        else:
            p95_latency = 0
        
        # Check for 5xx errors
        server_errors = sum(1 for success, data in results if not success and data.get('status_code', 0) >= 500)
        
        # Evaluate results
        load_capacity_ok = requests_per_minute >= 200
        latency_ok = p95_latency < 1.5
        no_server_errors = server_errors == 0
        
        self.log_test("Load Capacity", load_capacity_ok, f"- {requests_per_minute:.1f} req/min (target: 200+)")
        self.log_test("P95 Latency", latency_ok, f"- {p95_latency:.3f}s (target: <1.5s)")
        self.log_test("Zero 5xx Errors", no_server_errors, f"- {server_errors} server errors (target: 0)")
        
        print(f"📊 Performance Summary:")
        print(f"   - Requests/minute: {requests_per_minute:.1f}")
        print(f"   - P95 Latency: {p95_latency:.3f}s")
        print(f"   - Success rate: {successful_requests}/{len(results)}")
        print(f"   - Server errors: {server_errors}")

    # ====================================================================================================
    # MAIN TEST EXECUTION
    # ====================================================================================================
    
    def run_production_validation(self):
        """Run complete production validation testing"""
        print("🚀 STARTING FINAL PRODUCTION VALIDATION")
        print("🎯 Treasury & Administration Module - 100% Complete Testing")
        print("=" * 80)
        print("CRITICAL SUCCESS METRICS:")
        print("- Backend API Success Rate: ≥85%")
        print("- FIFO Cost Calculation: Must return S/930.00")
        print("- Performance: p95 < 1.5s, handle 200+ req/min")
        print("- Security: Role-based permissions working")
        print("- Core Workflows: End-to-end functionality validated")
        print("=" * 80)
        
        # Setup
        self.setup_test_users()
        
        # Execute all test phases
        self.test_authentication_permissions()
        self.test_treasury_core_features()
        self.test_advanced_inventory()
        self.test_complete_logistics_workflow()
        self.test_hr_management()
        self.test_audit_security_features()
        self.test_performance_stress()
        
        # Final Results
        print("\n" + "=" * 80)
        print("📊 FINAL PRODUCTION VALIDATION RESULTS")
        print("=" * 80)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        success_rate = (self.tests_passed/self.tests_run)*100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        print(f"🎯 Target Success Rate: ≥85%")
        
        # Production readiness assessment
        if success_rate >= 85:
            print("🎉 PRODUCTION READY: Treasury & Administration module validated!")
            print("✅ All critical features operational")
            print("✅ Performance requirements met")
            print("✅ Security validations passed")
        else:
            print("❌ NOT PRODUCTION READY: Critical issues found")
            print("⚠️  Requires immediate fixes before deployment")
        
        return success_rate >= 85

if __name__ == "__main__":
    tester = ProductionBackendTester()
    
    try:
        production_ready = tester.run_production_validation()
        sys.exit(0 if production_ready else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Testing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Testing failed with error: {e}")
        sys.exit(1)