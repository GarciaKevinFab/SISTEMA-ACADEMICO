from django.contrib import admin

from .models import JefeLinea, Personal, PersonalCVItem


@admin.register(JefeLinea)
class JefeLineaAdmin(admin.ModelAdmin):
    list_display = ("orden", "letra", "cargo", "teacher", "activo")
    list_filter = ("activo",)
    search_fields = ("cargo", "resolucion", "teacher__full_name")


class PersonalCVItemInline(admin.TabularInline):
    model = PersonalCVItem
    extra = 0


@admin.register(Personal)
class PersonalAdmin(admin.ModelAdmin):
    list_display = ("nombre_completo", "tipo", "cargo", "document", "activo")
    list_filter = ("tipo", "activo", "condicion_laboral")
    search_fields = ("full_name", "nombres", "apellido_paterno",
                     "apellido_materno", "document", "cargo")
    inlines = [PersonalCVItemInline]
