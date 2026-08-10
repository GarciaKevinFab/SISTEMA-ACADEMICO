"""
¿Por qué la Boleta de Información dice "no hay notas procesadas"? — solo lectura.

Reproduce paso a paso el filtro de `EvaluationBoletasZipView` para ver en cuál
de ellos la lista cae a cero. El filtro encadena:

    Student.filter(grade_records__term=period)      ← kárdex
          .filter(plan__career_id=...)              ← OJO: Student.plan es NULL-able
          .filter(ciclo=...)                        ← ciclo ACTUAL del alumno,
                                                      no el del período pedido

Uso:
    python manage.py shell < check_boleta_filtro.py
"""
from students.models import Student
from academic.models import AcademicGradeRecord

PERIOD = "2026-I"

print("=" * 78)
print(f"FILTRO DE LA BOLETA — período {PERIOD}")
print("=" * 78)

base = Student.objects.filter(grade_records__term=PERIOD).distinct()
print(f"  1. Alumnos con kárdex en {PERIOD} ......... {base.count()}")

sin_plan = base.filter(plan__isnull=True).count()
print(f"     de ellos, SIN plan asignado (plan=NULL) . {sin_plan}"
      f"   ← estos desaparecen al filtrar por carrera")

print()
print("  2. Por carrera (filtro `plan__career_id`):")
carreras = {}
for st in base.select_related("plan", "plan__career"):
    nom = (st.plan.career.name if st.plan and st.plan.career else "— SIN PLAN —")
    carreras[nom] = carreras.get(nom, 0) + 1
for nom, n in sorted(carreras.items(), key=lambda x: -x[1]):
    print(f"     {nom:<50} {n:>5}")

print()
print("  3. Por ciclo (filtro `Student.ciclo`, que es el ciclo ACTUAL):")
ciclos = {}
for st in base:
    ciclos[st.ciclo] = ciclos.get(st.ciclo, 0) + 1
for c, n in sorted(ciclos.items(), key=lambda x: (x[0] is None, x[0])):
    print(f"     ciclo {str(c):<6} {n:>5}")

print()
print("  4. Combinación exacta de la captura (EDUCACIÓN INICIAL + Ciclo 2):")
ei = base.filter(plan__career__name__icontains="INICIAL")
print(f"     EDUCACIÓN INICIAL con kárdex ............ {ei.count()}")
print(f"     … y además Student.ciclo = 2 ............ {ei.filter(ciclo=2).count()}"
      f"   ← si es 0, ESTE es el motivo del 404")

print()
print("  5. ¿Cuántos cursaron ciclo 2 en el período, según el kárdex?")
recs = (AcademicGradeRecord.objects
        .filter(term=PERIOD, plan_course__semester=2)
        .values_list("student_id", flat=True).distinct())
print(f"     Alumnos con cursos de ciclo 2 en {PERIOD} . {len(set(recs))}")
print("     (si este número es > 0 pero el punto 4 da 0, el filtro está")
print("      usando el ciclo actual del alumno en vez del ciclo que cursó)")
print("=" * 78)
