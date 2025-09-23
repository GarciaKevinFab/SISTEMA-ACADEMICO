# backend/accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Security', {'fields': ('mfa_enabled',)}),
    )
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'is_active', 'mfa_enabled')
    list_filter = BaseUserAdmin.list_filter + ('mfa_enabled',)
