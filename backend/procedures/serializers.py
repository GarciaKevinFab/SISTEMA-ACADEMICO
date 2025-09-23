from rest_framework import serializers
from django.utils import timezone
from .models import Procedure

class ProcedureSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Procedure
        fields = [
            "id", "tracking_code",
            "student", "student_name",
            "procedure_type", "description",
            "status", "submitted_at", "resolved_at",
            "notes", "created_at"
        ]
        read_only_fields = ["submitted_at", "resolved_at", "created_at", "tracking_code"]

    def get_student_name(self, obj):
        return f"{obj.student.last_name}, {obj.student.first_name}"

    def validate(self, attrs):
        # Validaciones simples de flujo
        status_ = attrs.get("status") or getattr(self.instance, "status", Procedure.Status.PENDING)
        if self.instance:
            # Si se marca como DELIVERED/APPROVED/REJECTED, puede poner resolved_at
            if status_ in [Procedure.Status.APPROVED, Procedure.Status.REJECTED, Procedure.Status.DELIVERED] and not self.instance.resolved_at:
                # no seteamos aquí resolved_at para no sorprender; lo hace la acción de view
                pass
        return attrs
