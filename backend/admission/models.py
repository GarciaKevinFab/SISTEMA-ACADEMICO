from django.db import models

# Create your models here.
from django.db import models
from django.contrib.auth import get_user_model
User = get_user_model()

class AdmissionParam(models.Model):
    data = models.JSONField(default=dict)  # parámetros globales de admisión (configs)

class AdmissionCall(models.Model):
    title = models.CharField(max_length=160)
    period = models.CharField(max_length=20)   # p.e. 2025-I
    published = models.BooleanField(default=False)
    vacants_total = models.PositiveIntegerField(default=0)
    meta = models.JSONField(default=dict)      # reglas, costos, etc.

class AdmissionScheduleItem(models.Model):
    call = models.ForeignKey(AdmissionCall, on_delete=models.CASCADE, related_name='schedule')
    label = models.CharField(max_length=140)
    start = models.DateTimeField()
    end   = models.DateTimeField()
    kind  = models.CharField(max_length=40, blank=True, default='')  # INSCRIPCION / EXAMEN / RESULTADOS

class Applicant(models.Model):
    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True)
    dni = models.CharField(max_length=12, unique=True)
    names = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True, default='')

class Application(models.Model):
    call = models.ForeignKey(AdmissionCall, on_delete=models.CASCADE, related_name='applications')
    applicant = models.ForeignKey(Applicant, on_delete=models.CASCADE, related_name='applications')
    career_name = models.CharField(max_length=140)       # puedes normalizar con FK a Career si quieres
    status = models.CharField(max_length=20, default='CREATED')  # CREATED/PAID/EVALUATED/PUBLISHED
    data = models.JSONField(default=dict)                # payload libre (respuestas, anexos, etc.)

class ApplicationDocument(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=60)      # DNI, CONSTANCIA, etc.
    file = models.FileField(upload_to='admission/docs/')
    status = models.CharField(max_length=20, default='PENDING')  # PENDING/APPROVED/REJECTED
    note = models.CharField(max_length=200, blank=True, default='')

class Payment(models.Model):
    application = models.OneToOneField(Application, on_delete=models.CASCADE, related_name='payment')
    method = models.CharField(max_length=20)            # YAPE, EFECTIVO, etc.
    status = models.CharField(max_length=20, default='STARTED')  # STARTED/CONFIRMED/VOID
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    meta = models.JSONField(default=dict)               # refs externas
    created_at = models.DateTimeField(auto_now_add=True)

class EvaluationScore(models.Model):
    application = models.OneToOneField(Application, on_delete=models.CASCADE, related_name='score')
    rubric = models.JSONField(default=dict)             # {PARCIAL: xx, ENTREVISTA: yy, ...}
    total = models.DecimalField(max_digits=6, decimal_places=2, default=0)

class ResultPublication(models.Model):
    call = models.OneToOneField(AdmissionCall, on_delete=models.CASCADE, related_name='result_pub')
    published = models.BooleanField(default=False)
    payload = models.JSONField(default=dict)            # ranking final, cupos, etc.
