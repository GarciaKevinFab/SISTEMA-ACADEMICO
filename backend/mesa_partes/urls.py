# mesa_partes/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OfficeView, UsersCatalogView,
    ProcedureTypeViewSet, ProcedureViewSet,
    dashboard_stats,
    procedures_summary, procedures_report_sla, procedures_report_volume,  # ver §2
    public_create, public_upload_file, public_track,
)

router = DefaultRouter(trailing_slash=False)
router.register(r"offices", OfficeView, basename="office")
router.register(r"users", UsersCatalogView, basename="users")
router.register(r"procedure-types", ProcedureTypeViewSet, basename="ptype")
router.register(r"procedures", ProcedureViewSet, basename="procedure")

urlpatterns = [
    # REST routes: /api/offices, /api/procedures, etc.
    path("", include(router.urls)),

    # Dashboard
    path("dashboard/stats/", dashboard_stats, name="dashboard-stats"),

    # Reportes (ver §2 para sus vistas)
    path("procedures/reports/summary/", procedures_summary, name="proc-summary"),
    path("procedures/reports/sla.xlsx", procedures_report_sla, name="proc-sla"),
    path("procedures/reports/volume.xlsx", procedures_report_volume, name="proc-volume"),

    # Público
    path("public/procedures", public_create, name="public-create"),
    path("public/procedures/<str:code>/files", public_upload_file, name="public-upload"),
    path("public/procedures/track", public_track, name="public-track"),
]
