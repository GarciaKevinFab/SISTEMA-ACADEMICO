from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("id",)
    list_display = ("id", "username", "email", "full_name", "is_active", "is_staff")
    search_fields = ("username", "email", "full_name")

    fieldsets = (
        (None, {"fields": ("username", "email", "password", "full_name")}),
        ("Estado", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Roles", {"fields": ("roles",)}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("username", "email", "full_name", "password1", "password2", "is_staff", "is_superuser", "is_active"),
        }),
    )
