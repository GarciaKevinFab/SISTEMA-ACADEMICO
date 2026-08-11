"""
Detecta (y opcionalmente borra) AcademicPeriod FANTASMA — períodos futuros
creados por accidente.

`_period_obj(auto_create=True)` crea un AcademicPeriod con cualquier código
que llegue por querystring; bastó que alguien pidiera "2027-II" para que
existiera, y el viejo default del sistema ("el código más alto") lo convertía
en el período por defecto de pagos, padrón y matrícula.

SOLO LECTURA por defecto. Borra únicamente fantasmas SIN datos colgando:
    APLICAR=1 python manage.py shell < limpiar_periodos_fantasma.py
"""
import os
from datetime import date

from academic.models import (AcademicPeriod, Enrollment, Section,
                             AcademicGradeRecord, EnrollmentPayment)

APLICAR = os.environ.get("APLICAR", "").strip() in ("1", "true", "si")

hoy = date.today()
estimado = f"{hoy.year}-{'I' if hoy.month < 8 else 'II'}"
print(f"Período del calendario: {estimado}")
print("=" * 78)

fantasmas = []
for p in AcademicPeriod.objects.order_by("code"):
    code = (p.code or "").strip()
    futuro = code > estimado
    n_enr = Enrollment.objects.filter(period=code).count()
    n_sec = Section.objects.filter(period=code).count()
    n_rec = AcademicGradeRecord.objects.filter(term=code).count()
    n_pay = EnrollmentPayment.objects.filter(period=code).count()
    marca = ""
    if futuro:
        marca = "  ← FUTURO (fantasma?)" if not (n_enr or n_sec or n_rec or n_pay) \
                else "  ← FUTURO con datos (NO se toca)"
    print(f"  {code:<10} matr={n_enr:<5} secc={n_sec:<4} kárdex={n_rec:<6} "
          f"pagos={n_pay:<4}{marca}")
    if futuro and not (n_enr or n_sec or n_rec or n_pay):
        fantasmas.append(p)

print("=" * 78)
if not fantasmas:
    print("Sin fantasmas que borrar.")
elif not APLICAR:
    print(f"{len(fantasmas)} fantasma(s) borrable(s): "
          + ", ".join(p.code for p in fantasmas))
    print("Vista previa — nada se borró. Para aplicar:")
    print("    APLICAR=1 python manage.py shell < limpiar_periodos_fantasma.py")
else:
    for p in fantasmas:
        print(f"  Borrando AcademicPeriod {p.code} (id={p.id})…")
        p.delete()
    print(f"✓ {len(fantasmas)} período(s) fantasma eliminados.")
