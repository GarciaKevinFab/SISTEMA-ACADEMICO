"""
Localiza a un docente "fantasma" en TODAS las tablas donde puede vivir
(accounts.User, catalogs.Teacher, academic.Teacher) y permite eliminarlo
de forma segura (desasignando sus secciones primero).

La grilla de "Asignación de Áreas" lista la unión de:
  1) Users con rol TEACHER/DOCENTE/PROFESOR
  2) catalogs.Teacher con user vinculado (Directorio de Docentes)
  3) academic.Teacher con user vinculado
por eso un docente puede aparecer ahí sin estar en el Directorio.

Uso:
    python manage.py buscar_docente --q "torres castilla"
    python manage.py buscar_docente --delete-user 123            # dry-run
    python manage.py buscar_docente --delete-user 123 --apply    # elimina
"""
import unicodedata

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from academic.models import Teacher as AcademicTeacher, Section
from catalogs.models import Teacher as CatalogTeacher

User = get_user_model()


def _norm(s: str) -> str:
    """minúsculas, sin tildes, todo espacio Unicode colapsado a ' '."""
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = "".join(" " if c.isspace() else c for c in s)
    return " ".join(s.lower().split())


class Command(BaseCommand):
    help = "Busca un docente en User/catalogs.Teacher/academic.Teacher y permite eliminarlo con seguridad."

    def add_arguments(self, parser):
        parser.add_argument("--q", default="", help="Texto a buscar (sin importar mayúsculas/tildes)")
        parser.add_argument("--list", action="store_true",
                            help="Lista TODOS los docentes exactamente como los arma la grilla de Asignación (3 fuentes)")
        parser.add_argument("--delete-user", type=int, default=None, help="ID de accounts.User a eliminar")
        parser.add_argument("--apply", action="store_true", help="Ejecuta la eliminación (sin esto es dry-run)")

    def handle(self, *args, **opts):
        if opts["delete_user"]:
            self._delete(opts["delete_user"], opts["apply"])
            return
        if opts["list"]:
            self._list_like_grid()
            return
        q = _norm(opts["q"])
        if not q:
            self.stderr.write("Usa --q \"texto\", --list, o --delete-user <id>.")
            return
        self._search(q)

    # ── réplica exacta de TeachersViewSet.list (grilla de Asignación) ──
    def _list_like_grid(self):
        from academic.views.utils import user_has_any_role, _get_full_name, list_teacher_users_qs

        def es_admin(u):
            if not u:
                return True
            if getattr(u, "is_staff", False) or getattr(u, "is_superuser", False):
                return True
            if (getattr(u, "username", "") or "").upper().startswith("ADMIN"):
                return True
            return user_has_any_role(u, ["ADMIN_SYSTEM", "ADMIN_ACADEMIC", "ADMIN_ACADEMICO", "REGISTRAR"])

        rows, seen = [], set()
        for u in list_teacher_users_qs():
            if u.id in seen or es_admin(u):
                continue
            seen.add(u.id)
            rows.append(("1:rol-TEACHER", u.id, _get_full_name(u), u.username))
        for ct in CatalogTeacher.objects.select_related("user").filter(user__isnull=False):
            if ct.user_id in seen or es_admin(ct.user):
                continue
            seen.add(ct.user_id)
            rows.append(("2:catalogs.Teacher", ct.user_id,
                         _get_full_name(ct.user) or ct.full_name, getattr(ct.user, "username", "")))
        for at in AcademicTeacher.objects.select_related("user").filter(user__isnull=False):
            if at.user_id in seen or es_admin(at.user):
                continue
            seen.add(at.user_id)
            rows.append(("3:academic.Teacher", at.user_id, _get_full_name(at.user),
                         getattr(at.user, "username", "")))

        rows.sort(key=lambda r: r[2].lower())
        self.stdout.write(f"\n{len(rows)} docente(s) tal como los ve la grilla de Asignación:\n")
        for src, uid, name, uname in rows:
            self.stdout.write(f"  user_id={uid:<6} {name!r:<50} username={uname!r}  fuente={src}")

    # ── búsqueda ───────────────────────────────────────────────
    def _search(self, q):
        self.stdout.write(f"\nBuscando {q!r} (insensible a mayúsculas y tildes)…\n")

        hits = 0
        for u in User.objects.all().only("id", "username", "email", "full_name", "is_active", "is_staff"):
            blob = _norm(f"{u.username} {u.email} {u.full_name}")
            if q in blob:
                hits += 1
                roles = []
                try:
                    from acl.models import UserRole
                    roles = list(UserRole.objects.filter(user=u).values_list("role__name", flat=True))
                except Exception:
                    pass
                try:
                    if hasattr(u, "roles"):
                        roles += [r for r in u.roles.values_list("name", flat=True) if r not in roles]
                except Exception:
                    pass
                n_secs = Section.objects.filter(teacher__user_id=u.id).count()
                n_acad = AcademicTeacher.objects.filter(user_id=u.id).count()
                n_cat = CatalogTeacher.objects.filter(user_id=u.id).count()
                self.stdout.write(self.style.SUCCESS(
                    f"USER id={u.id} username={u.username!r} full_name={u.full_name!r} "
                    f"email={u.email!r} activo={u.is_active} staff={u.is_staff}"
                ))
                self.stdout.write(
                    f"     roles={roles or '—'} · secciones asignadas={n_secs} · "
                    f"academic.Teacher={n_acad} · catalogs.Teacher(Directorio)={n_cat}"
                )
                for s in Section.objects.filter(teacher__user_id=u.id).select_related("plan_course__course")[:10]:
                    curso = getattr(getattr(s.plan_course, "course", None), "name", "?")
                    self.stdout.write(f"       · Section id={s.id} [{s.period}] {curso} ({s.label})")

        for ct in CatalogTeacher.objects.all().only("id", "full_name", "document", "email", "user_id"):
            if q in _norm(f"{ct.full_name} {ct.document} {ct.email}"):
                hits += 1
                self.stdout.write(self.style.WARNING(
                    f"CATALOGS.TEACHER id={ct.id} full_name={ct.full_name!r} "
                    f"doc={ct.document!r} user_id={ct.user_id}"
                ))

        if not hits:
            self.stdout.write("Sin coincidencias en User ni catalogs.Teacher.")
        self.stdout.write(
            "\nPara eliminar: python manage.py buscar_docente --delete-user <USER_ID> [--apply]"
        )

    # ── eliminación segura ─────────────────────────────────────
    def _delete(self, user_id, apply_changes):
        u = User.objects.filter(id=user_id).first()
        if not u:
            self.stderr.write(f"No existe User id={user_id}")
            return
        if u.is_staff or u.is_superuser:
            self.stderr.write("Es cuenta staff/superuser — no se elimina con este comando.")
            return
        try:
            from students.models import Student
            if Student.objects.filter(user_id=user_id).exists():
                self.stderr.write("Este usuario tiene perfil de ESTUDIANTE — usa el flujo de alumnos, no este comando.")
                return
        except Exception:
            pass

        n_secs = Section.objects.filter(teacher__user_id=user_id).count()
        n_acad = AcademicTeacher.objects.filter(user_id=user_id).count()
        n_cat = CatalogTeacher.objects.filter(user_id=user_id).count()

        self.stdout.write(f"\nEliminar USER id={u.id} {u.full_name!r} ({u.username}):")
        self.stdout.write(f"  - Desasignar {n_secs} sección(es) (quedan sin docente, no se borran)")
        self.stdout.write(f"  - Borrar {n_acad} academic.Teacher y {n_cat} catalogs.Teacher vinculados")
        self.stdout.write("  - Borrar roles y la cuenta de usuario")

        if not apply_changes:
            self.stdout.write(self.style.WARNING("\nDRY-RUN: nada cambió. Agrega --apply para ejecutar."))
            return

        with transaction.atomic():
            Section.objects.filter(teacher__user_id=user_id).update(teacher=None)
            AcademicTeacher.objects.filter(user_id=user_id).delete()
            CatalogTeacher.objects.filter(user_id=user_id).delete()
            try:
                from acl.models import UserRole
                UserRole.objects.filter(user_id=user_id).delete()
            except Exception:
                pass
            try:
                if hasattr(u, "roles"):
                    u.roles.clear()
            except Exception:
                pass
            u.delete()

        self.stdout.write(self.style.SUCCESS(f"\n✔ Usuario {user_id} eliminado y secciones desasignadas."))
