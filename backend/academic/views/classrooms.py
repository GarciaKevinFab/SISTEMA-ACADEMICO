"""
Vistas para manejo de Aulas (Classrooms)
────────────────────────────────────────
Lee desde catalogs.Classroom (fuente real) para que las aulas
creadas en el panel de catálogos aparezcan en los dropdowns
de secciones.  El resolver sigue creando academic.Classroom
al momento de guardar la sección.
"""
from rest_framework import viewsets, permissions
from rest_framework_simplejwt.authentication import JWTAuthentication

from catalogs.models import Classroom as CatalogClassroom
from academic.models import Classroom as AcademicClassroom
from .utils import ok


class ClassroomsViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    # No usamos serializer porque construimos la respuesta manualmente
    queryset = CatalogClassroom.objects.select_related("campus").all()

    def list(self, request, *args, **kwargs):
        """
        Retorna aulas de catalogs.Classroom (fuente primaria) +
        cualquier academic.Classroom huérfana (legacy).
        """
        # ── Aulas de catálogos (fuente real) ──
        cat_rooms = (
            CatalogClassroom.objects
            .select_related("campus")
            .order_by("campus__name", "code")
        )

        seen_codes = set()
        classrooms = []

        for cr in cat_rooms:
            campus_prefix = ""
            if cr.campus and getattr(cr.campus, "code", ""):
                campus_prefix = f"{cr.campus.code}-"
            full_code = f"{campus_prefix}{cr.code}"
            campus_name = cr.campus.name if cr.campus else ""

            display = f"{cr.code}"
            if cr.name and cr.name != cr.code:
                display = f"{cr.code} · {cr.name}"
            if campus_name:
                display = f"{campus_name} — {display}"

            seen_codes.add(full_code)
            classrooms.append({
                "id": cr.id,
                "code": full_code,
                "name": cr.name or cr.code,
                "capacity": cr.capacity or 30,
                "campus": campus_name,
                "display_label": f"{display} (cap. {cr.capacity or 30})",
            })

        # ── Aulas de academic.Classroom que no tengan equivalente en catálogos ──
        for ar in AcademicClassroom.objects.all():
            if ar.code not in seen_codes:
                classrooms.append({
                    "id": f"acad_{ar.id}",
                    "code": ar.code,
                    "name": ar.code,
                    "capacity": ar.capacity or 30,
                    "campus": "",
                    "display_label": f"{ar.code} (cap. {ar.capacity or 30})",
                })

        return ok(classrooms=classrooms)
