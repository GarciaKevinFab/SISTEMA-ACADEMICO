from django.conf import settings
from django.db import models

class Period(models.Model):
    code = models.CharField(max_length=20, unique=True)   # p.e. 2025-I
    label = models.CharField(max_length=80)
    start = models.DateField()
    end   = models.DateField()
    is_active = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.code} - {self.label}"

class Campus(models.Model):
    name = models.CharField(max_length=120)
    address = models.CharField(max_length=200, blank=True, default='')

    def __str__(self):
        return self.name

class Classroom(models.Model):
    campus = models.ForeignKey(Campus, on_delete=models.CASCADE, related_name='classrooms')
    code = models.CharField(max_length=40)
    capacity = models.PositiveIntegerField(default=30)

    class Meta:
        unique_together = ('campus', 'code')

    def __str__(self):
        return f"{self.campus.name} - {self.code}"

class Teacher(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='catalog_teachers',
        null=True, blank=True
    )

class InstitutionSetting(models.Model):
    data = models.JSONField(default=dict)

class MediaAsset(models.Model):
    kind = models.CharField(max_length=40)
    file = models.FileField(upload_to='institution/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

class ImportJob(models.Model):
    type = models.CharField(max_length=40)
    status = models.CharField(max_length=20, default='QUEUED')
    mapping = models.JSONField(default=dict, blank=True)
    file = models.FileField(upload_to='imports/')
    result = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class BackupExport(models.Model):
    scope = models.CharField(max_length=20, default='FULL')
    file = models.FileField(upload_to='backups/')
    created_at = models.DateTimeField(auto_now_add=True)
