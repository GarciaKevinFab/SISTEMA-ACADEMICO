from rest_framework import serializers
from .models import (
    Concept,
    BankAccount,
    CashSession,
    CashMovement,
    StudentAccountCharge,
    StudentAccountPayment,
    BankMovement,
    ReconciliationRun,
    ReconciliationItem,
    IncomeEntry,
    Receipt,
    InventoryItem,          
    InventoryMovement,
    Supplier, PurchaseRequirement, PurchaseRequirementItem,
    PurchaseOrder, PurchaseOrderItem,
    Employee, Attendance, EmployeeContract
)

class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = [
            "id",
            "receipt_number",
            "concept",
            "description",
            "amount",
            "customer_name",
            "customer_document",
            "customer_email",
            "due_date",
            "issued_at",
            "status",
            "payment_method",
            "payment_reference",
            "paid_at",
            "cancel_reason",
            "cancelled_at",
        ]

class ConceptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Concept
        fields = ["id", "code", "name", "type", "default_amount"]


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = ["id", "bank_name", "account_number", "currency"]


class CashSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashSession
        fields = [
            "id",
            "opening_amount",
            "closing_amount",
            "note",
            "status",
            "opened_at",
            "closed_at",
        ]


class CashMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashMovement
        fields = ["id", "session", "type", "amount", "concept", "date"]


class StudentAccountChargeSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentAccountCharge
        fields = [
            "id",
            "subject_id",
            "subject_type",
            "concept",
            "concept_name",
            "amount",
            "due_date",
            "paid",
        ]


class StudentAccountPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentAccountPayment
        fields = [
            "id",
            "subject_id",
            "subject_type",
            "amount",
            "method",
            "ref",
            "date",
            "concept",
            "career_id",
        ]


class BankMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankMovement
        fields = ["id", "account", "date", "description", "amount"]


class ReconciliationRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReconciliationRun
        fields = ["id", "account", "date_from", "date_to", "statement_balance", "diff"]


class ReconciliationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReconciliationItem
        fields = ["id", "run", "movement", "reconciled"]


class IncomeEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomeEntry
        fields = [
            "id",
            "date",
            "subject_id",
            "concept",
            "concept_name",
            "career_id",
            "career_name",
            "amount",
        ]
class InventoryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItem
        fields = [
            "id",
            "code",
            "name",
            "description",
            "category",
            "unit_of_measure",
            "min_stock",
            "max_stock",
            "current_stock",
            "unit_cost",
            "created_at",
            "updated_at",
        ]


class InventoryMovementSerializer(serializers.ModelSerializer):
    item = InventoryItemSerializer(read_only=True)

    class Meta:
        model = InventoryMovement
        fields = [
            "id",
            "item",
            "movement_type",
            "quantity",
            "unit_cost",
            "reason",
            "notes",
            "batch_number",
            "expiry_date",
            "created_at",
        ]

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            "id",
            "supplier_code",
            "ruc",
            "company_name",
            "trade_name",
            "contact_person",
            "email",
            "phone",
            "address",
            "bank_account",
            "bank_name",
            "status",
            "created_at",
            "updated_at",
            # los siguientes los manda el backend como números simples (no columnas)
            # pero los incluimos igual si lo quieres (los llenamos en views):
            "total_orders",
            "completed_orders",
        ]

    total_orders = serializers.IntegerField(read_only=True)
    completed_orders = serializers.IntegerField(read_only=True)


class PurchaseRequirementItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseRequirementItem
        fields = [
            "id",
            "description",
            "quantity",
            "unit_of_measure",
            "estimated_unit_price",
            "technical_specifications",
        ]


class PurchaseRequirementSerializer(serializers.ModelSerializer):
    requester = serializers.SerializerMethodField()
    items = PurchaseRequirementItemSerializer(many=True)

    class Meta:
        model = PurchaseRequirement
        fields = [
            "id",
            "requirement_number",
            "title",
            "description",
            "justification",
            "required_date",
            "status",
            "estimated_total",
            "requester",
            "items",
            "created_at",
            "updated_at",
        ]

    def get_requester(self, obj):
        if not obj.requester:
            return None
        return {"id": obj.requester.id, "username": getattr(obj.requester, "username", "")}
    
class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderItem
        fields = [
            "id",
            "description",
            "quantity",
            "unit_of_measure",
            "unit_price",
            "line_total",
            "technical_specifications",
            "inventory_item",
            "created_at",
        ]


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True, read_only=True)

    supplier_name = serializers.CharField(source="supplier.company_name", read_only=True)
    supplier_ruc = serializers.CharField(source="supplier.ruc", read_only=True)

    requirement_number = serializers.CharField(source="requirement.requirement_number", read_only=True)
    requirement_title = serializers.CharField(source="requirement.title", read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "order_number",

            "requirement",
            "requirement_number",
            "requirement_title",

            "supplier",
            "supplier_name",
            "supplier_ruc",

            "expected_date",
            "note",
            "status",

            "subtotal",
            "tax",
            "total",

            "issued_at",
            "items",

            "created_at",
            "updated_at",
        ]

class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_code",
            "first_name",
            "last_name",
            "document_number",
            "birth_date",
            "email",
            "phone",
            "address",
            "position",
            "department",
            "hire_date",
            "contract_type",
            "salary",
            "emergency_contact_name",
            "emergency_contact_phone",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "employee_code", "created_at", "updated_at"]

    def validate_document_number(self, v):
        v = (v or "").strip()
        if len(v) != 8 or not v.isdigit():
            raise serializers.ValidationError("El DNI debe tener 8 dígitos numéricos")
        return v


class AttendanceSerializer(serializers.ModelSerializer):
    employee = EmployeeSerializer(read_only=True)
    employee_id = serializers.IntegerField(write_only=True)

    worked_hours = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)
    is_late = serializers.BooleanField(read_only=True)
    is_absent = serializers.BooleanField(read_only=True)

    class Meta:
        model = Attendance
        fields = [
            "id",
            "employee",
            "employee_id",
            "date",
            "check_in",
            "check_out",
            "break_minutes",
            "overtime_hours",
            "notes",
            "worked_hours",
            "is_late",
            "is_absent",
            "created_at",
        ]
        read_only_fields = ["id", "employee", "created_at", "worked_hours", "is_late", "is_absent"]

    def validate(self, attrs):
        ci = attrs.get("check_in")
        co = attrs.get("check_out")
        if ci and co and co < ci:
            raise serializers.ValidationError("check_out no puede ser menor que check_in")
        return attrs
    
class EmployeeContractSerializer(serializers.ModelSerializer):
    employee = EmployeeSerializer(read_only=True)
    employee_id = serializers.IntegerField(write_only=True)
    status = serializers.CharField(read_only=True)

    class Meta:
        model = EmployeeContract
        fields = [
            "id",
            "employee",
            "employee_id",
            "contract_type",
            "start_date",
            "end_date",
            "salary",
            "status",
            "notes",
            "document_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "employee", "status", "created_at", "updated_at"]

    def validate(self, attrs):
        sd = attrs.get("start_date")
        ed = attrs.get("end_date")
        if sd and ed and ed < sd:
            raise serializers.ValidationError("end_date no puede ser menor que start_date")
        return attrs
