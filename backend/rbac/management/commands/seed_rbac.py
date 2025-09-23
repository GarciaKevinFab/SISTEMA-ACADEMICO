from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group
from rbac.models import AppPermission, RolePermission
from rbac.services import PERMS, ROLE_POLICIES

class Command(BaseCommand):
    help = "Seed RBAC: crea AppPermission y asigna ROLE_POLICIES a Groups"

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Creando permisos..."))
        existing = set(AppPermission.objects.values_list("code", flat=True))
        to_create = [AppPermission(code=c, description=c) for c in PERMS.keys() if c not in existing]
        AppPermission.objects.bulk_create(to_create, ignore_conflicts=True)
        self.stdout.write(self.style.SUCCESS(f"Permisos OK ({AppPermission.objects.count()})"))

        self.stdout.write(self.style.NOTICE("Creando/actualizando roles..."))
        for role_name, codes in ROLE_POLICIES.items():
            role, _ = Group.objects.get_or_create(name=role_name)
            RolePermission.objects.filter(role=role).delete()
            perms = list(AppPermission.objects.filter(code__in=codes))
            RolePermission.objects.bulk_create(
                [RolePermission(role=role, permission=p) for p in perms],
                ignore_conflicts=True
            )
            self.stdout.write(f" - {role_name}: {len(perms)} perms")
        self.stdout.write(self.style.SUCCESS("RBAC seed completo."))
