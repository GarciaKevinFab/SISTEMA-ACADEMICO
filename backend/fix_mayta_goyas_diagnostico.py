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
from academic.models import Enrollment, EnrollmentItem, PlanCourse, Section, AcademicGradeRecord

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
enrs = Enrollment.objects.filter(student=st).order_by("-id")
if not enrs:
    print("  [sin matrículas]")
else:
    for enr in enrs:
        # period puede ser FK o CharField dependiendo del modelo
        p = getattr(enr, "period", None)
        if hasattr(p, "code"):
            period_code = p.code
        elif hasattr(p, "name"):
            period_code = p.name
        else:
            period_code = str(p) if p else f"Enrollment#{enr.id}"
        print(f"\n  Enrollment #{enr.id} — Periodo: {period_code} — Status: {getattr(enr, 'status', '—')}")
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

print(f"\n─── ACADEMIC GRADE RECORDS (historial de notas) ───")
print("Si hay registros del ciclo 2 APROBADOS (>=11), el sistema calcula")
print("que la alumna está en ciclo 3 (el siguiente). Esto puede ser el bug.")
print()
grs = AcademicGradeRecord.objects.filter(student=st).select_related("plan_course__course").order_by("term")
if not grs:
    print("  [sin registros — no es este el problema]")
else:
    print(f"  {'Term':<15} {'Sem':>3} {'Nota':>6} {'Curso':<50}")
    print(f"  {'-'*15:<15} {'-'*3:>3} {'-'*6:>6} {'-'*50:<50}")
    for gr in grs:
        pc = gr.plan_course
        course_name = ""
        sem = ""
        if pc:
            c = getattr(pc, "course", None)
            course_name = getattr(c, "name", "") or getattr(c, "nombre", "") if c else ""
            sem = getattr(pc, "semester", "") or getattr(pc, "ciclo", "") or ""
        grade = gr.final_grade if gr.final_grade is not None else "—"
        aprobado = " ✓" if (gr.final_grade is not None and float(gr.final_grade) >= 11) else ""
        print(f"  {gr.term or '—':<15} {str(sem):>3} {str(grade):>6}{aprobado} {course_name[:50]}")

print()
print("=" * 70)
print("ANÁLISIS:")
print("=" * 70)
print("""
La alumna NO tiene matrículas. El ciclo que ve en sus cursos se calcula
así (academic/views/enrollment.py:_current_semester):
  ciclo_actual = max(student.ciclo, max_semestre_aprobado + 1)

Si tiene AcademicGradeRecord con notas >=11 del ciclo 2, el sistema cree
que ya aprobó el ciclo 2 y le toca el 3. Revisa la tabla de arriba.

Si es así, los registros del ciclo 2 deben borrarse (no debería haber
tenido notas previas ya que es una ingresante nueva del 2026-I).
""")

# ═══════════════════════════════════════════════════════════════════
# BORRAR MATRÍCULA — Descomenta para eliminar las matrículas actuales
# ═══════════════════════════════════════════════════════════════════
# print("\n─── BORRANDO MATRÍCULAS ───")
# deleted_items = EnrollmentItem.objects.filter(enrollment__student=st).delete()[0]
# deleted_enrs = Enrollment.objects.filter(student=st).delete()[0]
# print(f"  EnrollmentItems borrados: {deleted_items}")
# print(f"  Enrollments borrados:    {deleted_enrs}")

# ═══════════════════════════════════════════════════════════════════
# BORRAR NOTAS PREVIAS — Descomenta para limpiar AcademicGradeRecord
# Si la alumna es ingresante nueva y tiene registros de notas, esos
# están mal y deben borrarse para que el sistema no la "adelante" al
# ciclo siguiente.
# ═══════════════════════════════════════════════════════════════════
# print("\n─── BORRANDO ACADEMIC GRADE RECORDS ───")
# deleted_grs = AcademicGradeRecord.objects.filter(student=st).delete()[0]
# print(f"  AcademicGradeRecords borrados: {deleted_grs}")
#
# # Asegurar ciclo=2
# if st.ciclo != 2:
#     st.ciclo = 2
#     st.save(update_fields=["ciclo"])
#     print(f"  Student.ciclo actualizado a 2")
# print("  ✓ Listo. El sistema ahora debería mostrar cursos del ciclo II.")
