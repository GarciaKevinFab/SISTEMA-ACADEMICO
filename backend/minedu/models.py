from django.db import models
from django.utils import timezone

from finance.models import TimeStampedModel  # reutilizamos tu base


# ======================
# Exportaciones MINEDU
# ======================

class MineduExportBatch(TimeStampedModel):
    DATA_TYPE_CHOICES = [
        ("ENROLLMENT", "Matrículas"),
        ("GRADES", "Calificaciones"),
        ("STUDENTS", "Estudiantes"),
    ]

    STATUS_CHOICES = [
        ("PENDING", "Pendiente"),
        ("PROCESSING", "Procesando"),
        ("COMPLETED", "Completado"),
        ("FAILED", "Fallido"),
        ("RETRYING", "Reintentando"),
    ]

    data_type = models.CharField(max_length=20, choices=DATA_TYPE_CHOICES)
    academic_year = models.IntegerField()
    academic_period = models.CharField(max_length=10)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    total_records = models.IntegerField(default=0)
    record_data = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.data_type} {self.academic_year}-{self.academic_period} ({self.status})"


# ======================
# Mapeos de catálogos
# ======================

class MineduCatalogMapping(TimeStampedModel):
    TYPE_CHOICES = [
        ("INSTITUTION", "Institución"),
        ("CAREER", "Carrera"),
        ("STUDY_PLAN", "Plan de estudios"),
        ("STUDENT", "Estudiante"),
    ]

    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    local_id = models.IntegerField()  # ID de la tabla local (Career, Student, etc.)
    minedu_code = models.CharField(max_length=64, blank=True, null=True)

    class Meta:
        unique_together = ("type", "local_id")

    def __str__(self):
        return f"{self.type} {self.local_id} -> {self.minedu_code or 'UNLINKED'}"


# ======================
# Jobs programados
# ======================

class MineduJob(TimeStampedModel):
    type = models.CharField(max_length=50)  # EXPORT_ENROLLMENTS, EXPORT_GRADES, etc.
    cron = models.CharField(max_length=64, blank=True)
    enabled = models.BooleanField(default=True)
    last_run_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.type} ({'ON' if self.enabled else 'OFF'})"


class MineduJobRun(TimeStampedModel):
    STATUS_CHOICES = [
        ("PENDING", "Pendiente"),
        ("RUNNING", "En ejecución"),
        ("COMPLETED", "Completado"),
        ("FAILED", "Fallido"),
    ]

    job = models.ForeignKey(MineduJob, on_delete=models.CASCADE, related_name="runs")
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    meta = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Run #{self.id} {self.job.type} ({self.status})"


class MineduJobLog(TimeStampedModel):
    LEVEL_CHOICES = [
        ("INFO", "Info"),
        ("WARN", "Warning"),
        ("ERROR", "Error"),
    ]

    run = models.ForeignKey(MineduJobRun, on_delete=models.CASCADE, related_name="logs")
    timestamp = models.DateTimeField(default=timezone.now)
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default="INFO")
    message = models.TextField()
    meta = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.timestamp} [{self.level}] {self.message[:40]}"
