from django.db import models


class Period(models.Model):
    code = models.CharField(max_length=20, unique=True)   # "2025-I"
    label = models.CharField(max_length=80)               # "Semestre 2025-I"
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_active", "-start_date", "code"]

    def __str__(self):
        return f"{self.code} - {self.label}"


class Campus(models.Model):
    name = models.CharField(max_length=80, unique=True)
    short_name = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=200, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Classroom(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=80, blank=True, null=True)
    capacity = models.PositiveIntegerField(default=35)
    campus = models.ForeignKey(Campus, on_delete=models.SET_NULL, null=True, blank=True, related_name="classrooms")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.code if not self.name else f"{self.code} - {self.name}"


DOCUMENT_TYPES = (
    ("DNI", "DNI"),
    ("CE", "Carné Extranjería"),
    ("PAS", "Pasaporte"),
)

class Teacher(models.Model):
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)
    document_type = models.CharField(max_length=3, choices=DOCUMENT_TYPES, default="DNI")
    document_number = models.CharField(max_length=15, unique=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.last_name}, {self.first_name}"


def institution_upload_path(instance, filename):
    return f"institution/{filename}"

class InstitutionSettings(models.Model):
    # datos mínimos institucionales (ajústalos a tu TDR)
    full_name = models.CharField(max_length=160, default='IESPP "Gustavo Allende Llavería"')
    short_name = models.CharField(max_length=60, default="IESPP G.A.L.")
    ruc = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=200, blank=True, null=True)
    phone = models.CharField(max_length=60, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)

    logo = models.ImageField(upload_to=institution_upload_path, blank=True, null=True)
    logo_alt = models.ImageField(upload_to=institution_upload_path, blank=True, null=True)
    signature = models.ImageField(upload_to=institution_upload_path, blank=True, null=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Institution Settings"
        verbose_name_plural = "Institution Settings"

    def __str__(self):
        return self.short_name or "Institution Settings"
