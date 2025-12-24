from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
import csv

from django.db import transaction
from django.db.models import Sum
from django.http import HttpResponse
from django.utils.timezone import now, localtime
from django.utils.dateparse import parse_date


from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

from .models import (
    Concept,
    CashSession,
    CashMovement,
    StudentAccountCharge,
    StudentAccountPayment,
    BankAccount,
    BankMovement,
    ReconciliationRun,
    ReconciliationItem,
    IncomeEntry,
    Receipt,
    InventoryItem,
    InventoryMovement,
    Supplier,
    PurchaseRequirement,
    PurchaseRequirementItem,
    PurchaseOrder,
    PurchaseOrderItem,
    Employee, Attendance,
    EmployeeContract
)

from .serializers import (
    ConceptSerializer,
    CashSessionSerializer,
    CashMovementSerializer,
    BankAccountSerializer,
    BankMovementSerializer,
    IncomeEntrySerializer,
    ReceiptSerializer,
    InventoryItemSerializer,
    InventoryMovementSerializer,
    SupplierSerializer,
    PurchaseRequirementSerializer,
    PurchaseOrderSerializer,
    EmployeeSerializer, AttendanceSerializer,
    EmployeeContractSerializer
)

# =======================
# Dashboard / Estadísticas
# =======================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    today = date.today()
    month_start = today.replace(day=1)

    sessions_today = CashSession.objects.filter(opened_at__date=today)
    cash_today = Decimal("0.00")

    for s in sessions_today:
        opening = Decimal(str(s.opening_amount or 0))
        ins = s.movements.filter(type="IN").aggregate(t=Sum("amount"))["t"] or 0
        outs = s.movements.filter(type="OUT").aggregate(t=Sum("amount"))["t"] or 0
        cash_today += opening + Decimal(str(ins)) - Decimal(str(outs))

    income_qs = IncomeEntry.objects.filter(date__gte=month_start, date__lte=today)
    monthly_income = Decimal(str(income_qs.aggregate(t=Sum("amount"))["t"] or 0))

    stats = {
        "cash_today_amount": float(cash_today.quantize(Decimal("0.01"))),
        "monthly_income_amount": float(monthly_income.quantize(Decimal("0.01"))),
        "monthly_income_change_pct": 0.0,
        "low_stock_alerts": 0,
        "active_employees": 0,
    }
    return Response({"stats": stats})


# ===========================
# Catálogo de conceptos
# ===========================

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def concepts_list_create(request):
    if request.method == "GET":
        qs = Concept.objects.all().order_by("name")
        ser = ConceptSerializer(qs, many=True)
        return Response({"items": ser.data})

    ser = ConceptSerializer(data=request.data)
    if ser.is_valid():
        ser.save()
        return Response(ser.data, status=status.HTTP_201_CREATED)
    return Response({"detail": ser.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def concepts_detail(request, pk):
    try:
        obj = Concept.objects.get(pk=pk)
    except Concept.DoesNotExist:
        return Response({"detail": "Concepto no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PATCH":
        ser = ConceptSerializer(obj, data=request.data, partial=True)
        if ser.is_valid():
            ser.save()
            return Response(ser.data)
        return Response({"detail": ser.errors}, status=status.HTTP_400_BAD_REQUEST)

    obj.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ==================
# Caja / Bancos
# ==================

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def cash_sessions(request):
    if request.method == "GET":
        qs = CashSession.objects.all().order_by("-opened_at")
        ser = CashSessionSerializer(qs, many=True)
        return Response({"items": ser.data})

    opening_amount = request.data.get("opening_amount", 0) or 0
    note = request.data.get("note", "")

    session = CashSession.objects.create(
        user=request.user,
        opening_amount=opening_amount,
        note=note,
        status="OPEN",
    )
    return Response(CashSessionSerializer(session).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cash_session_close(request, pk):
    try:
        session = CashSession.objects.get(pk=pk)
    except CashSession.DoesNotExist:
        return Response({"detail": "Sesión no encontrada"}, status=status.HTTP_404_NOT_FOUND)

    closing_amount = request.data.get("closing_amount")
    note = request.data.get("note", "")

    session.closing_amount = closing_amount
    session.note = (session.note or "") + ("\n" + note if note else "")
    session.status = "CLOSED"
    session.closed_at = now()
    session.save(update_fields=["closing_amount", "note", "status", "closed_at"])

    return Response(CashSessionSerializer(session).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def cash_movements(request, pk):
    try:
        session = CashSession.objects.get(pk=pk)
    except CashSession.DoesNotExist:
        return Response({"detail": "Sesión no encontrada"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        qs = session.movements.all().order_by("date", "id")
        return Response({"items": CashMovementSerializer(qs, many=True).data})

    type_ = request.data.get("type")
    amount = request.data.get("amount")
    concept = request.data.get("concept", "")

    if type_ not in ("IN", "OUT"):
        return Response({"detail": "Tipo inválido"}, status=status.HTTP_400_BAD_REQUEST)
    if amount is None:
        return Response({"detail": "Monto requerido"}, status=status.HTTP_400_BAD_REQUEST)

    mov = CashMovement.objects.create(
        session=session,
        type=type_,
        amount=amount,
        concept=concept or "",
    )
    return Response(CashMovementSerializer(mov).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cash_session_export_pdf(request, pk):
    # Stub controlado
    return Response(
        {"success": False, "detail": "Exportación PDF de caja no implementada aún"},
        status=status.HTTP_200_OK,
    )


# ==================
# Estados de cuenta
# ==================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def accounts_statement(request):
    subject_id = request.query_params.get("subject_id")
    subject_type = request.query_params.get("subject_type", "STUDENT")

    if not subject_id:
        return Response({"detail": "subject_id requerido"}, status=status.HTTP_400_BAD_REQUEST)

    charges = list(
        StudentAccountCharge.objects.filter(subject_id=subject_id, subject_type=subject_type)
        .order_by("due_date", "created_at", "id")
    )
    payments = list(
        StudentAccountPayment.objects.filter(subject_id=subject_id, subject_type=subject_type)
        .order_by("date", "created_at", "id")
    )

    ledger = []
    for c in charges:
        ledger.append({
            "date": c.due_date or c.created_at.date(),
            "kind": "CARGO",
            "description": c.concept_name or (c.concept.name if c.concept else "Cargo"),
            "amount": float(c.amount),
            "status": "Pagado" if c.paid else "Pendiente",
        })
    for p in payments:
        ledger.append({
            "date": p.date or p.created_at.date(),
            "kind": "PAGO",
            "description": f"Pago {p.method} {p.ref or ''}".strip(),
            "amount": float(p.amount) * -1,
            "status": "Pago",
        })

    ledger.sort(key=lambda x: (x["date"], x["kind"]))

    resp = {
        "subject_id": subject_id,
        "subject_type": subject_type,
        "subject_name": f"Sujeto {subject_id}",
        "career_name": "",
        "charges": [
            {
                "id": c.id,
                "concept_name": c.concept_name or (c.concept.name if c.concept else ""),
                "amount": float(c.amount),
                "due_date": c.due_date,
                "paid": c.paid,
            }
            for c in charges
        ],
        "payments": [
            {
                "id": p.id,
                "amount": float(p.amount),
                "date": p.date or p.created_at.date(),
                "method": p.method,
            }
            for p in payments
        ],
        "ledger": ledger,
    }
    return Response(resp)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accounts_charge(request):
    subject_id = request.data.get("subject_id")
    subject_type = request.data.get("subject_type", "STUDENT")
    concept_id = request.data.get("concept_id")
    amount = request.data.get("amount")
    due_date = request.data.get("due_date")

    if not subject_id or not concept_id:
        return Response({"detail": "subject_id y concept_id requeridos"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        concept = Concept.objects.get(pk=concept_id)
    except Concept.DoesNotExist:
        return Response({"detail": "Concepto no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    if amount is None:
        amount = concept.default_amount

    charge = StudentAccountCharge.objects.create(
        subject_id=subject_id,
        subject_type=subject_type,
        concept=concept,
        concept_name=concept.name,
        amount=amount,
        due_date=due_date or None,
    )
    return Response({"id": charge.id}, status=status.HTTP_201_CREATED)


@transaction.atomic
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accounts_pay(request):
    subject_id = request.data.get("subject_id")
    subject_type = request.data.get("subject_type", "STUDENT")
    amount = request.data.get("amount")
    method = request.data.get("method", "CASH")
    ref = request.data.get("ref", "")
    date_str = request.data.get("date")

    if not subject_id or amount is None:
        return Response({"detail": "subject_id y amount requeridos"}, status=status.HTTP_400_BAD_REQUEST)

    pay_date = None
    if date_str:
        try:
            pay_date = datetime.fromisoformat(date_str).date()
        except ValueError:
            pay_date = date.today()

    payment = StudentAccountPayment.objects.create(
        subject_id=subject_id,
        subject_type=subject_type,
        amount=amount,
        method=method,
        ref=ref,
        date=pay_date,
    )

    remaining = float(amount)
    charges = StudentAccountCharge.objects.filter(
        subject_id=subject_id,
        subject_type=subject_type,
        paid=False,
    ).order_by("due_date", "created_at", "id")

    for c in charges:
        if remaining <= 0:
            break
        c_amt = float(c.amount)
        if remaining >= c_amt:
            c.paid = True
            remaining -= c_amt
        c.save(update_fields=["paid"])

    first_charge = charges.first()
    if first_charge and first_charge.concept:
        payment.concept = first_charge.concept
        payment.save(update_fields=["concept"])

    IncomeEntry.objects.create(
        date=pay_date or date.today(),
        subject_id=subject_id,
        concept=payment.concept,
        concept_name=payment.concept.name if payment.concept else "Pago",
        amount=amount,
    )

    return Response({"id": payment.id}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def accounts_statement_pdf(request):
    subject_id = request.query_params.get("subject_id")
    subject_type = request.query_params.get("subject_type", "STUDENT")

    if not subject_id:
        return Response({"detail": "subject_id requerido"}, status=status.HTTP_400_BAD_REQUEST)

    charges = list(
        StudentAccountCharge.objects.filter(subject_id=subject_id, subject_type=subject_type)
        .order_by("due_date", "created_at", "id")
    )
    payments = list(
        StudentAccountPayment.objects.filter(subject_id=subject_id, subject_type=subject_type)
        .order_by("date", "created_at", "id")
    )

    ledger = []
    for c in charges:
        ledger.append({
            "date": c.due_date or c.created_at.date(),
            "kind": "CARGO",
            "description": c.concept_name or (c.concept.name if c.concept else "Cargo"),
            "amount": float(c.amount),
            "status": "Pagado" if c.paid else "Pendiente",
        })
    for p in payments:
        ledger.append({
            "date": p.date or p.created_at.date(),
            "kind": "PAGO",
            "description": f"Pago {p.method} {p.ref or ''}".strip(),
            "amount": float(p.amount) * -1,
            "status": "Pago",
        })
    ledger.sort(key=lambda x: (x["date"], x["kind"]))

    total_ch = sum(float(c.amount) for c in charges)
    total_py = sum(float(p.amount) for p in payments)
    balance = total_ch - total_py

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    y = h - 50

    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, f"Estado de Cuenta - {subject_type} {subject_id}")
    y -= 25

    c.setFont("Helvetica", 10)
    c.drawString(40, y, f"Total cargos: S/ {total_ch:.2f}   Total pagos: S/ {total_py:.2f}   Saldo: S/ {balance:.2f}")
    y -= 20

    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, y, "Fecha")
    c.drawString(120, y, "Tipo")
    c.drawString(190, y, "Detalle")
    c.drawRightString(w - 60, y, "Monto")
    y -= 14

    c.setFont("Helvetica", 9)
    for it in ledger:
        if y < 60:
            c.showPage()
            y = h - 50
            c.setFont("Helvetica", 9)

        c.drawString(40, y, str(it["date"]))
        c.drawString(120, y, it["kind"])
        c.drawString(190, y, (it["description"] or "")[:55])
        c.drawRightString(w - 60, y, f"S/ {float(it['amount']):.2f}")
        y -= 12

    c.showPage()
    c.save()
    buf.seek(0)

    resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="estado-cuenta-{subject_id}.pdf"'
    return resp


# ========================
# Conciliación bancaria
# ========================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def bank_accounts(request):
    qs = BankAccount.objects.all().order_by("bank_name", "account_number")
    return Response({"items": BankAccountSerializer(qs, many=True).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reconciliation_movements(request):
    account_id = request.query_params.get("account_id")
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")

    if not account_id or not date_from or not date_to:
        return Response({"detail": "account_id, date_from y date_to requeridos"}, status=status.HTTP_400_BAD_REQUEST)

    qs = BankMovement.objects.filter(
        account_id=account_id,
        date__gte=date_from,
        date__lte=date_to,
    ).order_by("date", "id")

    ser = BankMovementSerializer(qs, many=True)
    items = [{**x, "reconciled": False} for x in ser.data]
    return Response({"items": items})


@transaction.atomic
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reconciliation_save(request):
    account_id = request.data.get("account_id")
    date_from = request.data.get("date_from")
    date_to = request.data.get("date_to")
    statement_balance = request.data.get("statement_balance", 0)
    items = request.data.get("items", [])

    if not account_id or not date_from or not date_to:
        return Response({"detail": "account_id, date_from y date_to requeridos"}, status=status.HTTP_400_BAD_REQUEST)

    qs = BankMovement.objects.filter(account_id=account_id, date__gte=date_from, date__lte=date_to)
    mov_map = {m.id: m for m in qs}

    total_reconciled = Decimal("0.00")
    for it in items:
        mid = it.get("movement_id")
        if it.get("reconciled") and mid in mov_map:
            total_reconciled += Decimal(str(mov_map[mid].amount))

    run = ReconciliationRun.objects.create(
        account_id=account_id,
        date_from=date_from,
        date_to=date_to,
        statement_balance=statement_balance,
        diff=Decimal(str(statement_balance)) - total_reconciled,
    )

    for it in items:
        mid = it.get("movement_id")
        if mid not in mov_map:
            continue
        ReconciliationItem.objects.create(
            run=run,
            movement=mov_map[mid],
            reconciled=bool(it.get("reconciled")),
        )

    return Response({"id": run.id}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reconciliation_export_pdf(request):
    return Response({"success": False, "detail": "Exportación PDF de conciliación no implementada aún"}, status=status.HTTP_200_OK)


# =====================
# Reportes de ingresos
# =====================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reports_income(request):
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")
    concept_id = request.query_params.get("concept_id")
    career_id = request.query_params.get("career_id")

    qs = IncomeEntry.objects.all()
    if date_from:
        qs = qs.filter(date__gte=date_from)
    if date_to:
        qs = qs.filter(date__lte=date_to)
    if concept_id:
        qs = qs.filter(concept_id=concept_id)
    if career_id:
        qs = qs.filter(career_id=career_id)

    qs = qs.order_by("date", "id")

    data = [
        {
            "date": it.date,
            "concept_name": it.concept_name,
            "career_name": it.career_name,
            "amount": float(it.amount),
        }
        for it in qs
    ]
    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reports_income_export_pdf(request):
    return Response({"success": False, "detail": "Exportación PDF de reporte de ingresos no implementada aún"}, status=status.HTTP_200_OK)


# =====================
# Pagos & e-factura
# =====================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def payments_checkout(request):
    amount = request.data.get("amount", 0)
    subject_id = request.data.get("subject_id")
    _ = request.data.get("meta", {})

    fake_url = f"https://example.com/pago-sandbox?subject={subject_id}&amount={amount}"
    return Response({"url": fake_url})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def einvoice_issue(request):
    receipt_id = request.data.get("receipt_id")
    return Response({"status": "QUEUED", "receipt_id": receipt_id}, status=status.HTTP_202_ACCEPTED)


# =====================
# Receipts (Boletas)
# =====================

def _next_receipt_number():
    prefix = now().strftime("BOLETA-%Y%m-")
    last = Receipt.objects.filter(receipt_number__startswith=prefix).order_by("-id").first()
    if not last:
        return f"{prefix}000001"
    last_num = int(last.receipt_number.split("-")[-1])
    return f"{prefix}{last_num + 1:06d}"


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def receipts_list_create(request):
    if request.method == "GET":
        qs = Receipt.objects.all().order_by("-issued_at", "-id")
        return Response({"receipts": ReceiptSerializer(qs, many=True).data})

    payload = request.data.copy()
    payload["receipt_number"] = _next_receipt_number()

    ser = ReceiptSerializer(data=payload)
    if not ser.is_valid():
        return Response({"detail": ser.errors}, status=status.HTTP_400_BAD_REQUEST)

    obj = ser.save(user=request.user, issued_at=now(), status="PENDING")
    return Response({"receipt": ReceiptSerializer(obj).data}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def receipt_pay(request, pk):
    try:
        r = Receipt.objects.get(pk=pk)
    except Receipt.DoesNotExist:
        return Response({"detail": "Boleta no encontrada"}, status=status.HTTP_404_NOT_FOUND)

    if r.status != "PENDING":
        return Response({"detail": "Solo se puede pagar una boleta PENDING"}, status=status.HTTP_400_BAD_REQUEST)

    r.status = "PAID"
    r.payment_method = request.data.get("payment_method", "CASH")
    r.payment_reference = request.data.get("payment_reference") or None
    r.paid_at = now()
    r.save(update_fields=["status", "payment_method", "payment_reference", "paid_at"])

    return Response({"receipt": ReceiptSerializer(r).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def receipt_cancel(request, pk):
    try:
        r = Receipt.objects.get(pk=pk)
    except Receipt.DoesNotExist:
        return Response({"detail": "Boleta no encontrada"}, status=status.HTTP_404_NOT_FOUND)

    if r.status == "CANCELLED":
        return Response({"detail": "La boleta ya está anulada"}, status=status.HTTP_400_BAD_REQUEST)

    r.status = "CANCELLED"
    r.cancel_reason = request.data.get("reason") or "Sin motivo"
    r.cancelled_at = now()
    r.save(update_fields=["status", "cancel_reason", "cancelled_at"])

    return Response({"receipt": ReceiptSerializer(r).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def receipt_pdf(request, pk):
    try:
        r = Receipt.objects.get(pk=pk)
    except Receipt.DoesNotExist:
        return Response({"detail": "Boleta no encontrada"}, status=status.HTTP_404_NOT_FOUND)

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    y = h - 50

    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, f"Boleta / Recibo: {r.receipt_number}")
    y -= 22

    concept_text = r.get_concept_display() if hasattr(r, "get_concept_display") else (r.concept or "")

    c.setFont("Helvetica", 10)
    c.drawString(40, y, f"Concepto: {concept_text}"); y -= 14
    ...


    concept_text = ""
    try:
        concept_text = r.concept.name if r.concept else ""
    except:
        concept_text = str(r.concept) if r.concept else ""

    c.setFont("Helvetica", 10)
    c.drawString(40, y, f"Concepto: {concept_text}"); y -= 14
    c.drawString(40, y, f"Descripción: {(r.description or '')[:80]}"); y -= 14
    c.drawString(40, y, f"Monto: S/ {Decimal(str(r.amount)).quantize(Decimal('0.01'))}"); y -= 14
    c.drawString(40, y, f"Cliente: {r.customer_name or '—'}"); y -= 14
    c.drawString(40, y, f"Documento: {r.customer_document or '—'}"); y -= 14
    c.drawString(40, y, f"Email: {r.customer_email or '—'}"); y -= 14
    c.drawString(40, y, f"Estado: {r.status}"); y -= 14
    c.drawString(40, y, f"Emitido: {r.issued_at.strftime('%Y-%m-%d %H:%M') if r.issued_at else '—'}"); y -= 14

    if r.status == "PAID":
        c.drawString(40, y, f"Pagado: {r.paid_at.strftime('%Y-%m-%d %H:%M') if r.paid_at else '—'}"); y -= 14
        c.drawString(40, y, f"Método: {r.payment_method or '—'}"); y -= 14
        c.drawString(40, y, f"Referencia: {r.payment_reference or '—'}"); y -= 14

    if r.status == "CANCELLED":
        c.drawString(40, y, f"Anulado: {r.cancelled_at.strftime('%Y-%m-%d %H:%M') if r.cancelled_at else '—'}"); y -= 14
        c.drawString(40, y, f"Motivo: {(r.cancel_reason or '')[:80]}"); y -= 14

    c.showPage()
    c.save()
    buf.seek(0)

    resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{r.receipt_number}.pdf"'
    return resp


# --------------------
# INVENTORY: Items
# --------------------

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def inventory_items(request):
    if request.method == "GET":
        qs = InventoryItem.objects.all().order_by("name")
        return Response({"items": InventoryItemSerializer(qs, many=True).data})

    ser = InventoryItemSerializer(data=request.data)
    if not ser.is_valid():
        return Response({"detail": ser.errors}, status=status.HTTP_400_BAD_REQUEST)

    obj = ser.save()
    return Response({"item": InventoryItemSerializer(obj).data}, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def inventory_item_detail(request, pk):
    try:
        obj = InventoryItem.objects.get(pk=pk)
    except InventoryItem.DoesNotExist:
        return Response({"detail": "Item no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PATCH":
        ser = InventoryItemSerializer(obj, data=request.data, partial=True)
        if not ser.is_valid():
            return Response({"detail": ser.errors}, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return Response({"item": ser.data})

    obj.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ------------------------
# INVENTORY: Movimientos
# ------------------------

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def inventory_movements(request):
    if request.method == "GET":
        limit = int(request.query_params.get("limit", 20))
        qs = InventoryMovement.objects.select_related("item").order_by("-created_at", "-id")[:limit]
        return Response({"movements": InventoryMovementSerializer(qs, many=True).data})

    item_id = request.data.get("item_id")
    movement_type = request.data.get("movement_type")
    quantity = request.data.get("quantity")
    unit_cost = request.data.get("unit_cost")
    reason = request.data.get("reason", "")
    notes = request.data.get("notes", "")
    batch_number = request.data.get("batch_number", "")
    expiry_date = request.data.get("expiry_date")

    if not item_id or not movement_type or quantity is None or not reason:
        return Response({"detail": "item_id, movement_type, quantity y reason son requeridos"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        item = InventoryItem.objects.select_for_update().get(pk=item_id)
    except InventoryItem.DoesNotExist:
        return Response({"detail": "Item no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    try:
        qty = int(quantity)
    except:
        return Response({"detail": "quantity inválido"}, status=status.HTTP_400_BAD_REQUEST)

    if qty <= 0:
        return Response({"detail": "quantity debe ser > 0"}, status=status.HTTP_400_BAD_REQUEST)

    is_entry = movement_type == "ENTRY"
    is_exit = movement_type in ("EXIT", "TRANSFER")

    if is_entry:
        item.current_stock = int(item.current_stock) + qty
        if unit_cost not in ("", None):
            item.unit_cost = unit_cost
    elif is_exit:
        if int(item.current_stock) - qty < 0:
            return Response({"detail": "Stock insuficiente"}, status=status.HTTP_400_BAD_REQUEST)
        item.current_stock = int(item.current_stock) - qty
    elif movement_type == "ADJUSTMENT":
        item.current_stock = int(item.current_stock) + qty
    else:
        return Response({"detail": "movement_type inválido"}, status=status.HTTP_400_BAD_REQUEST)

    item.save(update_fields=["current_stock", "unit_cost", "updated_at"])

    mov = InventoryMovement.objects.create(
        item=item,
        movement_type=movement_type,
        quantity=qty,
        unit_cost=unit_cost if unit_cost not in ("", None) else None,
        reason=reason,
        notes=notes or "",
        batch_number=batch_number or "",
        expiry_date=expiry_date or None,
    )

    return Response({"movement": InventoryMovementSerializer(mov).data}, status=status.HTTP_201_CREATED)


# --------------------
# INVENTORY: Alertas
# --------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def inventory_alerts(request):
    qs = InventoryItem.objects.all()
    alerts = []

    for it in qs:
        if it.current_stock <= it.min_stock:
            severity = "HIGH" if it.current_stock == 0 else "MEDIUM"
            alerts.append({
                "item_id": it.id,
                "item_code": it.code,
                "item_name": it.name,
                "severity": severity,
                "message": "Stock agotado" if it.current_stock == 0 else "Stock bajo",
            })

    return Response({"alerts": alerts})


# --------------------
# INVENTORY: Kardex (FIFO)
# --------------------

def _kardex_fifo(item: InventoryItem):
    movements = item.movements.all().order_by("created_at", "id")
    layers = []  # [{qty, cost}]
    running_stock = 0

    def total_value():
        return sum(float(l["qty"]) * float(l["cost"]) for l in layers)

    out = []
    for m in movements:
        qty = int(m.quantity)
        if m.movement_type == "ENTRY":
            cost = float(m.unit_cost) if m.unit_cost is not None else float(item.unit_cost or 0)
            layers.append({"qty": qty, "cost": cost})
            running_stock += qty
        else:
            to_consume = qty
            consumed_cost = 0.0
            consumed_qty = 0

            while to_consume > 0 and layers:
                layer = layers[0]
                take = min(to_consume, int(layer["qty"]))
                consumed_cost += take * float(layer["cost"])
                consumed_qty += take
                layer["qty"] = int(layer["qty"]) - take
                to_consume -= take
                if int(layer["qty"]) == 0:
                    layers.pop(0)

            running_stock = max(0, running_stock - consumed_qty)
            if consumed_qty > 0:
                m.unit_cost = consumed_cost / consumed_qty

        out.append({
            "id": m.id,
            "created_at": m.created_at,
            "movement_type": m.movement_type,
            "quantity": qty,
            "unit_cost": float(m.unit_cost) if m.unit_cost is not None else None,
            "running_stock": running_stock,
            "running_value": round(total_value(), 2),
        })

    return out


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def inventory_kardex(request, pk):
    try:
        item = InventoryItem.objects.get(pk=pk)
    except InventoryItem.DoesNotExist:
        return Response({"detail": "Item no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    kardex = _kardex_fifo(item)
    return Response({"item": InventoryItemSerializer(item).data, "kardex": kardex})


# ==========================
# LOGISTICS: Numeradores
# ==========================

def _next_supplier_code():
    prefix = now().strftime("PRV-%Y%m-")
    last = Supplier.objects.filter(supplier_code__startswith=prefix).order_by("-id").first()
    if not last:
        return f"{prefix}0001"
    last_num = int(last.supplier_code.split("-")[-1])
    return f"{prefix}{last_num + 1:04d}"


def _next_requirement_number():
    prefix = now().strftime("REQ-%Y%m-")
    last = PurchaseRequirement.objects.filter(requirement_number__startswith=prefix).order_by("-id").first()
    if not last:
        return f"{prefix}0001"
    last_num = int(last.requirement_number.split("-")[-1])
    return f"{prefix}{last_num + 1:04d}"


def _next_po_number():
    prefix = now().strftime("OC-%Y%m-")
    last = PurchaseOrder.objects.filter(order_number__startswith=prefix).order_by("-id").first()
    if not last:
        return f"{prefix}000001"
    last_num = int(last.order_number.split("-")[-1])
    return f"{prefix}{last_num + 1:06d}"


# ==========================
# LOGISTICS: Suppliers
# ==========================

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def logistics_suppliers(request):
    if request.method == "GET":
        qs = Supplier.objects.all().order_by("-created_at", "-id")
        data = SupplierSerializer(qs, many=True).data

        for s in data:
            s["total_orders"] = 0
            s["completed_orders"] = 0

        return Response({"suppliers": data})

    payload = request.data.copy()
    payload["supplier_code"] = _next_supplier_code()

    ser = SupplierSerializer(data=payload)
    if not ser.is_valid():
        return Response({"detail": ser.errors}, status=status.HTTP_400_BAD_REQUEST)

    obj = ser.save()
    out = SupplierSerializer(obj).data
    out["total_orders"] = 0
    out["completed_orders"] = 0
    return Response({"supplier": out}, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def logistics_supplier_detail(request, pk):
    try:
        obj = Supplier.objects.get(pk=pk)
    except Supplier.DoesNotExist:
        return Response({"detail": "Proveedor no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    ser = SupplierSerializer(obj, data=request.data, partial=True)
    if not ser.is_valid():
        return Response({"detail": ser.errors}, status=status.HTTP_400_BAD_REQUEST)

    ser.save()
    out = ser.data
    out["total_orders"] = 0
    out["completed_orders"] = 0
    return Response({"supplier": out})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def logistics_suppliers_csv(request):
    qs = Supplier.objects.all().order_by("company_name")
    resp = HttpResponse(content_type="text/csv")
    resp["Content-Disposition"] = 'attachment; filename="proveedores.csv"'

    w = csv.writer(resp)
    w.writerow(["supplier_code", "ruc", "company_name", "status", "email", "phone", "bank_name", "bank_account"])
    for s in qs:
        w.writerow([
            s.supplier_code,
            s.ruc,
            s.company_name,
            s.status,
            s.email or "",
            s.phone or "",
            s.bank_name or "",
            s.bank_account or "",
        ])
    return resp


# ==========================
# LOGISTICS: Requirements
# ==========================

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def logistics_requirements(request):
    if request.method == "GET":
        qs = PurchaseRequirement.objects.select_related("requester").prefetch_related("items").order_by("-created_at", "-id")
        return Response({"requirements": PurchaseRequirementSerializer(qs, many=True).data})

    items = request.data.get("items") or []
    if not items:
        return Response({"detail": "items es requerido"}, status=status.HTTP_400_BAD_REQUEST)

    req = PurchaseRequirement.objects.create(
        requirement_number=_next_requirement_number(),
        title=request.data.get("title", ""),
        description=request.data.get("description", "") or "",
        justification=request.data.get("justification", ""),
        required_date=request.data.get("required_date") or None,
        requester=request.user,
        status="DRAFT",
        estimated_total=Decimal("0.00"),
    )

    total = Decimal("0.00")

    for it in items:
        desc = (it.get("description") or "").strip()
        if not desc:
            return Response({"detail": "Cada item debe tener description"}, status=400)

        try:
            qty = int(it.get("quantity") or 0)
        except:
            return Response({"detail": "quantity inválido"}, status=400)

        if qty <= 0:
            return Response({"detail": "quantity debe ser > 0"}, status=400)

        try:
            price = Decimal(str(it.get("estimated_unit_price") or "0"))
        except:
            return Response({"detail": "estimated_unit_price inválido"}, status=400)

        total += Decimal(qty) * price

        PurchaseRequirementItem.objects.create(
            requirement=req,
            description=desc,
            quantity=qty,
            unit_of_measure=it.get("unit_of_measure", "UNIT"),
            estimated_unit_price=price,
            technical_specifications=it.get("technical_specifications", "") or "",
        )

    req.estimated_total = total.quantize(Decimal("0.01"))
    req.save(update_fields=["estimated_total", "updated_at"])

    req = PurchaseRequirement.objects.select_related("requester").prefetch_related("items").get(pk=req.pk)
    return Response({"requirement": PurchaseRequirementSerializer(req).data}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def logistics_requirement_detail(request, pk):
    try:
        req = PurchaseRequirement.objects.select_related("requester").prefetch_related("items").get(pk=pk)
    except PurchaseRequirement.DoesNotExist:
        return Response({"detail": "Requerimiento no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    return Response({"requirement": PurchaseRequirementSerializer(req).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logistics_requirement_submit(request, pk):
    try:
        req = PurchaseRequirement.objects.get(pk=pk)
    except PurchaseRequirement.DoesNotExist:
        return Response({"detail": "Requerimiento no encontrado"}, status=404)

    if req.status != "DRAFT":
        return Response({"detail": "Solo puedes enviar un requerimiento en DRAFT"}, status=400)

    req.status = "SUBMITTED"
    req.save(update_fields=["status", "updated_at"])

    req = PurchaseRequirement.objects.select_related("requester").prefetch_related("items").get(pk=req.pk)
    return Response({"requirement": PurchaseRequirementSerializer(req).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logistics_requirement_approve(request, pk):
    if not request.user.is_staff:
        raise PermissionDenied("Solo administradores pueden aprobar")

    try:
        req = PurchaseRequirement.objects.get(pk=pk)
    except PurchaseRequirement.DoesNotExist:
        return Response({"detail": "Requerimiento no encontrado"}, status=404)

    if req.status != "SUBMITTED":
        return Response({"detail": "Solo puedes aprobar un requerimiento en SUBMITTED"}, status=400)

    req.status = "APPROVED"
    req.save(update_fields=["status", "updated_at"])

    req = PurchaseRequirement.objects.select_related("requester").prefetch_related("items").get(pk=req.pk)
    return Response({"requirement": PurchaseRequirementSerializer(req).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logistics_requirement_reject(request, pk):
    if not request.user.is_staff:
        raise PermissionDenied("Solo administradores pueden rechazar")

    try:
        req = PurchaseRequirement.objects.get(pk=pk)
    except PurchaseRequirement.DoesNotExist:
        return Response({"detail": "Requerimiento no encontrado"}, status=404)

    if req.status != "SUBMITTED":
        return Response({"detail": "Solo puedes rechazar un requerimiento en SUBMITTED"}, status=400)

    req.status = "REJECTED"
    req.save(update_fields=["status", "updated_at"])

    req = PurchaseRequirement.objects.select_related("requester").prefetch_related("items").get(pk=req.pk)
    return Response({"requirement": PurchaseRequirementSerializer(req).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def logistics_requirement_pdf(request, pk):
    try:
        req = PurchaseRequirement.objects.select_related("requester").prefetch_related("items").get(pk=pk)
    except PurchaseRequirement.DoesNotExist:
        return Response({"detail": "Requerimiento no encontrado"}, status=404)

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    y = h - 50

    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, f"Requerimiento {req.requirement_number}")
    y -= 18

    c.setFont("Helvetica", 10)
    c.drawString(40, y, f"Título: {req.title}"); y -= 14
    c.drawString(40, y, f"Estado: {req.status}"); y -= 14
    c.drawString(40, y, f"Solicitante: {getattr(req.requester, 'username', '')}"); y -= 14
    c.drawString(40, y, f"Fecha requerida: {req.required_date or '—'}"); y -= 18

    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, y, "Items")
    y -= 14
    c.setFont("Helvetica", 9)

    total = Decimal("0.00")
    for it in req.items.all():
        line_total = Decimal(it.quantity) * (it.estimated_unit_price or Decimal("0.00"))
        total += line_total

        if y < 70:
            c.showPage()
            y = h - 50
            c.setFont("Helvetica", 9)

        txt = f"- {it.description} | {it.quantity} {it.unit_of_measure} | S/ {it.estimated_unit_price} | S/ {line_total}"
        c.drawString(40, y, txt[:120])
        y -= 12

    y -= 8
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, f"Total estimado: S/ {total.quantize(Decimal('0.01'))}")

    c.showPage()
    c.save()
    buf.seek(0)

    resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="requerimiento-{req.requirement_number}.pdf"'
    return resp


# ==========================
# LOGISTICS: PURCHASE ORDERS
# ==========================

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def purchase_orders(request):
    if request.method == "GET":
        qs = (
            PurchaseOrder.objects
            .select_related("supplier", "requirement")
            .prefetch_related("items")
            .order_by("-issued_at", "-id")
        )
        return Response({"purchase_orders": PurchaseOrderSerializer(qs, many=True).data})

    requirement_id = request.data.get("requirement_id")
    supplier_id = request.data.get("supplier_id")
    expected_date = request.data.get("expected_date")
    note = request.data.get("note", "")

    if not requirement_id or not supplier_id:
        return Response({"detail": "requirement_id y supplier_id son requeridos"}, status=400)

    try:
        req = PurchaseRequirement.objects.prefetch_related("items").get(pk=requirement_id)
    except PurchaseRequirement.DoesNotExist:
        return Response({"detail": "Requerimiento no encontrado"}, status=404)

    if req.status != "APPROVED":
        return Response({"detail": "Solo se puede convertir a OC un requerimiento APPROVED"}, status=400)

    # evita OC duplicada activa
    if PurchaseOrder.objects.filter(requirement=req).exclude(status="CANCELLED").exists():
        return Response({"detail": "El requerimiento ya tiene una OC activa"}, status=400)

    try:
        supplier = Supplier.objects.get(pk=supplier_id)
    except Supplier.DoesNotExist:
        return Response({"detail": "Proveedor no encontrado"}, status=404)

    if supplier.status != "ACTIVE":
        return Response({"detail": "El proveedor no está activo"}, status=400)

    po = PurchaseOrder.objects.create(
        order_number=_next_po_number(),
        requirement=req,
        supplier=supplier,
        expected_date=expected_date or None,
        note=note or "",
        status="DRAFT",
        subtotal=Decimal("0.00"),
        tax=Decimal("0.00"),
        total=Decimal("0.00"),
        issued_at=now(),
    )

    subtotal = Decimal("0.00")
    for it in req.items.all():
        qty = int(it.quantity or 0)
        price = Decimal(str(it.estimated_unit_price or "0.00"))
        line_total = Decimal(qty) * price
        subtotal += line_total

        PurchaseOrderItem.objects.create(
            purchase_order=po,
            description=it.description,
            quantity=qty,
            unit_of_measure=it.unit_of_measure,
            unit_price=price,
            line_total=line_total,
            technical_specifications=it.technical_specifications or "",
        )

    po.subtotal = subtotal.quantize(Decimal("0.01"))
    po.tax = Decimal("0.00")
    po.total = (po.subtotal + po.tax).quantize(Decimal("0.01"))
    po.save(update_fields=["subtotal", "tax", "total", "updated_at"])

    req.status = "CONVERTED_TO_PO"
    req.save(update_fields=["status", "updated_at"])

    po = PurchaseOrder.objects.select_related("supplier", "requirement").prefetch_related("items").get(pk=po.id)
    return Response({"purchase_order": PurchaseOrderSerializer(po).data}, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def purchase_order_detail(request, pk):
    try:
        po = (
            PurchaseOrder.objects
            .select_related("supplier", "requirement")
            .prefetch_related("items")
            .get(pk=pk)
        )
    except PurchaseOrder.DoesNotExist:
        return Response({"detail": "OC no encontrada"}, status=404)

    return Response({"purchase_order": PurchaseOrderSerializer(po).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def purchase_order_send(request, pk):
    try:
        po = PurchaseOrder.objects.get(pk=pk)
    except PurchaseOrder.DoesNotExist:
        return Response({"detail": "OC no encontrada"}, status=404)

    if po.status != "DRAFT":
        return Response({"detail": "Solo puedes enviar una OC en estado DRAFT"}, status=400)

    po.status = "SENT"
    po.save(update_fields=["status", "updated_at"])

    po = PurchaseOrder.objects.select_related("supplier", "requirement").prefetch_related("items").get(pk=po.id)
    return Response({"purchase_order": PurchaseOrderSerializer(po).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def purchase_order_receive(request, pk):
    try:
        po = PurchaseOrder.objects.select_related("supplier", "requirement").prefetch_related("items").get(pk=pk)
    except PurchaseOrder.DoesNotExist:
        return Response({"detail": "OC no encontrada"}, status=404)

    if po.status not in ("SENT", "DRAFT"):
        return Response({"detail": "Solo puedes recibir una OC en estado SENT o DRAFT"}, status=400)

    # ingreso automático si hay mapping inventory_item
    for line in po.items.all():
        if line.inventory_item_id:
            item = InventoryItem.objects.select_for_update().get(pk=line.inventory_item_id)

            item.current_stock = int(item.current_stock) + int(line.quantity)
            item.unit_cost = line.unit_price
            item.save(update_fields=["current_stock", "unit_cost", "updated_at"])

            InventoryMovement.objects.create(
                item=item,
                movement_type="ENTRY",
                quantity=int(line.quantity),
                unit_cost=line.unit_price,
                reason=f"Recepción OC {po.order_number}",
                notes="Ingreso automático por recepción de OC",
            )

    po.status = "RECEIVED"
    po.save(update_fields=["status", "updated_at"])

    po = PurchaseOrder.objects.select_related("supplier", "requirement").prefetch_related("items").get(pk=po.id)
    return Response({"purchase_order": PurchaseOrderSerializer(po).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def purchase_order_cancel(request, pk):
    try:
        po = PurchaseOrder.objects.select_related("requirement").get(pk=pk)
    except PurchaseOrder.DoesNotExist:
        return Response({"detail": "OC no encontrada"}, status=404)

    if po.status == "CANCELLED":
        return Response({"detail": "La OC ya está anulada"}, status=400)

    req = po.requirement

    po.status = "CANCELLED"
    po.save(update_fields=["status", "updated_at"])

    # si ya no queda OC activa, vuelve el requerimiento a APPROVED
    active_pos = PurchaseOrder.objects.filter(requirement=req).exclude(status="CANCELLED").exists()
    if not active_pos and req.status == "CONVERTED_TO_PO":
        req.status = "APPROVED"
        req.save(update_fields=["status", "updated_at"])

    po = PurchaseOrder.objects.select_related("supplier", "requirement").prefetch_related("items").get(pk=po.id)
    return Response({"purchase_order": PurchaseOrderSerializer(po).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def purchase_order_pdf(request, pk):
    try:
        po = PurchaseOrder.objects.select_related("supplier", "requirement").prefetch_related("items").get(pk=pk)
    except PurchaseOrder.DoesNotExist:
        return Response({"detail": "OC no encontrada"}, status=404)

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    y = h - 50

    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, f"Orden de Compra {po.order_number}")
    y -= 18

    c.setFont("Helvetica", 10)
    c.drawString(40, y, f"Proveedor: {po.supplier.company_name} (RUC {po.supplier.ruc})"); y -= 14
    c.drawString(40, y, f"Requerimiento: {po.requirement.requirement_number} - {po.requirement.title}"); y -= 14
    c.drawString(40, y, f"Estado: {po.status}"); y -= 14
    c.drawString(40, y, f"Fecha esperada: {po.expected_date or '—'}"); y -= 18

    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, y, "Items"); y -= 14
    c.setFont("Helvetica", 9)

    for it in po.items.all():
        if y < 70:
            c.showPage()
            y = h - 50
            c.setFont("Helvetica", 9)
        txt = f"- {it.description} | {it.quantity} {it.unit_of_measure} | S/ {it.unit_price} | S/ {it.line_total}"
        c.drawString(40, y, txt[:120])
        y -= 12

    y -= 8
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, f"Subtotal: S/ {po.subtotal}   Impuesto: S/ {po.tax}   Total: S/ {po.total}")

    c.showPage()
    c.save()
    buf.seek(0)

    resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="oc-{po.order_number}.pdf"'
    return resp

def _next_employee_code():
    prefix = now().strftime("EMP-%Y%m-")
    last = Employee.objects.filter(employee_code__startswith=prefix).order_by("-id").first()
    if not last:
        return f"{prefix}0001"
    last_num = int(last.employee_code.split("-")[-1])
    return f"{prefix}{last_num + 1:04d}"


def _compute_attendance_flags(att: Attendance):
    is_absent = (att.check_in is None) and (att.check_out is None)

    worked = 0.0
    is_late = False

    if att.check_in and att.check_out:
        start = att.check_in
        end = att.check_out
        diff_minutes = (end - start).total_seconds() / 60.0
        worked_minutes = diff_minutes - float(att.break_minutes or 0)
        worked = max(0.0, worked_minutes / 60.0)

    if att.check_in:
        ci_local = localtime(att.check_in) if getattr(att.check_in, "tzinfo", None) else att.check_in
        is_late = (ci_local.hour, ci_local.minute, ci_local.second) > (8, 0, 0)

    return worked, is_late, is_absent


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def hr_employees(request):
    if request.method == "GET":
        qs = Employee.objects.all().order_by("-created_at", "-id")
        return Response({"employees": EmployeeSerializer(qs, many=True).data})

    ser = EmployeeSerializer(data=request.data)
    if not ser.is_valid():
        return Response({"detail": ser.errors}, status=status.HTTP_400_BAD_REQUEST)

    obj = ser.save(employee_code=_next_employee_code())
    return Response({"employee": EmployeeSerializer(obj).data}, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def hr_employee_detail(request, pk):
    try:
        obj = Employee.objects.get(pk=pk)
    except Employee.DoesNotExist:
        return Response({"detail": "Empleado no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response({"employee": EmployeeSerializer(obj).data})

    if request.method == "PATCH":
        ser = EmployeeSerializer(obj, data=request.data, partial=True)
        if not ser.is_valid():
            return Response({"detail": ser.errors}, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return Response({"employee": ser.data})

    obj.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def hr_attendance(request):
    """
    GET:
      - date_from, date_to (YYYY-MM-DD)
      - Si es 1 solo día (como tu frontend), devuelve 1 registro por empleado ACTIVE:
        si no tiene asistencia, lo devuelve como AUSENTE (virtual, no guarda).
    POST:
      - upsert por (employee_id, date)
    """
    if request.method == "GET":
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if not date_from or not date_to:
            return Response({"detail": "date_from y date_to son requeridos"}, status=status.HTTP_400_BAD_REQUEST)

        d_from = parse_date(date_from)
        d_to = parse_date(date_to)
        if not d_from or not d_to:
            return Response({"detail": "Formato de fecha inválido (YYYY-MM-DD)"}, status=status.HTTP_400_BAD_REQUEST)

        # Caso rango distinto: devolvemos registros existentes (si luego quieres rango real full, se amplía)
        if d_from != d_to:
            qs = Attendance.objects.select_related("employee").filter(date__gte=d_from, date__lte=d_to).order_by("date", "id")
            out = []
            for a in qs:
                worked, is_late, is_absent = _compute_attendance_flags(a)
                data = AttendanceSerializer(a).data
                data["worked_hours"] = round(worked, 2)
                data["is_late"] = is_late
                data["is_absent"] = is_absent
                out.append(data)
            return Response({"attendance": out})

        # Caso 1 día: 1 por empleado ACTIVE (incluye ausentes)
        employees = list(Employee.objects.filter(status="ACTIVE").order_by("last_name", "first_name", "id"))
        existing = Attendance.objects.select_related("employee").filter(date=d_from, employee__in=employees)
        by_emp = {a.employee_id: a for a in existing}

        out = []
        for e in employees:
            if e.id in by_emp:
                a = by_emp[e.id]
            else:
                a = Attendance(
                    employee=e,
                    date=d_from,
                    check_in=None,
                    check_out=None,
                    break_minutes=0,
                    overtime_hours=0,
                    notes="",
                )

            worked, is_late, is_absent = _compute_attendance_flags(a)
            data = AttendanceSerializer(a).data
            data["worked_hours"] = round(worked, 2)
            data["is_late"] = is_late
            data["is_absent"] = is_absent
            out.append(data)

        return Response({"attendance": out})

    # POST upsert
    ser = AttendanceSerializer(data=request.data)
    if not ser.is_valid():
        return Response({"detail": ser.errors}, status=status.HTTP_400_BAD_REQUEST)

    employee_id = ser.validated_data["employee_id"]
    att_date = ser.validated_data["date"]

    defaults = {
        "check_in": ser.validated_data.get("check_in"),
        "check_out": ser.validated_data.get("check_out"),
        "break_minutes": ser.validated_data.get("break_minutes") or 0,
        "overtime_hours": ser.validated_data.get("overtime_hours") or 0,
        "notes": ser.validated_data.get("notes") or "",
        "created_by": request.user,
    }

    obj, _created = Attendance.objects.update_or_create(
        employee_id=employee_id,
        date=att_date,
        defaults=defaults,
    )

    worked, is_late, is_absent = _compute_attendance_flags(obj)
    data = AttendanceSerializer(obj).data
    data["worked_hours"] = round(worked, 2)
    data["is_late"] = is_late
    data["is_absent"] = is_absent

    return Response({"attendance": data}, status=status.HTTP_201_CREATED)

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def hr_contracts(request):
    if request.method == "GET":
        employee_id = request.query_params.get("employee_id")
        qs = EmployeeContract.objects.select_related("employee").order_by("-start_date", "-id")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return Response({"contracts": EmployeeContractSerializer(qs, many=True).data})

    ser = EmployeeContractSerializer(data=request.data)
    if not ser.is_valid():
        return Response({"detail": ser.errors}, status=status.HTTP_400_BAD_REQUEST)

    obj = ser.save(created_by=request.user)
    return Response({"contract": EmployeeContractSerializer(obj).data}, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def hr_contract_detail(request, pk):
    try:
        obj = EmployeeContract.objects.select_related("employee").get(pk=pk)
    except EmployeeContract.DoesNotExist:
        return Response({"detail": "Contrato no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response({"contract": EmployeeContractSerializer(obj).data})

    if request.method == "PATCH":
        ser = EmployeeContractSerializer(obj, data=request.data, partial=True)
        if not ser.is_valid():
            return Response({"detail": ser.errors}, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return Response({"contract": ser.data})

    obj.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

def get_model(app_label, candidates):
    for name in candidates:
        try:
            return apps.get_model(app_label, name)
        except Exception:
            continue
    return None

def has_field(model, name: str) -> bool:
    try:
        model._meta.get_field(name)
        return True
    except Exception:
        return False

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def finance_dashboard_stats(request):
    """
    Shape para DashboardHome:
      income_today, pending_receipts, cash_balance, trend
    """

    Receipt = get_model("finance", ["Receipt", "Recibo", "FinanceReceipt"])
    Payment = get_model("finance", ["Payment", "Pago", "FinancePayment"])
    Movement = get_model("finance", ["CashMovement", "Movement", "FinanceMovement"])
    CashSession = get_model("finance", ["CashSession", "Session", "CashBankSession"])

    today = timezone.localdate()

    income_today = 0
    pending_receipts = 0
    cash_balance = 0
    trend = []

    # pending receipts
    if Receipt:
        # status field: PENDING/PAID/CANCELLED (o similares)
        status_field = "status" if has_field(Receipt, "status") else None
        if status_field:
            pending_receipts = Receipt.objects.filter(status__in=["PENDING", "UNPAID", "OPEN"]).count()
        else:
            pending_receipts = Receipt.objects.count()

        # income_today: suma por paid_at/date o created_at si no hay paid_at
        date_field = None
        for fld in ["paid_at", "payment_date", "date", "created_at"]:
            if has_field(Receipt, fld):
                date_field = fld
                break

        amount_field = None
        for fld in ["amount", "total", "total_amount", "monto"]:
            if has_field(Receipt, fld):
                amount_field = fld
                break

        if date_field and amount_field:
            qs = Receipt.objects.all()
            # si hay status: considera pagados
            if status_field:
                qs = qs.filter(status__in=["PAID", "CONFIRMED", "DONE"])
            qs = qs.filter(**{f"{date_field}__date": today})
            income_today = qs.aggregate(s=Sum(amount_field))["s"] or 0

        # trend (últimos 14 días)
        if date_field and amount_field:
            since = timezone.now() - timedelta(days=14)
            qs = Receipt.objects.all()
            if status_field:
                qs = qs.filter(status__in=["PAID", "CONFIRMED", "DONE"])
            qs = (
                qs.filter(**{f"{date_field}__gte": since})
                .annotate(d=TruncDate(date_field))
                .values("d")
                .annotate(total=Sum(amount_field))
                .order_by("d")
            )
            trend = [{"date": str(r["d"]), "value": float(r["total"] or 0)} for r in qs]

    # cash balance: si hay movimientos, suma ingresos-egresos; si no, 0
    if Movement:
        amount_field = None
        for fld in ["amount", "value", "monto"]:
            if has_field(Movement, fld):
                amount_field = fld
                break

        type_field = None
        for fld in ["type", "kind", "movement_type"]:
            if has_field(Movement, fld):
                type_field = fld
                break

        if amount_field:
            if type_field:
                inflow = Movement.objects.filter(**{f"{type_field}__in": ["IN", "INCOME", "CREDIT"]}).aggregate(s=Sum(amount_field))["s"] or 0
                outflow = Movement.objects.filter(**{f"{type_field}__in": ["OUT", "EXPENSE", "DEBIT"]}).aggregate(s=Sum(amount_field))["s"] or 0
                cash_balance = float(inflow) - float(outflow)
            else:
                cash_balance = float(Movement.objects.aggregate(s=Sum(amount_field))["s"] or 0)

    return Response({
        "income_today": float(income_today or 0),
        "pending_receipts": int(pending_receipts or 0),
        "cash_balance": float(cash_balance or 0),
        "trend": trend,
    })