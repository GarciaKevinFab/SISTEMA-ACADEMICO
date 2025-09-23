from django.db import models

class Grade(models.Model):
    class EvaluationType(models.TextChoices):
        EXAM = "EXAM", "Examen"
        ASSIGNMENT = "ASSIGNMENT", "Tarea"
        QUIZ = "QUIZ", "Quiz"
        PROJECT = "PROJECT", "Proyecto"
        FINAL = "FINAL", "Examen Final"

    enrollment = models.ForeignKey(
        "enrollment.Enrollment",
        on_delete=models.CASCADE,
        related_name="grades"
    )
    evaluation_type = models.CharField(
        max_length=20,
        choices=EvaluationType.choices,
        default=EvaluationType.EXAM
    )
    score = models.DecimalField(max_digits=5, decimal_places=2)
    weight = models.DecimalField(
        max_digits=4, decimal_places=2, default=1.0,
        help_text="Peso en el cálculo de nota final (1.0 = 100%)"
    )
    graded_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Grade"
        verbose_name_plural = "Grades"
        ordering = ["-graded_at"]

    def __str__(self):
        return f"{self.enrollment.student} - {self.enrollment.course} ({self.evaluation_type}: {self.score})"
