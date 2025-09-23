# backend/courses/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import (
    Career, Course, AcademicPlan, PlanCourse, CoursePrerequisite,
    Section, SectionScheduleSlot,
)

# OJO: estos dos deben existir en tu models.py (los creamos cuando hicimos makemigrations 0004)
from .models import SectionAttendanceSession, AttendanceRow

User = get_user_model()


class CareerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Career
        fields = "__all__"


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = "__all__"

    def validate(self, attrs):
        if attrs.get("credits", 1) <= 0:
            raise serializers.ValidationError({"credits": "Debe ser mayor que 0."})
        if attrs.get("weekly_hours", 1) <= 0:
            raise serializers.ValidationError({"weekly_hours": "Debe ser mayor que 0."})
        return attrs


class AcademicPlanSerializer(serializers.ModelSerializer):
    career = CareerSerializer(read_only=True)
    career_id = serializers.PrimaryKeyRelatedField(
        queryset=Career.objects.all(), source="career", write_only=True
    )

    class Meta:
        model = AcademicPlan
        fields = ["id", "career", "career_id", "name", "code", "year", "is_active", "created_at"]


class PlanCourseSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all(), source="course", write_only=True
    )

    class Meta:
        model = PlanCourse
        fields = ["id", "plan", "course", "course_id", "term"]


class SectionScheduleSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = SectionScheduleSlot
        fields = ["id", "section", "day_of_week", "start_time", "end_time", "classroom"]


class SectionSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all(), source="course", write_only=True
    )
    career = CareerSerializer(read_only=True)
    career_id = serializers.PrimaryKeyRelatedField(
        queryset=Career.objects.all(), source="career", write_only=True, required=False, allow_null=True
    )
    teacher_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="teacher", write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Section
        fields = [
            "id", "course", "course_id", "career", "career_id",
            "period", "code", "teacher_id", "capacity",
            "evaluation_config", "syllabus", "is_active", "created_at"
        ]


# ====================== Asistencia ======================

class SectionAttendanceSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SectionAttendanceSession
        fields = ["id", "section", "date", "topic", "closed", "created_at"]


class AttendanceRowSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceRow
        fields = ["id", "session", "student_id", "present", "note"]
