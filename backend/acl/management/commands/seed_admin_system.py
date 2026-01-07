from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

from acl.models import Role, UserRole

User = get_user_model()


class Command(BaseCommand):
    help = "Crea/actualiza un usuario y lo asigna al rol ADMIN_SYSTEM"

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True)
        parser.add_argument("--email", required=True)
        parser.add_argument("--password", required=True)
        parser.add_argument("--full_name", default="Administrador del Sistema")

    @transaction.atomic
    def handle(self, *args, **opts):
        username = opts["username"]
        email = opts["email"]
        password = opts["password"]
        full_name = opts["full_name"]

        # 1) Crear/actualizar usuario
        u, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email, "is_active": True},
        )

        u.email = email
        u.is_active = True
        u.set_password(password)

        # si tu User tiene full_name (custom user), lo llena. Si no, lo ignora.
        if hasattr(u, "full_name"):
            setattr(u, "full_name", full_name)

        # si tu User es el default de Django, puedes setear first/last si quieres
        if hasattr(u, "first_name") and hasattr(u, "last_name") and not hasattr(u, "full_name"):
            # pone todo en first_name para no inventar apellidos
            u.first_name = full_name

        # opcional pero útil para admin/compat
        if hasattr(u, "is_staff"):
            u.is_staff = True
        if hasattr(u, "is_superuser"):
            u.is_superuser = True

        u.save()

        # 2) Asignar rol ADMIN_SYSTEM por tabla UserRole
        role = Role.objects.get(name="ADMIN_SYSTEM")
        UserRole.objects.get_or_create(user=u, role=role)

        self.stdout.write(self.style.SUCCESS(
            f"✅ Admin listo: {u.username} -> ADMIN_SYSTEM (created={created})"
        ))
