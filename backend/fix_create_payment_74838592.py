"""
Crear pago pendiente para postulante DNI 74838592
que se registró pero no completó el paso de pago.
"""
from decimal import Decimal
from admission.models import Applicant, Application, Payment

dni = "74838592"

applicant = Applicant.objects.filter(dni=dni).first()
if not applicant:
    print(f"❌ No se encontró postulante con DNI {dni}")
    exit()

print(f"  Postulante: {applicant.names} ({applicant.dni})")

app = Application.objects.filter(applicant=applicant).first()
if not app:
    print(f"❌ No se encontró postulación para {dni}")
    exit()

print(f"  Postulación #{app.id}: {app.career_name} - Estado: {app.status}")

# Verificar si ya tiene pago
existing = Payment.objects.filter(application=app).first()
if existing:
    print(f"  ⚠ Ya tiene pago #{existing.id} - Estado: {existing.status}")
    exit()

# Obtener fee de la convocatoria
fee = 0
try:
    meta = app.call.meta or {}
    fee = float(meta.get("application_fee") or 0)
except Exception:
    pass

if fee == 0:
    fee = 180  # Default

print(f"  Monto: S/.{fee}")

# Crear pago pendiente
payment = Payment.objects.create(
    application=app,
    method="CASHIER",
    status="PENDING_REVIEW",
    amount=Decimal(str(fee)),
    channel="AGENCIA_BN",
    meta={"created_by_admin_script": True},
)

# Actualizar estado de postulación si está en CREATED
if app.status in ("CREATED", "REGISTERED"):
    app.status = "REGISTERED"
    app.save(update_fields=["status"])

print(f"  ✓ Pago #{payment.id} creado - Estado: PENDING_REVIEW")
print(f"  Ahora aparecerá en Finanzas > Pagos Admisión para aprobar")
