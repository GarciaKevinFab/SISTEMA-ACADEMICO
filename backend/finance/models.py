from django.conf import settings
from django.db import models


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
