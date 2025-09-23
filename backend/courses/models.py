# backend/courses/models.py
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Career(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.code} - {self.name}"


class Course(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, null=True)
    credits = models.PositiveSmallIntegerField(default=3)
    weekly_hours = models.PositiveSmallIntegerField(default=4)
    semester = models.CharField(max_length=20, blank=True, null=True)  # p.ej. "2025-I"
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = "Course"
        verbose_name_plural = "Courses"

    def __str__(self):
        return f"{self.code} - {self.name}"


class AcademicPlan(models.Model):
    """Malla/plan de estudios por carrera."""
    career = models.ForeignKey(Career, on_delete=models.CASCADE, related_name="plans")
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=20, unique=True)
    year = models.PositiveIntegerField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["career__name", "name"]

    def __str__(self):
        return f"{self.career.code} - {self.name}"


class PlanCourse(models.Model):
    """Asignación de curso dentro del plan (con info opcional)."""
    plan = models.ForeignKey(AcademicPlan, on_delete=models.CASCADE, related_name="plan_courses")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="in_plans")
    term = models.CharField(max_length=20, blank=True, null=True)  # p.ej. "I", "II" o "2025-I"

    class Meta:
        unique_together = ("plan", "course")
        ordering = ["plan_id", "term", "course__name"]


class CoursePrerequisite(models.Model):
    """Prerrequisitos entre cursos."""
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="prerequisites")
    prerequisite = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="is_prerequisite_of")

    class Meta:
        unique_together = ("course", "prerequisite")


class Section(models.Model):
    """Sección/grupo de dictado."""
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="sections")
    career = models.ForeignKey(Career, on_delete=models.SET_NULL, null=True, blank=True, related_name="sections")
    period = models.CharField(max_length=20)  # p.ej. "2025-I"
    code = models.CharField(max_length=20)    # p.ej. "A", "B"
    teacher = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="sections")
    capacity = models.PositiveIntegerField(default=35)
    evaluation_config = models.JSONField(default=list, blank=True)  # [{code,label,weight}]
    syllabus = models.FileField(upload_to="syllabi/", null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("course", "period", "code")
        ordering = ["course__name", "code"]

    def __str__(self):
        return f"{self.course.code}-{self.code} [{self.period}]"


class SectionScheduleSlot(models.Model):
    """Horario de una sección."""
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="schedule")
    day_of_week = models.PositiveSmallIntegerField()  # 1=Lunes ... 7=Domingo
    start_time = models.TimeField()
    end_time = models.TimeField()
    classroom = models.CharField(max_length=60, blank=True, null=True)  # o FK a common.Classroom

    class Meta:
        ordering = ["section_id", "day_of_week", "start_time"]
# ======== Asistencia ========
from django.utils import timezone
from students.models import Student  # usamos Student del app students

class SectionAttendanceSession(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="attendance_sessions")
    date = models.DateField(default=timezone.now)
    number = models.PositiveIntegerField(default=1)  # correlativo 1,2,3...
    is_closed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["section_id", "date", "number"]
        unique_together = ("section", "number")

    def __str__(self):
        return f"Sesión {self.number} - {self.section} ({self.date})"


class AttendanceRow(models.Model):
    class Status(models.TextChoices):
        PRESENT = "P", "Presente"
        ABSENT = "A", "Ausente"
        JUSTIFIED = "J", "Justificado"

    session = models.ForeignKey(SectionAttendanceSession, on_delete=models.CASCADE, related_name="rows")
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    status = models.CharField(max_length=1, choices=Status.choices, default=Status.PRESENT)
    note = models.CharField(max_length=250, blank=True, null=True)

    class Meta:
        unique_together = ("session", "student")
        ordering = ["student_id"]
