from django.conf import settings
from django.db import models

def _default_list():
    return []

class UserMFA(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mfa",
    )
    enabled = models.BooleanField(default=False)
    secret = models.CharField(max_length=64, blank=True, default="")
    backup_codes = models.JSONField(default=_default_list, blank=True)  # hashes sha256

    def __str__(self):
        return f"MFA<{self.user_id}, enabled={self.enabled}>"
