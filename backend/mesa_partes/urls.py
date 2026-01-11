# mesa_partes/urls.py
from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter

from .views import (
    OfficeView, UsersCatalogView,
    ProcedureTypeViewSet, ProcedureViewSet,
    dashboard_stats,
    procedures_summary, procedures_report_sla, procedures_report_volume,
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

    # Dashboard (acepta / y sin /)
    re_path(r"^dashboard/stats/?$", dashboard_stats, name="dashboard-stats"),

    # Reportes (acepta / y sin /)
    re_path(r"^procedures/reports/summary/?$", procedures_summary, name="proc-summary"),
    re_path(r"^procedures/reports/sla\.xlsx/?$", procedures_report_sla, name="proc-sla"),
    re_path(r"^procedures/reports/volume\.xlsx/?$", procedures_report_volume, name="proc-volume"),

    # Público (acepta / y sin /)
    re_path(r"^public/procedures/?$", public_create, name="public-create"),
    re_path(r"^public/procedures/(?P<code>[^/]+)/files/?$", public_upload_file, name="public-upload"),
    re_path(r"^public/procedures/track/?$", public_track, name="public-track"),
]
