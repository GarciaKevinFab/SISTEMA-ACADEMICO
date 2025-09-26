from django.db import models
from django.utils import timezone

class AuditLog(models.Model):
    timestamp   = models.DateTimeField(default=timezone.now, db_index=True)
    actor_id    = models.CharField(max_length=64, blank=True, default="", db_index=True)
    actor_name  = models.CharField(max_length=150, blank=True, default="")

    action      = models.CharField(max_length=64, db_index=True)     # <-- EXISTE
    entity      = models.CharField(max_length=64, db_index=True)     # <-- EXISTE
    entity_id   = models.CharField(max_length=64, blank=True, default="", db_index=True)  # <-- EXISTE

    summary     = models.CharField(max_length=255, blank=True, default="")
    detail      = models.JSONField(blank=True, null=True)

    ip          = models.GenericIPAddressField(null=True, blank=True)   # <-- EXISTE
    request_id  = models.CharField(max_length=64, blank=True, default="", db_index=True)  # <-- EXISTE

    class Meta:
        db_table  = "audit_logs"
        ordering  = ("-timestamp",)
        indexes   = [
            models.Index(fields=["timestamp", "action"]),
            models.Index(fields=["entity", "entity_id"]),
        ]

    def __str__(self):
        who = self.actor_name or self.actor_id or "-"
        return f"{self.timestamp} {self.action} {self.entity}#{self.entity_id} by {who}"
