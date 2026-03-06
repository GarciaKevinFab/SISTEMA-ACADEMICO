"""
research/admin.py
"""
from django.contrib import admin
from .models import (
    ResearchLine, Advisor, Project, ScheduleItem, Deliverable,
    Evaluation, TeamMember, BudgetItem, EthicsIP, Publication,
    Call, Proposal, ProposalReview,
)


@admin.register(ResearchLine)
class ResearchLineAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(Advisor)
class AdvisorAdmin(admin.ModelAdmin):
    list_display = ("id", "full_name", "email", "specialty", "is_active")
    list_filter = ("is_active",)
    search_fields = ("full_name", "email")


class ScheduleInline(admin.TabularInline):
    model = ScheduleItem
    extra = 0


class DeliverableInline(admin.TabularInline):
    model = Deliverable
    extra = 0


class TeamMemberInline(admin.TabularInline):
    model = TeamMember
    extra = 0


class BudgetItemInline(admin.TabularInline):
    model = BudgetItem
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "line", "advisor", "status", "start_date", "end_date")
    list_filter = ("status", "line")
    search_fields = ("title", "summary")
    raw_id_fields = ("line", "advisor", "created_by")
    readonly_fields = ("created_at", "updated_at")
    inlines = [ScheduleInline, DeliverableInline, TeamMemberInline, BudgetItemInline]


@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = ("id", "project", "created_at")
    raw_id_fields = ("project",)


@admin.register(EthicsIP)
class EthicsIPAdmin(admin.ModelAdmin):
    list_display = ("id", "project")
    raw_id_fields = ("project",)


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "type", "journal", "year", "indexed")
    list_filter = ("type", "indexed", "year")
    search_fields = ("title", "journal", "doi")
    raw_id_fields = ("project",)


@admin.register(Call)
class CallAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "title", "start_date", "end_date", "budget_cap")
    search_fields = ("code", "title")


class ProposalReviewInline(admin.TabularInline):
    model = ProposalReview
    extra = 0


@admin.register(Proposal)
class ProposalAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "call", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("title",)
    raw_id_fields = ("call", "line")
    inlines = [ProposalReviewInline]