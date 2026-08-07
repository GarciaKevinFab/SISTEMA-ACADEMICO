"""
fix_student_roles — utilidades para el rol STUDENT (M2M directa User.roles),
que es la relación que lee /auth/me.

CONTEXTO:
  El alta de alumnos vía StudentsService.create (traslados/regulares) y la
  importación masiva escribían el rol SOLO en la tabla acl_userrole (UserRole),
  pero NO en la M2M directa `User.roles`. Resultado: el alumno inicia sesión y
  ve "Tu cuenta aún no tiene un rol asignado".

MODOS:
  # 1) Reparar alumnos sin rol STUDENT en la M2M (excluye cuentas privilegiadas)
  python manage.py fix_student_roles --dry-run
  python manage.py fix_student_roles --yes
  python manage.py fix_student_roles --dni 47449679 --yes

  # 2) Diagnóstico completo de un DNI (incluye usuarios duplicados)
  python manage.py fix_student_roles --diagnose 47449679

  # 3) Quitar STUDENT a cuentas privilegiadas (admin, docentes, secretaría…)
  python manage.py fix_student_roles --cleanup-privileged --dry-run
  python manage.py fix_student_roles --cleanup-privileged --yes
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from students.models import Student
from acl.models import Role, UserRole

User = get_user_model()

# Roles que indican que la cuenta NO es un alumno: nunca debe recibir STUDENT
# por este comando, y si lo tiene junto a uno de estos, se considera "ensuciado".
PRIVILEGED_ROLES = {
    "ADMIN_SYSTEM", "ACCESS_ADMIN", "SECURITY_ADMIN",
    "ADMIN_ACADEMIC", "ADMIN_ACADEMICO", "REGISTRAR",
    "FINANCE_ADMIN", "ACCOUNTANT", "CASHIER",
    "ADMISSION_OFFICER", "MPV_OFFICER", "MPV_MANAGER",
    "RESEARCH_COORDINATOR", "TEACHER_RESEARCHER", "CALLS_COMMITTEE",
    "MINEDU_INTEGRATION", "TEACHER",
}


class Command(BaseCommand):
    help = "Gestiona el rol STUDENT (M2M directa) de los usuarios de alumnos."

    def add_arguments(self, parser):
        parser.add_argument("--yes", action="store_true", help="Aplica los cambios.")
        parser.add_argument("--dry-run", action="store_true", help="Solo reporta (por defecto).")
        parser.add_argument("--dni", type=str, default=None, help="Limitar a un DNI específico.")
        parser.add_argument("--diagnose", type=str, default=None, help="Diagnóstico completo de un DNI.")
        parser.add_argument("--cleanup-privileged", action="store_true",
                            help="Quita STUDENT a cuentas con rol privilegiado (admin, docente, etc.).")

    # ── despacho ──
    def handle(self, *args, **opts):
        if opts.get("diagnose"):
            return self._diagnose(opts["diagnose"].strip())
        if opts.get("cleanup_privileged"):
            return self._cleanup_privileged(apply=bool(opts.get("yes")))
        return self._fix(apply=bool(opts.get("yes")), dni=opts.get("dni"))

    # ── 1) reparar ──
    def _fix(self, apply, dni):
        tag = "[APPLY]" if apply else "[DRY]"
        self.stdout.write(self.style.NOTICE(f"=== fix_student_roles {tag} ==="))

        student_role = Role.objects.filter(name__iexact="STUDENT").first()
        if not student_role:
            self.stdout.write(self.style.ERROR("No existe el rol STUDENT en la BD. Aborta."))
            return

        qs = Student.objects.exclude(user__isnull=True).select_related("user")
        if dni:
            qs = qs.filter(num_documento=dni.strip())

        total = qs.count()
        fixed = skipped_priv = already_ok = 0
        self.stdout.write(f"Alumnos con usuario a revisar: {total}")

        for st in qs.iterator():
            user = st.user
            roles_now = set(user.roles.values_list("name", flat=True))

            if "STUDENT" in roles_now:
                already_ok += 1
                continue

            # No tocar cuentas que claramente son de staff/docente.
            if roles_now & PRIVILEGED_ROLES:
                skipped_priv += 1
                self.stdout.write(self.style.WARNING(
                    f"  ~ {st.num_documento} (user={user.username}) OMITIDO: "
                    f"cuenta privilegiada {sorted(roles_now & PRIVILEGED_ROLES)}"
                ))
                continue

            full = " ".join(
                x for x in [st.apellido_paterno, st.apellido_materno, st.nombres] if x
            ).strip()
            self.stdout.write(f"  + {st.num_documento} {full!r} (user={user.username}) → asignar STUDENT")
            if apply:
                user.roles.add(student_role)
                UserRole.objects.get_or_create(user_id=user.id, role_id=student_role.id)
            fixed += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"=== FIN {tag} — ya correctos: {already_ok} | "
            f"omitidos (privilegiados): {skipped_priv} | "
            f"{'a corregir' if not apply else 'corregidos'}: {fixed} ==="
        ))
        if not apply and fixed:
            self.stdout.write(self.style.NOTICE(
                "Modo dry-run. Para aplicar: python manage.py fix_student_roles --yes"
            ))

    # ── 2) diagnóstico ──
    def _diagnose(self, dni):
        self.stdout.write(self.style.NOTICE(f"=== diagnóstico DNI {dni} ==="))

        st = Student.objects.filter(num_documento=dni).select_related("user").first()
        if not st:
            self.stdout.write(self.style.ERROR("No existe Student con ese DNI."))
        else:
            full = " ".join(
                x for x in [st.apellido_paterno, st.apellido_materno, st.nombres] if x
            ).strip()
            self.stdout.write(f"Student: id={st.id} nombre={full!r}")
            self.stdout.write(f"  Student.user_id = {st.user_id}")
            if st.user:
                self._dump_user(st.user, prefix="  [user del Student] ")
            else:
                self.stdout.write(self.style.WARNING("  El Student NO tiene usuario vinculado."))

        # Usuarios cuyo username empieza por el DNI (detecta duplicados como 47449679-2)
        dupes = list(User.objects.filter(username__startswith=dni).order_by("id"))
        self.stdout.write("")
        self.stdout.write(f"Usuarios con username que empieza por '{dni}': {len(dupes)}")
        for u in dupes:
            linked = Student.objects.filter(user_id=u.id).first()
            link_txt = f"Student id={linked.id} ({linked.num_documento})" if linked else "SIN Student vinculado"
            self._dump_user(u, prefix="  - ", extra=link_txt)

        self.stdout.write("")
        self.stdout.write(self.style.NOTICE(
            "Si la alumna inicia sesión en un usuario SIN STUDENT mientras su Student "
            "apunta a otro, hay un usuario duplicado: unifica o asigna el rol al user correcto."
        ))

    def _dump_user(self, u, prefix="", extra=""):
        roles = list(u.roles.values_list("name", flat=True))
        ur = list(UserRole.objects.filter(user_id=u.id).values_list("role__name", flat=True))
        self.stdout.write(
            f"{prefix}user id={u.id} username={u.username!r} activo={u.is_active} "
            f"| roles(M2M /auth/me)={roles} | acl_userrole={ur}"
            + (f" | {extra}" if extra else "")
        )

    # ── 3) limpiar privilegiados ──
    def _cleanup_privileged(self, apply):
        tag = "[APPLY]" if apply else "[DRY]"
        self.stdout.write(self.style.NOTICE(f"=== cleanup-privileged {tag} ==="))

        student_role = Role.objects.filter(name__iexact="STUDENT").first()
        if not student_role:
            self.stdout.write(self.style.ERROR("No existe el rol STUDENT en la BD. Aborta."))
            return

        # Usuarios que tienen STUDENT y además algún rol privilegiado.
        candidates = (
            User.objects.filter(roles=student_role)
            .filter(roles__name__in=PRIVILEGED_ROLES)
            .distinct()
        )
        cleaned = 0
        for u in candidates:
            roles_now = set(u.roles.values_list("name", flat=True))
            priv = sorted(roles_now & PRIVILEGED_ROLES)
            self.stdout.write(f"  - user={u.username!r} tiene {priv} → quitar STUDENT")
            if apply:
                u.roles.remove(student_role)
                UserRole.objects.filter(user_id=u.id, role_id=student_role.id).delete()
            cleaned += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"=== FIN {tag} — {'limpiados' if apply else 'a limpiar'}: {cleaned} ==="
        ))
        if not apply and cleaned:
            self.stdout.write(self.style.NOTICE(
                "Para aplicar: python manage.py fix_student_roles --cleanup-privileged --yes"
            ))
