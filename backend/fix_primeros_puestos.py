"""
Script para corregir montos de primeros puestos.
Estos 7 alumnos pagaron S/.135 pero el sistema registró S/.180.
Diferencia: S/.45 por alumno.

Ejecutar en el servidor:
  cd /var/www/sistema-academico/backend
  python manage.py shell < fix_primeros_puestos.py
"""
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from decimal import Decimal
from academic.models import EnrollmentPayment
from finance.models import IncomeEntry, CashMovement
from students.models import Student

# DNIs de primeros puestos que pagaron S/.135
PRIMEROS_PUESTOS_DNIS = [
    "72036143",  # ESPINOZA SANTISTEBAN JHOSTYN ANDERSON
    "75754932",  # MATAMOROS MACHAGA ANTONY ALEXANDER
    "73976013",  # HUAMAN CASABONA FERNANDO RAFAEL
    "70826237",  # PERALTA GONZALES JORGE RAFAEL
    "76037981",  # PAREDES JULCARIMA MARIA ISABEL
    "48093627",  # CORONEL PORRAS SHIRLEY LIZETH
    "72299994",  # LOVATON RAMOS IDA MARTHA
]

MONTO_INCORRECTO = Decimal("180.00")
MONTO_CORRECTO = Decimal("135.00")
DIFERENCIA = MONTO_INCORRECTO - MONTO_CORRECTO  # 45.00

print("=" * 60)
print("CORRECCIÓN DE MONTOS - PRIMEROS PUESTOS")
print("=" * 60)

total_corregidos = 0

for dni in PRIMEROS_PUESTOS_DNIS:
    print(f"\n--- Procesando DNI: {dni} ---")

    # 1. Buscar estudiante
    try:
        st = Student.objects.get(num_documento=dni)
        print(f"  Estudiante: {st.apellido_paterno} {st.apellido_materno} {st.nombres}")
    except Student.DoesNotExist:
        print(f"  ⚠ Estudiante no encontrado con DNI {dni}")
        continue

    # 2. Corregir EnrollmentPayment
    ep = EnrollmentPayment.objects.filter(student=st, period="2026-I").first()
    if ep:
        if ep.amount == MONTO_INCORRECTO:
            ep.amount = MONTO_CORRECTO
            ep.discount_tag = "PRIMER_PUESTO"
            ep.save(update_fields=["amount", "discount_tag", "updated_at"])
            print(f"  ✓ EnrollmentPayment #{ep.id}: {MONTO_INCORRECTO} → {MONTO_CORRECTO}")
        elif ep.amount == MONTO_CORRECTO:
            print(f"  - EnrollmentPayment ya tiene monto correcto ({MONTO_CORRECTO})")
        else:
            print(f"  ⚠ EnrollmentPayment tiene monto inesperado: {ep.amount}")
            continue
    else:
        print(f"  ⚠ No tiene EnrollmentPayment para 2026-I")
        continue

    # 3. Corregir IncomeEntry (ingreso registrado)
    entries = IncomeEntry.objects.filter(
        subject_id=dni,
        amount=MONTO_INCORRECTO,
    )
    for entry in entries:
        entry.amount = MONTO_CORRECTO
        entry.save(update_fields=["amount", "updated_at"])
        print(f"  ✓ IncomeEntry #{entry.id}: {MONTO_INCORRECTO} → {MONTO_CORRECTO}")

    if not entries.exists():
        # Intentar buscar con subject_id = student.id
        entries2 = IncomeEntry.objects.filter(
            subject_id=str(st.id),
            amount=MONTO_INCORRECTO,
        )
        for entry in entries2:
            entry.amount = MONTO_CORRECTO
            entry.save(update_fields=["amount", "updated_at"])
            print(f"  ✓ IncomeEntry #{entry.id} (by student_id): {MONTO_INCORRECTO} → {MONTO_CORRECTO}")

    # 4. Corregir CashMovement (movimiento de caja)
    nombre = f"{st.apellido_paterno} {st.apellido_materno} {st.nombres}".strip()
    movs = CashMovement.objects.filter(
        type="IN",
        amount=MONTO_INCORRECTO,
        concept__icontains=dni,
    )
    for mov in movs:
        mov.amount = MONTO_CORRECTO
        mov.save(update_fields=["amount"])
        print(f"  ✓ CashMovement #{mov.id}: {MONTO_INCORRECTO} → {MONTO_CORRECTO}")

    if not movs.exists():
        # Buscar por nombre del estudiante
        movs2 = CashMovement.objects.filter(
            type="IN",
            amount=MONTO_INCORRECTO,
            concept__icontains=st.apellido_paterno,
        )
        for mov in movs2:
            mov.amount = MONTO_CORRECTO
            mov.save(update_fields=["amount"])
            print(f"  ✓ CashMovement #{mov.id} (by name): {MONTO_INCORRECTO} → {MONTO_CORRECTO}")

    # 5. Corregir StudentAccountCharge y StudentAccountPayment
    try:
        from finance.models import StudentAccountCharge, StudentAccountPayment

        charges = StudentAccountCharge.objects.filter(
            subject_id=dni,
            amount=MONTO_INCORRECTO,
        )
        for ch in charges:
            ch.amount = MONTO_CORRECTO
            ch.save(update_fields=["amount", "updated_at"])
            print(f"  ✓ StudentAccountCharge #{ch.id}: {MONTO_INCORRECTO} → {MONTO_CORRECTO}")

        payments = StudentAccountPayment.objects.filter(
            subject_id=dni,
            amount=MONTO_INCORRECTO,
        )
        for pay in payments:
            pay.amount = MONTO_CORRECTO
            pay.save(update_fields=["amount", "updated_at"])
            print(f"  ✓ StudentAccountPayment #{pay.id}: {MONTO_INCORRECTO} → {MONTO_CORRECTO}")
    except Exception as e:
        print(f"  ⚠ Error con StudentAccount: {e}")

    total_corregidos += 1

print(f"\n{'=' * 60}")
print(f"RESUMEN: {total_corregidos}/{len(PRIMEROS_PUESTOS_DNIS)} alumnos corregidos")
print(f"Ahorro total registrado: S/.{DIFERENCIA * total_corregidos}")
print(f"{'=' * 60}")
