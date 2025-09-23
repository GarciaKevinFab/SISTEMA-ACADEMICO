from django.db import models

# Create your models here.
from django.db import models
from django.contrib.auth import get_user_model
from django.utils.crypto import get_random_string

User = get_user_model()

class Office(models.Model):
    name = models.CharField(max_length=120)
    acronym = models.CharField(max_length=20, blank=True, default='')
    is_active = models.BooleanField(default=True)
    def __str__(self): return self.name

class ProcedureType(models.Model):
    name = models.CharField(max_length=140)
    code = models.CharField(max_length=30, unique=True)
    is_active = models.BooleanField(default=True)
    meta = models.JSONField(default=dict, blank=True)
    def __str__(self): return f"{self.code} - {self.name}"

class Procedure(models.Model):
    STATUS_CHOICES = (
        ("RECEIVED","RECEIVED"),
        ("IN_REVIEW","IN_REVIEW"),
        ("DERIVED","DERIVED"),
        ("RESOLVED","RESOLVED"),
        ("REJECTED","REJECTED"),
        ("CLOSED","CLOSED"),
    )
    # tracking público y código interno
    tracking_code = models.CharField(max_length=16, unique=True, editable=False)
    code = models.CharField(max_length=32, unique=True)  # si usas correlativo/documento
    type = models.ForeignKey(ProcedureType, on_delete=models.PROTECT, related_name='procedures')
    subject = models.CharField(max_length=200)           # asunto
    applicant_name = models.CharField(max_length=140)    # para intake público
    applicant_doc = models.CharField(max_length=20, blank=True, default='')
    applicant_email = models.EmailField(blank=True, default='')
    office = models.ForeignKey(Office, on_delete=models.SET_NULL, null=True, blank=True, related_name='procedures')  # oficina actual
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_procedures')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="RECEIVED")
    created_at = models.DateTimeField(auto_now_add=True)
    deadline_at = models.DateTimeField(null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)

    def save(self, *args, **kwargs):
        if not self.tracking_code:
            self.tracking_code = get_random_string(12).upper()
        return super().save(*args, **kwargs)

    def __str__(self): return f"{self.code} / {self.tracking_code}"

class ProcedureRoute(models.Model):
    procedure = models.ForeignKey(Procedure, on_delete=models.CASCADE, related_name='routes')
    from_office = models.ForeignKey(Office, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    to_office = models.ForeignKey(Office, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    note = models.CharField(max_length=300, blank=True, default='')
    deadline_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ProcedureNote(models.Model):
    procedure = models.ForeignKey(Procedure, on_delete=models.CASCADE, related_name='notes')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class ProcedureFile(models.Model):
    procedure = models.ForeignKey(Procedure, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to='mesa/files/')
    doc_type = models.CharField(max_length=60, blank=True, default='')
    description = models.CharField(max_length=200, blank=True, default='')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

class ProcedureNotification(models.Model):
    procedure = models.ForeignKey(Procedure, on_delete=models.CASCADE, related_name='notifications')
    channels = models.JSONField(default=list, blank=True)   # ["EMAIL", "SMS"]
    subject = models.CharField(max_length=200)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    meta = models.JSONField(default=dict, blank=True)
