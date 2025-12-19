from django.conf import settings
from django.db import models
from django.utils.timezone import now
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from datetime import date

class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# =====================
# Catálogo de conceptos
# =====================

class Concept(TimeStampedModel):
    TYPE_CHOICES = [
        ("ADMISION", "Admisión"),
        ("MATRICULA", "Matrícula"),
        ("PENSION", "Pensión"),
        ("CERTIFICADO", "Certificado"),
        ("OTRO", "Otro"),
    ]

    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="OTRO")
    default_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.code} - {self.name}"


# ===========
# Caja/Bancos
# ===========

class BankAccount(TimeStampedModel):
    bank_name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=64)
    currency = models.CharField(max_length=8, default="PEN")

    def __str__(self):
        return f"{self.bank_name} {self.account_number}"


class CashSession(TimeStampedModel):
    STATUS_CHOICES = [
        ("OPEN", "Abierta"),
        ("CLOSED", "Cerrada"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cash_sessions",
    )
    opening_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    closing_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="OPEN")
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Sesion #{self.id} ({self.status})"


class CashMovement(TimeStampedModel):
    TYPE_CHOICES = [
        ("IN", "Ingreso"),
        ("OUT", "Egreso"),
    ]

    session = models.ForeignKey(
        CashSession,
        on_delete=models.CASCADE,
        related_name="movements",
    )
    type = models.CharField(max_length=4, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    concept = models.CharField(max_length=255, blank=True)
    date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.session_id} {self.type} {self.amount}"


# ====================
# Estados de cuenta
# ====================

class StudentAccountCharge(TimeStampedModel):
    SUBJECT_TYPE_CHOICES = [
        ("STUDENT", "Alumno"),
        ("APPLICANT", "Postulante"),
    ]

    subject_id = models.CharField(max_length=50)
    subject_type = models.CharField(max_length=20, choices=SUBJECT_TYPE_CHOICES, default="STUDENT")
    concept = models.ForeignKey(Concept, on_delete=models.SET_NULL, null=True, blank=True)
    concept_name = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField(null=True, blank=True)
    paid = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.subject_id} {self.concept_name} {self.amount}"


class StudentAccountPayment(TimeStampedModel):
    METHOD_CHOICES = [
        ("CASH", "Efectivo"),
        ("CARD", "Tarjeta"),
        ("TRANSFER", "Transferencia"),
    ]

    subject_id = models.CharField(max_length=50)
    subject_type = models.CharField(max_length=20, default="STUDENT")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default="CASH")
    ref = models.CharField(max_length=100, blank=True)
    date = models.DateField(null=True, blank=True)
    concept = models.ForeignKey(Concept, on_delete=models.SET_NULL, null=True, blank=True)
    career_id = models.IntegerField(null=True, blank=True)  # para futuro

    def __str__(self):
        return f"{self.subject_id} {self.amount} {self.method}"


# ========================
# Conciliación bancaria
# ========================

class BankMovement(TimeStampedModel):
    account = models.ForeignKey(
        BankAccount,
        on_delete=models.CASCADE,
        related_name="movements",
    )
    date = models.DateField()
    description = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.account_id} {self.date} {self.amount}"


class ReconciliationRun(TimeStampedModel):
    account = models.ForeignKey(BankAccount, on_delete=models.CASCADE)
    date_from = models.DateField()
    date_to = models.DateField()
    statement_balance = models.DecimalField(max_digits=12, decimal_places=2)
    diff = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f"Conciliación {self.account_id} {self.date_from} - {self.date_to}"


class ReconciliationItem(TimeStampedModel):
    run = models.ForeignKey(
        ReconciliationRun,
        on_delete=models.CASCADE,
        related_name="items",
    )
    movement = models.ForeignKey(BankMovement, on_delete=models.CASCADE)
    reconciled = models.BooleanField(default=False)


# ====================
# Reporte de ingresos
# ====================

class IncomeEntry(TimeStampedModel):
    date = models.DateField()
    subject_id = models.CharField(max_length=50, blank=True)
    concept = models.ForeignKey(Concept, on_delete=models.SET_NULL, null=True, blank=True)
    concept_name = models.CharField(max_length=255, blank=True)
    career_id = models.IntegerField(null=True, blank=True)
    career_name = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.date} {self.concept_name} {self.amount}"

class Receipt(TimeStampedModel):
    STATUS_CHOICES = [
        ("PENDING", "Pendiente"),
        ("PAID", "Pagado"),
        ("CANCELLED", "Anulado"),
        ("REFUNDED", "Reembolsado"),
    ]

    CONCEPT_CHOICES = [
        ("ENROLLMENT", "Matrícula"),
        ("TUITION", "Pensión"),
        ("CERTIFICATE", "Constancia/Certificado"),
        ("PROCEDURE", "Trámite"),
        ("ACADEMIC_SERVICES", "Servicios Académicos"),
        ("OTHER", "Otros"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipts",
    )

    receipt_number = models.CharField(max_length=32, unique=True)
    concept = models.CharField(max_length=32, choices=CONCEPT_CHOICES, default="OTHER")
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    customer_name = models.CharField(max_length=120)
    customer_document = models.CharField(max_length=11)
    customer_email = models.EmailField(blank=True, null=True)

    due_date = models.DateField(blank=True, null=True)
    issued_at = models.DateTimeField(default=now)

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING")

    payment_method = models.CharField(max_length=32, blank=True, null=True)
    payment_reference = models.CharField(max_length=64, blank=True, null=True)
    paid_at = models.DateTimeField(blank=True, null=True)

    cancel_reason = models.CharField(max_length=255, blank=True, null=True)
    cancelled_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return self.receipt_number
    
    # ====================
# Inventario
# ====================

class InventoryItem(TimeStampedModel):
    UNIT_CHOICES = [
        ("UNIT", "Unidad"),
        ("DOZEN", "Docena"),
        ("KG", "Kilogramo"),
        ("L", "Litro"),
        ("M", "Metro"),
        ("PKG", "Paquete"),
        ("BOX", "Caja"),
    ]

    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=120, blank=True)
    unit_of_measure = models.CharField(max_length=20, choices=UNIT_CHOICES, default="UNIT")

    min_stock = models.IntegerField(default=0)
    max_stock = models.IntegerField(default=0)

    current_stock = models.IntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # costo referencial

    def __str__(self):
        return f"{self.code} - {self.name}"


class InventoryMovement(TimeStampedModel):
    MOVEMENT_CHOICES = [
        ("ENTRY", "Entrada"),
        ("EXIT", "Salida"),
        ("TRANSFER", "Transferencia"),
        ("ADJUSTMENT", "Ajuste"),
    ]

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="movements")
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_CHOICES)
    quantity = models.IntegerField()
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    reason = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    batch_number = models.CharField(max_length=80, blank=True)
    expiry_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.item.code} {self.movement_type} {self.quantity}"

class Supplier(TimeStampedModel):
    STATUS_CHOICES = [
        ("ACTIVE", "Activo"),
        ("INACTIVE", "Inactivo"),
        ("BLACKLISTED", "Lista Negra"),
    ]

    supplier_code = models.CharField(max_length=20, unique=True)
    ruc = models.CharField(max_length=11, unique=True)

    company_name = models.CharField(max_length=255)
    trade_name = models.CharField(max_length=255, blank=True)

    contact_person = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)

    bank_account = models.CharField(max_length=64, blank=True)
    bank_name = models.CharField(max_length=100, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ACTIVE")

    def __str__(self):
        return f"{self.supplier_code} - {self.company_name}"


class PurchaseRequirement(TimeStampedModel):
    STATUS_CHOICES = [
        ("DRAFT", "Borrador"),
        ("SUBMITTED", "Enviado"),
        ("APPROVED", "Aprobado"),
        ("REJECTED", "Rechazado"),
        ("CONVERTED_TO_PO", "Convertido a OC"),
    ]

    requirement_number = models.CharField(max_length=30, unique=True)

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    justification = models.TextField()
    required_date = models.DateField(null=True, blank=True)

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_requirements",
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="DRAFT")
    estimated_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    def __str__(self):
        return self.requirement_number


class PurchaseRequirementItem(TimeStampedModel):
    UNIT_CHOICES = InventoryItem.UNIT_CHOICES  # reutilizamos lo mismo

    requirement = models.ForeignKey(
        PurchaseRequirement,
        on_delete=models.CASCADE,
        related_name="items",
    )

    description = models.CharField(max_length=255)
    quantity = models.IntegerField()
    unit_of_measure = models.CharField(max_length=20, choices=UNIT_CHOICES, default="UNIT")
    estimated_unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    technical_specifications = models.TextField(blank=True)

    def __str__(self):
        return f"{self.requirement.requirement_number} - {self.description}"

class PurchaseOrder(TimeStampedModel):
    STATUS_CHOICES = [
        ("DRAFT", "Borrador"),
        ("SENT", "Enviada"),
        ("RECEIVED", "Recibida"),
        ("CANCELLED", "Anulada"),
    ]

    order_number = models.CharField(max_length=30, unique=True)

    requirement = models.ForeignKey(
        PurchaseRequirement,
        on_delete=models.PROTECT,
        related_name="purchase_orders",
    )

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="purchase_orders",
    )

    expected_date = models.DateField(null=True, blank=True)
    note = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="DRAFT")

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))   # si quieres IGV: subtotal*0.18
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    issued_at = models.DateTimeField(default=now)

    def __str__(self):
        return self.order_number


class PurchaseOrderItem(TimeStampedModel):
    UNIT_CHOICES = InventoryItem.UNIT_CHOICES

    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="items",
    )

    description = models.CharField(max_length=255)
    quantity = models.IntegerField()
    unit_of_measure = models.CharField(max_length=20, choices=UNIT_CHOICES, default="UNIT")

    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    technical_specifications = models.TextField(blank=True)

    # opcional: si lo mapeas, al "recibir" puede ingresar a inventario automático
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="po_lines",
    )

    def __str__(self):
        return f"{self.purchase_order.order_number} - {self.description}"

User = get_user_model()


class Employee(models.Model):
    CONTRACT_TYPES = [
        ("PERMANENT", "Nombrado/Permanente"),
        ("TEMPORARY", "Contratado"),
        ("CAS", "CAS"),
        ("LOCACION", "Locación de Servicios"),
    ]

    STATUSES = [
        ("ACTIVE", "Activo"),
        ("INACTIVE", "Inactivo"),
        ("SUSPENDED", "Suspendido"),
        ("RETIRED", "Cesante/Jubilado"),
        ("TERMINATED", "Cesado"),
    ]

    employee_code = models.CharField(max_length=32, unique=True)
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)

    document_number = models.CharField(max_length=16, unique=True)  # DNI
    birth_date = models.DateField(null=True, blank=True)

    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=32, null=True, blank=True)
    address = models.TextField(null=True, blank=True)

    position = models.CharField(max_length=120)
    department = models.CharField(max_length=120, null=True, blank=True)
    hire_date = models.DateField(null=True, blank=True)

    contract_type = models.CharField(max_length=20, choices=CONTRACT_TYPES, default="PERMANENT")
    salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    emergency_contact_name = models.CharField(max_length=120, null=True, blank=True)
    emergency_contact_phone = models.CharField(max_length=32, null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUSES, default="ACTIVE")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.employee_code} - {self.first_name} {self.last_name}"

class Attendance(models.Model):
    employee = models.ForeignKey(Employee, related_name="attendance", on_delete=models.CASCADE)
    date = models.DateField()

    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)

    break_minutes = models.IntegerField(default=0)
    overtime_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    notes = models.TextField(null=True, blank=True)

    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="hr_attendance_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("employee", "date")
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"{self.employee.employee_code} - {self.date}"
    
class EmployeeContract(TimeStampedModel):
    """
    Historial de contratos por empleado.
    Serializer y views ya lo usan, así que esto era obligatorio.
    """

    CONTRACT_TYPES = Employee.CONTRACT_TYPES

    employee = models.ForeignKey(
        Employee,
        related_name="contracts",
        on_delete=models.CASCADE,
    )

    contract_type = models.CharField(max_length=20, choices=CONTRACT_TYPES, default="PERMANENT")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    document_url = models.URLField(blank=True, null=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="hr_contracts_created",
    )

    class Meta:
        ordering = ["-start_date", "-id"]
        indexes = [
            models.Index(fields=["employee", "start_date"]),
            models.Index(fields=["start_date"]),
        ]

    def clean(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValidationError("end_date no puede ser menor que start_date")

    @property
    def status(self):
        today = date.today()
        if self.start_date and self.start_date > today:
            return "UPCOMING"
        if self.end_date and self.end_date < today:
            return "EXPIRED"
        return "ACTIVE"

    def __str__(self):
        return f"{self.employee.employee_code} {self.contract_type} {self.start_date} - {self.end_date or '∞'}"
