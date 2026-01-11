from django.conf import settings
from django.db import models

User = settings.AUTH_USER_MODEL


class Student(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_profile"
    )

    codigo_estudiante = models.CharField(max_length=30, unique=True)
    dni = models.CharField(max_length=12, unique=True)

    nombres = models.CharField(max_length=120)
    apellidos = models.CharField(max_length=120)

    sexo = models.CharField(max_length=20, blank=True, default="")
    fecha_nacimiento = models.DateField(null=True, blank=True)

    email = models.EmailField(blank=True, default="")
    celular = models.CharField(max_length=30, blank=True, default="")

    direccion = models.CharField(max_length=255, blank=True, default="")
    departamento = models.CharField(max_length=80, blank=True, default="")
    provincia = models.CharField(max_length=80, blank=True, default="")
    distrito = models.CharField(max_length=80, blank=True, default="")

    programa_id = models.CharField(max_length=64, blank=True, default="")
    ciclo_actual = models.IntegerField(null=True, blank=True)
    turno = models.CharField(max_length=30, blank=True, default="")
    seccion = models.CharField(max_length=30, blank=True, default="")
    periodo_ingreso = models.CharField(max_length=20, blank=True, default="")
    estado = models.CharField(max_length=30, blank=True, default="activo")

    apoderado_nombre = models.CharField(max_length=160, blank=True, default="")
    apoderado_dni = models.CharField(max_length=12, blank=True, default="")
    apoderado_telefono = models.CharField(max_length=30, blank=True, default="")

    photo = models.ImageField(upload_to="students/photos/", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.apellidos} {self.nombres} ({self.dni})"
