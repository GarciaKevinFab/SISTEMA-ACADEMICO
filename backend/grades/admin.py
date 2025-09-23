from django.contrib import admin
from .models import Grade

@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ("id", "enrollment", "evaluation_type", "score", "weight", "graded_at")
    list_filter = ("evaluation_type",)
    search_fields = (
        "enrollment__student__dni",
        "enrollment__student__first_name",
        "enrollment__student__last_name",
        "enrollment__course__code",
        "enrollment__course__name",
    )
    autocomplete_fields = ("enrollment",)
    ordering = ("-graded_at",)
