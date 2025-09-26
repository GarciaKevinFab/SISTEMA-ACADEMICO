from django.conf import settings

# Create your models here.
from django.db import models
from django.contrib.auth import get_user_model
User = get_user_model()

class Career(models.Model):
    name = models.CharField(max_length=120)

class Course(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=160)
    credits = models.PositiveSmallIntegerField(default=3)

class Plan(models.Model):
    career = models.ForeignKey(Career, on_delete=models.CASCADE, related_name='plans')
    name = models.CharField(max_length=120)
    year = models.PositiveSmallIntegerField()

class PlanCourse(models.Model):
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name='plan_courses')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='in_plans')
    semester = models.PositiveSmallIntegerField(default=1)

class CoursePrereq(models.Model):
    plan_course = models.ForeignKey(PlanCourse, on_delete=models.CASCADE, related_name='prereqs')
    prerequisite = models.ForeignKey(Course, on_delete=models.CASCADE)

class Classroom(models.Model):
    code = models.CharField(max_length=40, unique=True)
    capacity = models.PositiveSmallIntegerField(default=30)

class Teacher(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='academic_teachers',   # 👈 nombre único
        null=True, blank=True
    )

class Section(models.Model):
    plan_course = models.ForeignKey(PlanCourse, on_delete=models.CASCADE, related_name='sections')
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True)
    classroom = models.ForeignKey(Classroom, on_delete=models.SET_NULL, null=True, blank=True)
    label = models.CharField(max_length=20, default='A')

class SectionScheduleSlot(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='schedule_slots')
    weekday = models.PositiveSmallIntegerField()  # 1..7
    start = models.TimeField()
    end   = models.TimeField()

class AcademicPeriod(models.Model):
    code = models.CharField(max_length=20, unique=True)  # p.e. 2025-I
    start = models.DateField()
    end   = models.DateField()

class Syllabus(models.Model):
    section = models.OneToOneField(Section, on_delete=models.CASCADE, related_name='syllabus')
    file = models.FileField(upload_to='syllabus/')

class EvaluationConfig(models.Model):
    section = models.OneToOneField(Section, on_delete=models.CASCADE, related_name='evaluation')
    config = models.JSONField(default=list)  # [{code,label,weight}, ...]

class AttendanceSession(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='attendance_sessions')
    date = models.DateField(auto_now_add=True)
    closed = models.BooleanField(default=False)

class AttendanceRow(models.Model):
    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name='rows')
    student_id = models.IntegerField()       # <-- reemplaza por FK cuando tengas Student
    status = models.CharField(max_length=10) # 'P','T','A', etc.

class AcademicProcess(models.Model):
    # retiro / reserva / convalidación / traslado / reincorporación
    kind = models.CharField(max_length=20)
    student_id = models.IntegerField()
    status = models.CharField(max_length=20, default='PENDIENTE')
    note = models.TextField(blank=True, default='')

class ProcessFile(models.Model):
    process = models.ForeignKey(AcademicProcess, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to='process_files/')
    note = models.CharField(max_length=200, blank=True, default='')
