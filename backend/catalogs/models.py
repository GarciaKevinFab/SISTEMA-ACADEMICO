from django.db import models

# Create your models here.
from django.db import models
from django.contrib.auth import get_user_model
User = get_user_model()

class Period(models.Model):
    code = models.CharField(max_length=20, unique=True)   # p.e. 2025-I
    label = models.CharField(max_length=80)
    start = models.DateField()
    end   = models.DateField()
    is_active = models.BooleanField(default=False)

    def __str__(self): return f"{self.code} - {self.label}"

class Campus(models.Model):
    name = models.CharField(max_length=120)
    address = models.CharField(max_length=200, blank=True, default='')

    def __str__(self): return self.name

class Classroom(models.Model):
    campus = models.ForeignKey(Campus, on_delete=models.CASCADE, related_name='classrooms')
    code = models.CharField(max_length=40)
    capacity = models.PositiveIntegerField(default=30)

    class Meta:
        unique_together = ('campus', 'code')

    def __str__(self): return f"{self.campus.name} - {self.code}"

class Teacher(models.Model):
    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True)
    dni = models.CharField(max_length=12, unique=True)
    full_name = models.CharField(max_length=150)
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=30, blank=True, default='')

    def __str__(self): return self.full_name

class InstitutionSetting(models.Model):
    # settings JSON + media referenciadas
    data = models.JSONField(default=dict)

class MediaAsset(models.Model):
    # kind: LOGO|LOGO_ALT|SIGNATURE
    kind = models.CharField(max_length=40)
    file = models.FileField(upload_to='institution/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

class ImportJob(models.Model):
    type = models.CharField(max_length=40)   # STUDENTS|COURSES|GRADES|CATALOGS|...
    status = models.CharField(max_length=20, default='QUEUED')  # QUEUED|RUNNING|DONE|ERROR
    mapping = models.JSONField(default=dict, blank=True)
    file = models.FileField(upload_to='imports/')
    result = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class BackupExport(models.Model):
    scope = models.CharField(max_length=20, default='FULL')  # FULL|INCREMENTAL|...
    file = models.FileField(upload_to='backups/')
    created_at = models.DateTimeField(auto_now_add=True)
