from django.core.management.base import BaseCommand
from django.db import transaction

from acl.models import Permission, Role
from acl.permissions_catalog import PERMS, ROLE_POLICIES, PERM_ALIASES


def expand_aliases(codes: set[str]) -> set[str]:
    """
    Aplica aliases tipo: si tienes 'academic.view' también agrega 'academic.sections.view'
    para que el rol termine con permisos efectivos completos.
    """
    changed = True
    while changed:
        changed = False
        for src, dst in PERM_ALIASES.items():
            if src in codes and dst not in codes:
                codes.add(dst)
                changed = True
    return codes


class Command(BaseCommand):
    help = "Seed de permisos y roles base"

    @transaction.atomic
    def handle(self, *args, **kwargs):
        # 1) Permisos
        codes = list(PERMS.keys())
        created = 0
        for code in codes:
            _, was_created = Permission.objects.get_or_create(
                code=code,
                defaults={"label": code}  # si tu modelo no tiene label, quita esta línea
            )
            if was_created:
                created += 1

        self.stdout.write(self.style.SUCCESS(
            f"✅ Permisos OK: total={len(codes)} nuevos={created}"
        ))

        # 2) Roles + asignación de permisos
        for name, perm_codes in ROLE_POLICIES.items():
            role, _ = Role.objects.get_or_create(
                name=name,
                defaults={"description": name}
            )

            # aplica aliases
            final_codes = expand_aliases(set(perm_codes or []))

            perms = list(Permission.objects.filter(code__in=list(final_codes)))
            role.permissions.set(perms)

            self.stdout.write(self.style.SUCCESS(
                f"✅ Rol {name}: permisos={len(perms)}"
            ))

        self.stdout.write(self.style.SUCCESS("🎉 Seed ACL completado."))
