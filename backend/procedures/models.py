from django.db import models
from django.utils import timezone
from django.core.validators import MinLengthValidator
import uuid

def default_tracking():
    # Ej: PRC-20250917-8F2C1A
    today = timezone.now().strftime("%Y%m%d")
    rnd = uuid.uuid4().hex[:6].upper()
    return f"PRC-{today}-{rnd}"

class Procedure(models.Model):
    class ProcedureType(models.TextChoices):
        CONSTANCIA_ESTUDIOS = "CONSTANCIA_ESTUDIOS", "Constancia de Estudios"
        CERTIFICADO_NOTAS   = "CERTIFICADO_NOTAS", "Certificado de Notas"
        DUPLICADO_CARNET    = "DUPLICADO_CARNET", "Duplicado de Carnet"
        OTRO                = "OTRO", "Otro"

    class Status(models.TextChoices):
        PENDING   = "PENDING", "Pendiente"
        IN_REVIEW = "IN_REVIEW", "En Revisión"
        APPROVED  = "APPROVED", "Aprobado"
        REJECTED  = "REJECTED", "Rechazado"
        DELIVERED = "DELIVERED", "Entregado"

    tracking_code = models.CharField(
        max_length=32,
        unique=True,
        default=default_tracking,
        validators=[MinLengthValidator(8)],
        help_text="Código de seguimiento del trámite (auto-generado)."
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.PROTECT,
        related_name="procedures"
    )
    procedure_type = models.CharField(
        max_length=32,
        choices=ProcedureType.choices,
        default=ProcedureType.CONSTANCIA_ESTUDIOS,
    )
    description = models.TextField(blank=True, null=True)

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(blank=True, null=True)

    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Procedure"
        verbose_name_plural = "Procedures"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tracking_code"]),
            models.Index(fields=["status"]),
            models.Index(fields=["procedure_type"]),
        ]

    def __str__(self):
        return f"{self.tracking_code} - {self.get_procedure_type_display()} ({self.get_status_display()})"
