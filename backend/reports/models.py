from django.db import models

# Create your models here.
from django.db import models

REPORT_TYPES = (
    ("ACADEMIC_ACTA","ACADEMIC_ACTA"),
    ("ADMISSION_ACTA","ADMISSION_ACTA"),
    ("GRADE_SLIP","GRADE_SLIP"),
    ("ENROLLMENT_CONST","ENROLLMENT_CONST"),
    ("KARDEX","KARDEX"),
    ("CERTIFICATE","CERTIFICATE"),
)

class ReportJob(models.Model):
    type = models.CharField(max_length=40, choices=REPORT_TYPES)
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=12, default="PENDING")  # PENDING|READY|ERROR
    file_path = models.CharField(max_length=300, blank=True, default="")
    error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
