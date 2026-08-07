"""
verify_ingresantes_plan — verifica que cada Application ADMITTED tenga un
Student con:
  - plan correcto (el plan 2020-2020 de su carrera)
  - ciclo = 1
  - periodo del call
  - rol STUDENT asignado en User.roles
Reporta inconsistencias y, con --fix, las corrige (fuerza el plan 2020-2020
aunque ya tenga otro plan asignado, lo cual es distinto del backfill que
solo asigna si no hay plan).

Uso:
    python manage.py verify_ingresantes_plan             # solo reporta
    python manage.py verify_ingresantes_plan --fix       # corrige mismatches
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count

from admission.models import Application
from students.models import Student
from academic.models import Plan
from catalogs.helpers import match_career_robust
from acl.models import Role, UserRole


def expected_plan_for_career(career):
    """Devuelve el plan 2020-2020 de esa carrera, o el más reciente si no hay."""
    if not career:
        return None
    # Prioridad: plan start_year=2020 (sin importar end_year)
    plan = (
        Plan.objects
        .filter(career=career, is_deleted=False, start_year=2020)
        .annotate(n_courses=Count("plan_courses"))
        .order_by("-n_courses", "-id")
        .first()
    )
    if plan:
        return plan
    # Fallback: el más reciente
    return (
        Plan.objects
        .filter(career=career, is_deleted=False)
        .annotate(n_courses=Count("plan_courses"))
        .order_by("-start_year", "-n_courses", "-id")
        .first()
    )


class Command(BaseCommand):
    help = "Verifica que los admitidos estén en su plan 2020-2020 correcto."

    def add_arguments(self, parser):
        parser.add_argument("--fix", action="store_true",
                            help="Corrige mismatches de plan/ciclo/periodo/rol.")

    def handle(self, *args, **opts):
        fix = opts.get("fix", False)

        student_role = Role.objects.filter(name__iexact="STUDENT").first()

        qs = (
            Application.objects
            .filter(status="ADMITTED")
            .select_related("applicant", "call")
            .prefetch_related("preferences__career")
        )

        total = qs.count()
        self.stdout.write(self.style.NOTICE(f"Admitidos a revisar: {total}"))

        counts = {
            "ok": 0,
            "no_student": 0,
            "no_career": 0,
            "no_expected_plan": 0,
            "wrong_plan": 0,
            "wrong_ciclo": 0,
            "wrong_periodo": 0,
            "missing_role_m2m": 0,
            "missing_role_userrole": 0,
            "no_user": 0,
            "fixed": 0,
        }
        issues = []

        for app in qs.iterator(chunk_size=100):
            ap = app.applicant
            if not ap:
                continue
            st = Student.objects.filter(num_documento=ap.dni).first()
            if not st:
                counts["no_student"] += 1
                issues.append({"dni": ap.dni, "issue": "no_student"})
                continue

            # Resolver carrera esperada
            career = None
            pref = app.preferences.order_by("rank").first()
            if pref and pref.career_id:
                career = pref.career
            if not career and app.career_name:
                career = match_career_robust(app.career_name)
            if not career and st.programa_carrera:
                career = match_career_robust(st.programa_carrera)

            if not career:
                counts["no_career"] += 1
                issues.append({"dni": ap.dni, "issue": "no_career",
                               "detail": f"career_name={app.career_name!r}"})
                continue

            expected_plan = expected_plan_for_career(career)
            if not expected_plan:
                counts["no_expected_plan"] += 1
                issues.append({"dni": ap.dni, "issue": "no_expected_plan",
                               "detail": f"career={career.name}"})
                continue

            period_code = (app.call.period if app.call else "") or ""
            problems = []
            dirty = []

            # 1. plan
            if st.plan_id != expected_plan.id:
                counts["wrong_plan"] += 1
                cur_plan_name = st.plan.name if st.plan else "(sin plan)"
                problems.append(
                    f"plan={cur_plan_name!r} → esperado {expected_plan.name!r}"
                )
                if fix:
                    st.plan = expected_plan
                    dirty.append("plan")

            # 2. ciclo
            if st.ciclo != 1:
                counts["wrong_ciclo"] += 1
                problems.append(f"ciclo={st.ciclo} → esperado 1")
                if fix:
                    st.ciclo = 1
                    dirty.append("ciclo")

            # 3. periodo
            if period_code and st.periodo != period_code:
                counts["wrong_periodo"] += 1
                problems.append(f"periodo={st.periodo!r} → esperado {period_code!r}")
                if fix:
                    st.periodo = period_code
                    dirty.append("periodo")

            # 4. rol STUDENT
            if student_role:
                if not st.user_id:
                    counts["no_user"] += 1
                    problems.append("sin User vinculado")
                else:
                    user = st.user
                    if not user.roles.filter(id=student_role.id).exists():
                        counts["missing_role_m2m"] += 1
                        problems.append("falta STUDENT en User.roles (M2M)")
                        if fix:
                            user.roles.add(student_role)
                    if not UserRole.objects.filter(
                        user_id=user.id, role_id=student_role.id
                    ).exists():
                        counts["missing_role_userrole"] += 1
                        problems.append("falta en acl.UserRole")
                        if fix:
                            UserRole.objects.get_or_create(
                                user_id=user.id, role_id=student_role.id
                            )

            if problems:
                self.stdout.write(
                    f"  DNI {ap.dni} [{career.name}]: " + "; ".join(problems)
                    + (" [FIXED]" if fix and (dirty or "falta" in " ".join(problems)) else "")
                )
                if fix and dirty:
                    with transaction.atomic():
                        st.save(update_fields=dirty)
                    counts["fixed"] += 1
                elif fix:
                    counts["fixed"] += 1
                issues.append({
                    "dni": ap.dni,
                    "issue": "multiple",
                    "detail": "; ".join(problems),
                })
            else:
                counts["ok"] += 1

        # Resumen
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=== RESUMEN ==="))
        for k, v in counts.items():
            self.stdout.write(f"  {k}: {v}")

        if not fix and (counts["wrong_plan"] or counts["wrong_ciclo"]
                        or counts["wrong_periodo"] or counts["missing_role_m2m"]
                        or counts["missing_role_userrole"]):
            self.stdout.write("")
            self.stdout.write(self.style.WARNING(
                "Para corregir: python manage.py verify_ingresantes_plan --fix"
            ))
