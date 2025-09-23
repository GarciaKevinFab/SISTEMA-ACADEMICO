from django.contrib import admin
from .models import Student

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("id", "dni", "first_name", "last_name", "email", "created_at")
    search_fields = ("dni", "first_name", "last_name", "email")
