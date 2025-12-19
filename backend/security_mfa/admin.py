from django.contrib import admin
from .models import UserMFA

@admin.register(UserMFA)
class UserMFAAdmin(admin.ModelAdmin):
    list_display = ("user", "enabled")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("user",)
