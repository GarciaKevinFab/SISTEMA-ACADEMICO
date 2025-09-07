#!/usr/bin/env python3
"""
CRITICAL FIFO VALIDATION TEST - FOCUSED TESTING
Tests the specific FIFO cost calculation scenario from the review request
"""

import requests
import sys
import json
from datetime import datetime

class FIFOTester:
    def __init__(self, base_url="https://academic-treasury.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
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

    def authenticate(self):
        """Authenticate with admin credentials from review request"""
        login_data = {
            "username": "admin@universidad.edu",
            "password": "password123"
        }
        
        success, data = self.make_request('POST', 'auth/login', login_data)
        
        if success and 'access_token' in data:
            self.admin_token = data['access_token']
            self.log_test("Authentication", True, f"- Logged in as {login_data['username']}")
            return True
        else:
            self.log_test("Authentication", False, f"- Error: {data}")
            return False

    def test_critical_fifo_scenario(self):
        """
        Test the critical FIFO scenario:
        1. Create inventory item
        2. Add Entry 1: 50 units @ S/15.00 (total: S/750.00)
        3. Add Entry 2: 30 units @ S/18.00 (total: S/540.00)
        4. Create Exit: 60 units
        5. Expected Result: Total cost = S/930.00 (50×15 + 10×18 = 750 + 180 = 930)
        """
        print("\n🎯 CRITICAL FIFO VALIDATION TEST")
        print("=" * 60)
        
        if not self.authenticate():
            return False

        # Step 1: Create inventory item
        timestamp = datetime.now().strftime('%H%M%S')
        item_data = {
            "code": f"FIFO_TEST_{timestamp}",
            "name": f"FIFO Test Item {timestamp}",
            "description": "Item for FIFO cost calculation testing",
            "category": "OFFICE_SUPPLIES",
            "unit_of_measure": "UNIT",
            "min_stock": 0,
            "max_stock": 1000,
            "unit_cost": 15.00,  # Initial cost
            "track_serial": False,
            "track_expiry": False,
            "is_active": True
        }

        success, data = self.make_request('POST', 'inventory/items', item_data, token=self.admin_token)
        
        if not success or 'item' not in data:
            self.log_test("Step 1: Create Inventory Item", False, f"- Error: {data}")
            return False
        
        item_id = data['item']['id']
        self.log_test("Step 1: Create Inventory Item", True, f"- ID: {item_id}")

        # Step 2: Add Entry 1 - 50 units @ S/15.00
        entry1_data = {
            "item_id": item_id,
            "movement_type": "ENTRY",
            "quantity": 50,
            "unit_cost": 15.00,
            "reason": "FIFO Test Entry 1",
            "notes": "First FIFO entry - 50 units at S/15.00"
        }

        success, data = self.make_request('POST', 'inventory/movements', entry1_data, token=self.admin_token)
        
        if not success or 'movement' not in data:
            self.log_test("Step 2: Entry 1 (50 @ S/15.00)", False, f"- Error: {data}")
            return False
        
        entry1_id = data['movement']['id']
        self.log_test("Step 2: Entry 1 (50 @ S/15.00)", True, f"- ID: {entry1_id}, Total: S/750.00")

        # Step 3: Add Entry 2 - 30 units @ S/18.00
        entry2_data = {
            "item_id": item_id,
            "movement_type": "ENTRY",
            "quantity": 30,
            "unit_cost": 18.00,
            "reason": "FIFO Test Entry 2",
            "notes": "Second FIFO entry - 30 units at S/18.00"
        }

        success, data = self.make_request('POST', 'inventory/movements', entry2_data, token=self.admin_token)
        
        if not success or 'movement' not in data:
            self.log_test("Step 3: Entry 2 (30 @ S/18.00)", False, f"- Error: {data}")
            return False
        
        entry2_id = data['movement']['id']
        self.log_test("Step 3: Entry 2 (30 @ S/18.00)", True, f"- ID: {entry2_id}, Total: S/540.00")

        # Step 4: Create Exit - 60 units (should use FIFO: 50@15 + 10@18 = 930)
        exit_data = {
            "inventory_item_id": item_id,
            "movement_type": "EXIT",
            "quantity": 60,
            "reference": f"EXIT_{timestamp}",
            "notes": "FIFO exit - 60 units (50@15 + 10@18 = 930)"
        }

        success, data = self.make_request('POST', 'inventory/movements', exit_data, token=self.admin_token)
        
        if not success or 'movement' not in data:
            self.log_test("Step 4: Exit Movement (60 units)", False, f"- Error: {data}")
            return False
        
        exit_id = data['movement']['id']
        total_cost = data['movement'].get('total_cost', 0)
        
        # Step 5: Validate FIFO calculation
        expected_cost = 930.00  # 50×15 + 10×18 = 750 + 180 = 930
        cost_correct = abs(total_cost - expected_cost) < 0.01
        
        self.log_test("Step 4: Exit Movement (60 units)", True, f"- ID: {exit_id}")
        self.log_test("Step 5: FIFO Cost Calculation", cost_correct, 
                     f"- Expected: S/{expected_cost:.2f}, Got: S/{total_cost:.2f}")

        # Additional validation: Check stock levels
        success, stock_data = self.make_request('GET', f'inventory/items/{item_id}', token=self.admin_token)
        
        if success and 'item' in stock_data:
            current_stock = stock_data['item'].get('current_stock', 0)
            expected_stock = 20  # 50 + 30 - 60 = 20
            stock_correct = current_stock == expected_stock
            
            self.log_test("Step 6: Stock Level Validation", stock_correct,
                         f"- Expected: {expected_stock}, Got: {current_stock}")
        else:
            self.log_test("Step 6: Stock Level Validation", False, f"- Error: {stock_data}")

        # Get movement history for verification
        success, history_data = self.make_request('GET', f'inventory/movements?inventory_item_id={item_id}', 
                                                 token=self.admin_token)
        
        if success and 'movements' in history_data:
            movements = history_data['movements']
            movements_count = len(movements)
            self.log_test("Step 7: Movement History", True, f"- Found {movements_count} movements")
            
            # Print movement details for debugging
            print("\n📋 Movement History:")
            for i, movement in enumerate(movements, 1):
                print(f"  {i}. {movement.get('movement_type', 'N/A')} - "
                      f"Qty: {movement.get('quantity', 0)}, "
                      f"Unit Cost: S/{movement.get('unit_cost', 0):.2f}, "
                      f"Total: S/{movement.get('total_cost', 0):.2f}")
        else:
            self.log_test("Step 7: Movement History", False, f"- Error: {history_data}")

        return cost_correct

    def run_test(self):
        """Run the critical FIFO test"""
        print("🚀 STARTING CRITICAL FIFO VALIDATION TEST")
        print("🎯 OBJECTIVE: Validate FIFO cost calculation fix")
        print("=" * 80)
        
        success = self.test_critical_fifo_scenario()
        
        print("\n" + "=" * 80)
        print(f"📊 FIFO TEST RESULTS")
        print("=" * 80)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        success_rate = (self.tests_passed/self.tests_run)*100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if success:
            print("🎉 FIFO CALCULATION FIX VALIDATED: Working correctly!")
        else:
            print("❌ FIFO CALCULATION BROKEN: Requires immediate fix!")
        
        return success

if __name__ == "__main__":
    tester = FIFOTester()
    success = tester.run_test()
    sys.exit(0 if success else 1)