from rest_framework import serializers
from .models import Period, Campus, Classroom, Teacher, InstitutionSettings
from courses.models import Career  # <-- Career viene de courses

class PeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = Period
        fields = "__all__"


class CampusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campus
        fields = "__all__"


class ClassroomSerializer(serializers.ModelSerializer):
    campus_name = serializers.CharField(source="campus.name", read_only=True)

    class Meta:
        model = Classroom
        fields = ["id", "code", "name", "capacity", "campus", "campus_name", "is_active"]


class TeacherSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = [
            "id", "first_name", "last_name", "full_name",
            "document_type", "document_number", "email", "phone", "is_active"
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


class InstitutionSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstitutionSettings
        fields = "__all__"


# ========= NUEVO: Career =========
class CareerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Career
        fields = ["id", "code", "name", "is_active", "created_at"]
