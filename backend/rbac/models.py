from django.db import models

# Create your models here.
from django.db import models
from django.contrib.auth.models import Group, User

class AppPermission(models.Model):
    code = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True, default="")

    def __str__(self):
        return self.code

class RolePermission(models.Model):
    role = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(AppPermission, on_delete=models.CASCADE, related_name="permission_roles")

    class Meta:
        unique_together = ("role", "permission")

    def __str__(self):
        return f"{self.role.name} -> {self.permission.code}"
