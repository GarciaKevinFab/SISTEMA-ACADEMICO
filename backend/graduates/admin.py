from django.contrib import admin

from .models import Graduate


@admin.register(Graduate)
class GraduateAdmin(admin.ModelAdmin):
    list_display = [
        "apellidos_nombres",
        "dni",
        "especialidad",
        "anio_egreso",
        "fecha_sustentacion",
        "tiene_constancia_display",
        "is_active",
    ]
    list_filter = [
        "especialidad",
        "anio_egreso",
        "is_active",
    ]
    search_fields = [
        "apellidos_nombres",
        "dni",
    ]
    list_editable = [
        "is_active",
    ]
    list_per_page = 50
    ordering = ["apellidos_nombres"]

    fieldsets = (
        (
            "Datos Personales",
            {
                "fields": ("dni", "apellidos_nombres"),
            },
        ),
        (
            "Datos Académicos",
            {
                "fields": (
                    "grado_titulo",
                    "especialidad",
                    "nivel",
                    "anio_ingreso",
                    "anio_egreso",
                    "fecha_sustentacion",
                ),
            },
        ),
        (
            "Datos del Diploma / Constancia",
            {
                "fields": (
                    "resolucion_acta",
                    "codigo_diploma",
                ),
                "description": "Estos campos se llenan desde la PLANTILLA_VERIFICADOR. "
                "Son necesarios para que aparezca el botón de descarga de constancia.",
            },
        ),
        (
            "Datos Institucionales",
            {
                "fields": (
                    "director_general",
                    "secretario_academico",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Control",
            {
                "fields": ("is_active",),
            },
        ),
    )

    readonly_fields = ["created_at", "updated_at"]

    def tiene_constancia_display(self, obj):
        return "✅" if obj.tiene_constancia else "—"

    tiene_constancia_display.short_description = "Constancia"

    actions = ["activate_selected", "deactivate_selected"]

    @admin.action(description="✅ Activar seleccionados")
    def activate_selected(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f"{updated} egresado(s) activado(s).")

    @admin.action(description="❌ Desactivar seleccionados")
    def deactivate_selected(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"{updated} egresado(s) desactivado(s).")