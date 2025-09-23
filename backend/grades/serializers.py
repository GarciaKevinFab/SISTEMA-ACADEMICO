from rest_framework import serializers
from .models import Grade

class GradeSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField(read_only=True)
    course_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Grade
        fields = [
            "id", "enrollment", "student_name", "course_name",
            "evaluation_type", "score", "weight", "graded_at", "notes"
        ]
        read_only_fields = ["graded_at"]

    def get_student_name(self, obj):
        return f"{obj.enrollment.student.last_name}, {obj.enrollment.student.first_name}"

    def get_course_name(self, obj):
        return f"{obj.enrollment.course.code} - {obj.enrollment.course.name}"

    def validate_score(self, value):
        if value < 0 or value > 20:
            raise serializers.ValidationError("La nota debe estar entre 0 y 20.")
        return value
