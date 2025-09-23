from django.db import models

class Enrollment(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        ACTIVE = "ACTIVE", "Activa"
        DROPPED = "DROPPED", "Retirada"
        COMPLETED = "COMPLETED", "Completada"

    student = models.ForeignKey(
        "students.Student",
        on_delete=models.PROTECT,
        related_name="enrollments",
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.PROTECT,
        related_name="enrollments",
    )
    period = models.CharField(max_length=20, help_text="p.ej. 2025-I")
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.PENDING,
    )
    section = models.CharField(max_length=10, blank=True, null=True)
    enrollment_date = models.DateField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Enrollment"
        verbose_name_plural = "Enrollments"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "course", "period"],
                name="uniq_student_course_period",
            )
        ]

    def __str__(self):
        return f"{self.student} → {self.course} [{self.period}]"
