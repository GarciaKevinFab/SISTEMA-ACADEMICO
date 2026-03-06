from django.db import models
from django.utils import timezone

from finance.models import TimeStampedModel


# ══════════════════════════════════════════════════════════
# Códigos MINEDU (admin los registra manualmente)
# ══════════════════════════════════════════════════════════

class MineduCode(TimeStampedModel):
    """
    Códigos oficiales que el MINEDU asigna (código modular IE,
    códigos de programa, etc.).  El admin los ingresa una vez
    y luego los vincula a registros locales en MineduCatalogMapping.
    """
    TYPE_CHOICES = [
        ("INSTITUTION", "Institución (código modular)"),
        ("CAREER", "Programa de estudios"),
        ("STUDY_PLAN", "Plan de estudios"),
        ("STUDENT", "Estudiante (código matrícula SIA)"),
    ]

    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    code = models.CharField(max_length=64)
    label = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        unique_together = ("type", "code")
        ordering = ["type", "code"]

    def __str__(self):
        return f"[{self.type}] {self.code} – {self.label}"


# ══════════════════════════════════════════════════════════
# Exportaciones MINEDU
# ══════════════════════════════════════════════════════════

class MineduExportBatch(TimeStampedModel):
    """
    Cada registro = un archivo generado (XLSX / CSV).
    data_type normalizados a los 5 documentos SIA + extras.

    Migración: si tenías data_type='FICHA_MATRICULA'→'FICHA',
    'GRADES'→'ACTA', 'STUDENTS'→'REPORTE'.
    Ejecutar data-migration para normalizar registros viejos.
    """
    DATA_TYPE_CHOICES = [
        # ── 5 documentos SIA principales ──
        ("ENROLLMENT",  "Nómina de Matrícula"),
        ("FICHA",       "Ficha de Matrícula"),
        ("BOLETA",      "Boleta de Notas"),
        ("ACTA",        "Acta Consolidada de Evaluación"),
        ("REPORTE",     "Reporte de Información del Sistema (Kardex)"),
        # ── Extras ──
        ("REGISTRO_AUX", "Registro Auxiliar de Evaluación"),
        ("CERTIFICADO",  "Certificado de Estudios"),
    ]
    FORMAT_CHOICES = [
        ("XLSX", "Excel"),
        ("CSV", "CSV"),
    ]
    STATUS_CHOICES = [
        ("PENDING",    "Pendiente"),
        ("PROCESSING", "Procesando"),
        ("COMPLETED",  "Completado"),
        ("FAILED",     "Fallido"),
        ("RETRYING",   "Reintentando"),
    ]

    data_type       = models.CharField(max_length=20, choices=DATA_TYPE_CHOICES)
    export_format   = models.CharField(max_length=10, choices=FORMAT_CHOICES, default="XLSX")
    academic_year   = models.IntegerField()
    academic_period = models.CharField(max_length=10)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    total_records   = models.IntegerField(default=0)
    record_data     = models.JSONField(default=dict, blank=True)
    file            = models.FileField(upload_to="minedu/exports/", null=True, blank=True)
    error_message   = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.data_type} {self.academic_year}-{self.academic_period} ({self.status})"


# ══════════════════════════════════════════════════════════
# Mapeos locales ↔ MINEDU
# ══════════════════════════════════════════════════════════

class MineduCatalogMapping(TimeStampedModel):
    TYPE_CHOICES = [
        ("INSTITUTION", "Institución"),
        ("CAREER",      "Carrera"),
        ("STUDY_PLAN",  "Plan de estudios"),
        ("STUDENT",     "Estudiante"),
    ]

    type        = models.CharField(max_length=20, choices=TYPE_CHOICES)
    local_id    = models.IntegerField()
    minedu_code = models.CharField(max_length=64, blank=True, null=True)

    class Meta:
        unique_together = ("type", "local_id")

    def __str__(self):
        return f"{self.type} {self.local_id} → {self.minedu_code or 'SIN VINCULAR'}"


# ══════════════════════════════════════════════════════════
# Jobs programados
# ══════════════════════════════════════════════════════════

class MineduJob(TimeStampedModel):
    type    = models.CharField(max_length=50)
    cron    = models.CharField(max_length=64, blank=True)
    enabled = models.BooleanField(default=True)
    last_run_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.type} ({'ON' if self.enabled else 'OFF'})"


class MineduJobRun(TimeStampedModel):
    STATUS_CHOICES = [
        ("PENDING",   "Pendiente"),
        ("RUNNING",   "En ejecución"),
        ("COMPLETED", "Completado"),
        ("FAILED",    "Fallido"),
    ]

    job         = models.ForeignKey(MineduJob, on_delete=models.CASCADE, related_name="runs")
    started_at  = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    meta        = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Run #{self.id} {self.job.type} ({self.status})"


class MineduJobLog(TimeStampedModel):
    LEVEL_CHOICES = [
        ("INFO",  "Info"),
        ("WARN",  "Warning"),
        ("ERROR", "Error"),
    ]

    run       = models.ForeignKey(MineduJobRun, on_delete=models.CASCADE, related_name="logs")
    timestamp = models.DateTimeField(default=timezone.now)
    level     = models.CharField(max_length=10, choices=LEVEL_CHOICES, default="INFO")
    message   = models.TextField()
    meta      = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.timestamp} [{self.level}] {self.message[:40]}"