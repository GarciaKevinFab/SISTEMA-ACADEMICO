from rest_framework import serializers
from .models import Enrollment
from students.models import Student
from courses.models import Course

class EnrollmentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField(read_only=True)
    course_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            "id", "student", "student_name",
            "course", "course_name",
            "period", "status", "section",
            "enrollment_date", "notes", "created_at"
        ]
        read_only_fields = ["enrollment_date", "created_at"]

    def get_student_name(self, obj):
        return f"{obj.student.last_name}, {obj.student.first_name}"

    def get_course_name(self, obj):
        return f"{obj.course.code} - {obj.course.name}"

    def validate(self, attrs):
        # Evitar duplicado (por si no entra el UniqueConstraint aún)
        student = attrs.get("student") or getattr(self.instance, "student", None)
        course = attrs.get("course") or getattr(self.instance, "course", None)
        period = attrs.get("period") or getattr(self.instance, "period", None)

        if student and course and period:
            qs = Enrollment.objects.filter(student=student, course=course, period=period)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"non_field_errors": ["El estudiante ya está matriculado en este curso para ese periodo."]}
                )
        # Ejemplo extra: no permitir matricular si el curso está inactivo
        if course and hasattr(course, "is_active") and not course.is_active:
            raise serializers.ValidationError({"course": "El curso está inactivo."})

        return attrs
