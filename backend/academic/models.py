# backend/academic/models.py
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.db.models import Q
from catalogs.models import Career


# ══════════════════════════════════════════════════════════════
#  CURSOS Y PLANES
# ══════════════════════════════════════════════════════════════

class Course(models.Model):
    code    = models.CharField(max_length=20, unique=True)
    name    = models.CharField(max_length=160)
    credits = models.PositiveSmallIntegerField(default=3)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name}"


class Plan(models.Model):
    career      = models.ForeignKey(Career, on_delete=models.CASCADE, related_name="plans")
    name        = models.CharField(max_length=120)
    start_year  = models.PositiveSmallIntegerField(default=2025)
    end_year    = models.PositiveSmallIntegerField(default=2025)
    semesters   = models.PositiveSmallIntegerField(default=10)
    description = models.TextField(blank=True, default="")
    is_deleted  = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["career", "start_year", "end_year"],
                condition=Q(is_deleted=False),
                name="uniq_plan_by_career_year_range",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.start_year}-{self.end_year})"


class PlanCourse(models.Model):
    TYPE_CHOICES = [
        ("MANDATORY", "Obligatorio"),
        ("ELECTIVE",  "Electivo"),
    ]

    plan         = models.ForeignKey(Plan,   on_delete=models.CASCADE, related_name="plan_courses")
    course       = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="in_plans")
    semester     = models.PositiveSmallIntegerField(default=1)
    weekly_hours = models.PositiveSmallIntegerField(default=3)
    type         = models.CharField(max_length=15, choices=TYPE_CHOICES, default="MANDATORY")

    # Overrides por malla
    display_code = models.CharField(max_length=20,  blank=True, default="")
    display_name = models.CharField(max_length=160, blank=True, default="")
    credits      = models.PositiveSmallIntegerField(default=3)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["plan", "display_code"],
                condition=~Q(display_code=""),
                name="uniq_plan_display_code",
            ),
            models.UniqueConstraint(
                fields=["plan", "course"],
                name="uniq_plan_course",
            ),
        ]

    @property
    def effective_code(self) -> str:
        return self.display_code or self.course.code

    @property
    def effective_name(self) -> str:
        return self.display_name or self.course.name

    def __str__(self):
        return f"{self.plan.name}: {self.effective_code} - {self.effective_name} (S{self.semester})"


class CoursePrereq(models.Model):
    plan_course  = models.ForeignKey(PlanCourse, on_delete=models.CASCADE, related_name="prereqs")
    prerequisite = models.ForeignKey(PlanCourse, on_delete=models.CASCADE, related_name="required_for")

    class Meta:
        unique_together = [("plan_course", "prerequisite")]


# ══════════════════════════════════════════════════════════════
#  INFRAESTRUCTURA
# ══════════════════════════════════════════════════════════════

class Classroom(models.Model):
    code     = models.CharField(max_length=40, unique=True)
    capacity = models.PositiveSmallIntegerField(default=30)

    def __str__(self):
        return f"{self.code} (cap {self.capacity})"


class Teacher(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="academic_teachers",
        null=True, blank=True,
    )

    def __str__(self):
        if self.user:
            full = (self.user.get_full_name() or "").strip() if hasattr(self.user, "get_full_name") else ""
            return full or getattr(self.user, "full_name", "") or self.user.username
        return f"Teacher #{self.id}"


# ══════════════════════════════════════════════════════════════
#  SECCIONES
# ══════════════════════════════════════════════════════════════

class Section(models.Model):
    plan_course = models.ForeignKey(PlanCourse, on_delete=models.CASCADE,  related_name="sections")
    teacher     = models.ForeignKey(Teacher,    on_delete=models.SET_NULL,  null=True, blank=True)
    classroom   = models.ForeignKey(Classroom,  on_delete=models.SET_NULL,  null=True, blank=True)
    label       = models.CharField(max_length=20, default="A")
    period      = models.CharField(max_length=20, default="2025-I")
    capacity    = models.PositiveSmallIntegerField(default=30)

    class Meta:
        indexes = [models.Index(fields=["period"])]

    def __str__(self):
        return f"{self.plan_course.course.code} {self.label} ({self.period})"


class SectionScheduleSlot(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="schedule_slots")
    weekday = models.PositiveSmallIntegerField()  # 1..7
    start   = models.TimeField()
    end     = models.TimeField()


# ══════════════════════════════════════════════════════════════
#  PERÍODO ACADÉMICO — núcleo del sistema de ventanas
# ══════════════════════════════════════════════════════════════

class AcademicPeriod(models.Model):
    """
    Representa un semestre académico y gestiona las ventanas de matrícula.

    Estados posibles:
      FREE         → Sin fechas configuradas (acceso libre, sin bloqueo)
      OPEN         → Dentro del período ordinario
      EXTEMPORARY  → Dentro del período extemporáneo (con recargo)
      CLOSED       → Fuera de ambas ventanas (matrícula bloqueada)
    """

    STATUS_FREE        = "FREE"
    STATUS_OPEN        = "OPEN"
    STATUS_EXTEMPORARY = "EXTEMPORARY"
    STATUS_CLOSED      = "CLOSED"

    code  = models.CharField(max_length=20, unique=True)  # ej: 2026-I
    start = models.DateField()
    end   = models.DateField()

    # ── Ventana ordinaria ──────────────────────────────────────
    enrollment_start = models.DateTimeField(null=True, blank=True)
    enrollment_end   = models.DateTimeField(null=True, blank=True)

    # ── Ventana extemporánea ───────────────────────────────────
    extemporary_start     = models.DateTimeField(null=True, blank=True)
    extemporary_end       = models.DateTimeField(null=True, blank=True)
    extemporary_surcharge = models.DecimalField(
        max_digits=8, decimal_places=2, default=0,
        help_text="Recargo por matrícula extemporánea (soles)",
    )

    class Meta:
        ordering = ["-code"]

    def __str__(self):
        return self.code

    # ── Estado ────────────────────────────────────────────────

    def enrollment_status(self, now=None) -> str:
        now = now or timezone.now()

        if not self.enrollment_start or not self.enrollment_end:
            return self.STATUS_FREE

        if self.enrollment_start <= now <= self.enrollment_end:
            return self.STATUS_OPEN

        if (
            self.extemporary_start
            and self.extemporary_end
            and self.extemporary_start <= now <= self.extemporary_end
        ):
            return self.STATUS_EXTEMPORARY

        return self.STATUS_CLOSED

    def is_enrollment_open(self, now=None) -> bool:
        """True si la matrícula está permitida (FREE, OPEN o EXTEMPORARY)."""
        return self.enrollment_status(now) != self.STATUS_CLOSED

    def window_info(self, now=None) -> dict:
        """
        Serializa el estado de ventana listo para el frontend.
        Compatible con EnrollmentComponent.jsx (windowInfo).
        """
        now    = now or timezone.now()
        status = self.enrollment_status(now)
        return {
            "status":                status,
            "is_open":               status != self.STATUS_CLOSED,
            "enrollment_start":      self.enrollment_start.isoformat()   if self.enrollment_start  else None,
            "enrollment_end":        self.enrollment_end.isoformat()     if self.enrollment_end    else None,
            "extemporary_start":     self.extemporary_start.isoformat()  if self.extemporary_start else None,
            "extemporary_end":       self.extemporary_end.isoformat()    if self.extemporary_end   else None,
            "extemporary_surcharge": float(self.extemporary_surcharge),
        }

    # ── Helpers de clase ──────────────────────────────────────

    @classmethod
    def get_or_none(cls, code: str):
        try:
            return cls.objects.get(code=code)
        except cls.DoesNotExist:
            return None

    @classmethod
    def get_status_for_period(cls, code: str, now=None) -> str:
        """Estado de ventana para un código. Devuelve FREE si el período no existe."""
        obj = cls.get_or_none(code)
        return obj.enrollment_status(now) if obj else cls.STATUS_FREE

    @classmethod
    def is_open_for_period(cls, code: str, now=None) -> bool:
        return cls.get_status_for_period(code, now) != cls.STATUS_CLOSED


# ══════════════════════════════════════════════════════════════
#  MATRÍCULA
# ══════════════════════════════════════════════════════════════

class Enrollment(models.Model):
    STATUS_DRAFT     = "DRAFT"
    STATUS_CONFIRMED = "CONFIRMED"
    STATUS_CANCELLED = "CANCELLED"

    STATUS_CHOICES = [
        (STATUS_DRAFT,     "Borrador"),
        (STATUS_CONFIRMED, "Confirmada"),
        (STATUS_CANCELLED, "Anulada"),
    ]

    student       = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="enrollments")
    period        = models.CharField(max_length=20)
    status        = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    total_credits = models.PositiveSmallIntegerField(default=0)
    created_at    = models.DateTimeField(auto_now_add=True)
    confirmed_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("student", "period")]
        indexes = [
            models.Index(fields=["student", "period"]),
            models.Index(fields=["period", "status"]),
        ]

    def __str__(self):
        return f"Enrollment {self.student_id} / {self.period} [{self.status}]"

    @property
    def is_confirmed(self) -> bool:
        return self.status == self.STATUS_CONFIRMED

    @property
    def is_active(self) -> bool:
        return self.status in (self.STATUS_DRAFT, self.STATUS_CONFIRMED)

    def confirm(self):
        """Confirma la matrícula y registra la fecha."""
        self.status      = self.STATUS_CONFIRMED
        self.confirmed_at = timezone.now()
        self.save(update_fields=["status", "confirmed_at"])

    def cancel(self):
        """Anula la matrícula."""
        self.status = self.STATUS_CANCELLED
        self.save(update_fields=["status"])


class EnrollmentItem(models.Model):
    enrollment  = models.ForeignKey(Enrollment, on_delete=models.CASCADE,  related_name="items")
    plan_course = models.ForeignKey(PlanCourse, on_delete=models.PROTECT)
    section     = models.ForeignKey(Section,    on_delete=models.PROTECT,   null=True, blank=True)
    credits     = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = [("enrollment", "plan_course")]


# ══════════════════════════════════════════════════════════════
#  EVALUACIÓN / ASISTENCIA / DOCUMENTOS
# ══════════════════════════════════════════════════════════════

class Syllabus(models.Model):
    section = models.OneToOneField(Section, on_delete=models.CASCADE, related_name="syllabus")
    file    = models.FileField(upload_to="syllabus/")


class EvaluationConfig(models.Model):
    section = models.OneToOneField(Section, on_delete=models.CASCADE, related_name="evaluation")
    config  = models.JSONField(default=list)


class AttendanceSession(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="attendance_sessions")
    date    = models.DateField(default=timezone.now)
    closed  = models.BooleanField(default=False)


class AttendanceRow(models.Model):
    session    = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name="rows")
    student_id = models.IntegerField()
    status     = models.CharField(max_length=10)


class SectionGrades(models.Model):
    section      = models.OneToOneField(Section, on_delete=models.CASCADE, related_name="grades_bundle")
    grades       = models.JSONField(default=dict)
    submitted    = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(null=True, blank=True)
    updated_at   = models.DateTimeField(auto_now=True)


# ══════════════════════════════════════════════════════════════
#  PROCESOS ACADÉMICOS
# ══════════════════════════════════════════════════════════════

class AcademicProcess(models.Model):
    kind       = models.CharField(max_length=60)
    student_id = models.IntegerField()
    status     = models.CharField(max_length=20, default="PENDIENTE")
    note       = models.TextField(blank=True, default="")


class ProcessFile(models.Model):
    process = models.ForeignKey(AcademicProcess, on_delete=models.CASCADE, related_name="files")
    file    = models.FileField(upload_to="process_files/")
    note    = models.CharField(max_length=200, blank=True, default="")


# ══════════════════════════════════════════════════════════════
#  REGISTROS DE NOTAS
# ══════════════════════════════════════════════════════════════

class AcademicGradeRecord(models.Model):
    student     = models.ForeignKey("students.Student", on_delete=models.CASCADE,  related_name="grade_records")
    course      = models.ForeignKey(Course,      on_delete=models.CASCADE,  related_name="grade_records")
    plan_course = models.ForeignKey(PlanCourse,  on_delete=models.PROTECT,  null=True, blank=True, related_name="grade_records")
    term        = models.CharField(max_length=20)
    final_grade = models.DecimalField(max_digits=5, decimal_places=2)
    components  = models.JSONField(default=dict, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)


# ══════════════════════════════════════════════════════════════
#  CONFIGURACIÓN INSTITUCIONAL
# ══════════════════════════════════════════════════════════════

class InstitutionSettings(models.Model):
    name                      = models.CharField(max_length=200, blank=True, default="")
    ruc                       = models.CharField(max_length=20,  blank=True, default="")
    address                   = models.CharField(max_length=250, blank=True, default="")
    website                   = models.CharField(max_length=120, blank=True, default="")
    email                     = models.CharField(max_length=120, blank=True, default="")
    phone                     = models.CharField(max_length=40,  blank=True, default="")
    passing_grade             = models.DecimalField(max_digits=5, decimal_places=2, default=11)
    max_credits_normal        = models.PositiveSmallIntegerField(default=22)
    min_credits_normal        = models.PositiveSmallIntegerField(default=12)
    max_credits_third_attempt = models.PositiveSmallIntegerField(default=11)
    logo_url                  = models.CharField(max_length=500, blank=True, default="")
    signature_url             = models.CharField(max_length=500, blank=True, default="")
    updated_at                = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"InstitutionSettings #{self.id}"