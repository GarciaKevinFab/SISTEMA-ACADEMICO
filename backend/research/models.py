# Create your models here.
from django.db import models

# --------- Catálogos básicos ---------
class ResearchLine(models.Model):
    name = models.CharField(max_length=160)

class Advisor(models.Model):
    full_name = models.CharField(max_length=160)
    email = models.EmailField(blank=True, default='')

# --------- Proyectos ---------
class Project(models.Model):
    title = models.CharField(max_length=220)
    line = models.ForeignKey(ResearchLine, null=True, blank=True, on_delete=models.SET_NULL)
    advisor = models.ForeignKey(Advisor, null=True, blank=True, on_delete=models.SET_NULL)
    summary = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, default='DRAFT')  # DRAFT|APPROVED|REJECTED|RUNNING|FINISHED
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

# Cronograma
class ScheduleItem(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='schedule')
    name = models.CharField(max_length=160)
    start = models.DateField()
    end = models.DateField()
    progress = models.PositiveIntegerField(default=0)  # 0..100
    meta = models.JSONField(default=dict, blank=True)

# Entregables
class Deliverable(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='deliverables')
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True, default='')
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default='PENDING')  # PENDING|SUBMITTED|APPROVED|REJECTED
    file = models.FileField(upload_to='research/deliverables/', null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

# Evaluaciones
class Evaluation(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='evaluations')
    rubric = models.JSONField(default=dict, blank=True)  # {scores, comment, total}
    created_at = models.DateTimeField(auto_now_add=True)

# Equipo
class TeamMember(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='team')
    full_name = models.CharField(max_length=160)
    role = models.CharField(max_length=80)
    dedication_pct = models.PositiveIntegerField(default=0)
    email = models.EmailField(blank=True, default='')
    orcid = models.CharField(max_length=40, blank=True, default='')
    meta = models.JSONField(default=dict, blank=True)

# Presupuesto
class BudgetItem(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='budget_items')
    category = models.CharField(max_length=80)  # p.e., EQUIPMENT, SUPPLIES, TRAVEL
    concept = models.CharField(max_length=160)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    executed = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    receipt = models.FileField(upload_to='research/budget/', null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

# Ética & Propiedad Intelectual
class EthicsIP(models.Model):
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='ethics_ip')
    ethics = models.JSONField(default=dict, blank=True)  # { status, committee, approval_code, approval_date }
    ethics_doc = models.FileField(upload_to='research/ethics/', null=True, blank=True)
    ip = models.JSONField(default=dict, blank=True)      # { status, type, registry_code, holder }
    ip_doc = models.FileField(upload_to='research/ip/', null=True, blank=True)

# Publicaciones
class Publication(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='publications')
    type = models.CharField(max_length=40)  # ARTICLE|BOOK|CHAPTER|CONFERENCE...
    title = models.CharField(max_length=300)
    journal = models.CharField(max_length=200, blank=True, default='')
    year = models.PositiveIntegerField(null=True, blank=True)
    doi = models.CharField(max_length=120, blank=True, default='')
    link = models.URLField(blank=True, default='')
    indexed = models.BooleanField(default=False)
    meta = models.JSONField(default=dict, blank=True)

# Convocatorias / Postulaciones / Revisión
class Call(models.Model):
    code = models.CharField(max_length=40, unique=True)
    title = models.CharField(max_length=220)
    start_date = models.DateField()
    end_date = models.DateField()
    budget_cap = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    description = models.TextField(blank=True, default='')

class Proposal(models.Model):
    call = models.ForeignKey(Call, on_delete=models.CASCADE, related_name='proposals')
    title = models.CharField(max_length=220)
    line = models.ForeignKey(ResearchLine, null=True, blank=True, on_delete=models.SET_NULL)
    team = models.JSONField(default=list, blank=True)  # [{full_name, role, email}]
    summary = models.TextField(blank=True, default='')
    budget = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, default='DRAFT')  # DRAFT|SUBMITTED|REVIEWED
    created_at = models.DateTimeField(auto_now_add=True)

class ProposalReview(models.Model):
    proposal = models.ForeignKey(Proposal, on_delete=models.CASCADE, related_name='reviews')
    reviewer_id = models.IntegerField()  # referencia a Users (ID externo)
    rubric = models.JSONField(default=dict, blank=True)  # {scores, comment, total}
    created_at = models.DateTimeField(auto_now_add=True)
