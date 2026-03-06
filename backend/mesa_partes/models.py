from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Office(models.Model):
    name        = models.CharField(max_length=120)
    description = models.TextField(blank=True)           # ← ADDED
    is_active   = models.BooleanField(default=True)      # ← ADDED

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ProcedureType(models.Model):
    name               = models.CharField(max_length=120)
    description        = models.TextField(blank=True)
    required_documents = models.TextField(blank=True)
    processing_days    = models.PositiveIntegerField(default=5)
    cost               = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_active          = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Procedure(models.Model):
    STATUS = [
        ("RECEIVED",  "RECEIVED"),
        ("IN_REVIEW", "IN_REVIEW"),
        ("APPROVED",  "APPROVED"),
        ("REJECTED",  "REJECTED"),
        ("COMPLETED", "COMPLETED"),
    ]
    URGENCY = [
        ("LOW",    "Baja"),
        ("NORMAL", "Normal"),
        ("HIGH",   "Alta"),
        ("URGENT", "Urgente"),
    ]
    CANAL = [
        ("VIRTUAL",    "Mesa de Partes Virtual"),
        ("PRESENCIAL", "Mesa de Partes Presencial"),
        ("EMAIL",      "Correo Electrónico"),
        ("FAXSIMIL",   "Fax / Facsímil"),
    ]

    tracking_code      = models.CharField(max_length=32, unique=True, db_index=True)
    procedure_type     = models.ForeignKey(ProcedureType, on_delete=models.PROTECT)
    applicant_name     = models.CharField(max_length=160)
    applicant_document = models.CharField(max_length=40, blank=True, null=True)
    applicant_email    = models.EmailField(blank=True)
    applicant_phone    = models.CharField(max_length=40, blank=True)
    description        = models.TextField(blank=True)
    status             = models.CharField(max_length=16, choices=STATUS, default="RECEIVED")
    urgency_level      = models.CharField(max_length=10, choices=URGENCY, default="NORMAL")  # ← ADDED
    canal_ingreso      = models.CharField(                                                    # ← ADDED
        max_length=20, choices=CANAL, default="VIRTUAL", blank=True
    )
    current_office = models.ForeignKey(
        Office, null=True, blank=True, on_delete=models.SET_NULL
    )
    assignee = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="mp_assigned"
    )
    deadline_at = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.tracking_code

    @property
    def is_overdue(self):
        from django.utils import timezone
        return (
            self.deadline_at is not None
            and self.deadline_at < timezone.now()
            and self.status not in ("COMPLETED", "REJECTED")
        )


class ProcedureEvent(models.Model):
    procedure   = models.ForeignKey(Procedure, on_delete=models.CASCADE, related_name="events")
    at          = models.DateTimeField(auto_now_add=True)
    type        = models.CharField(max_length=32)
    description = models.TextField(blank=True)
    actor       = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-at"]

    def __str__(self):
        return f"{self.type} — {self.procedure.tracking_code}"


class ProcedureFile(models.Model):
    procedure     = models.ForeignKey(Procedure, on_delete=models.CASCADE, related_name="files")
    file          = models.FileField(upload_to="procedures/")
    original_name = models.CharField(max_length=200, blank=True)
    doc_type      = models.CharField(max_length=60, blank=True)
    size          = models.IntegerField(default=0)
    uploaded_at   = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.original_name or self.file.name