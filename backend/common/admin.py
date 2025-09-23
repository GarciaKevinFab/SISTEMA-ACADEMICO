from django.contrib import admin
from .models import Period, Campus, Classroom, Teacher, InstitutionSettings

@admin.register(Period)
class PeriodAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "start_date", "end_date", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "label")

@admin.register(Campus)
class CampusAdmin(admin.ModelAdmin):
    list_display = ("name", "short_name", "address", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "short_name", "address")

@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "campus", "capacity", "is_active")
    list_filter = ("campus", "is_active")
    search_fields = ("code", "name", "campus__name")

@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ("last_name", "first_name", "document_type", "document_number", "email", "is_active")
    list_filter = ("is_active", "document_type")
    search_fields = ("first_name", "last_name", "document_number", "email")

@admin.register(InstitutionSettings)
class InstitutionSettingsAdmin(admin.ModelAdmin):
    list_display = ("short_name", "ruc", "updated_at")
