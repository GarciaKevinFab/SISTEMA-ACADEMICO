"""
Vistas para Pagos de Admisión (Admin)

Flujo:
  1. Postulante se inscribe → se crea Payment con status=STARTED
  2. Admin ve la lista de pagos en PaymentsManagement
  3. Admin verifica el pago → payment_confirm:
     a. Cambia status a PAID
     b. Cambia Application.status a ADMITTED
     c. Crea User con username=DNI y password temporal
     d. Vincula User al Applicant
     e. Retorna credenciales { username, password }
  4. Postulante consulta resultado público y ve sus credenciales
"""
import secrets
import string
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from admission.models import Payment, Application, Applicant
from admission.serializers import PaymentSerializer
from .utils import _ensure_media_tmp, _write_stub_pdf

User = get_user_model()


def _load_admission_params():
    """Lee configuración global de admisión (singleton AdmissionParam pk=1)."""
    defaults = {
        "auto_generate_credentials": True,
        "credential_password_length": 8,
    }
    try:
        from admission.models import AdmissionParam
        obj = AdmissionParam.objects.filter(pk=1).first()
        if obj and obj.data:
            return {**defaults, **obj.data}
    except Exception:
        pass
    return defaults


def _generate_password(length=8):
    """Genera contraseña alfanumérica segura"""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _payment_to_dict(payment):
    """Serializa un Payment con datos enriquecidos del postulante"""
    app = payment.application
    applicant = app.applicant if app else None

    data = {
        "id": payment.id,
        "application_id": app.id if app else None,
        "method": payment.method,
        "status": payment.status,
        "amount": float(payment.amount),
        "created_at": payment.created_at.isoformat() if payment.created_at else None,
        "order_id": (payment.meta or {}).get("order_id"),
        "applicant_name": applicant.names if applicant else "—",
        "applicant_dni": applicant.dni if applicant else "—",
        "career_name": app.career_name if app else "—",
        "credentials_generated": False,
        "username": None,
    }

    # Verificar si ya tiene usuario creado
    if applicant and applicant.user:
        data["credentials_generated"] = True
        data["username"] = applicant.user.username

    return data


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def payments_list(request):
    """
    Lista pagos con datos enriquecidos del postulante.
    Filtros: call_id, career_id
    """
    call_id = request.query_params.get("call_id")
    career_id = request.query_params.get("career_id")

    qs = (
        Payment.objects.all()
        .select_related("application", "application__applicant", "application__applicant__user")
        .order_by("-created_at")
    )

    if call_id:
        qs = qs.filter(application__call_id=call_id)

    if career_id:
        qs = qs.filter(
            application__preferences__career_id=career_id
        ).distinct()

    payments = [_payment_to_dict(p) for p in qs]
    return Response({"payments": payments})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def payment_confirm(request, payment_id):
    """
    Verificar pago + generar credenciales de acceso.

    1. Marca el pago como PAID
    2. Marca la postulación como ADMITTED
    3. Crea un User (username=DNI, password=aleatorio)
    4. Vincula el User al Applicant
    5. Retorna las credenciales generadas

    Si el Applicant ya tiene un User, no crea otro — retorna el existente.
    """
    try:
        payment = Payment.objects.select_related(
            "application",
            "application__applicant",
            "application__applicant__user",
        ).get(pk=payment_id)
    except Payment.DoesNotExist:
        return Response({"detail": "Pago no encontrado"}, status=404)

    if payment.status == "PAID":
        # Ya está pagado — retornar info sin cambiar nada
        applicant = payment.application.applicant
        creds = None
        if applicant and applicant.user:
            creds = {
                "username": applicant.user.username,
                "password": "(ya generada previamente)",
                "already_existed": True,
            }
        return Response({
            "ok": True,
            "status": "PAID",
            "credentials": creds,
        })

    with transaction.atomic():
        # 1. Confirmar pago
        payment.status = "PAID"
        meta = payment.meta or {}
        meta["confirmed_by"] = request.user.id
        meta["confirmed_at"] = __import__("django").utils.timezone.now().isoformat()
        payment.meta = meta
        payment.save(update_fields=["status", "meta"])

        # 2. Marcar postulación como ADMITTED
        app = payment.application
        if app and app.status not in ("ADMITTED",):
            app.status = "ADMITTED"
            app.save(update_fields=["status"])

        # 3. Crear usuario si no existe
        applicant = app.applicant if app else None
        credentials = None

        if applicant:
            if applicant.user:
                # Ya tiene usuario — no crear otro
                credentials = {
                    "username": applicant.user.username,
                    "password": "(ya generada previamente)",
                    "already_existed": True,
                }
            else:
                # Leer configuración de credenciales desde params
                _params = _load_admission_params()
                auto_gen = _params.get("auto_generate_credentials", True)
                pwd_len = _params.get("credential_password_length", 8)

                if not auto_gen:
                    credentials = None
                else:
                    # Generar credenciales nuevas
                    dni = applicant.dni.strip()
                    password = _generate_password(max(6, min(16, pwd_len)))

                    # Username = DNI. Si ya existe un user con ese username, agregar sufijo
                    username = dni
                    if User.objects.filter(username=username).exists():
                        username = f"{dni}_{applicant.id}"

                    # Crear el usuario
                    user = User.objects.create_user(
                        username=username,
                        password=password,
                        email=applicant.email or "",
                        first_name=applicant.names or "",
                        is_active=True,
                    )

                    # Vincular al applicant
                    applicant.user = user
                    applicant.save(update_fields=["user"])

                    # Guardar password en meta del payment (para poder consultarla después)
                    meta["generated_username"] = username
                    meta["generated_password"] = password
                    payment.meta = meta
                    payment.save(update_fields=["meta"])

                    credentials = {
                        "username": username,
                        "password": password,
                        "already_existed": False,
                        "user_id": user.id,
                    }

    return Response({
        "ok": True,
        "status": "PAID",
        "credentials": credentials,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def payment_void(request, payment_id):
    """
    Anular pago.
    Desactiva el usuario generado (si existe) pero no lo elimina.
    """
    try:
        payment = Payment.objects.select_related(
            "application",
            "application__applicant",
            "application__applicant__user",
        ).get(pk=payment_id)
    except Payment.DoesNotExist:
        return Response({"detail": "Pago no encontrado"}, status=404)

    with transaction.atomic():
        payment.status = "VOIDED"
        meta = payment.meta or {}
        meta["voided_by"] = request.user.id
        meta["voided_at"] = __import__("django").utils.timezone.now().isoformat()
        payment.meta = meta
        payment.save(update_fields=["status", "meta"])

        # Revertir estado de postulación
        app = payment.application
        if app and app.status == "ADMITTED":
            app.status = "EVALUATED"
            app.save(update_fields=["status"])

        # Desactivar usuario (no eliminar, por auditoría)
        applicant = app.applicant if app else None
        if applicant and applicant.user:
            applicant.user.is_active = False
            applicant.user.save(update_fields=["is_active"])

    return Response({"ok": True, "status": "VOIDED"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def payment_receipt_pdf(request, payment_id):
    """Genera recibo de pago en PDF"""
    try:
        payment = Payment.objects.select_related(
            "application", "application__applicant"
        ).get(pk=payment_id)
    except Payment.DoesNotExist:
        return Response({"detail": "Pago no encontrado"}, status=404)

    applicant = payment.application.applicant if payment.application else None
    name = applicant.names if applicant else "—"
    dni = applicant.dni if applicant else "—"

    tmpdir = _ensure_media_tmp()
    filename = f"recibo_pago_{payment_id}.pdf"
    abs_path = f"{tmpdir}/{filename}"

    _write_stub_pdf(
        abs_path,
        title=f"Recibo de Pago — Admisión",
        subtitle=f"Postulante: {name} | DNI: {dni} | Monto: S/. {float(payment.amount):.2f} | Estado: {payment.status}",
    )

    with open(abs_path, "rb") as f:
        data = f.read()

    resp = HttpResponse(data, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp


# ═══════════════════════════════════════════════════════
# ENDPOINTS DEL POSTULANTE (requieren auth del postulante)
# ═══════════════════════════════════════════════════════


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def application_payment_start(request, application_id):
    """
    Iniciar pago para una postulación.
    Crea (o retorna) el registro Payment asociado.
    """
    try:
        app = Application.objects.select_related("applicant").get(pk=application_id)
    except Application.DoesNotExist:
        return Response({"detail": "Postulación no encontrada"}, status=404)

    method = (request.data or {}).get("method", "CASHIER")

    # Buscar pago existente
    existing = Payment.objects.filter(application=app).first()
    if existing:
        return Response({
            "id": existing.id,
            "status": existing.status,
            "method": existing.method,
            "amount": float(existing.amount),
        })

    # Obtener monto del fee de la convocatoria
    fee = 0
    try:
        meta = app.call.meta or {}
        fee = float(meta.get("application_fee") or 0)
    except Exception:
        pass

    payment = Payment.objects.create(
        application=app,
        method=method,
        status="STARTED",
        amount=fee,
        meta={"started_by": request.user.id},
    )

    return Response({
        "id": payment.id,
        "status": payment.status,
        "method": payment.method,
        "amount": float(payment.amount),
    }, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def application_payment_status(request, application_id):
    """Consultar estado de pago de una postulación"""
    payment = Payment.objects.filter(application_id=application_id).first()
    if not payment:
        return Response({"status": "NOT_STARTED", "amount": 0})

    return Response({
        "id": payment.id,
        "status": payment.status,
        "method": payment.method,
        "amount": float(payment.amount),
    })