from django.db import models

# Create your models here.
from django.db import models

CURRENCY_CHOICES = (("PEN","PEN"), ("USD","USD"))
SUBJECT_TYPES = (("STUDENT","STUDENT"), ("APPLICANT","APPLICANT"))

class FinanceConcept(models.Model):
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=30, unique=True)
    default_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    active = models.BooleanField(default=True)
    def __str__(self): return f"{self.code} - {self.name}"

class BankAccount(models.Model):
    name = models.CharField(max_length=120)
    bank = models.CharField(max_length=80, blank=True, default="")
    number = models.CharField(max_length=60, unique=True)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default="PEN")
    def __str__(self): return f"{self.bank} {self.number}"

class BankMovement(models.Model):
    account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name="movements")
    date = models.DateField()
    description = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=12, decimal_places=2)  # + abono / - cargo
    external_ref = models.CharField(max_length=80, blank=True, default="")
    reconciled = models.BooleanField(default=False)

class AccountEntry(models.Model):
    # Libro por sujeto (alumno / postulante)
    subject_type = models.CharField(max_length=20, choices=SUBJECT_TYPES)
    subject_id = models.IntegerField()
    concept = models.ForeignKey(FinanceConcept, on_delete=models.SET_NULL, null=True, blank=True)
    date = models.DateField()
    # cargos positivos, pagos negativos (o usa dos columnas si prefieres)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=20, blank=True, default="")  # efectivo, yape, etc.
    ref = models.CharField(max_length=80, blank=True, default="")
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [models.Index(fields=["subject_type","subject_id","date"])]

class IncomeAggregate(models.Model):
    # cache de reportes por rango (MVP)
    date_from = models.DateField()
    date_to = models.DateField()
    concept = models.ForeignKey(FinanceConcept, null=True, blank=True, on_delete=models.SET_NULL)
    career_id = models.IntegerField(null=True, blank=True)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    meta = models.JSONField(default=dict, blank=True)
