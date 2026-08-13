"""
AUDITORÍA GLOBAL DEL FLUJO DE MATRÍCULA — solo lectura, no escribe nada.

Recorre TODOS los pagos de matrícula del período y simula, para cada alumno,
lo que le mostraría la pantalla de Selección de Cursos (los mismos filtros
de EnrollmentAvailableView). Clasifica:

    LISTO        pago aprobado y vería N cursos → puede matricularse ya
    MATRICULADO  ya confirmó su matrícula del período
    TRABADO      pago aprobado pero vería 0 cursos (se indica el porqué)
    EN REVISIÓN  voucher subido, Finanzas aún no lo aprueba
    RECHAZADO    voucher rechazado (el alumno debe subir otro)
    SIN CUENTA   pagó pero su ficha no tiene usuario → no puede iniciar sesión

Uso:
    python manage.py shell < auditar_flujo_matricula.py
    PERIODO=2026-II python manage.py shell < auditar_flujo_matricula.py
"""
import os

from academic.models import Enrollment, EnrollmentPayment, PlanCourse
from academic.views.enrollment import (
    _approved_info, _current_semester, _is_course_approved,
    _attempts_for_course,
)
from students.name_utils import clave_orden, nombre_oficial

PERIODO = (os.environ.get("PERIODO") or "2026-II").strip().upper()

pagos = list(EnrollmentPayment.objects
             .select_related("student", "student__plan")
             .filter(period=PERIODO))

print("=" * 94)
print(f"AUDITORÍA DEL FLUJO DE MATRÍCULA — {PERIODO}   ({len(pagos)} pagos)")
print("=" * 94)
if not pagos:
    print("No hay pagos registrados en este período.")
    raise SystemExit

# Cursos por plan (una sola vez por plan)
_planes = {}


def _pcs_de(plan_id):
    if plan_id not in _planes:
        _planes[plan_id] = list(
            PlanCourse.objects.select_related("course")
            .filter(plan_id=plan_id).order_by("semester"))
    return _planes[plan_id]


def _simular_seleccion(st):
    """(n_cursos_visibles, motivo_si_cero) — misma lógica de la vista."""
    if not st.plan_id:
        return 0, "SIN PLAN asignado"
    approved_ids, approved_names = _approved_info(st)
    current_sem = _current_semester(st)
    student_ciclo = max(0, int(st.ciclo or 0))
    pcs = _pcs_de(st.plan_id)
    if not pcs:
        return 0, f"el plan {st.plan_id} no tiene cursos"

    n = 0
    hay_sem_actual = False
    for pc in pcs:
        sem = int(pc.semester or 0)
        if sem <= 0:
            continue
        if sem == current_sem:
            hay_sem_actual = True
        if _is_course_approved(pc, approved_ids, approved_names):
            continue
        if sem > current_sem:
            continue
        if (student_ciclo > 0 and sem < student_ciclo
                and not _attempts_for_course(st, pc)):
            continue
        n += 1
    if n:
        return n, ""
    if not hay_sem_actual:
        return 0, (f"el plan no tiene cursos del semestre {current_sem} "
                   f"(ciclo calculado)")
    return 0, (f"todos los cursos hasta el semestre {current_sem} figuran "
               "aprobados — ¿ciclo/plan correctos?")


matriculados = Enrollment.objects.filter(
    period=PERIODO, status=Enrollment.STATUS_CONFIRMED
).values_list("student_id", flat=True)
matriculados = set(matriculados)

grupos = {"LISTO": [], "MATRICULADO": [], "TRABADO": [],
          "EN REVISIÓN": [], "RECHAZADO": [], "SIN CUENTA": []}

for p in sorted(pagos, key=lambda x: clave_orden(nombre_oficial(x.student))):
    st = p.student
    nombre = nombre_oficial(st)[:38]
    dni = st.num_documento or "—"

    if p.status == EnrollmentPayment.STATUS_REJECTED:
        grupos["RECHAZADO"].append((nombre, dni, p.rejection_note or ""))
        continue
    if p.status == EnrollmentPayment.STATUS_PENDING:
        grupos["EN REVISIÓN"].append((nombre, dni, f"subido {p.created_at:%d/%m}"))
        continue
    # APPROVED:
    if not st.user_id:
        grupos["SIN CUENTA"].append((nombre, dni, "ficha sin usuario"))
        continue
    if st.id in matriculados:
        grupos["MATRICULADO"].append((nombre, dni, ""))
        continue
    n, motivo = _simular_seleccion(st)
    if n:
        grupos["LISTO"].append((nombre, dni, f"vería {n} curso(s)"))
    else:
        grupos["TRABADO"].append((nombre, dni, motivo))

ORDEN = ["TRABADO", "SIN CUENTA", "RECHAZADO", "EN REVISIÓN",
         "LISTO", "MATRICULADO"]
for g in ORDEN:
    filas = grupos[g]
    if not filas:
        continue
    print(f"\n▐ {g} — {len(filas)} alumno(s)")
    for nombre, dni, extra in filas:
        print(f"   {nombre:<40} DNI {dni:<10} {extra}")

print("\n" + "=" * 94)
print("RESUMEN: " + " · ".join(f"{g}: {len(grupos[g])}" for g in ORDEN
                               if grupos[g]))
print("=" * 94)
print("""
Lecturas:
  · LISTO        → si igual dicen que no ven cursos, el problema es de
                   pantalla/período: revisar que el frontend esté
                   redesplegado (npm run build) y el período activo.
  · TRABADO      → problema de datos (plan/ciclo); el motivo dice cuál.
                   Detalle fino: DNI=xxx PERIODO=%s python manage.py shell < diagnostico_matricula.py
  · EN REVISIÓN  → le falta la aprobación de Finanzas, no es error.
  · SIN CUENTA   → crear el usuario desde el Padrón (botón de credenciales).
""" % PERIODO)
