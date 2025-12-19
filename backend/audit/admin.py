from django.contrib import admin
from .models import AuditLog

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("timestamp","actor_name","action","entity","entity_id","ip","request_id")
    search_fields = ("actor_name","actor_id","action","entity","entity_id","summary","request_id")
    list_filter = ("action","entity")
    date_hierarchy = "timestamp"

    readonly_fields = (
        "timestamp","actor_id","actor_name","action","entity","entity_id",
        "summary","detail","ip","request_id"
    )
