from django.conf import settings
from django.db import models

User = settings.AUTH_USER_MODEL

class Permission(models.Model):
    code = models.CharField(max_length=100, unique=True)   # p.ej. academic.plans.view
    label = models.CharField(max_length=150, blank=True, default="")

    def __str__(self):
        return self.code

class Role(models.Model):
    name = models.CharField(max_length=64, unique=True)
    description = models.CharField(max_length=200, blank=True, default="")  # <-- NUEVO

    # Relación con permisos (mantén el through si lo usas en migraciones/API)
    permissions = models.ManyToManyField(              # <-- asegúrate de tenerlo
        Permission,
        through='RolePermission',
        related_name='roles',
        blank=True,
    )

    def __str__(self):
        return self.name

class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('role', 'permission')

class UserRole(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_users')

    class Meta:
        unique_together = ('user', 'role')
