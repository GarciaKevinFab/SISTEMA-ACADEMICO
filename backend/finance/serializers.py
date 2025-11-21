from rest_framework import serializers
from .models import (
    Concept,
    BankAccount,
    CashSession,
    CashMovement,
    StudentAccountCharge,
    StudentAccountPayment,
    BankMovement,
    ReconciliationRun,
    ReconciliationItem,
    IncomeEntry,
)


class ConceptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Concept
        fields = ["id", "code", "name", "type", "default_amount"]


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = ["id", "bank_name", "account_number", "currency"]


class CashSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashSession
        fields = [
            "id",
            "opening_amount",
            "closing_amount",
            "note",
            "status",
            "opened_at",
            "closed_at",
        ]


class CashMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashMovement
        fields = ["id", "session", "type", "amount", "concept", "date"]


class StudentAccountChargeSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentAccountCharge
        fields = [
            "id",
            "subject_id",
            "subject_type",
            "concept",
            "concept_name",
            "amount",
            "due_date",
            "paid",
        ]


class StudentAccountPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentAccountPayment
        fields = [
            "id",
            "subject_id",
            "subject_type",
            "amount",
            "method",
            "ref",
            "date",
            "concept",
            "career_id",
        ]


class BankMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankMovement
        fields = ["id", "account", "date", "description", "amount"]


class ReconciliationRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReconciliationRun
        fields = ["id", "account", "date_from", "date_to", "statement_balance", "diff"]


class ReconciliationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReconciliationItem
        fields = ["id", "run", "movement", "reconciled"]


class IncomeEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomeEntry
        fields = [
            "id",
            "date",
            "subject_id",
            "concept",
            "concept_name",
            "career_id",
            "career_name",
            "amount",
        ]
