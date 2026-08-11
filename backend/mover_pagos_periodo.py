"""
Mueve pagos de matrícula (EnrollmentPayment) de un período a otro.

Para rescatar vouchers que quedaron registrados en un período equivocado —
p. ej. el pago varado en 2027-I cuando el alumno pagaba 2026-II (el default
del sistema apuntaba a un período fantasma).

SOLO LECTURA por defecto:
    DE=2027-I A=2026-II python manage.py shell < mover_pagos_periodo.py
Aplicar:
    DE=2027-I A=2026-II APLICAR=1 python manage.py shell < mover_pagos_periodo.py

No pisa nada: si el alumno YA tiene un pago en el período destino, ese
voucher se reporta y se deja donde está para revisarlo a mano.
"""
import os

from academic.models import EnrollmentPayment
from students.name_utils import nombre_oficial

DE = (os.environ.get("DE") or "").strip().upper()
A = (os.environ.get("A") or "").strip().upper()
APLICAR = os.environ.get("APLICAR", "").strip() in ("1", "true", "si")

if not DE or not A:
    print("Uso: DE=2027-I A=2026-II [APLICAR=1] python manage.py shell < mover_pagos_periodo.py")
    raise SystemExit

pagos = list(EnrollmentPayment.objects.select_related("student").filter(period=DE))
print("=" * 78)
print(f"PAGOS EN {DE} → {A}   ({'APLICANDO' if APLICAR else 'vista previa'})")
print("=" * 78)
if not pagos:
    print(f"No hay pagos registrados en {DE}.")
    raise SystemExit

movidos = conflictos = 0
for p in pagos:
    st = p.student
    ya = EnrollmentPayment.objects.filter(student=st, period=A).first()
    print(f"\n  Pago id={p.id}  {nombre_oficial(st)}  (DNI {st.num_documento})")
    print(f"    monto=S/{p.amount}  estado={p.status}  canal={p.channel}"
          f"  op={p.operation_code or '—'}  subido={p.created_at:%d/%m/%Y}")
    if ya:
        conflictos += 1
        print(f"    ✗ CONFLICTO: ya tiene un pago en {A} "
              f"(id={ya.id}, estado={ya.status}) — NO se mueve, revisar a mano.")
        continue
    if APLICAR:
        p.period = A
        p.save(update_fields=["period", "updated_at"])
        movidos += 1
        print(f"    ✓ movido a {A}")
    else:
        print(f"    → se movería a {A}")

print("\n" + "=" * 78)
if APLICAR:
    print(f"Movidos: {movidos} · Conflictos sin tocar: {conflictos}")
else:
    print(f"Se moverían {len(pagos) - conflictos} pago(s); "
          f"{conflictos} conflicto(s). Nada se guardó.")
print("=" * 78)
