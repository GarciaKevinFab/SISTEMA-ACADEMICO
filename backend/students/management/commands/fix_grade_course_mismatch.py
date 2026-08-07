"""
fix_grade_course_mismatch — diagnostica y arregla AcademicGradeRecord cuyo
Course apunta a un curso de un plan VIEJO en lugar del curso del plan
vigente del alumno.

CASO TÍPICO:
  Alumna RUNACHAGUA MONTALVO (DNI 73943620), ciclo X de su plan vigente,
  debería tener el curso "ESCUELA, FAMILIA Y COMUNIDAD" (ESCUELAFAM, 2cr).
  En BD su AcademicGradeRecord apunta al curso "TUTORIA Y ORIENTACION
  EDUCATIVA" (3cr) que pertenece a un plan anterior. La ficha lee
  r.course.name y muestra el nombre viejo.

USO:
  # 1) Solo diagnóstico de 1 o más DNIs
  python manage.py fix_grade_course_mismatch \\
      --dnis 73943620,74925127

  # 2) Diagnóstico amplio — TODOS los alumnos cuyos AcademicGradeRecord
  #    apuntan a un Course que NO está en su plan actual
  python manage.py fix_grade_course_mismatch --scan-all

  # 3) Remapear: cambia el Course del registro al curso que indiques
  python manage.py fix_grade_course_mismatch \\
      --dnis 73943620,74925127 \\
      --from-course "TUTORIA Y ORIENTACION EDUCATIVA" \\
      --to-course   "ESCUELAFAM" \\
      --yes

  # 4) Remapeo automático por ciclo (experimental)
  #    Para cada registro huérfano busca en el plan del alumno UN ÚNICO
  #    PlanCourse del mismo ciclo (semester) que tenga al menos un
  #    PlanCourse con esa malla. Si encuentra exactamente uno, sugiere
  #    remapear. Si hay ambigüedad, omite y reporta.
  python manage.py fix_grade_course_mismatch \\
      --dnis 73943620,74925127 --auto-remap --yes
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from students.models import Student
from academic.models import AcademicGradeRecord, Plan, PlanCourse, Course


# ── helpers ──────────────────────────────────────────────────────────

def _resolve_course(spec: str):
    """Resuelve un Course a partir de un código exacto, o nombre
    aproximado (icontains). Devuelve el Course o None."""
    if not spec:
        return None
    spec = spec.strip()
    # 1) Code exacto
    c = Course.objects.filter(code__iexact=spec).first()
    if c:
        return c
    # 2) Nombre exacto
    c = Course.objects.filter(name__iexact=spec).first()
    if c:
        return c
    # 3) Nombre icontains
    matches = list(Course.objects.filter(name__icontains=spec)[:5])
    if len(matches) == 1:
        return matches[0]
    return None


def _plan_courses_set(plan_id):
    """Set de course_id que pertenecen a un plan dado."""
    if not plan_id:
        return set()
    return set(
        PlanCourse.objects.filter(plan_id=plan_id)
        .values_list("course_id", flat=True)
    )


def _credits_for(plan_id, course_id):
    """Créditos definidos para ese (plan, course). 0 si no existe."""
    pc = PlanCourse.objects.filter(
        plan_id=plan_id, course_id=course_id
    ).first()
    if not pc:
        return 0, None
    return int(pc.credits or 0), pc


class Command(BaseCommand):
    help = "Diagnostica y/o remapea AcademicGradeRecord con Course de plan viejo."

    def add_arguments(self, parser):
        parser.add_argument("--dnis", type=str, default="",
            help="Lista de DNIs separados por coma.")
        parser.add_argument("--scan-all", action="store_true",
            help="Escanea TODOS los alumnos.")
        parser.add_argument("--from-course", type=str, default="",
            help="Código o nombre del curso EQUIVOCADO.")
        parser.add_argument("--to-course", type=str, default="",
            help="Código o nombre del curso CORRECTO.")
        parser.add_argument("--auto-remap", action="store_true",
            help="Intenta remapear automáticamente por ciclo "
                 "(solo si hay UN único candidato no ambiguo).")
        parser.add_argument("--yes", action="store_true",
            help="Aplica los cambios. Sin esto es solo diagnóstico.")

    # ── main ────────────────────────────────────────────────────────
    def handle(self, *args, **opts):
        apply = bool(opts.get("yes"))
        tag = "[APPLY]" if apply else "[DRY]"
        self.stdout.write(self.style.NOTICE(
            f"=== fix_grade_course_mismatch {tag} ==="
        ))

        # Resolver alumnos
        if opts.get("scan_all"):
            students_qs = Student.objects.exclude(plan_id__isnull=True)
        else:
            dnis_raw = (opts.get("dnis") or "").strip()
            if not dnis_raw:
                self.stdout.write(self.style.ERROR(
                    "Debes pasar --dnis a,b,c o --scan-all"
                ))
                return
            dnis = [d.strip() for d in dnis_raw.split(",") if d.strip()]
            students_qs = Student.objects.filter(num_documento__in=dnis)

        students = list(students_qs.select_related("plan", "plan__career"))
        if not students:
            self.stdout.write(self.style.ERROR("No se encontraron alumnos."))
            return

        # Resolver remap dirigido si lo pidieron
        from_course = _resolve_course(opts.get("from_course") or "")
        to_course = _resolve_course(opts.get("to_course") or "")
        manual_remap = bool(from_course and to_course)
        auto_remap = bool(opts.get("auto_remap"))

        if manual_remap:
            self.stdout.write(
                f"Remap MANUAL: '{from_course.name}' (id={from_course.id})"
                f"  →  '{to_course.name}' (id={to_course.id})"
            )
        if auto_remap:
            self.stdout.write("Remap AUTO por ciclo activado.")

        total_orphans = total_fixed = total_skipped = 0

        for st in students:
            if not st.plan_id:
                self.stdout.write(self.style.WARNING(
                    f"  · {st.num_documento}: SIN plan vigente — omito."
                ))
                continue

            plan_course_ids = _plan_courses_set(st.plan_id)
            recs = list(
                AcademicGradeRecord.objects
                .filter(student=st)
                .select_related("course", "plan_course")
            )

            # Detectar huérfanos: course NO está en el plan vigente
            orphans = [r for r in recs if r.course_id not in plan_course_ids]
            if not orphans:
                continue

            total_orphans += len(orphans)
            full = " ".join(
                x for x in [st.apellido_paterno, st.apellido_materno, st.nombres] if x
            ).strip()
            plan_lbl = f"{st.plan.name}" if st.plan else "—"
            self.stdout.write("")
            self.stdout.write(self.style.NOTICE(
                f"▸ {st.num_documento} · {full}  |  plan vigente: {plan_lbl}"
            ))
            self.stdout.write(
                f"  Huérfanos: {len(orphans)} de {len(recs)} registros"
            )

            for r in orphans:
                cname = (r.course.name if r.course else "—")
                ccode = (r.course.code if r.course else "—")
                self.stdout.write(
                    f"   - rec_id={r.id} term={r.term!r} "
                    f"course=({ccode}) {cname!r} grade={r.final_grade}"
                )

                # ── Modo manual: remap A→B ──
                target_course = None
                if manual_remap and r.course_id == from_course.id:
                    target_course = to_course

                # ── Modo auto: buscar único candidato en el plan ──
                if not target_course and auto_remap:
                    # Si el record tiene plan_course con semester usable,
                    # buscamos en el plan vigente los cursos de ese semestre.
                    sem = 0
                    if r.plan_course and r.plan_course.semester:
                        sem = int(r.plan_course.semester)
                    if sem:
                        candidates = list(
                            PlanCourse.objects
                            .filter(plan_id=st.plan_id, semester=sem)
                            .select_related("course")
                        )
                        # Filtrar: que el record actual no apunte ya a
                        # uno de esos cursos
                        candidates = [
                            c for c in candidates
                            if c.course_id != r.course_id
                        ]
                        if len(candidates) == 1:
                            target_course = candidates[0].course
                        elif len(candidates) > 1:
                            self.stdout.write(self.style.WARNING(
                                f"     ⚠ auto-remap ambiguo "
                                f"({len(candidates)} candidatos en ciclo {sem})"
                            ))

                if not target_course:
                    total_skipped += 1
                    continue

                # Resolver nuevo plan_course + créditos
                new_credits, new_pc = _credits_for(st.plan_id, target_course.id)
                self.stdout.write(self.style.SUCCESS(
                    f"     → REMAP a ({target_course.code}) "
                    f"{target_course.name!r}  cred={new_credits}"
                ))
                if apply:
                    with transaction.atomic():
                        r.course = target_course
                        r.plan_course = new_pc
                        # Actualizar créditos en components si hay
                        if isinstance(r.components, dict):
                            r.components["CREDITS"] = new_credits
                        r.save(update_fields=["course", "plan_course", "components"])
                total_fixed += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"=== FIN {tag}  ·  huérfanos: {total_orphans}  ·  "
            f"{'remapeados' if apply else 'a remapear'}: {total_fixed}  ·  "
            f"omitidos: {total_skipped} ==="
        ))
        if not apply and total_fixed:
            self.stdout.write(self.style.NOTICE(
                "Modo dry-run. Para aplicar agrega --yes"
            ))
