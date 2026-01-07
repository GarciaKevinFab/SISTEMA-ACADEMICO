# backend/admission/serializers.py
from rest_framework import serializers
from .models import (
    AdmissionCall,
    AdmissionScheduleItem,
    Applicant,
    Application,
    ApplicationDocument,
    Payment,
    EvaluationScore,
    AdmissionParam,
    Career,
)

class AdmissionCallSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionCall
        fields = "__all__"


class AdmissionScheduleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionScheduleItem
        fields = "__all__"


class ApplicantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Applicant
        fields = "__all__"


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = "__all__"


class ApplicationDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationDocument
        fields = ["id", "application", "document_type", "file", "status", "note"]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"


class EvaluationScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationScore
        fields = "__all__"


class AdmissionParamSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionParam
        fields = ["id", "data"]


class CareerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Career
        fields = "__all__"
