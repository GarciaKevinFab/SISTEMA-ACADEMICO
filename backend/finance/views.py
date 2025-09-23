from django.shortcuts import render

# Create your views here.
from datetime import date
from decimal import Decimal
from django.db.models import Sum, Q
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

from .models import *
from .serializers import *

# --------- Conceptos ---------
class ConceptViewSet(viewsets.ModelViewSet):
    queryset = FinanceConcept.objects.all().order_by("code")
    serializer_class = FinanceConceptSerializer
    http_method_names = ['get','post','patch','delete']

# --------- Estados de cuenta ---------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def account_statement(request):
    subject_id = request.query_params.get("subject_id")
    subject_type = request.query_params.get("subject_type")
    if not subject_id or not subject_type:
        return Response({"detail":"subject_id y subject_type requeridos"}, status=400)
    qs = AccountEntry.objects.filter(subject_id=subject_id, subject_type=subject_type).order_by("date","id")
    items = AccountEntrySerializer(qs, many=True).data
    balance = qs.aggregate(b=Sum("amount"))["b"] or Decimal("0")
    return Response({"items": items, "balance": str(balance)})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def account_charge(request):
    # {subject_id, subject_type, concept_id, amount, due_date, meta}
    payload = request.data or {}
    entry = AccountEntry.objects.create(
        subject_id=payload.get("subject_id"),
        subject_type=payload.get("subject_type"),
        concept_id=payload.get("concept_id"),
        date=payload.get("due_date") or date.today(),
        amount=Decimal(str(payload.get("amount") or "0")),
        meta=payload.get("meta") or {},
    )
    return Response(AccountEntrySerializer(entry).data, status=201)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def account_pay(request):
    # {subject_id, subject_type, amount, method, ref, date}
    payload = request.data or {}
    entry = AccountEntry.objects.create(
        subject_id=payload.get("subject_id"),
        subject_type=payload.get("subject_type"),
        concept=None,
        date=payload.get("date") or date.today(),
        amount=Decimal(str(payload.get("amount") or "0")) * Decimal("-1"),  # pago resta
        method=payload.get("method") or "",
        ref=payload.get("ref") or "",
        meta=payload.get("meta") or {},
    )
    return Response(AccountEntrySerializer(entry).data, status=201)

# --------- Conciliación bancaria ---------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bank_accounts(request):
    data = BankAccountSerializer(BankAccount.objects.all().order_by("name"), many=True).data
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reconciliation_movements(request):
    account_id = request.query_params.get("account_id")
    dfrom = request.query_params.get("date_from")
    dto = request.query_params.get("date_to")
    qs = BankMovement.objects.all()
    if account_id: qs = qs.filter(account_id=account_id)
    if dfrom: qs = qs.filter(date__gte=dfrom)
    if dto: qs = qs.filter(date__lte=dto)
    return Response(BankMovementSerializer(qs.order_by("date","id"), many=True).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reconciliation_save(request):
    # {account_id, date_from, date_to, statement_balance, items:[{movement_id, reconciled}]}
    items = request.data.get("items", [])
    for it in items:
        BankMovement.objects.filter(id=it.get("movement_id")).update(reconciled=bool(it.get("reconciled")))
    return Response({"ok": True})

# --------- Reportes ---------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def report_income(request):
    dfrom = request.query_params.get("date_from")
    dto = request.query_params.get("date_to")
    concept_id = request.query_params.get("concept_id")
    career_id = request.query_params.get("career_id")  # placeholder si luego cruzas con alumnos
    qs = AccountEntry.objects.all()
    if dfrom: qs = qs.filter(date__gte=dfrom)
    if dto: qs = qs.filter(date__lte=dto)
    if concept_id: qs = qs.filter(concept_id=concept_id)
    # Ingresos = pagos (amount negativo) multiplicado por -1
    total = (qs.filter(amount__lt=0).aggregate(s=Sum("amount"))["s"] or Decimal("0")) * Decimal("-1")
    return Response({"total": str(total), "filters": {"date_from": dfrom, "date_to": dto, "concept_id": concept_id, "career_id": career_id}})

# --------- PSP / Checkout ---------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payments_checkout(request):
    # {subject_id, subject_type, amount, currency, meta}
    payload = request.data or {}
    # devolver URL ficticia (en prod: crear sesión en PSP y retornar redirect_url)
    url = f"https://psp.sandbox/checkout?amount={payload.get('amount')}&currency={payload.get('currency','PEN')}"
    return Response({"url": url})

# --------- E-Invoice (stub) ---------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def einvoice_issue(request):
    # {receipt_id}
    return Response({"ok": True, "ticket": "SUNAT-FAKE-TICKET-001"})
