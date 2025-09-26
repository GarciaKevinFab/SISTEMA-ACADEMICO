from django.core.management.base import BaseCommand
from acl.models import Permission, Role, RolePermission
from acl.permissions_catalog import PERMS, ROLE_POLICIES


class Command(BaseCommand):
    help = "Seed de permisos y roles base"


def handle(self, *args, **kwargs):
# Permisos
    codes = list(PERMS.keys())
    for code in codes:
        Permission.objects.get_or_create(code=code, defaults={"label": code})
    self.stdout.write(self.style.SUCCESS(f"Permisos ok: {len(codes)}"))


# Roles con sus permisos por defecto
for name, perm_codes in ROLE_POLICIES.items():
    role, _ = Role.objects.get_or_create(name=name, defaults={"description": name})
    perms = list(Permission.objects.filter(code__in=perm_codes))
    role.permissions.set(perms)
    self.stdout.write(self.style.SUCCESS("Roles ok"))