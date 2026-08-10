"""
¿Hay notas registradas y procesadas en 2026-I? — solo lectura, no escribe nada.

Resuelve la única duda del documento de correcciones que no se puede contestar
leyendo código: si el error "No hay alumnos con notas procesadas en 2026-I"
es un bug o el comportamiento correcto.

Hay DOS almacenes de notas y un puente entre ellos:
    SectionGrades       → el acta que llena el docente (por sección)
    AcademicGradeRecord → el kárdex, que alimenta boletas/fichas/méritos
    puente              → "Procesar calificaciones"

Si hay actas pero no hay kárdex, el mensaje es CORRECTO: falta procesar.

Uso:
    python manage.py shell < check_notas_2026I.py
"""
from academic.models import SectionGrades, AcademicGradeRecord, Section

PERIODOS = ["2026-I", "2026-II", "2025-II"]

print("=" * 78)
print(f"{'PERÍODO':<10} {'SECCIONES':>10} {'ACTAS':>10} {'ACTAS c/NOTA':>14} {'KÁRDEX':>10}")
print("=" * 78)

for period in PERIODOS:
    secs = Section.objects.filter(period=period)
    sgs = list(SectionGrades.objects.filter(section__period=period)
               .only("id", "grades"))
    con_nota = sum(1 for sg in sgs if (sg.grades or {}))
    kardex = AcademicGradeRecord.objects.filter(term=period).count()
    print(f"{period:<10} {secs.count():>10} {len(sgs):>10} {con_nota:>14} {kardex:>10}")

print("=" * 78)

p = "2026-I"
actas = sum(1 for sg in SectionGrades.objects.filter(section__period=p)
            .only("grades") if (sg.grades or {}))
kardex = AcademicGradeRecord.objects.filter(term=p).count()

print(f"\nDIAGNÓSTICO PARA {p}")
print("-" * 78)
if kardex:
    print(f"  Hay {kardex} registros de kárdex. Si aun así la Boleta de")
    print("  Información dice 'no hay notas procesadas', ESO SÍ ES UN BUG.")
elif actas:
    print(f"  Hay {actas} actas con notas, pero 0 registros de kárdex.")
    print("  → El mensaje es CORRECTO: falta correr 'Procesar calificaciones'.")
    print("    No hay nada que arreglar en la Boleta; hay que procesar el período.")
else:
    print("  No hay ni actas con notas ni kárdex en el período.")
    print("  → Los docentes todavía no registraron. El mensaje es correcto.")
print("-" * 78)
