from django.contrib import admin
from .models import Course

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name", "credits", "weekly_hours", "semester", "is_active", "created_at")
    list_filter = ("is_active", "semester")
    search_fields = ("code", "name")
    ordering = ("name",)
