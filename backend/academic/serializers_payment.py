# backend/academic/serializers_payment.py
"""
Serializers para EnrollmentPayment (pago de matrícula).
"""
from rest_framework import serializers
from .models import EnrollmentPayment


class EnrollmentPaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_dni = serializers.SerializerMethodField()
    student_career = serializers.SerializerMethodField()
    voucher_url = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = EnrollmentPayment
        fields = [
            "id", "student", "period",
            "amount", "discount_tag", "surcharge", "total",
            "channel", "operation_code",
            "voucher_url", "voucher_name",
            "status", "reviewer", "reviewer_name", "reviewed_at",
            "rejection_note",
            "created_at", "updated_at",
            # computed
            "student_name", "student_dni", "student_career",
        ]
        read_only_fields = [
            "id", "status", "reviewer", "reviewed_at", "rejection_note",
            "created_at", "updated_at",
        ]

    def get_student_name(self, obj):
        st = obj.student
        parts = [
            getattr(st, "apellido_paterno", "") or "",
            getattr(st, "apellido_materno", "") or "",
            getattr(st, "nombres", "") or "",
        ]
        full = " ".join(p for p in parts if p).strip()
        return full or getattr(st, "num_documento", str(st.id))

    def get_student_dni(self, obj):
        return getattr(obj.student, "num_documento", "")

    def get_student_career(self, obj):
        return getattr(obj.student, "programa_carrera", "")

    def get_voucher_url(self, obj):
        if obj.voucher:
            try:
                return obj.voucher.url
            except Exception:
                return ""
        return ""

    def get_total(self, obj):
        return float(obj.amount + obj.surcharge)

    def get_reviewer_name(self, obj):
        if obj.reviewer:
            full = getattr(obj.reviewer, "full_name", "") or ""
            return full.strip() or obj.reviewer.username
        return ""


class EnrollmentPaymentUploadSerializer(serializers.Serializer):
    period = serializers.CharField(max_length=20)
    channel = serializers.ChoiceField(choices=EnrollmentPayment.CHANNEL_CHOICES)
    operation_code = serializers.CharField(max_length=60, required=False, allow_blank=True)
    voucher = serializers.FileField()

    def validate_voucher(self, value):
        # Max 5 MB
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("El archivo no puede superar 5 MB.")
        # Tipos permitidos
        allowed = [
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "application/pdf",
        ]
        if value.content_type not in allowed:
            raise serializers.ValidationError(
                "Solo se permiten imágenes (JPG, PNG, WebP) o PDF."
            )
        return value
