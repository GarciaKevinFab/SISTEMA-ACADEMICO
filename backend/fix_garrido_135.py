"""Corregir monto de GARRIDO VALDEZ (DNI 75177236) de 180 → 135 (primer puesto)."""
from decimal import Decimal
from students.models import Student
from academic.models import EnrollmentPayment
from finance.models import IncomeEntry, StudentAccountPayment

dni = "75177236"
OLD, NEW = Decimal("180.00"), Decimal("135.00")

st = Student.objects.filter(num_documento=dni).first()
if not st:
    print(f"❌ No se encontró estudiante con DNI {dni}")
    exit()

print(f"Estudiante: {st.apellido_paterno} {st.apellido_materno} {st.nombres}")

fixed = 0

for ep in EnrollmentPayment.objects.filter(student=st, amount=OLD):
    ep.amount = NEW
    ep.save(update_fields=["amount"])
    print(f"  ✓ EnrollmentPayment #{ep.id}: {OLD} → {NEW}")
    fixed += 1

for ie in IncomeEntry.objects.filter(subject_id=dni, amount=OLD):
    ie.amount = NEW
    ie.save(update_fields=["amount"])
    print(f"  ✓ IncomeEntry #{ie.id}: {OLD} → {NEW}")
    fixed += 1

for sap in StudentAccountPayment.objects.filter(student=st, amount=OLD):
    sap.amount = NEW
    sap.save(update_fields=["amount"])
    print(f"  ✓ StudentAccountPayment #{sap.id}: {OLD} → {NEW}")
    fixed += 1

if fixed:
    print(f"\n✓ {fixed} registros corregidos. Diferencia: S/.{OLD - NEW}")
else:
    print("\n⚠ No se encontraron registros con monto 180 para corregir")
