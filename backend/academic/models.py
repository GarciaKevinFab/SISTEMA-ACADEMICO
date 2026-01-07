# backend/academic/models.py
from django.conf import settings
from django.db import models
from django.utils import timezone


class Career(models.Model):
    name = models.CharField(max_length=120)

    def __str__(self):
        return self.name


class Course(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=160)
    credits = models.PositiveSmallIntegerField(default=3)

    def __str__(self):
        return f"{self.code} - {self.name}"


class Plan(models.Model):
    career = models.ForeignKey(Career, on_delete=models.CASCADE, related_name='plans')
    name = models.CharField(max_length=120)

    start_year = models.PositiveSmallIntegerField(default=2025)
    semesters = models.PositiveSmallIntegerField(default=10)
    description = models.TextField(blank=True, default="")

    def __str__(self):
        return f"{self.name} ({self.start_year})"


class PlanCourse(models.Model):
    TYPE_CHOICES = [
        ("MANDATORY", "Obligatorio"),
        ("ELECTIVE", "Electivo"),
    ]

    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name='plan_courses')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='in_plans')
    semester = models.PositiveSmallIntegerField(default=1)

    weekly_hours = models.PositiveSmallIntegerField(default=3)
    type = models.CharField(max_length=15, choices=TYPE_CHOICES, default="MANDATORY")

    class Meta:
        unique_together = [("plan", "course")]

    def __str__(self):
        return f"{self.plan.name}: {self.course.code} (S{self.semester})"


class CoursePrereq(models.Model):
    plan_course = models.ForeignKey(PlanCourse, on_delete=models.CASCADE, related_name='prereqs')
    prerequisite = models.ForeignKey(PlanCourse, on_delete=models.CASCADE, related_name='required_for')

    class Meta:
        unique_together = [("plan_course", "prerequisite")]


class Classroom(models.Model):
    code = models.CharField(max_length=40, unique=True)
    capacity = models.PositiveSmallIntegerField(default=30)

    def __str__(self):
        return f"{self.code} (cap {self.capacity})"


class Teacher(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='academic_teachers',
        null=True, blank=True
    )

    def __str__(self):
        if self.user:
            full = (self.user.get_full_name() or "").strip() if hasattr(self.user, "get_full_name") else ""
            return full or getattr(self.user, "full_name", "") or self.user.username
        return f"Teacher #{self.id}"


class Section(models.Model):
    plan_course = models.ForeignKey(PlanCourse, on_delete=models.CASCADE, related_name='sections')
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True)
    classroom = models.ForeignKey(Classroom, on_delete=models.SET_NULL, null=True, blank=True)
    label = models.CharField(max_length=20, default='A')

    period = models.CharField(max_length=20, default="2025-I")
    capacity = models.PositiveSmallIntegerField(default=30)

    def __str__(self):
        return f"{self.plan_course.course.code} {self.label} ({self.period})"


class SectionScheduleSlot(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='schedule_slots')
    weekday = models.PositiveSmallIntegerField()  # 1..7
    start = models.TimeField()
    end   = models.TimeField()


class AcademicPeriod(models.Model):
    code = models.CharField(max_length=20, unique=True)
    start = models.DateField()
    end   = models.DateField()


class Syllabus(models.Model):
    section = models.OneToOneField(Section, on_delete=models.CASCADE, related_name='syllabus')
    file = models.FileField(upload_to='syllabus/')


class EvaluationConfig(models.Model):
    section = models.OneToOneField(Section, on_delete=models.CASCADE, related_name='evaluation')
    config = models.JSONField(default=list)


class AttendanceSession(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='attendance_sessions')
    date = models.DateField(default=timezone.now)  # ✅ ahora aceptará fecha via backend
    closed = models.BooleanField(default=False)


class AttendanceRow(models.Model):
    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name='rows')
    student_id = models.IntegerField()
    status = models.CharField(max_length=10)


class SectionGrades(models.Model):
    section = models.OneToOneField(Section, on_delete=models.CASCADE, related_name="grades_bundle")
    grades = models.JSONField(default=dict)  # {student_id:{PARCIAL_1:..., ...}}
    submitted = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class AcademicProcess(models.Model):
    kind = models.CharField(max_length=20)
    student_id = models.IntegerField()
    status = models.CharField(max_length=20, default='PENDIENTE')
    note = models.TextField(blank=True, default='')


class ProcessFile(models.Model):
    process = models.ForeignKey(AcademicProcess, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to='process_files/')
    note = models.CharField(max_length=200, blank=True, default='')
