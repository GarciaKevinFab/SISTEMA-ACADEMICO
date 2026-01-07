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
        on_delete=models.PROTECT,
        related_name="catalog_teachers",
        null=True, blank=True
    )

    document = models.CharField(max_length=30, blank=True, default="")
    full_name = models.CharField(max_length=160, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    specialization = models.CharField(max_length=120, blank=True, default="")

    def __str__(self):
        # ✅ NO uses first_name/last_name (tu User no los tiene)
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


class InstitutionSetting(models.Model):
    data = models.JSONField(default=dict)


class MediaAsset(models.Model):
    kind = models.CharField(max_length=40)  # LOGO|LOGO_ALT|SIGNATURE
    file = models.FileField(upload_to="institution/")
    uploaded_at = models.DateTimeField(auto_now_add=True)


class ImportJob(models.Model):
    type = models.CharField(max_length=40)   # students|courses|grades
    status = models.CharField(max_length=20, default="QUEUED")  # RUNNING|COMPLETED|FAILED
    mapping = models.JSONField(default=dict, blank=True)
    file = models.FileField(upload_to="imports/")
    result = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class BackupExport(models.Model):
    scope = models.CharField(max_length=20, default="FULL")  # FULL|DATA_ONLY|FILES_ONLY
    file = models.FileField(upload_to="backups/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
