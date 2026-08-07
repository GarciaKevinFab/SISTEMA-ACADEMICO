"""
diagnose_student — muestra todo el estado académico de un estudiante por DNI.
Reporta: registro Student, plan, ciclo almacenado, ciclo computado, notas,
enrollments, items, etc.

Uso:
    python manage.py diagnose_student --dni 61654734
    python manage.py diagnose_student --dni 61654734 --fix-ciclo 2
"""
from django.core.management.base import BaseCommand

from students.models import Student
from academic.models import (
    Enrollment, EnrollmentItem, PlanCourse, AcademicGradeRecord,
)


def _norm_text(s):
    import unicodedata, re
    s = (s or "").strip().lower()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", s)


class Command(BaseCommand):
    help = "Diagnóstico completo de un estudiante por DNI."

    def add_arguments(self, parser):
        parser.add_argument("--dni", required=True)
        parser.add_argument("--fix-ciclo", type=int, default=None,
                            help="Si se pasa, fuerza Student.ciclo a ese valor.")

    def handle(self, *args, **opts):
        dni = opts["dni"].strip()
        fix_ciclo = opts.get("fix_ciclo")

        st = Student.objects.filter(num_documento=dni).first()
        if not st:
            self.stdout.write(self.style.ERROR(f"No existe Student con DNI {dni}"))
            return

        full = " ".join([
            st.apellido_paterno or "", st.apellido_materno or "", st.nombres or ""
        ]).strip()

        self.stdout.write(self.style.SUCCESS(f"=== {full} (DNI {dni}) ==="))
        self.stdout.write(f"  id          : {st.id}")
        self.stdout.write(f"  user_id     : {st.user_id}")
        self.stdout.write(f"  programa    : {st.programa_carrera!r}")
        self.stdout.write(f"  plan        : {st.plan.name if st.plan else '(sin plan)'} "
                          f"(id={st.plan_id})")
        self.stdout.write(f"  ciclo (BD)  : {st.ciclo}")
        self.stdout.write(f"  periodo     : {st.periodo!r}")

        # ── Notas (AcademicGradeRecord) ──
        recs = list(
            AcademicGradeRecord.objects
            .select_related("course", "plan_course")
            .filter(student=st)
            .order_by("term", "course__code")
        )
        self.stdout.write("")
        self.stdout.write(f"  Registros de notas (AcademicGradeRecord): {len(recs)}")

        # ── Computar ciclo según lógica del sistema ──
        approved_ids = set()
        approved_names = set()
        try:
            from academic.views.enrollment import PASSING_GRADE
        except Exception:
            PASSING_GRADE = 11

        # Detectar restart (replicando lógica del enrollment)
        try:
            from academic.views.enrollment import (
                _detect_restart_term, _approved_info,
            )
            from academic.models import AcademicGradeRecord as AGR
            qs_plan = AGR.objects.filter(student=st)
            if st.plan_id:
                from django.db.models import Q
                qs_plan = qs_plan.filter(
                    Q(plan_course__isnull=True) |
                    Q(plan_course__plan_id=st.plan_id)
                )
            restart_term = _detect_restart_term(st, qs_plan)
        except Exception as e:
            restart_term = None
            self.stdout.write(f"  (no se pudo detectar restart: {e})")

        if restart_term:
            self.stdout.write(self.style.WARNING(
                f"  ⚠ REINICIO detectado en {restart_term} → "
                f"se ignoran notas anteriores"
            ))

        # Mejor nota por course_id (con filtros de plan + restart)
        from academic.views.kardex import _period_to_num as _pnum
        restart_num = _pnum(restart_term) if restart_term else None

        # ── Tabla de notas con marcas ──
        if recs:
            self.stdout.write(
                f"    {'TERM':<10} {'COURSE':<12} {'NOMBRE':<40} "
                f"{'NOTA':>6} {'PC.SEM':>6} {'PC.PLAN':>8} {'CUENTA':>7}"
            )
            for r in recs:
                pc_sem = r.plan_course.semester if r.plan_course_id else "-"
                pc_plan = r.plan_course.plan_id if r.plan_course_id else "-"
                if not st.plan_id:
                    cuenta = "?"
                elif r.plan_course_id and pc_plan != st.plan_id:
                    cuenta = "NO-plan"
                elif restart_num is not None:
                    tnum = _pnum(r.term)
                    if tnum is None or tnum < restart_num:
                        cuenta = "NO-pre"
                    else:
                        cuenta = "SI"
                else:
                    cuenta = "SI"
                cname = (r.course.name or "")[:40]
                self.stdout.write(
                    f"    {r.term:<10} {r.course.code:<12} {cname:<40} "
                    f"{float(r.final_grade):>6.2f} {pc_sem!s:>6} "
                    f"{pc_plan!s:>8} {cuenta:>7}"
                )

        best = {}
        for r in recs:
            if st.plan_id and r.plan_course_id and \
                    r.plan_course.plan_id != st.plan_id:
                continue
            if restart_num is not None:
                tnum = _pnum(r.term)
                if tnum is None or tnum < restart_num:
                    continue
            try:
                g = float(r.final_grade)
            except Exception:
                g = None
            name_norm = _norm_text(getattr(r.course, "name", "") or "")
            prev = best.get(r.course_id)
            if prev is None or (g is not None and (prev[0] is None or g > prev[0])):
                best[r.course_id] = (g, name_norm)

        for cid, (g, n) in best.items():
            if g is not None and g >= PASSING_GRADE:
                approved_ids.add(cid)
                if n:
                    approved_names.add(n)

        max_approved_sem = 0
        if st.plan_id:
            for pc in PlanCourse.objects.select_related("course").filter(plan_id=st.plan_id):
                sem = int(pc.semester or 0)
                if sem <= 0:
                    continue
                approved = (pc.course_id in approved_ids)
                if not approved:
                    pc_name = _norm_text(
                        getattr(pc, "display_name", "") or
                        getattr(pc.course, "name", "") or ""
                    )
                    if pc_name and pc_name in approved_names:
                        approved = True
                if approved and sem > max_approved_sem:
                    max_approved_sem = sem

        ciclo_val = max(1, int(st.ciclo or 0))
        computed = max(1, max_approved_sem + 1)
        current = max(ciclo_val, computed)

        self.stdout.write("")
        self.stdout.write(f"  Cursos aprobados      : {len(approved_ids)} (ids)")
        self.stdout.write(f"  Max semestre aprobado : {max_approved_sem}")
        self.stdout.write(f"  computed (sem_aprob+1): {computed}")
        self.stdout.write(f"  ciclo_val (BD)        : {ciclo_val}")
        self.stdout.write(self.style.SUCCESS(
            f"  → CICLO ACTUAL DEL SISTEMA: {current}"
        ))

        # ── Enrollments ──
        enrolls = Enrollment.objects.filter(student=st).order_by("-id")
        self.stdout.write("")
        self.stdout.write(f"  Enrollments: {enrolls.count()}")
        for e in enrolls:
            items = EnrollmentItem.objects.select_related("plan_course__course").filter(enrollment=e)
            self.stdout.write(
                f"    - id={e.id} period={e.period} status={e.status} "
                f"items={items.count()} created={e.created_at} "
                f"confirmed={e.confirmed_at}"
            )
            for it in items:
                pc = it.plan_course
                self.stdout.write(
                    f"        · sem={pc.semester} "
                    f"{pc.display_code or pc.course.code} - "
                    f"{pc.display_name or pc.course.name}"
                )

        # ── Fix opcional ──
        if fix_ciclo is not None:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING(
                f"--fix-ciclo {fix_ciclo}: Student.ciclo {st.ciclo} → {fix_ciclo}"
            ))
            st.ciclo = fix_ciclo
            st.save(update_fields=["ciclo"])
            self.stdout.write(self.style.SUCCESS("  ✓ ciclo actualizado"))
            if max_approved_sem >= fix_ciclo:
                self.stdout.write(self.style.WARNING(
                    f"  ⚠ Pero tiene cursos aprobados de semestre {max_approved_sem}. "
                    f"El sistema seguirá computando ciclo={max_approved_sem + 1} "
                    f"a menos que también se ajusten esas notas."
                ))
