# catalogs/models.py
from django.conf import settings
from django.db import models

class Period(models.Model):
    TERM_CHOICES = (
        ("I", "I"),
        ("II", "II"),
        ("III", "III"),
    )

    code = models.CharField(max_length=40, blank=True, default="")
    year = models.PositiveSmallIntegerField()
    term = models.CharField(max_length=5, choices=TERM_CHOICES, default="I")
    start_date = models.DateField(null=True, blank=True)
    end_date   = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=False)

    label = models.CharField(max_length=80, blank=True, default="")

    def __str__(self):
        nice = self.label or self.code
        return f"{self.code} - {nice}"


class Campus(models.Model):
    code = models.CharField(max_length=40, blank=True, default="", db_index=True)
    name = models.CharField(max_length=120)
    address = models.CharField(max_length=200, blank=True, default="")

    def __str__(self):
        return f"{self.code} - {self.name}"


class Classroom(models.Model):
    campus = models.ForeignKey(Campus, on_delete=models.CASCADE, related_name="classrooms")
    code = models.CharField(max_length=40)
    name = models.CharField(max_length=120, blank=True, default="")
    capacity = models.PositiveIntegerField(default=30)

    class Meta:
        unique_together = ("campus", "code")

    def __str__(self):
        return f"{self.campus.name} - {self.code} ({self.name})"


class Teacher(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="catalog_teachers",
        null=True, blank=True
    )

    document = models.CharField(max_length=30, blank=True, default="")
    full_name = models.CharField(max_length=160, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    specialization = models.CharField(max_length=120, blank=True, default="")

    # ✅ cursos asignados al docente (existentes en academic)
    courses = models.ManyToManyField(
        "academic.Course",
        blank=True,
        related_name="catalog_teachers",
    )

    def __str__(self):
        if self.user:
            if hasattr(self.user, "full_name") and (self.user.full_name or "").strip():
                return self.user.full_name.strip()
            if hasattr(self.user, "name") and (self.user.name or "").strip():
                return self.user.name.strip()
            if hasattr(self.user, "username") and (self.user.username or "").strip():
                return self.user.username.strip()
            if hasattr(self.user, "email") and (self.user.email or "").strip():
                return self.user.email.strip()
            return "Docente"
        return self.full_name or self.document or f"Teacher {self.pk}"


class Career(models.Model):
    DEGREE_CHOICES = [
        ("BACHELOR", "Bachiller"),
        ("TECHNICAL", "Técnico"),
        ("PROFESSIONAL", "Profesional"),
    ]
    MODALITY_CHOICES = [
        ("PRESENCIAL", "Presencial"),
        ("VIRTUAL", "Virtual"),
        ("SEMIPRESENCIAL", "Semipresencial"),
    ]

    name = models.CharField(max_length=150)
    # ✅ obligatorio y único (import ya lo respeta generando code)
    code = models.CharField(max_length=50, unique=True)

    description = models.TextField(blank=True, default="")
    duration_semesters = models.PositiveIntegerField(default=0)
    vacancies = models.PositiveIntegerField(default=0)

    degree_type = models.CharField(max_length=20, choices=DEGREE_CHOICES, default="BACHELOR")
    modality = models.CharField(max_length=20, choices=MODALITY_CHOICES, default="PRESENCIAL")

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.code} - {self.name}"


class InstitutionSetting(models.Model):
    data = models.JSONField(default=dict)


class MediaAsset(models.Model):
    # ✅ LOGO | LOGO_ALT | SIGNATURE (views ya lo acepta)
    kind = models.CharField(max_length=40)
    file = models.FileField(upload_to="institution/")
    uploaded_at = models.DateTimeField(auto_now_add=True)


class ImportJob(models.Model):
    # ✅ soporta students|courses|grades|plans (views ya lo usa)
    type = models.CharField(max_length=40)
    # ✅ RUNNING|COMPLETED|COMPLETED_WITH_ERRORS|FAILED
    status = models.CharField(max_length=20, default="QUEUED")
    mapping = models.JSONField(default=dict, blank=True)
    file = models.FileField(upload_to="imports/")
    result = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_jobs"
    )  # ✅ Campo agregado para trackear usuario


class BackupExport(models.Model):
    scope = models.CharField(max_length=20, default="FULL")  # FULL|DATA_ONLY|FILES_ONLY|DATASET_*
    file = models.FileField(upload_to="backups/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)