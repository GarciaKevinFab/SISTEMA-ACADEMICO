from __future__ import annotations
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timezone
from enum import Enum
import uuid

# Import finance enums
from finance_enums import PaymentMethod, ReceiptStatus

# Finance and Administration Models

# Cash and Bank Models
class BankAccountCreate(BaseModel):
    account_name: str = Field(..., min_length=3, max_length=100)
    bank_name: str = Field(..., min_length=3, max_length=50)
    account_number: str = Field(..., min_length=10, max_length=30)
    account_type: str = Field(..., pattern="^(SAVINGS|CHECKING|CTS)$")
    currency: str = Field(default="PEN", pattern="^(PEN|USD)$")
    is_active: bool = True

class BankAccount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_name: str
    bank_name: str
    account_number: str
    account_type: str
    currency: str = "PEN"
    current_balance: float = 0.0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class CashSessionCreate(BaseModel):
    initial_amount: float = Field(..., ge=0)
    cashier_notes: Optional[str] = Field(None, max_length=500)

class CashSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_number: str = Field(default_factory=lambda: f"CAJA{datetime.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:6].upper()}")
    
    # Session details
    initial_amount: float
    final_amount: Optional[float] = None
    difference: Optional[float] = None
    
    # Status and dates
    status: str = "OPEN"  # CashSessionStatus
    opened_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    closed_at: Optional[datetime] = None
    reconciled_at: Optional[datetime] = None
    
    # Users
    opened_by: str
    closed_by: Optional[str] = None
    reconciled_by: Optional[str] = None
    
    # Notes
    cashier_notes: Optional[str] = None
    closing_notes: Optional[str] = None
    reconciliation_notes: Optional[str] = None
    
    # Totals (calculated)
    total_income: float = 0.0
    total_expense: float = 0.0
    expected_final_amount: float = 0.0

class CashMovementCreate(BaseModel):
    cash_session_id: str
    movement_type: str = Field(..., pattern="^(INCOME|EXPENSE|TRANSFER)$")
    amount: float = Field(..., gt=0)
    concept: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    reference_id: Optional[str] = None  # Link to receipt, invoice, etc.
    cost_center: Optional[str] = None
    counterpart_account: Optional[str] = None  # For transfers

class CashMovement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cash_session_id: str
    movement_number: str = Field(default_factory=lambda: f"MOV{datetime.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:8].upper()}")
    
    # Movement details
    movement_type: str
    amount: float
    concept: str
    description: Optional[str] = None
    
    # References
    reference_id: Optional[str] = None
    cost_center: Optional[str] = None
    counterpart_account: Optional[str] = None
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

# Receipt Models (Boletas Internas)
class ReceiptCreate(BaseModel):
    concept: str = Field(..., pattern="^(ENROLLMENT|TUITION|CERTIFICATE|PROCEDURE|OTHER)$")
    description: str = Field(..., min_length=5, max_length=200)
    amount: float = Field(..., gt=0)
    
    # Customer details
    customer_name: str = Field(..., min_length=3, max_length=100)
    customer_document: str = Field(..., min_length=8, max_length=20)
    customer_email: Optional[str] = Field(None, pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    
    # Additional details
    cost_center: Optional[str] = None
    due_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)

class Receipt(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    receipt_number: str = Field(default_factory=lambda: f"REC-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}")
    series: str = Field(default="001")
    correlative: int
    
    # Receipt details
    concept: str
    description: str
    amount: float
    
    # Customer details
    customer_name: str
    customer_document: str
    customer_email: Optional[str] = None
    
    # Status and dates
    status: str = "PENDING"  # ReceiptStatus
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    paid_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    
    # Payment details
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    
    # Additional details
    cost_center: Optional[str] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    
    # System fields
    qr_code: Optional[str] = None
    pdf_path: Optional[str] = None
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

# GL Concepts and Cost Centers
class GLConceptCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=20)
    name: str = Field(..., min_length=3, max_length=100)
    concept_type: str = Field(..., pattern="^(INCOME|EXPENSE)$")
    category: Optional[str] = Field(None, max_length=50)
    is_active: bool = True

class GLConcept(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    concept_type: str
    category: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class CostCenterCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=10)
    name: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    responsible_user_id: Optional[str] = None
    is_active: bool = True

class CostCenter(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    description: Optional[str] = None
    responsible_user_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

# Income/Expense Models
class IncomeExpenseCreate(BaseModel):
    movement_type: str = Field(..., pattern="^(INCOME|EXPENSE)$")
    gl_concept_id: str
    cost_center_id: Optional[str] = None
    amount: float = Field(..., gt=0)
    description: str = Field(..., min_length=5, max_length=500)
    
    # Payment details
    payment_method: str = Field(..., pattern="^(CASH|BANK_DEPOSIT|BANK_TRANSFER|CHECK)$")
    bank_account_id: Optional[str] = None
    reference_number: Optional[str] = Field(None, max_length=50)
    
    # Dates
    operation_date: date
    due_date: Optional[date] = None
    
    # Supporting documents
    document_number: Optional[str] = Field(None, max_length=50)
    supplier_customer: Optional[str] = Field(None, max_length=100)

class IncomeExpense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    voucher_number: str = Field(default_factory=lambda: f"VOU-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}")
    
    # Movement details
    movement_type: str
    gl_concept_id: str
    cost_center_id: Optional[str] = None
    amount: float
    description: str
    
    # Payment details
    payment_method: str
    bank_account_id: Optional[str] = None
    reference_number: Optional[str] = None
    
    # Dates
    operation_date: date
    due_date: Optional[date] = None
    
    # Supporting documents
    document_number: Optional[str] = None
    supplier_customer: Optional[str] = None
    
    # Status
    is_reconciled: bool = False
    reconciled_at: Optional[datetime] = None
    reconciled_by: Optional[str] = None
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Inventory Models
class InventoryItemCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=20)
    name: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=50)
    unit_of_measure: str = Field(..., min_length=1, max_length=10)
    
    # Stock control
    min_stock: int = Field(default=0, ge=0)
    max_stock: Optional[int] = Field(None, ge=0)
    
    # Pricing
    unit_cost: Optional[float] = Field(None, ge=0)
    
    # Settings
    track_serial: bool = False
    track_expiry: bool = False
    is_active: bool = True

class InventoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    unit_of_measure: str
    
    # Current stock
    current_stock: int = 0
    reserved_stock: int = 0
    available_stock: int = 0
    
    # Stock control
    min_stock: int = 0
    max_stock: Optional[int] = None
    
    # Pricing (weighted average)
    unit_cost: Optional[float] = None
    total_value: float = 0.0
    
    # Settings
    track_serial: bool = False
    track_expiry: bool = False
    is_active: bool = True
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InventoryMovementCreate(BaseModel):
    item_id: str
    movement_type: str = Field(..., pattern="^(ENTRY|EXIT|TRANSFER|ADJUSTMENT)$")
    quantity: int = Field(..., gt=0)
    unit_cost: Optional[float] = Field(None, ge=0)
    
    # References
    reference_type: Optional[str] = Field(None, max_length=50)  # PURCHASE, SALE, TRANSFER, etc.
    reference_id: Optional[str] = None
    
    # Details
    reason: str = Field(..., min_length=3, max_length=200)
    notes: Optional[str] = Field(None, max_length=500)
    
    # For transfers
    from_warehouse: Optional[str] = None
    to_warehouse: Optional[str] = None
    
    # For items with expiry
    expiry_date: Optional[date] = None
    batch_number: Optional[str] = Field(None, max_length=50)

class InventoryMovement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    movement_number: str = Field(default_factory=lambda: f"INV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}")
    
    # Movement details
    item_id: str
    movement_type: str
    quantity: int
    unit_cost: Optional[float] = None
    total_cost: Optional[float] = None
    
    # Stock after movement
    stock_before: int
    stock_after: int
    
    # References
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    
    # Details
    reason: str
    notes: Optional[str] = None
    
    # For transfers
    from_warehouse: Optional[str] = None
    to_warehouse: Optional[str] = None
    
    # For items with expiry
    expiry_date: Optional[date] = None
    batch_number: Optional[str] = None
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

# HR Models
class EmployeeCreate(BaseModel):
    # Personal information
    employee_code: Optional[str] = None
    first_name: str = Field(..., min_length=2, max_length=50)
    last_name: str = Field(..., min_length=2, max_length=50)
    document_number: str = Field(..., min_length=8, max_length=20)
    birth_date: date
    
    # Contact information
    email: Optional[str] = Field(None, pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    phone: Optional[str] = Field(None, max_length=15)
    address: Optional[str] = Field(None, max_length=200)
    
    # Employment information
    position: str = Field(..., min_length=3, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    hire_date: date
    contract_type: str = Field(..., pattern="^(PERMANENT|TEMPORARY|CAS|LOCACION)$")
    
    # System user link
    user_id: Optional[str] = None
    
    # Status
    is_active: bool = True

class Employee(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_code: str = Field(default_factory=lambda: f"EMP{datetime.now().year}{str(uuid.uuid4())[:6].upper()}")
    
    # Personal information
    first_name: str
    last_name: str
    document_number: str
    birth_date: date
    
    # Contact information
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    
    # Employment information
    position: str
    department: Optional[str] = None
    hire_date: date
    termination_date: Optional[date] = None
    contract_type: str
    
    # System user link
    user_id: Optional[str] = None
    
    # Status
    status: str = "ACTIVE"  # EmployeeStatus
    is_active: bool = True
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AttendanceCreate(BaseModel):
    employee_id: str
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    break_minutes: int = Field(default=0, ge=0)
    worked_hours: Optional[float] = Field(None, ge=0)
    overtime_hours: Optional[float] = Field(default=0, ge=0)
    notes: Optional[str] = Field(None, max_length=200)

class Attendance(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    date: date
    
    # Time tracking
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    break_minutes: int = 0
    worked_hours: Optional[float] = None
    overtime_hours: float = 0
    
    # Details
    notes: Optional[str] = None
    is_late: bool = False
    is_absent: bool = False
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Audit Log Model
class AuditLogCreate(BaseModel):
    table_name: str
    record_id: str
    action: str = Field(..., pattern="^(CREATE|UPDATE|DELETE)$")
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    user_id: str
    ip_address: Optional[str] = None

class AuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    table_name: str
    record_id: str
    action: str
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    user_id: str
    ip_address: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Logistics Models

class SupplierCreate(BaseModel):
    ruc: str = Field(..., min_length=11, max_length=11)
    company_name: str = Field(..., min_length=3, max_length=200)
    trade_name: Optional[str] = Field(None, max_length=200)
    contact_person: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    phone: Optional[str] = Field(None, max_length=15)
    address: Optional[str] = Field(None, max_length=300)
    
    # Banking
    bank_account: Optional[str] = Field(None, max_length=30)
    bank_name: Optional[str] = Field(None, max_length=50)
    
    is_active: bool = True

class Supplier(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplier_code: str = Field(default_factory=lambda: f"PROV{datetime.now().year}{str(uuid.uuid4())[:6].upper()}")
    
    # Company information
    ruc: str
    company_name: str
    trade_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    
    # Banking
    bank_account: Optional[str] = None
    bank_name: Optional[str] = None
    
    # Performance tracking
    total_orders: int = 0
    completed_orders: int = 0
    average_rating: float = 0.0
    
    # Status
    status: str = "ACTIVE"  # SupplierStatus
    is_active: bool = True
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RequirementItemCreate(BaseModel):
    item_id: Optional[str] = None  # Link to inventory item
    description: str = Field(..., min_length=3, max_length=200)
    quantity: int = Field(..., gt=0)
    unit_of_measure: str = Field(..., min_length=1, max_length=10)
    estimated_unit_price: Optional[float] = Field(None, ge=0)
    technical_specifications: Optional[str] = Field(None, max_length=1000)

class RequirementCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    justification: str = Field(..., min_length=10, max_length=500)
    required_date: date
    cost_center_id: Optional[str] = None
    items: List[RequirementItemCreate] = Field(..., min_items=1)

class RequirementItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requirement_id: str
    item_id: Optional[str] = None
    description: str
    quantity: int
    unit_of_measure: str
    estimated_unit_price: Optional[float] = None
    technical_specifications: Optional[str] = None
    
    # Quotation tracking
    best_quote_price: Optional[float] = None
    selected_supplier_id: Optional[str] = None

class Requirement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requirement_number: str = Field(default_factory=lambda: f"REQ-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}")
    
    # Basic information
    title: str
    description: Optional[str] = None
    justification: str
    required_date: date
    cost_center_id: Optional[str] = None
    
    # Status tracking
    status: str = "DRAFT"  # RequirementStatus
    
    # Approval workflow
    requested_by: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    # Totals
    estimated_total: float = 0.0
    final_total: Optional[float] = None
    
    # Purchase order link
    purchase_order_id: Optional[str] = None
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PurchaseOrderItemCreate(BaseModel):
    requirement_item_id: Optional[str] = None
    item_id: Optional[str] = None
    description: str = Field(..., min_length=3, max_length=200)
    quantity: int = Field(..., gt=0)
    unit_of_measure: str = Field(..., min_length=1, max_length=10)
    unit_price: float = Field(..., gt=0)
    discount_percentage: float = Field(default=0.0, ge=0, le=100)

class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    requirement_id: Optional[str] = None
    delivery_date: date
    delivery_address: Optional[str] = Field(None, max_length=300)
    payment_terms: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)
    items: List[PurchaseOrderItemCreate] = Field(..., min_items=1)

class PurchaseOrderItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    purchase_order_id: str
    requirement_item_id: Optional[str] = None
    item_id: Optional[str] = None
    description: str
    quantity: int
    unit_of_measure: str
    unit_price: float
    discount_percentage: float = 0.0
    subtotal: float
    
    # Receiving tracking
    received_quantity: int = 0
    pending_quantity: int
    is_fully_received: bool = False

class PurchaseOrder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    po_number: str = Field(default_factory=lambda: f"PO-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}")
    
    # Basic information
    supplier_id: str
    requirement_id: Optional[str] = None
    
    # Delivery information
    delivery_date: date
    delivery_address: Optional[str] = None
    
    # Commercial terms
    payment_terms: Optional[str] = None
    currency: str = "PEN"
    
    # Totals
    subtotal: float = 0.0
    discount_amount: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    
    # Status tracking
    status: str = "DRAFT"  # PurchaseOrderStatus
    
    # Dates
    issued_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    fully_received_at: Optional[datetime] = None
    
    # Additional information
    notes: Optional[str] = None
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReceptionCreate(BaseModel):
    purchase_order_id: str
    received_by: str
    reception_date: date = Field(default_factory=date.today)
    notes: Optional[str] = Field(None, max_length=500)
    items: List[dict]  # [{item_id, received_quantity, condition, notes}]

class Reception(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reception_number: str = Field(default_factory=lambda: f"REC-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}")
    
    # Basic information
    purchase_order_id: str
    supplier_id: str  # Copied from PO
    
    # Reception details
    reception_date: date
    received_by: str
    
    # Status
    is_complete: bool = False
    has_discrepancies: bool = False
    
    # Notes
    notes: Optional[str] = None
    discrepancy_notes: Optional[str] = None
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReceptionItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reception_id: str
    purchase_order_item_id: str
    item_id: Optional[str] = None
    
    # Reception details
    ordered_quantity: int
    received_quantity: int
    condition: str = Field(default="GOOD", pattern="^(GOOD|DAMAGED|INCOMPLETE)$")
    
    # Quality control
    quality_approved: bool = True
    quality_notes: Optional[str] = None
    
    # Inventory processing
    processed_to_inventory: bool = False
    inventory_movement_id: Optional[str] = None
    
    # Notes
    notes: Optional[str] = None