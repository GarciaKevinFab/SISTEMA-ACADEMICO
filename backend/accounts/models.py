# backend/accounts/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    """
    Usuario base extendido.
    - Si no necesitas nada extra, al menos define el modelo para AUTH_USER_MODEL.
    """
    mfa_enabled = models.BooleanField(default=False)

    def __str__(self):
        return self.username
