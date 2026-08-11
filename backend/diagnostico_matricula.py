"""
¿Por qué a un alumno NO le aparecen cursos en Selección de Cursos? — solo lectura.

Replica uno a uno los filtros de `EnrollmentAvailableView` (la vista que
llena la pantalla del paso 17 del manual) y muestra el veredicto de CADA
curso del plan, más todos los insumos: plan, ciclo, kárdex, pago, ventana.

Uso (en el servidor):
    DNI=61054240 python manage.py shell < diagnostico_matricula.py
    DNI=61054240 PERIODO=2026-II python manage.py shell < diagnostico_matricula.py
"""
import os

from students.models import Student
from academic.models import PlanCourse, Section, Enrollment, AcademicPeriod
from academic.views.enrollment import (
    _approved_info, _current_semester, _is_course_approved, _prereqs_met,
    _attempts_for_course, _guess_default_period_code, _period_obj,
)
from academic.views.enrollment_payment import check_enrollment_payment

DNI = (os.environ.get("DNI") or "").strip()
PERIODO = (os.environ.get("PERIODO") or "").strip().upper() or _guess_default_period_code()

if not DNI:
    print("Falta DNI. Uso: DNI=12345678 python manage.py shell < diagnostico_matricula.py")
    raise SystemExit

st = (Student.objects.select_related("plan", "plan__career")
      .filter(num_documento=DNI).first())
if not st:
    print(f"[ERROR] No existe estudiante con DNI {DNI}")
    raise SystemExit

print("=" * 78)
print(f"DIAGNÓSTICO DE SELECCIÓN DE CURSOS — {PERIODO}")
print("=" * 78)
print(f"Alumno: {st.apellido_paterno} {st.apellido_materno}, {st.nombres}")
print(f"  id={st.id}  DNI={st.num_documento}  user_id={st.user_id}")
print(f"  carrera(texto)={st.programa_carrera!r}")
print(f"  plan_id={st.plan_id}  plan={st.plan.name if st.plan else '— SIN PLAN —'}")
print(f"  Student.ciclo={st.ciclo}  periodo(ficha)={st.periodo!r}  "
      f"estado_academico={st.estado_academico!r}")

# ── 1. Ventana del período ──
per = _period_obj(PERIODO)
if per:
    try:
        estado = per.enrollment_status()
    except Exception:
        estado = getattr(per, "status", "?")
    print(f"\n1) Período {PERIODO}: existe, ventana = {estado}")
else:
    print(f"\n1) Período {PERIODO}: NO EXISTE AcademicPeriod (la vista lo "
          "auto-crea, pero revisa que el código sea el esperado)")

# ── 2. Pago ──
paid, info = check_enrollment_payment(st, PERIODO)
print(f"\n2) Pago de matrícula {PERIODO}: {'APROBADO ✓' if paid else 'NO ✗'}")
if isinstance(info, dict):
    for k in ("status", "amount", "period", "detail", "reviewed_at"):
        if info.get(k) is not None:
            print(f"     {k} = {info[k]}")

# ── 3. Kárdex / aprobados ──
approved_ids, approved_names = _approved_info(st)
current_sem = _current_semester(st)
print(f"\n3) Aprobados (stint activo): {len(approved_ids)} por id, "
      f"{len(approved_names)} por nombre")
print(f"   _current_semester = {current_sem}   Student.ciclo = {st.ciclo}")

# ── 4. Cursos del plan por semestre ──
pcs = list(PlanCourse.objects.select_related("course")
           .filter(plan_id=st.plan_id).order_by("semester", "course__code"))
por_sem = {}
for pc in pcs:
    por_sem.setdefault(int(pc.semester or 0), []).append(pc)
print(f"\n4) Plan {st.plan_id}: {len(pcs)} cursos. Por semestre: "
      + ", ".join(f"sem{s}={len(v)}" for s, v in sorted(por_sem.items())))
if current_sem not in por_sem:
    print(f"   ⚠️  EL PLAN NO TIENE CURSOS DEL SEMESTRE {current_sem} — si el "
          "alumno debe cursar ese ciclo, la selección saldrá VACÍA.")

# ── 5. Veredicto curso por curso (misma lógica de la vista) ──
existing = (Enrollment.objects.filter(student=st, period=PERIODO)
            .exclude(status="CANCELLED").first())
enrolled_pc = (set(existing.items.values_list("plan_course_id", flat=True))
               if existing else set())
if existing:
    print(f"\n   Ya tiene Enrollment {existing.id} [{existing.status}] en "
          f"{PERIODO} con {len(enrolled_pc)} cursos.")

student_ciclo = max(0, int(st.ciclo or 0))
n_visibles = 0
print(f"\n5) VEREDICTO POR CURSO (sem 1..{max(por_sem) if por_sem else 0}):")
for pc in pcs:
    sem = int(pc.semester or 0)
    if sem <= 0:
        continue
    nombre = (pc.display_name or pc.course.name or "")[:44]
    if _is_course_approved(pc, approved_ids, approved_names):
        v = "oculto: APROBADO"
    elif sem > current_sem:
        v = f"oculto: sem {sem} > ciclo actual {current_sem}"
    else:
        attempts = _attempts_for_course(st, pc)
        if student_ciclo > 0 and sem < student_ciclo and not attempts:
            v = f"oculto: sem {sem} < Student.ciclo {student_ciclo} y sin intentos"
        else:
            n_visibles += 1
            if pc.id in enrolled_pc:
                v = "VISIBLE (deshabilitado: ya matriculado en el período)"
            elif not _prereqs_met(pc.id, approved_ids, approved_names):
                v = "VISIBLE (deshabilitado: faltan prerrequisitos)"
            else:
                v = "VISIBLE ✓"
    print(f"   sem{sem}  {nombre:<44} {v}")

print("\n" + "=" * 78)
print(f"RESULTADO: {n_visibles} curso(s) le aparecerían en Selección de Cursos.")
if n_visibles == 0:
    print("Revisa arriba cuál filtro los oculta a todos — los sospechosos:")
    print("  · el plan no tiene cursos del semestre que le toca (punto 4)")
    print("  · Student.ciclo desalineado con el kárdex (punto 3)")
    print("  · todos figuran APROBADOS (¿plan/carrera equivocados?)")
n_secs = Section.objects.filter(period=PERIODO).count()
print(f"(Secciones creadas en {PERIODO}: {n_secs} — no bloquean la selección, "
      "solo el horario)")
print("=" * 78)
