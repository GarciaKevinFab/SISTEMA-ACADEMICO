# backend/academic/views/enrollment_payment.py
"""
Vistas para el pago de matrícula.
Flujo:
  1. Estudiante consulta estado y monto  → GET  status
  2. Estudiante sube voucher             → POST upload
  3. Estudiante re-sube tras rechazo     → POST re-upload
  4. Finanzas lista pendientes           → GET  pending
  5. Finanzas ve detalle                 → GET  <id>
  6. Finanzas aprueba                    → POST <id>/approve
  7. Finanzas rechaza                    → POST <id>/reject
"""

from decimal import Decimal
from django.db.models import Avg, FloatField, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import permissions

from students.models import Student
from academic.models import (
    EnrollmentPayment, AcademicPeriod, AcademicGradeRecord,
    Enrollment,
)
from academic.serializers_payment import (
    EnrollmentPaymentSerializer,
    EnrollmentPaymentUploadSerializer,
)

try:
    from catalogs.models import InstitutionSetting as _InstitutionSetting
except ImportError:
    _InstitutionSetting = None


def _get_bank_info():
    """Lee datos bancarios de InstitutionSetting para mostrar al estudiante."""
    defaults = {
        "bank_name": "Banco de la Nación",
        "bank_account": "",
        "bank_holder": "",
    }
    if not _InstitutionSetting:
        return defaults
    try:
        obj = _InstitutionSetting.objects.filter(pk=1).first()
        if obj and isinstance(obj.data, dict):
            return {
                "bank_name":    obj.data.get("bank_name") or defaults["bank_name"],
                "bank_account": obj.data.get("bank_account") or defaults["bank_account"],
                "bank_holder":  obj.data.get("bank_holder") or defaults["bank_holder"],
            }
    except Exception:
        pass
    return defaults

# ── Constantes de monto ────────────────────────────────────────
ENROLLMENT_AMOUNT_REGULAR     = Decimal("180.00")
ENROLLMENT_AMOUNT_PRIMER_PUESTO = Decimal("135.00")


# ══════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════

def _student_of(user):
    try:
        return Student.objects.select_related("plan").get(user=user)
    except Student.DoesNotExist:
        return None


def _is_primer_puesto(student):
    """
    Determina si el estudiante es primer puesto en su carrera
    (mérito = 1, es decir, el promedio más alto).
    """
    programa = getattr(student, "programa_carrera", "") or ""
    if not programa:
        return False

    avg = AcademicGradeRecord.objects.filter(student=student).aggregate(
        a=Coalesce(Avg("final_grade"), 0.0, output_field=FloatField())
    )["a"]

    if avg <= 0:
        return False

    better = (
        AcademicGradeRecord.objects
        .filter(student__programa_carrera=programa)
        .values("student")
        .annotate(a=Avg("final_grade"))
        .filter(a__gt=avg)
        .count()
    )
    return better == 0  # nadie tiene mejor promedio → es primer puesto


def _compute_enrollment_amount(student, period_code):
    """
    Calcula el monto de matrícula para un estudiante en un período.
    Retorna (amount, discount_tag, surcharge).
    """
    is_pp = _is_primer_puesto(student)
    amount = ENROLLMENT_AMOUNT_PRIMER_PUESTO if is_pp else ENROLLMENT_AMOUNT_REGULAR
    discount_tag = "PRIMER_PUESTO" if is_pp else ""

    surcharge = Decimal("0.00")
    period_obj = AcademicPeriod.objects.filter(code=period_code).first()
    if period_obj:
        status = period_obj.enrollment_status()
        if status == AcademicPeriod.STATUS_EXTEMPORARY:
            surcharge = period_obj.extemporary_surcharge or Decimal("0.00")

    return amount, discount_tag, surcharge


def _register_income_on_approve(payment, reviewer):
    """
    Al aprobar un pago, registra el ingreso en el módulo de finanzas:
      1. IncomeEntry (reporte de ingresos)
      2. CashMovement IN en la sesión abierta del reviewer (si existe)
      3. StudentAccountPayment (estado de cuenta del alumno)
      4. Marca StudentAccountCharge de matrícula como paid (si existe)
    """
    from finance.models import (
        IncomeEntry, CashSession, CashMovement,
        StudentAccountPayment, StudentAccountCharge, Concept,
    )

    total = payment.total
    student = payment.student
    dni = getattr(student, "num_documento", str(student.id))
    today = timezone.now().date()

    # Buscar concepto MATRICULA
    concept = Concept.objects.filter(type="MATRICULA").first()
    concept_name = concept.name if concept else "Matrícula"

    career_name = getattr(student, "programa_carrera", "") or ""

    # 1. IncomeEntry
    IncomeEntry.objects.create(
        date=today,
        subject_id=dni,
        concept=concept,
        concept_name=f"{concept_name} {payment.period}",
        career_name=career_name,
        amount=total,
    )

    # 2. CashMovement (si el reviewer tiene sesión abierta)
    open_session = CashSession.objects.filter(
        user=reviewer, status="OPEN"
    ).order_by("-opened_at").first()

    if open_session:
        CashMovement.objects.create(
            session=open_session,
            type="IN",
            amount=total,
            concept=f"Pago matrícula {payment.period} - {dni}",
        )

    # 3. StudentAccountPayment
    method_map = {
        "PAGALO": "TRANSFER",
        "CAJERO_MULTIRED": "TRANSFER",
        "AGENCIA_BN": "CASH",
    }
    StudentAccountPayment.objects.create(
        subject_id=dni,
        subject_type="STUDENT",
        amount=total,
        method=method_map.get(payment.channel, "TRANSFER"),
        ref=payment.operation_code or f"VOUCHER-{payment.id}",
        date=today,
        concept=concept,
    )

    # 4. Marcar charge como paid (si existe)
    charges = StudentAccountCharge.objects.filter(
        subject_id=dni,
        subject_type="STUDENT",
        paid=False,
    )
    if concept:
        charges = charges.filter(Q(concept=concept) | Q(concept_name__icontains="matrícula"))
    else:
        charges = charges.filter(concept_name__icontains="matrícula")

    for charge in charges[:1]:  # solo el primero pendiente
        charge.paid = True
        charge.save(update_fields=["paid"])


# ══════════════════════════════════════════════════════════════
#  CHECK HELPER (importado por enrollment.py)
# ══════════════════════════════════════════════════════════════

def check_enrollment_payment(student, period_code):
    """
    Retorna (is_paid: bool, info: dict).
    Usado por enrollment.py para gatear la matrícula.
    """
    try:
        p = EnrollmentPayment.objects.get(student=student, period=period_code)
        return p.status == EnrollmentPayment.STATUS_APPROVED, {
            "status": p.status,
            "rejection_note": p.rejection_note,
            "payment_id": p.id,
        }
    except EnrollmentPayment.DoesNotExist:
        return False, {"status": "NOT_STARTED"}


# ══════════════════════════════════════════════════════════════
#  VISTAS — ESTUDIANTE
# ══════════════════════════════════════════════════════════════

class EnrollmentPaymentStatusView(APIView):
    """
    GET /academic/enrollment-payment/status?period=2026-I
    Retorna el estado del pago de matrícula del estudiante actual.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = _student_of(request.user)
        if not student:
            return Response({"detail": "No se encontró perfil de estudiante."}, status=404)

        period = (request.query_params.get("period") or "").strip()
        if not period:
            return Response({"detail": "Parámetro 'period' requerido."}, status=400)

        amount, discount_tag, surcharge = _compute_enrollment_amount(student, period)
        bank_info = _get_bank_info()

        # Verificar si ya tiene matrícula confirmada
        is_enrolled = Enrollment.objects.filter(
            student=student, period=period, status=Enrollment.STATUS_CONFIRMED,
        ).exists()

        try:
            payment = EnrollmentPayment.objects.get(student=student, period=period)
            data = EnrollmentPaymentSerializer(payment, context={"request": request}).data
            # Recalcular montos (por si cambió el mérito)
            data["computed_amount"] = float(amount)
            data["computed_discount_tag"] = discount_tag
            data["computed_surcharge"] = float(surcharge)
            data["computed_total"] = float(amount + surcharge)
            data["is_enrolled"] = is_enrolled
            data["bank_info"] = bank_info
            return Response(data)
        except EnrollmentPayment.DoesNotExist:
            return Response({
                "status": "NOT_STARTED",
                "amount": float(amount),
                "discount_tag": discount_tag,
                "surcharge": float(surcharge),
                "total": float(amount + surcharge),
                "period": period,
                "is_enrolled": is_enrolled,
                "bank_info": bank_info,
            })


class EnrollmentPaymentUploadView(APIView):
    """
    POST /academic/enrollment-payment/upload
    Estudiante sube su voucher de pago.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        student = _student_of(request.user)
        if not student:
            return Response({"detail": "No se encontró perfil de estudiante."}, status=404)

        ser = EnrollmentPaymentUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        period = ser.validated_data["period"]
        channel = ser.validated_data["channel"]
        operation_code = ser.validated_data.get("operation_code", "")
        nro_secuencia = ser.validated_data.get("nro_secuencia", "")
        codigo_caja = ser.validated_data.get("codigo_caja", "")
        fecha_movimiento = ser.validated_data.get("fecha_movimiento", None)
        voucher = ser.validated_data["voucher"]

        # Verificar que no tenga ya un pago APPROVED
        existing = EnrollmentPayment.objects.filter(student=student, period=period).first()
        if existing:
            if existing.status == EnrollmentPayment.STATUS_APPROVED:
                return Response(
                    {"detail": "Ya tienes un pago aprobado para este período."},
                    status=409,
                )
            if existing.status == EnrollmentPayment.STATUS_PENDING:
                return Response(
                    {"detail": "Ya tienes un voucher en revisión para este período."},
                    status=409,
                )
            # Si es REJECTED, debe usar re-upload
            if existing.status == EnrollmentPayment.STATUS_REJECTED:
                return Response(
                    {"detail": "Tu pago fue rechazado. Usa la opción de reenviar voucher."},
                    status=409,
                )

        amount, discount_tag, surcharge = _compute_enrollment_amount(student, period)

        payment = EnrollmentPayment.objects.create(
            student=student,
            period=period,
            amount=amount,
            discount_tag=discount_tag,
            surcharge=surcharge,
            channel=channel,
            operation_code=operation_code,
            nro_secuencia=nro_secuencia,
            codigo_caja=codigo_caja,
            fecha_movimiento=fecha_movimiento,
            voucher=voucher,
            voucher_name=voucher.name,
            status=EnrollmentPayment.STATUS_PENDING,
        )

        return Response(
            EnrollmentPaymentSerializer(payment, context={"request": request}).data,
            status=201,
        )


class EnrollmentPaymentReUploadView(APIView):
    """
    POST /academic/enrollment-payment/re-upload
    Estudiante re-sube voucher tras rechazo.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        student = _student_of(request.user)
        if not student:
            return Response({"detail": "No se encontró perfil de estudiante."}, status=404)

        period = (request.data.get("period") or "").strip()
        if not period:
            return Response({"detail": "Parámetro 'period' requerido."}, status=400)

        try:
            payment = EnrollmentPayment.objects.get(student=student, period=period)
        except EnrollmentPayment.DoesNotExist:
            return Response({"detail": "No existe pago para este período."}, status=404)

        if payment.status not in (EnrollmentPayment.STATUS_REJECTED, EnrollmentPayment.STATUS_PENDING):
            return Response(
                {"detail": "Solo puedes modificar el voucher si el pago está pendiente o fue rechazado."},
                status=409,
            )

        channel = (request.data.get("channel") or "").strip()
        operation_code = (request.data.get("operation_code") or "").strip()
        nro_secuencia = (request.data.get("nro_secuencia") or "").strip()
        codigo_caja = (request.data.get("codigo_caja") or "").strip()
        fecha_movimiento_raw = (request.data.get("fecha_movimiento") or "").strip()
        voucher = request.FILES.get("voucher")

        if not voucher:
            return Response({"detail": "Debes subir un nuevo voucher."}, status=400)
        if not channel:
            return Response({"detail": "Debes seleccionar un canal de pago."}, status=400)

        # Validar archivo
        if voucher.size > 5 * 1024 * 1024:
            return Response({"detail": "El archivo no puede superar 5 MB."}, status=400)

        # Recalcular montos
        amount, discount_tag, surcharge = _compute_enrollment_amount(student, period)

        # Borrar voucher anterior
        if payment.voucher:
            try:
                payment.voucher.delete(save=False)
            except Exception:
                pass

        payment.amount = amount
        payment.discount_tag = discount_tag
        payment.surcharge = surcharge
        payment.channel = channel
        payment.operation_code = operation_code
        payment.nro_secuencia = nro_secuencia
        payment.codigo_caja = codigo_caja
        if fecha_movimiento_raw:
            try:
                from datetime import date as _date
                payment.fecha_movimiento = _date.fromisoformat(fecha_movimiento_raw)
            except (ValueError, TypeError):
                payment.fecha_movimiento = None
        else:
            payment.fecha_movimiento = None
        payment.voucher = voucher
        payment.voucher_name = voucher.name
        payment.status = EnrollmentPayment.STATUS_PENDING
        payment.rejection_note = ""
        payment.reviewer = None
        payment.reviewed_at = None
        payment.save()

        return Response(EnrollmentPaymentSerializer(payment, context={"request": request}).data)


# ══════════════════════════════════════════════════════════════
#  VISTAS — FINANZAS
# ══════════════════════════════════════════════════════════════

class EnrollmentPaymentPendingView(APIView):
    """
    GET /academic/enrollment-payment/pending?period=2026-I&status=PENDING&search=...
    Lista pagos para revisión de finanzas.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        period = (request.query_params.get("period") or "").strip()
        status_filter = (request.query_params.get("status") or "").strip().upper()
        search = (request.query_params.get("search") or "").strip()

        qs = EnrollmentPayment.objects.select_related(
            "student", "reviewer"
        ).order_by("-created_at")

        if period:
            qs = qs.filter(period=period)

        if status_filter and status_filter in ("PENDING", "APPROVED", "REJECTED"):
            qs = qs.filter(status=status_filter)

        if search:
            qs = qs.filter(
                Q(student__num_documento__icontains=search) |
                Q(student__nombres__icontains=search) |
                Q(student__apellido_paterno__icontains=search) |
                Q(student__apellido_materno__icontains=search) |
                Q(operation_code__icontains=search) |
                Q(nro_secuencia__icontains=search) |
                Q(codigo_caja__icontains=search)
            )

        # Conteos para resumen
        base_qs = EnrollmentPayment.objects.all()
        if period:
            base_qs = base_qs.filter(period=period)

        summary = {
            "pending": base_qs.filter(status="PENDING").count(),
            "approved": base_qs.filter(status="APPROVED").count(),
            "rejected": base_qs.filter(status="REJECTED").count(),
        }

        data = EnrollmentPaymentSerializer(qs[:200], many=True, context={"request": request}).data
        return Response({"payments": data, "summary": summary})


class EnrollmentPaymentDetailView(APIView):
    """
    GET /academic/enrollment-payment/<id>
    Detalle de un pago (para finanzas).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            payment = EnrollmentPayment.objects.select_related(
                "student", "reviewer"
            ).get(pk=pk)
        except EnrollmentPayment.DoesNotExist:
            return Response({"detail": "Pago no encontrado."}, status=404)

        return Response(EnrollmentPaymentSerializer(payment, context={"request": request}).data)


class EnrollmentPaymentApproveView(APIView):
    """
    POST /academic/enrollment-payment/<id>/approve
    Finanzas aprueba el pago → registra ingreso en caja.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            payment = EnrollmentPayment.objects.select_related("student").get(pk=pk)
        except EnrollmentPayment.DoesNotExist:
            return Response({"detail": "Pago no encontrado."}, status=404)

        if payment.status == EnrollmentPayment.STATUS_APPROVED:
            return Response({"detail": "Este pago ya fue aprobado."}, status=409)

        payment.status = EnrollmentPayment.STATUS_APPROVED
        payment.reviewer = request.user
        payment.reviewed_at = timezone.now()
        payment.rejection_note = ""
        payment.save(update_fields=[
            "status", "reviewer", "reviewed_at", "rejection_note", "updated_at",
        ])

        # Registrar ingreso en finanzas
        try:
            _register_income_on_approve(payment, request.user)
        except Exception:
            # No bloquear la aprobación si falla el registro contable
            pass

        return Response(EnrollmentPaymentSerializer(payment, context={"request": request}).data)


class EnrollmentPaymentRejectView(APIView):
    """
    POST /academic/enrollment-payment/<id>/reject
    Finanzas rechaza el pago con motivo.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            payment = EnrollmentPayment.objects.select_related("student").get(pk=pk)
        except EnrollmentPayment.DoesNotExist:
            return Response({"detail": "Pago no encontrado."}, status=404)

        if payment.status == EnrollmentPayment.STATUS_APPROVED:
            return Response({"detail": "No se puede rechazar un pago ya aprobado."}, status=409)

        note = (request.data.get("note") or "").strip()
        if not note:
            return Response({"detail": "Debe indicar el motivo del rechazo."}, status=400)

        payment.status = EnrollmentPayment.STATUS_REJECTED
        payment.reviewer = request.user
        payment.reviewed_at = timezone.now()
        payment.rejection_note = note
        payment.save(update_fields=[
            "status", "reviewer", "reviewed_at", "rejection_note", "updated_at",
        ])

        return Response(EnrollmentPaymentSerializer(payment, context={"request": request}).data)


class EnrollmentPaymentDeleteView(APIView):
    """
    DELETE /academic/enrollment-payment/<id>/delete
    Finanzas elimina un pago de matrícula (cualquier estado).
    """
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        try:
            payment = EnrollmentPayment.objects.get(pk=pk)
        except EnrollmentPayment.DoesNotExist:
            return Response({"detail": "Pago no encontrado."}, status=404)

        # Eliminar archivo de voucher
        if payment.voucher:
            try:
                payment.voucher.delete(save=False)
            except Exception:
                pass

        payment.delete()
        return Response(status=204)
