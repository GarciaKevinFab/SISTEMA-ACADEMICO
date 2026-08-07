"""
backfill_ingresantes_plan — asigna plan + ciclo=1 + periodo a los Students
que fueron creados por el importador de ingresantes (Applications con
status=ADMITTED) pero no tienen plan asignado.

Uso:
    # Dry-run: solo reporta qué cambiaría
    python manage.py backfill_ingresantes_plan --dry-run

    # Aplica los cambios
    python manage.py backfill_ingresantes_plan --yes

    # Limitar a una convocatoria
    python manage.py backfill_ingresantes_plan --yes --call-id 23

    # Forzar overwrite de plan/ciclo aunque ya estén asignados
    python manage.py backfill_ingresantes_plan --yes --force
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from admission.models import Application
from students.models import Student
from catalogs.helpers import pick_plan_for_student, match_career_robust
from acl.models import Role, UserRole


class Command(BaseCommand):
    help = "Asigna Plan + ciclo=1 + periodo a ingresantes ADMITIDOS sin plan."

    def add_arguments(self, parser):
        parser.add_argument("--yes", action="store_true", help="Aplica los cambios.")
        parser.add_argument("--dry-run", action="store_true", help="Solo reporta.")
        parser.add_argument("--call-id", type=int, default=None, help="Limitar a una convocatoria.")
        parser.add_argument("--force", action="store_true",
                            help="Reasignar plan/ciclo aunque ya estén definidos.")

    def handle(self, *args, **opts):
        dry = opts.get("dry_run") and not opts.get("yes")
        call_id = opts.get("call_id")
        force = opts.get("force")

        qs = (
            Application.objects
            .filter(status="ADMITTED")
            .select_related("applicant", "call")
            .prefetch_related("preferences__career")
        )
        if call_id:
            qs = qs.filter(call_id=call_id)

        total = qs.count()
        self.stdout.write(self.style.NOTICE(
            f"ADMITTED applications a revisar: {total}"
            + (f" (call_id={call_id})" if call_id else "")
        ))

        counts = {
            "processed": 0,
            "no_applicant": 0,
            "no_student": 0,
            "no_career_match": 0,
            "no_plan_for_career": 0,
            "already_ok": 0,
            "updated_plan": 0,
            "updated_ciclo": 0,
            "updated_periodo": 0,
            "updated_any": 0,
            "role_assigned": 0,
            "no_user": 0,
        }
        missing = []

        # Rol STUDENT (se resuelve una vez)
        student_role = Role.objects.filter(name__iexact="STUDENT").first()
        if not student_role:
            self.stdout.write(self.style.WARNING(
                "No existe Role 'STUDENT' — no se asignarán roles."
            ))

        for app in qs.iterator(chunk_size=100):
            counts["processed"] += 1

            applicant = app.applicant
            if not applicant or not applicant.dni:
                counts["no_applicant"] += 1
                continue

            student = Student.objects.filter(num_documento=applicant.dni).first()
            if not student:
                counts["no_student"] += 1
                missing.append({"dni": applicant.dni, "reason": "Student no existe"})
                continue

            # Resolver carrera: preferencia rank=1, o career_name
            career = None
            pref = app.preferences.order_by("rank").first()
            if pref and pref.career_id:
                career = pref.career
            if not career and app.career_name:
                career = match_career_robust(app.career_name)
            if not career and student.programa_carrera:
                career = match_career_robust(student.programa_carrera)

            if not career:
                counts["no_career_match"] += 1
                missing.append({
                    "dni": applicant.dni,
                    "reason": f"No se pudo hacer match de carrera "
                              f"(career_name={app.career_name!r}, "
                              f"programa_carrera={student.programa_carrera!r})",
                })
                continue

            period_code = (app.call.period if app.call else "") or ""
            plan = pick_plan_for_student(career, period_code)
            if not plan:
                counts["no_plan_for_career"] += 1
                missing.append({
                    "dni": applicant.dni,
                    "reason": f"No hay Plan para la carrera {career.name}",
                })
                continue

            dirty = []
            # plan
            if force or not student.plan_id:
                if student.plan_id != plan.id:
                    student.plan = plan
                    dirty.append("plan")
                    counts["updated_plan"] += 1
            # ciclo=1
            if force or not student.ciclo:
                if student.ciclo != 1:
                    student.ciclo = 1
                    dirty.append("ciclo")
                    counts["updated_ciclo"] += 1
            # periodo (del call)
            if period_code and (force or not student.periodo):
                if student.periodo != period_code:
                    student.periodo = period_code
                    dirty.append("periodo")
                    counts["updated_periodo"] += 1

            # Rol STUDENT en User vinculado.
            # El User tiene una M2M directa `roles` (accounts.User.roles) que es
            # la que lee /auth/me y el frontend. Además escribimos a acl.UserRole
            # por compatibilidad con el resto del sistema.
            role_added = False
            if student_role:
                if not student.user_id:
                    counts["no_user"] += 1
                else:
                    user = student.user
                    has_m2m = user.roles.filter(id=student_role.id).exists()
                    has_userrole = UserRole.objects.filter(
                        user_id=user.id, role_id=student_role.id
                    ).exists()
                    if not has_m2m or not has_userrole:
                        role_added = True
                        counts["role_assigned"] += 1
                        if not dry:
                            if not has_m2m:
                                user.roles.add(student_role)
                            if not has_userrole:
                                UserRole.objects.get_or_create(
                                    user_id=user.id, role_id=student_role.id
                                )

            if not dirty and not role_added:
                counts["already_ok"] += 1
                continue

            counts["updated_any"] += 1
            extra = " +ROLE_STUDENT" if role_added else ""
            self.stdout.write(
                f"  DNI {applicant.dni}  {career.name}  "
                f"→ plan={plan.name} ciclo=1 periodo={period_code}  "
                f"[{'DRY' if dry else 'APPLY'}] fields={','.join(dirty) or '-'}{extra}"
            )

            if not dry and dirty:
                with transaction.atomic():
                    student.save(update_fields=dirty)

        # Resumen
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=== RESUMEN ==="))
        for k, v in counts.items():
            self.stdout.write(f"  {k}: {v}")

        if missing:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING(f"Casos no resueltos ({len(missing)}):"))
            for m in missing[:30]:
                self.stdout.write(f"  - DNI {m['dni']}: {m['reason']}")
            if len(missing) > 30:
                self.stdout.write(f"  ... y {len(missing) - 30} más")

        if dry:
            self.stdout.write("")
            self.stdout.write(self.style.NOTICE(
                "Modo dry-run. Para aplicar, re-ejecuta con --yes."
            ))
