"""
research/models.py
Módulo de Investigación – IESPP Gustavo Allende Llavería
"""
from django.db import models
from django.conf import settings


# ─────────────────────────────────────────────
# Catálogos básicos
# ─────────────────────────────────────────────
class ResearchLine(models.Model):
    """Línea de investigación institucional."""
    name = models.CharField("Nombre", max_length=160)
    description = models.TextField("Descripción", blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Línea de investigación"
        verbose_name_plural = "Líneas de investigación"

    def __str__(self):
        return self.name


class Advisor(models.Model):
    """Asesor / docente investigador."""
    full_name = models.CharField("Nombre completo", max_length=160)
    email = models.EmailField(blank=True, default="")
    specialty = models.CharField("Especialidad", max_length=120, blank=True, default="")
    orcid = models.CharField("ORCID", max_length=40, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["full_name"]
        verbose_name = "Asesor"
        verbose_name_plural = "Asesores"

    def __str__(self):
        return self.full_name


# ─────────────────────────────────────────────
# Proyectos de investigación
# ─────────────────────────────────────────────
class Project(models.Model):
    STATUS_CHOICES = [
        ("DRAFT", "Borrador"),
        ("IN_REVIEW", "En revisión"),
        ("APPROVED", "Aprobado"),
        ("REJECTED", "Rechazado"),
        ("RUNNING", "En ejecución"),
        ("ON_HOLD", "Suspendido"),
        ("FINISHED", "Finalizado"),
    ]

    title = models.CharField("Título", max_length=220)
    line = models.ForeignKey(
        ResearchLine, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="projects",
    )
    # Asesor principal (FK simple)
    advisor = models.ForeignKey(
        Advisor, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="projects_as_main",
    )
    # Co-asesores (M2M) — FIX: el frontend envía advisors_ids para set()
    advisors = models.ManyToManyField(
        Advisor, blank=True, related_name="projects_as_advisor",
        verbose_name="Co-asesores",
    )
    summary = models.TextField("Resumen", blank=True, default="")
    status = models.CharField(
        "Estado", max_length=20, default="DRAFT", choices=STATUS_CHOICES,
    )
    start_date = models.DateField("Fecha inicio", null=True, blank=True)
    end_date = models.DateField("Fecha fin", null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "Proyecto de investigación"
        verbose_name_plural = "Proyectos de investigación"

    def __str__(self):
        return self.title


# ─────────────────────────────────────────────
# Cronograma
# ─────────────────────────────────────────────
class ScheduleItem(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="schedule",
    )
    name = models.CharField(max_length=160)
    start = models.DateField()
    end = models.DateField()
    progress = models.PositiveIntegerField(default=0)  # 0‥100
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["start", "end", "id"]

    def __str__(self):
        return f"{self.name} ({self.project_id})"


# ─────────────────────────────────────────────
# Entregables
# ─────────────────────────────────────────────
class Deliverable(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pendiente"),
        ("SUBMITTED", "Entregado"),
        ("APPROVED", "Aprobado"),
        ("REJECTED", "Rechazado"),
    ]

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="deliverables",
    )
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True, default="")
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default="PENDING", choices=STATUS_CHOICES)
    file = models.FileField(upload_to="research/deliverables/", null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date", "id"]

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────
# Evaluaciones de proyecto
# ─────────────────────────────────────────────
class Evaluation(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="evaluations",
    )
    evaluator = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    rubric = models.JSONField(default=dict, blank=True)  # {scores, comment, total}
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Eval #{self.id} – Proy #{self.project_id}"


# ─────────────────────────────────────────────
# Equipo de investigación
# ─────────────────────────────────────────────
class TeamMember(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="team",
    )
    full_name = models.CharField(max_length=160)
    role = models.CharField(max_length=80)
    dedication_pct = models.PositiveIntegerField(default=0)
    email = models.EmailField(blank=True, default="")
    orcid = models.CharField(max_length=40, blank=True, default="")
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.full_name} ({self.role})"


# ─────────────────────────────────────────────
# Presupuesto
# ─────────────────────────────────────────────
class BudgetItem(models.Model):
    CATEGORY_CHOICES = [
        ("EQUIPMENT", "Equipamiento"),
        ("SUPPLIES", "Materiales"),
        ("TRAVEL", "Viáticos"),
        ("SERVICES", "Servicios"),
        ("PERSONNEL", "Personal"),
        ("OTHER", "Otros"),
    ]

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="budget_items",
    )
    category = models.CharField(max_length=80)
    concept = models.CharField(max_length=160)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    executed = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    receipt = models.FileField(upload_to="research/budget/", null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.concept} ({self.category})"


# ─────────────────────────────────────────────
# Ética & Propiedad Intelectual
# ─────────────────────────────────────────────
class EthicsIP(models.Model):
    project = models.OneToOneField(
        Project, on_delete=models.CASCADE, related_name="ethics_ip",
    )
    ethics = models.JSONField(default=dict, blank=True)
    # { status, committee, approval_code, approval_date }
    ethics_doc = models.FileField(upload_to="research/ethics/", null=True, blank=True)
    ip = models.JSONField(default=dict, blank=True)
    # { status, type, registry_code, holder }
    ip_doc = models.FileField(upload_to="research/ip/", null=True, blank=True)

    class Meta:
        verbose_name = "Ética y PI"
        verbose_name_plural = "Ética y PI"

    def __str__(self):
        return f"EthicsIP – Proy #{self.project_id}"


# ─────────────────────────────────────────────
# Publicaciones
# ─────────────────────────────────────────────
class Publication(models.Model):
    TYPE_CHOICES = [
        ("ARTICLE", "Artículo"),
        ("BOOK", "Libro"),
        ("CHAPTER", "Capítulo"),
        ("CONFERENCE", "Conferencia"),
        ("THESIS", "Tesis"),
        ("OTHER", "Otro"),
    ]

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="publications",
    )
    type = models.CharField(max_length=40, choices=TYPE_CHOICES)
    title = models.CharField(max_length=300)
    journal = models.CharField(max_length=200, blank=True, default="")
    year = models.PositiveIntegerField(null=True, blank=True)
    doi = models.CharField(max_length=120, blank=True, default="")
    link = models.URLField(blank=True, default="")
    indexed = models.BooleanField(default=False)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-year", "title"]

    def __str__(self):
        return self.title


# ─────────────────────────────────────────────
# Convocatorias / Postulaciones / Revisión
# ─────────────────────────────────────────────
class Call(models.Model):
    code = models.CharField(max_length=40, unique=True)
    title = models.CharField(max_length=220)
    start_date = models.DateField()
    end_date = models.DateField()
    budget_cap = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    description = models.TextField(blank=True, default="")
    # FIX: Almacenar rúbrica personalizada de la convocatoria
    rubric_template = models.JSONField(
        default=list, blank=True,
        help_text="Rúbrica de evaluación: [{code, label, weight}, ...]",
    )

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.code} – {self.title}"


class Proposal(models.Model):
    STATUS_CHOICES = [
        ("DRAFT", "Borrador"),
        ("SUBMITTED", "Enviada"),
        ("REVIEWED", "Revisada"),
        ("ACCEPTED", "Aceptada"),
        ("REJECTED", "Rechazada"),
    ]

    call = models.ForeignKey(Call, on_delete=models.CASCADE, related_name="proposals")
    title = models.CharField(max_length=220)
    line = models.ForeignKey(
        ResearchLine, null=True, blank=True, on_delete=models.SET_NULL,
    )
    team = models.JSONField(default=list, blank=True)  # [{full_name, role, email}]
    summary = models.TextField(blank=True, default="")
    budget = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, default="DRAFT", choices=STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class ProposalReview(models.Model):
    proposal = models.ForeignKey(
        Proposal, on_delete=models.CASCADE, related_name="reviews",
    )
    reviewer_id = models.IntegerField()  # referencia a Users (ID externo)
    rubric = models.JSONField(default=dict, blank=True)  # {scores, comment, total}
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Review #{self.id} – Prop #{self.proposal_id}"