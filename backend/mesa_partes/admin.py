from django.contrib import admin
from .models import Office, ProcedureType, Procedure, ProcedureEvent, ProcedureFile

@admin.register(Office)
class OfficeAdmin(admin.ModelAdmin):
    list_display = ("id", "name")

@admin.register(ProcedureType)
class ProcedureTypeAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "processing_days", "cost", "is_active")
    list_filter = ("is_active",)

class ProcedureFileInline(admin.TabularInline):
    model = ProcedureFile
    extra = 0

class ProcedureEventInline(admin.TabularInline):
    model = ProcedureEvent
    extra = 0
    readonly_fields = ("at", "type", "description", "actor")

@admin.register(Procedure)
class ProcedureAdmin(admin.ModelAdmin):
    list_display = ("id", "tracking_code", "procedure_type", "applicant_name", "status", "created_at")
    list_filter = ("status", "procedure_type")
    search_fields = ("tracking_code", "applicant_name", "applicant_document")
    inlines = [ProcedureEventInline, ProcedureFileInline]
