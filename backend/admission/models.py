from django.db import models
from django.contrib.auth import get_user_model
from catalogs.models import Career

User = get_user_model()


class AdmissionParam(models.Model):
    data = models.JSONField(default=dict)


class AdmissionCall(models.Model):
    title = models.CharField(max_length=160)
    period = models.CharField(max_length=20, blank=True, default="")
    published = models.BooleanField(default=False)
    vacants_total = models.PositiveIntegerField(default=0)
    meta = models.JSONField(default=dict)

    def __str__(self):
        return self.title


class AdmissionScheduleItem(models.Model):
    call = models.ForeignKey(
        AdmissionCall, on_delete=models.CASCADE, related_name="schedule"
    )
    label = models.CharField(max_length=140)
    start = models.DateTimeField()
    end = models.DateTimeField()
    kind = models.CharField(max_length=40, blank=True, default="")
    notes = models.TextField(blank=True, default="")


class Applicant(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    dni = models.CharField(max_length=12, unique=True)
    names = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True, default="")

    def __str__(self):
        return f"{self.names} ({self.dni})"


class Application(models.Model):
    call = models.ForeignKey(
        AdmissionCall, on_delete=models.CASCADE, related_name="applications"
    )
    applicant = models.ForeignKey(
        Applicant, on_delete=models.CASCADE, related_name="applications"
    )
    career_name = models.CharField(max_length=140, blank=True, default="")
    status = models.CharField(max_length=20, default="CREATED")
    data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        return f"App#{self.id} - {self.applicant} → {self.career_name}"
class ApplicationPreference(models.Model):
    application = models.ForeignKey(
        Application, on_delete=models.CASCADE, related_name="preferences"
    )
    career = models.ForeignKey(Career, on_delete=models.PROTECT)
    rank = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("application", "career")
        ordering = ["rank", "id"]


class ApplicationDocument(models.Model):
    application = models.ForeignKey(
        Application, on_delete=models.CASCADE, related_name="documents"
    )
    document_type = models.CharField(max_length=60)
    file = models.FileField(upload_to="admission/docs/")
    original_name = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=20, default="PENDING")
    note = models.CharField(max_length=200, blank=True, default="")


class Payment(models.Model):
    CHANNEL_CHOICES = [
        ("AGENCIA_BN", "Agencia Banco de la Nación"),
        ("CAJERO_MULTIRED", "Cajero Multired"),
        ("PAGALO", "Págalo.pe"),
    ]
    application = models.OneToOneField(
        Application, on_delete=models.CASCADE, related_name="payment"
    )
    method = models.CharField(max_length=20)
    status = models.CharField(max_length=20, default="STARTED")
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    channel = models.CharField(
        max_length=20, choices=CHANNEL_CHOICES, default="AGENCIA_BN"
    )
    nro_secuencia = models.CharField(max_length=30, blank=True, default="")
    codigo_caja = models.CharField(max_length=20, blank=True, default="")
    fecha_movimiento = models.DateField(null=True, blank=True)
    voucher = models.FileField(
        upload_to="admission/vouchers/", null=True, blank=True
    )
    meta = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)


class EvaluationScore(models.Model):
    """
    FIX: Cambiado de OneToOneField a ForeignKey + campo 'phase'
    para soportar múltiples fases (WRITTEN, INTERVIEW) por postulación.
    unique_together garantiza una sola entrada por (application, phase).
    """
    application = models.ForeignKey(
        Application, on_delete=models.CASCADE, related_name="scores"
    )
    phase = models.CharField(
        max_length=20,
        default="WRITTEN",
        help_text="WRITTEN | INTERVIEW",
    )
    rubric = models.JSONField(default=dict)
    total = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    class Meta:
        unique_together = ("application", "phase")

    def __str__(self):
        return f"Score App#{self.application_id} [{self.phase}] = {self.total}"


class ResultPublication(models.Model):
    call = models.OneToOneField(
        AdmissionCall, on_delete=models.CASCADE, related_name="result_pub"
    )
    published = models.BooleanField(default=False)
    payload = models.JSONField(default=dict)


class InstitutionSetting(models.Model):
    """Logo, firma, sello, datos institucionales para constancias."""
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField(blank=True, default="")
    file = models.FileField(upload_to="institution/", blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.key}: {self.value[:50] if self.value else '(archivo)'}"