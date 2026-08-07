"""
Corrige el período vigente y limpia secciones creadas por error en un período futuro.

Contexto (jul-2026): ningún Period estaba marcado is_active y 2026-I no existía
en el catálogo, así que el frontend estimó "2026-II" por calendario y las pantallas
de Asignación de Áreas / Carga y Horarios crearon secciones fantasma en 2026-II
(0 alumnos, 0 sesiones).

Uso:
    python manage.py fix_active_period                      # dry-run (no cambia nada)
    python manage.py fix_active_period --apply              # aplica los cambios
    python manage.py fix_active_period --active 2026-I --purge 2026-II --apply

Qué hace:
  1. Asegura que el período --active exista en catálogos (catalogs.Period +
     academic.AcademicPeriod) y lo marca como único is_active.
  2. Lista las secciones del período --purge y elimina SOLO las que no tienen
     matrículas, ni sesiones de asistencia, ni notas registradas.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from catalogs.models import Period
from catalogs.views.utils import _ensure_period
from academic.models import Section, EnrollmentItem


class Command(BaseCommand):
    help = "Marca el período vigente y elimina secciones fantasma de un período futuro (dry-run por defecto)."

    def add_arguments(self, parser):
        parser.add_argument("--active", default="2026-I", help="Período que debe quedar como vigente (default: 2026-I)")
        parser.add_argument("--purge", default="2026-II", help="Período cuyas secciones vacías se eliminan (default: 2026-II)")
        parser.add_argument("--apply", action="store_true", help="Aplica los cambios (sin esto solo muestra qué haría)")

    def handle(self, *args, **opts):
        active_code = (opts["active"] or "").strip().upper()
        purge_code = (opts["purge"] or "").strip().upper()
        apply_changes = opts["apply"]

        if not apply_changes:
            self.stdout.write(self.style.WARNING("== DRY-RUN: no se cambiará nada. Usa --apply para ejecutar. =="))

        with transaction.atomic():
            self._activate_period(active_code, apply_changes)
            self._purge_empty_sections(purge_code, apply_changes)
            if not apply_changes:
                transaction.set_rollback(True)

    # ── 1. período vigente ─────────────────────────────────────
    def _activate_period(self, code, apply_changes):
        self.stdout.write(f"\n[1] Período vigente → {code}")

        per = Period.objects.filter(code=code).first()
        if not per:
            self.stdout.write(f"    Period {code!r} no existe en catálogos: se creará (con AcademicPeriod).")
            if apply_changes:
                per = _ensure_period(code)
                if not per:
                    self.stderr.write(self.style.ERROR(f"    No se pudo crear el período {code!r}"))
                    return
        else:
            self.stdout.write(f"    Period {code!r} ya existe (is_active={per.is_active}).")

        currently_active = list(Period.objects.filter(is_active=True).exclude(code=code).values_list("code", flat=True))
        if currently_active:
            self.stdout.write(f"    Se desactivarán: {', '.join(currently_active)}")

        if apply_changes:
            Period.objects.filter(is_active=True).exclude(code=code).update(is_active=False)
            Period.objects.filter(code=code).update(is_active=True)
            self.stdout.write(self.style.SUCCESS(f"    ✔ {code} marcado como vigente."))

    # ── 2. secciones fantasma ──────────────────────────────────
    def _purge_empty_sections(self, code, apply_changes):
        self.stdout.write(f"\n[2] Secciones en {code}")

        sections = (
            Section.objects.filter(period=code)
            .select_related("plan_course__course", "teacher__user")
            .order_by("id")
        )
        if not sections.exists():
            self.stdout.write("    No hay secciones en ese período. Nada que limpiar.")
            return

        to_delete, kept = [], []
        for sec in sections:
            n_enroll = EnrollmentItem.objects.filter(section=sec).count()
            n_sessions = sec.attendance_sessions.count()
            bundle = getattr(sec, "grades_bundle", None)
            has_grades = bool(bundle and (bundle.grades or bundle.submitted))

            course = getattr(getattr(sec.plan_course, "course", None), "name", "?")
            teacher = getattr(getattr(sec.teacher, "user", None), "get_full_name", lambda: "")() or "—"
            desc = f"id={sec.id} [{sec.label}] {course} | docente: {teacher}"

            if n_enroll or n_sessions or has_grades:
                kept.append((desc, n_enroll, n_sessions, has_grades))
            else:
                to_delete.append((sec, desc))

        for desc, n_enroll, n_sessions, has_grades in kept:
            self.stdout.write(self.style.WARNING(
                f"    CONSERVADA {desc} (matrículas={n_enroll}, sesiones={n_sessions}, notas={has_grades})"
            ))
        for _, desc in to_delete:
            self.stdout.write(f"    ELIMINAR   {desc}")

        self.stdout.write(f"    Total: {len(to_delete)} a eliminar, {len(kept)} conservadas.")

        if apply_changes and to_delete:
            for sec, _ in to_delete:
                sec.delete()
            self.stdout.write(self.style.SUCCESS(f"    ✔ {len(to_delete)} secciones eliminadas de {code}."))
