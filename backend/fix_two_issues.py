"""
Fix 1: Crear pago para postulante DNI 61974155
Fix 2: Corregir DNI 72097058 → 72097858
"""
from decimal import Decimal

# ═══════════════════════════════════════════
# FIX 1: Crear pago para postulante 61974155
# ═══════════════════════════════════════════
print("=" * 60)
print("FIX 1: Crear pago para postulante 61974155")
print("=" * 60)

from admission.models import Applicant, Application, Payment

dni1 = "61974155"
applicant = Applicant.objects.filter(dni=dni1).first()
if not applicant:
    print(f"  ❌ No se encontró postulante con DNI {dni1}")
else:
    print(f"  Postulante: {applicant.names} ({applicant.dni})")
    app = Application.objects.filter(applicant=applicant).order_by("-id").first()
    if not app:
        print(f"  ❌ No tiene postulación")
    else:
        print(f"  Postulación #{app.id}: {app.career_name} - Estado: {app.status}")
        existing = Payment.objects.filter(application=app).first()
        if existing:
            print(f"  ⚠ Ya tiene pago #{existing.id} - Estado: {existing.status}")
        else:
            fee = 0
            try:
                meta = app.call.meta or {}
                fee = float(meta.get("application_fee") or 0)
            except Exception:
                pass
            if fee == 0:
                fee = 180
            payment = Payment.objects.create(
                application=app,
                method="CASHIER",
                status="PENDING_REVIEW",
                amount=Decimal(str(fee)),
                channel="AGENCIA_BN",
                meta={"created_by_admin_script": True},
            )
            if app.status in ("CREATED", "REGISTERED"):
                app.status = "REGISTERED"
                app.save(update_fields=["status"])
            print(f"  ✓ Pago #{payment.id} creado - S/.{fee} - PENDING_REVIEW")

# ═══════════════════════════════════════════
# FIX 2: Corregir DNI 72097058 → 72097858
# ═══════════════════════════════════════════
print()
print("=" * 60)
print("FIX 2: Corregir DNI 72097058 → 72097858")
print("=" * 60)

from students.models import Student

old_dni = "72097058"
new_dni = "72097858"

st = Student.objects.filter(num_documento=old_dni).first()
if not st:
    print(f"  ❌ No se encontró estudiante con DNI {old_dni}")
    # Verificar si ya tiene el nuevo
    st2 = Student.objects.filter(num_documento=new_dni).first()
    if st2:
        print(f"  ℹ Ya existe estudiante con DNI {new_dni}: {st2.nombres} {st2.apellido_paterno}")
else:
    print(f"  Estudiante: {st.nombres} {st.apellido_paterno} {st.apellido_materno}")
    print(f"  DNI actual: {st.num_documento}")

    # Verificar que el nuevo DNI no esté en uso
    conflict = Student.objects.filter(num_documento=new_dni).exclude(pk=st.pk).first()
    if conflict:
        print(f"  ❌ El DNI {new_dni} ya está en uso por: {conflict.nombres} {conflict.apellido_paterno}")
    else:
        st.num_documento = new_dni
        st.save(update_fields=["num_documento", "updated_at"])
        print(f"  ✓ DNI actualizado: {old_dni} → {new_dni}")

        # También actualizar el username del User si es el DNI
        if st.user and st.user.username == old_dni:
            st.user.username = new_dni
            st.user.save(update_fields=["username"])
            print(f"  ✓ Username actualizado: {old_dni} → {new_dni}")

print()
print("=" * 60)
print("LISTO")
print("=" * 60)
