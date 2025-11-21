from datetime import date, datetime

from django.db import transaction
from django.db.models import Sum, Q
from django.utils.timezone import now
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

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
)
from .serializers import (
    ConceptSerializer,
    CashSessionSerializer,
    CashMovementSerializer,
    BankAccountSerializer,
    BankMovementSerializer,
    IncomeEntrySerializer,
)

# =======================
# Dashboard / Estadísticas
# =======================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    today = date.today()
    month_start = today.replace(day=1)

    # Caja del día: suma apertura + IN - OUT de sesiones de hoy
    sessions_today = CashSession.objects.filter(opened_at__date=today)
    cash_today = 0
    for s in sessions_today:
        opening = s.opening_amount or 0
        ins = s.movements.filter(type="IN").aggregate(t=Sum("amount"))["t"] or 0
        outs = s.movements.filter(type="OUT").aggregate(t=Sum("amount"))["t"] or 0
        cash_today += float(opening + ins - outs)

    # Ingresos del mes: suma de IncomeEntry del mes
    income_qs = IncomeEntry.objects.filter(date__gte=month_start, date__lte=today)
    monthly_income = float(income_qs.aggregate(t=Sum("amount"))["t"] or 0)

    # Por simplicidad, variación mensual fija
    monthly_delta = 0.0

    stats = {
        "cash_today_amount": round(cash_today, 2),
        "monthly_income_amount": round(monthly_income, 2),
        "monthly_income_change_pct": monthly_delta,
        "low_stock_alerts": 0,     # si luego conectas con inventario lo llenas
        "active_employees": 0,     # idem RRHH
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
    # GET: lista sesiones
    if request.method == "GET":
        qs = CashSession.objects.all().order_by("-opened_at")
        ser = CashSessionSerializer(qs, many=True)
        return Response({"items": ser.data})

    # POST: abrir nueva sesión
    opening_amount = request.data.get("opening_amount", 0) or 0
    note = request.data.get("note", "")
    session = CashSession.objects.create(
        user=request.user,
        opening_amount=opening_amount,
        note=note,
        status="OPEN",
    )
    ser = CashSessionSerializer(session)
    return Response(ser.data, status=status.HTTP_201_CREATED)


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
    ser = CashSessionSerializer(session)
    return Response(ser.data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def cash_movements(request, pk):
    try:
        session = CashSession.objects.get(pk=pk)
    except CashSession.DoesNotExist:
        return Response({"detail": "Sesión no encontrada"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        qs = session.movements.all().order_by("date")
        ser = CashMovementSerializer(qs, many=True)
        return Response({"items": ser.data})

    # POST: nuevo movimiento
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
    ser = CashMovementSerializer(mov)
    return Response(ser.data, status=status.HTTP_201_CREATED)


# Stub para exportar PDF de caja (la librería de polling lo usará; aquí solo devolvemos error controlado)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cash_session_export_pdf(request, pk):
    return Response(
        {"success": False, "detail": "Exportación PDF de caja no implementada aún"},
        status=status.HTTP_200_OK,
    )


# ==================
# Estados de cuenta
# ==================

def _auto_fill_concept_name(charge: StudentAccountCharge):
    if charge.concept and not charge.concept_name:
        charge.concept_name = charge.concept.name


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def accounts_statement(request):
    subject_id = request.query_params.get("subject_id")
    subject_type = request.query_params.get("subject_type", "STUDENT")

    if not subject_id:
        return Response({"detail": "subject_id requerido"}, status=status.HTTP_400_BAD_REQUEST)

    charges = list(
        StudentAccountCharge.objects.filter(
            subject_id=subject_id, subject_type=subject_type
        ).order_by("due_date", "created_at")
    )
    payments = list(
        StudentAccountPayment.objects.filter(
            subject_id=subject_id, subject_type=subject_type
        ).order_by("date", "created_at")
    )

    # Ledger combinando cargos y pagos
    ledger = []
    for c in charges:
        ledger.append(
            {
                "date": c.due_date or c.created_at.date(),
                "kind": "CARGO",
                "description": c.concept_name or (c.concept.name if c.concept else "Cargo"),
                "amount": float(c.amount),
                "status": "Pagado" if c.paid else "Pendiente",
            }
        )
    for p in payments:
        ledger.append(
            {
                "date": p.date or p.created_at.date(),
                "kind": "PAGO",
                "description": f"Pago {p.method} {p.ref or ''}".strip(),
                "amount": float(p.amount) * -1,
                "status": "Pago",
            }
        )
    ledger.sort(key=lambda x: (x["date"], x["kind"]))

    resp = {
        "subject_id": subject_id,
        "subject_type": subject_type,
        # Estos campos los puedes conectar luego con tu app académica
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
    # meta = request.data.get("meta")  # por ahora ignorado

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

    # Asignar pago a cargos pendientes en orden
    remaining = float(amount)
    charges = StudentAccountCharge.objects.filter(
        subject_id=subject_id,
        subject_type=subject_type,
        paid=False,
    ).order_by("due_date", "created_at")

    for c in charges:
        if remaining <= 0:
            break
        c_paid = float(c.amount)
        if remaining >= c_paid:
            c.paid = True
            remaining -= c_paid
        c.save()

    # Opcional: usar el primer concepto pendiente como concepto del pago/ingreso
    first_charge = charges.first()
    if first_charge and first_charge.concept:
        payment.concept = first_charge.concept
        payment.save(update_fields=["concept"])

    # Registrar entrada en IncomeEntry
    IncomeEntry.objects.create(
        date=pay_date or date.today(),
        subject_id=subject_id,
        concept=payment.concept,
        concept_name=payment.concept.name if payment.concept else "Pago",
        amount=amount,
    )

    return Response({"id": payment.id}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accounts_statement_export_pdf(request):
    # Stub: el frontend verá success=false y mostrará error controlado
    return Response(
        {"success": False, "detail": "Exportación PDF de estado de cuenta no implementada aún"},
        status=status.HTTP_200_OK,
    )


# ========================
# Conciliación bancaria
# ========================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def bank_accounts(request):
    qs = BankAccount.objects.all().order_by("bank_name", "account_number")
    ser = BankAccountSerializer(qs, many=True)
    return Response({"items": ser.data})


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
    # reconciled lo manejará el frontend (inicialmente false)
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

    qs = BankMovement.objects.filter(
        account_id=account_id,
        date__gte=date_from,
        date__lte=date_to,
    )

    total_reconciled = 0
    mov_map = {m.id: m for m in qs}
    for it in items:
        if it.get("reconciled") and it.get("movement_id") in mov_map:
            total_reconciled += float(mov_map[it["movement_id"].id])

    run = ReconciliationRun.objects.create(
        account_id=account_id,
        date_from=date_from,
        date_to=date_to,
        statement_balance=statement_balance,
        diff=float(statement_balance) - total_reconciled,
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
    return Response(
        {"success": False, "detail": "Exportación PDF de conciliación no implementada aún"},
        status=status.HTTP_200_OK,
    )


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
    return Response(
        {"success": False, "detail": "Exportación PDF de reporte de ingresos no implementada aún"},
        status=status.HTTP_200_OK,
    )


# =====================
# Pagos & e-factura
# =====================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def payments_checkout(request):
    # En la vida real aquí llamas a Izipay / Culqi / etc.
    amount = request.data.get("amount", 0)
    subject_id = request.data.get("subject_id")
    _ = request.data.get("meta", {})

    fake_url = f"https://example.com/pago-sandbox?subject={subject_id}&amount={amount}"
    return Response({"url": fake_url})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def einvoice_issue(request):
    receipt_id = request.data.get("receipt_id")
    return Response(
        {"status": "QUEUED", "receipt_id": receipt_id},
        status=status.HTTP_202_ACCEPTED,
    )
