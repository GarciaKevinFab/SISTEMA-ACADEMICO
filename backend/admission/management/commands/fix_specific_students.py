"""
fix_specific_students — fixes puntuales reportados por usuarios.

Casos:
  1. TOMAS PALPA  (DNI 60634749): matriculado en plan 2015 siendo ingresante
     2026-I → mover a Plan 2020-2020 EDUCACIÓN FÍSICA + borrar Enrollment
     existente del periodo 2026-I para que se vuelva a matricular en el plan
     correcto.
  2. BLANCO YAURI (DNI 75551660): nombre actual sale "CALDERON VILCHEZ".
     Restaurar a BLANCO YAURI.
  3. BALDEON HUARIONA, Brad (DNI 60621879): sistema dice "no matriculado"
     pero ya tiene ficha. Reportar el estado real (Enrollments + status) sin
     borrar nada — para que el admin decida.
  4. MONTALVO MAYTA, LUIS ANGEL: DNI actual 72097858 → debe ser 72097058.
     Cambiar num_documento + username (User).

Uso:
    python manage.py fix_specific_students --dry-run
    python manage.py fix_specific_students --yes
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from students.models import Student
from academic.models import Plan, Enrollment, EnrollmentItem
from catalogs.helpers import match_career_robust
from acl.models import Role, UserRole
from django.contrib.auth import get_user_model


PERIOD_CODE_INGRESANTES = "2026-I"


def get_plan_2020(career_name: str):
    car = match_career_robust(career_name)
    if not car:
        return None
    return (
        Plan.objects
        .filter(career=car, is_deleted=False, start_year=2020)
        .order_by("-id")
        .first()
    )


class Command(BaseCommand):
    help = "Aplica fixes puntuales reportados (4 estudiantes)."

    def add_arguments(self, parser):
        parser.add_argument("--yes", action="store_true")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        dry = opts.get("dry_run") and not opts.get("yes")
        self.dry = dry
        tag = "[DRY]" if dry else "[APPLY]"

        self.stdout.write(self.style.NOTICE(f"=== fix_specific_students {tag} ==="))

        # ── 1. TOMAS PALPA — DNI 60634749 ─────────────────────────
        self.stdout.write("")
        self.stdout.write(self.style.NOTICE(
            "1) TOMAS PALPA (DNI 60634749) — mover a plan 2020 EDUCACIÓN FÍSICA + "
            "borrar enrollment del periodo 2026-I"
        ))
        st = Student.objects.filter(num_documento="60634749").first()
        if not st:
            self.stdout.write("   - Student no existe.")
        else:
            self._show_student(st)
            target_plan = get_plan_2020("EDUCACIÓN FÍSICA")
            if not target_plan:
                self.stdout.write("   - ERROR: no se encontró Plan 2020 EDUCACIÓN FÍSICA.")
            else:
                if st.plan_id != target_plan.id:
                    self.stdout.write(
                        f"   plan: {st.plan.name if st.plan else '(none)'} "
                        f"→ {target_plan.name}"
                    )
                    if not dry:
                        st.plan = target_plan
                if st.ciclo != 1:
                    self.stdout.write(f"   ciclo: {st.ciclo} → 1")
                    if not dry:
                        st.ciclo = 1
                if st.periodo != PERIOD_CODE_INGRESANTES:
                    self.stdout.write(
                        f"   periodo: {st.periodo!r} → {PERIOD_CODE_INGRESANTES!r}"
                    )
                    if not dry:
                        st.periodo = PERIOD_CODE_INGRESANTES
                if not dry:
                    st.save()

                # Borrar enrollment del periodo 2026-I (para que se rematricule
                # con el plan 2020 correcto)
                enrolls = Enrollment.objects.filter(
                    student=st, period=PERIOD_CODE_INGRESANTES
                )
                for e in enrolls:
                    items = EnrollmentItem.objects.filter(enrollment=e)
                    self.stdout.write(
                        f"   Enrollment id={e.id} status={e.status} "
                        f"items={items.count()} → BORRAR"
                    )
                    if not dry:
                        items.delete()
                        e.delete()

        # ── 2. BLANCO YAURI — DNI 75551660 ────────────────────────
        # RENIEC: JHOMAR JOEL BLANCO YAURI, M, nac. 2005-12-01
        self.stdout.write("")
        self.stdout.write(self.style.NOTICE(
            "2) BLANCO YAURI (DNI 75551660) — restaurar nombre completo desde RENIEC"
        ))
        st = Student.objects.filter(num_documento="75551660").first()
        if not st:
            self.stdout.write("   - Student no existe.")
        else:
            self._show_student(st)
            new_ap_pat = "BLANCO"
            new_ap_mat = "YAURI"
            new_nombres = "JHOMAR JOEL"
            new_sexo = "M"
            from datetime import date
            new_fecha = date(2005, 12, 1)

            changed = []
            if st.apellido_paterno != new_ap_pat:
                self.stdout.write(
                    f"   apellido_paterno: {st.apellido_paterno!r} → {new_ap_pat!r}"
                )
                changed.append("apellido_paterno")
                if not dry:
                    st.apellido_paterno = new_ap_pat
            if st.apellido_materno != new_ap_mat:
                self.stdout.write(
                    f"   apellido_materno: {st.apellido_materno!r} → {new_ap_mat!r}"
                )
                changed.append("apellido_materno")
                if not dry:
                    st.apellido_materno = new_ap_mat
            if st.nombres != new_nombres:
                self.stdout.write(
                    f"   nombres: {st.nombres!r} → {new_nombres!r}"
                )
                changed.append("nombres")
                if not dry:
                    st.nombres = new_nombres
            if (st.sexo or "").upper() != new_sexo:
                self.stdout.write(f"   sexo: {st.sexo!r} → {new_sexo!r}")
                changed.append("sexo")
                if not dry:
                    st.sexo = new_sexo
            if st.fecha_nac != new_fecha:
                self.stdout.write(
                    f"   fecha_nac: {st.fecha_nac} → {new_fecha}"
                )
                changed.append("fecha_nac")
                if not dry:
                    st.fecha_nac = new_fecha
            # Sincroniza User.full_name
            if st.user_id and changed:
                full = " ".join([new_ap_pat, new_ap_mat, new_nombres]).strip()
                self.stdout.write(f"   User.full_name → {full!r}")
                if not dry and hasattr(st.user, "full_name"):
                    st.user.full_name = full
                    st.user.save(update_fields=["full_name"])
            if not dry and changed:
                st.save(update_fields=changed)
            if not changed:
                self.stdout.write("   (ya estaba correcto)")

        # ── 3. BALDEON HUARIONA, Brad — DNI 60621879 ──────────────
        self.stdout.write("")
        self.stdout.write(self.style.NOTICE(
            "3) BALDEON HUARIONA, Brad (DNI 60621879) — diagnóstico de matrícula"
        ))
        st = Student.objects.filter(num_documento="60621879").first()
        if not st:
            self.stdout.write("   - Student no existe.")
        else:
            self._show_student(st)
            enrolls = Enrollment.objects.filter(student=st).order_by("-id")
            if not enrolls.exists():
                self.stdout.write("   - NO tiene Enrollments registrados.")
                self.stdout.write(
                    "   - Si dice tener ficha, posiblemente el PDF se generó sin "
                    "haber confirmado matrícula. Avisar al admin."
                )
            else:
                self.stdout.write(f"   Enrollments encontrados: {enrolls.count()}")
                for e in enrolls:
                    items = EnrollmentItem.objects.filter(enrollment=e)
                    self.stdout.write(
                        f"   - Enrollment id={e.id} period={e.period} "
                        f"status={e.status} items={items.count()} "
                        f"created={e.created_at} confirmed={e.confirmed_at}"
                    )
                # Si hay enrollments con status=DRAFT/CANCELLED y el sistema dice
                # "no matriculado", el problema es el filtro. No borrar nada.

        # ── 4. MONTALVO MAYTA, LUIS ANGEL — DNI 72097858 → 72097058 ──
        self.stdout.write("")
        self.stdout.write(self.style.NOTICE(
            "4) MONTALVO MAYTA, LUIS ANGEL — corregir DNI 72097858 → 72097058"
        ))
        st = Student.objects.filter(num_documento="72097858").first()
        if not st:
            self.stdout.write("   - No existe Student con DNI 72097858.")
            # Quizá ya esté con el correcto
            st_ok = Student.objects.filter(num_documento="72097058").first()
            if st_ok:
                self.stdout.write(f"   - Ya existe Student con DNI 72097058 (id={st_ok.id}). OK.")
        else:
            # Verificar que no exista ya alguien con el DNI nuevo
            dup = Student.objects.filter(num_documento="72097058").exclude(id=st.id).first()
            if dup:
                self.stdout.write(self.style.ERROR(
                    f"   - CONFLICTO: ya existe otro Student con DNI 72097058 "
                    f"(id={dup.id}). Resolver manualmente."
                ))
            else:
                self._show_student(st)
                self.stdout.write(f"   num_documento: 72097858 → 72097058")
                if not dry:
                    st.num_documento = "72097058"
                    st.save(update_fields=["num_documento"])
                # Cambiar username del User vinculado si coincide
                if st.user_id:
                    user = st.user
                    if user.username == "72097858":
                        # Verificar que no exista otro user con el nuevo username
                        User = get_user_model()
                        if User.objects.filter(username="72097058").exclude(id=user.id).exists():
                            self.stdout.write(self.style.ERROR(
                                "   - CONFLICTO: ya existe User con username 72097058. "
                                "No se cambió username del User."
                            ))
                        else:
                            self.stdout.write(f"   User.username: 72097858 → 72097058")
                            if not dry:
                                user.username = "72097058"
                                user.save(update_fields=["username"])
                    else:
                        self.stdout.write(
                            f"   (User.username actual = {user.username!r}, no se modifica)"
                        )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"=== FIN {tag} ==="))
        if dry:
            self.stdout.write(self.style.NOTICE(
                "Modo dry-run. Para aplicar: python manage.py fix_specific_students --yes"
            ))

    def _show_student(self, st):
        full = " ".join([
            st.apellido_paterno or "", st.apellido_materno or "", st.nombres or ""
        ]).strip()
        plan_name = st.plan.name if st.plan_id and st.plan else "(sin plan)"
        self.stdout.write(
            f"   actual: id={st.id} dni={st.num_documento} nombre={full!r} "
            f"plan={plan_name} ciclo={st.ciclo} periodo={st.periodo!r} "
            f"user_id={st.user_id}"
        )
