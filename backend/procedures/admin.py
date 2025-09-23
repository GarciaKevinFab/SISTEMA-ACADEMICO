from django.contrib import admin
from .models import Procedure

@admin.register(Procedure)
class ProcedureAdmin(admin.ModelAdmin):
    list_display = ("id", "tracking_code", "student", "procedure_type", "status", "submitted_at", "resolved_at")
    list_filter = ("status", "procedure_type")
    search_fields = (
        "tracking_code",
        "student__dni", "student__first_name", "student__last_name",
        "description",
    )
    ordering = ("-submitted_at",)
    autocomplete_fields = ("student",)
