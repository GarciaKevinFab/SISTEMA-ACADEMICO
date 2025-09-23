from django.contrib import admin
from .models import Enrollment

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "course", "period", "status", "section", "enrollment_date")
    list_filter = ("status", "period", "section")
    search_fields = (
        "period", "section",
        "student__dni", "student__first_name", "student__last_name",
        "course__code", "course__name",
    )
    autocomplete_fields = ("student", "course")
    ordering = ("-enrollment_date",)
