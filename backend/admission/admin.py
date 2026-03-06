from django.contrib import admin
from admission.models import InstitutionSetting


@admin.register(InstitutionSetting)
class InstitutionSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value", "file", "updated_at")
    search_fields = ("key",)