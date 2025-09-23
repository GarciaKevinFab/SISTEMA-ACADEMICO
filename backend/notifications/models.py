from django.db import models

# Create your models here.
from django.db import models

CHANNELS = (("EMAIL","EMAIL"), ("SMS","SMS"), ("IN_APP","IN_APP"))

class NotificationTemplate(models.Model):
    # Plantilla por canal (puedes tener varias por evento; el binding decide cuál usar)
    name = models.CharField(max_length=140)
    channel = models.CharField(max_length=10, choices=CHANNELS)
    # Contenido por canal
    email_subject = models.CharField(max_length=200, blank=True, default="")
    email_html = models.TextField(blank=True, default="")
    sms_text = models.CharField(max_length=300, blank=True, default="")
    in_app_text = models.CharField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True)
    meta = models.JSONField(blank=True, default=dict)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

class EventBinding(models.Model):
    # Enlaza un evento lógico a una plantilla concreta y canal
    event_key = models.CharField(max_length=120)           # p.e. ADMISSION.PREINSCRIPTION_RECEIVED
    channel = models.CharField(max_length=10, choices=CHANNELS)
    template = models.ForeignKey(NotificationTemplate, on_delete=models.CASCADE, related_name='bindings')

    class Meta:
        unique_together = ('event_key','channel')

class NotificationLog(models.Model):
    event_key = models.CharField(max_length=120)
    channel = models.CharField(max_length=10, choices=CHANNELS)
    to = models.CharField(max_length=200, blank=True, default="")      # email, número o user_id
    subject = models.CharField(max_length=200, blank=True, default="")
    payload = models.JSONField(blank=True, default=dict)               # variables usadas
    rendered = models.JSONField(blank=True, default=dict)              # {subject, html|text}
    status = models.CharField(max_length=12, default="QUEUED")         # QUEUED|SENT|ERROR
    error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
