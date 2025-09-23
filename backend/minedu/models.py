from django.db import models

# Create your models here.
from django.db import models

EXPORT_TYPES = (("ENROLLMENTS","ENROLLMENTS"), ("GRADES","GRADES"))
JOB_TYPES = (("EXPORT_ENROLLMENTS","EXPORT_ENROLLMENTS"),
             ("EXPORT_GRADES","EXPORT_GRADES"),
             ("VALIDATION","VALIDATION"),
             ("SYNC_CATALOGS","SYNC_CATALOGS"))

class MineduExport(models.Model):
    type = models.CharField(max_length=30, choices=EXPORT_TYPES)
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, default="QUEUED")  # QUEUED|RUNNING|DONE|ERROR|RETRY
    tries = models.PositiveIntegerField(default=0)
    result = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Mapping(models.Model):
    # type: e.g. CAREER, COURSE, CAMPUS, etc.
    type = models.CharField(max_length=40)
    local_code = models.CharField(max_length=80)
    remote_code = models.CharField(max_length=80)
    label = models.CharField(max_length=160, blank=True, default='')
    class Meta:
        unique_together = ('type','local_code')

class IntegrationJob(models.Model):
    type = models.CharField(max_length=40, choices=JOB_TYPES)
    cron = models.CharField(max_length=60, blank=True, default='')  # "0 2 * * *"
    enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class JobRun(models.Model):
    job = models.ForeignKey(IntegrationJob, on_delete=models.CASCADE, related_name='runs')
    status = models.CharField(max_length=20, default='QUEUED')  # QUEUED|RUNNING|SUCCESS|FAILED
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)

class RunLog(models.Model):
    run = models.ForeignKey(JobRun, on_delete=models.CASCADE, related_name='logs')
    timestamp = models.DateTimeField(auto_now_add=True)
    level = models.CharField(max_length=10, default='INFO')
    message = models.TextField()
    meta = models.JSONField(default=dict, blank=True)
