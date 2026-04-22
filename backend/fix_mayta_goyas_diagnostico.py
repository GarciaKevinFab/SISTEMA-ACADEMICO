"""
Diagnóstico y fix de MAYTA GOYAS MARCIA (DNI 60317830).
Debe estar en ciclo II — sus cursos salen del III porque su
matrícula (Enrollment) está en secciones del ciclo III.

PASO 1: Ejecutar tal cual → SOLO DIAGNOSTICA (no borra nada).
        Muestra Student, Enrollments y a qué ciclo pertenecen
        las secciones matriculadas.

PASO 2: Si ves que las secciones son del ciclo III, descomenta
        la sección "BORRAR MATRÍCULA" al final y vuelve a correr.
        Eso borra la matrícula incorrecta. Luego el estudiante
        puede matricularse de nuevo (o el admin lo matricula) en
        las secciones correctas del ciclo II.

Uso:
    python manage.py shell < fix_mayta_goyas_diagnostico.py
"""
import os
import sys

try:
    import django
    if not django.apps.apps.ready:
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
        django.setup()
except Exception:
    pass

from students.models import Student
from academic.models import Enrollment, EnrollmentItem, PlanCourse, Section

DNI = "60317830"

print("=" * 70)
print(f"DIAGNÓSTICO DE ESTUDIANTE DNI {DNI}")
print("=" * 70)

st = Student.objects.filter(num_documento=DNI).first()
if not st:
    print(f"\n[ERROR] No existe estudiante con DNI {DNI}")
    sys.exit(1)

print(f"\n─── STUDENT ───")
print(f"  ID:               {st.id}")
print(f"  Nombre:           {st.apellido_paterno} {st.apellido_materno}, {st.nombres}")
print(f"  Carrera:          {st.programa_carrera}")
print(f"  Ciclo (campo):    {st.ciclo}")
print(f"  Periodo:          {st.periodo}")
print(f"  Plan:             {st.plan_id} ({st.plan.name if st.plan else '—'})")
print(f"  User:             {st.user_id} ({st.user.username if st.user else '—'})")

print(f"\n─── ENROLLMENTS (matrículas) ───")
enrs = Enrollment.objects.filter(student=st).select_related("period").order_by("-id")
if not enrs:
    print("  [sin matrículas]")
else:
    for enr in enrs:
        period_code = getattr(enr.period, "code", None) or getattr(enr.period, "name", None) or f"Period#{enr.period_id}"
        print(f"\n  Enrollment #{enr.id} — Periodo: {period_code}")
        items = EnrollmentItem.objects.filter(enrollment=enr).select_related("section__plan_course__course")
        if not items:
            print(f"    [sin items]")
            continue
        for it in items:
            sec = it.section
            pc = getattr(sec, "plan_course", None)
            course_name = ""
            ciclo_sec = None
            if pc:
                course = getattr(pc, "course", None)
                course_name = getattr(course, "name", "") or getattr(course, "nombre", "") if course else ""
                # PlanCourse suele tener semester/ciclo/cycle/semestre
                for attr in ("semester", "ciclo", "cycle", "semestre"):
                    v = getattr(pc, attr, None)
                    if v is not None:
                        ciclo_sec = v
                        break
            print(f"    - Section#{sec.id} | Ciclo: {ciclo_sec} | Curso: {course_name[:60]}")

print()
print("=" * 70)
print("ANÁLISIS:")
print("=" * 70)
print("""
Si las secciones matriculadas son del ciclo 3 (III), la matrícula está
mal y hay que borrarla. Una vez borrada, el estudiante puede matricularse
de nuevo en las secciones del ciclo 2 (II) desde la interfaz.

Para BORRAR las matrículas actuales, descomenta las líneas al final de
este script y vuelve a ejecutarlo.
""")

# ═══════════════════════════════════════════════════════════════════
# BORRAR MATRÍCULA — Descomenta para eliminar las matrículas actuales
# ═══════════════════════════════════════════════════════════════════
# print("\n─── BORRANDO MATRÍCULAS ───")
# deleted_items = EnrollmentItem.objects.filter(enrollment__student=st).delete()[0]
# deleted_enrs = Enrollment.objects.filter(student=st).delete()[0]
# print(f"  EnrollmentItems borrados: {deleted_items}")
# print(f"  Enrollments borrados:    {deleted_enrs}")
#
# # También asegurar que el ciclo del Student esté en 2
# if st.ciclo != 2:
#     st.ciclo = 2
#     st.save(update_fields=["ciclo"])
#     print(f"  Student.ciclo actualizado a 2")
# print("  ✓ Listo. El estudiante ahora puede matricularse en el ciclo II.")
