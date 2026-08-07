from django.conf import settings
from django.db import models
from academic.models import Plan

User = settings.AUTH_USER_MODEL


class Student(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_profile"
    )

    # Identidad real del excel
    num_documento = models.CharField(max_length=12, unique=True)
    nombres = models.CharField(max_length=120)
    apellido_paterno = models.CharField(max_length=120, blank=True, default="")
    apellido_materno = models.CharField(max_length=120, blank=True, default="")
    sexo = models.CharField(max_length=5, blank=True, default="")  # M / F
    fecha_nac = models.DateField(null=True, blank=True)

    # Ubicación / institución
    region = models.CharField(max_length=80, blank=True, default="")
    provincia = models.CharField(max_length=80, blank=True, default="")
    distrito = models.CharField(max_length=80, blank=True, default="")
    codigo_modular = models.CharField(max_length=20, blank=True, default="")
    nombre_institucion = models.CharField(max_length=255, blank=True, default="")
    gestion = models.CharField(max_length=50, blank=True, default="")
    tipo = models.CharField(max_length=50, blank=True, default="")

    # Académico
    programa_carrera = models.CharField(max_length=255, blank=True, default="")
    ciclo = models.IntegerField(null=True, blank=True)
    turno = models.CharField(max_length=30, blank=True, default="")
    seccion = models.CharField(max_length=30, blank=True, default="")
    periodo = models.CharField(max_length=20, blank=True, default="")
    lengua = models.CharField(max_length=80, blank=True, default="")
    discapacidad = models.CharField(max_length=20, blank=True, default="")
    tipo_discapacidad = models.CharField(max_length=255, blank=True, default="")

    # ✅ FK real al Plan académico
    plan = models.ForeignKey(
        Plan,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="students"
    )

    # ── Estado académico especial (con Resolución Directoral) ──
    # "" = normal (Matriculado/Pendiente se derivan de la matrícula del período)
    ESTADO_LICENCIA       = "LICENCIA"
    ESTADO_REINCORPORACION = "REINCORPORACION"
    ESTADO_TRASLADO       = "TRASLADO"
    ESTADO_SUBSANACION    = "SUBSANACION"
    ESTADOS_ESPECIALES = [
        (ESTADO_LICENCIA, "Licencia"),
        (ESTADO_REINCORPORACION, "Reincorporación"),
        (ESTADO_TRASLADO, "Traslado"),
        (ESTADO_SUBSANACION, "Subsanación"),
    ]
    estado_academico = models.CharField(
        max_length=20, blank=True, default="",
        choices=[("", "Normal")] + ESTADOS_ESPECIALES,
        help_text="Estado especial del alumno; con licencia no puede ser calificado",
    )
    estado_rd = models.CharField(
        max_length=80, blank=True, default="",
        help_text="N° de Resolución Directoral que sustenta el estado",
    )

    # Opcional
    email = models.EmailField(blank=True, default="")
    celular = models.CharField(max_length=30, blank=True, default="")
    photo = models.ImageField(upload_to="students/photos/", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.apellido_paterno} {self.apellido_materno} {self.nombres} ({self.num_documento})"
