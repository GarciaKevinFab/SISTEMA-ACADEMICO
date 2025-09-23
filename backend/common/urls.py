# backend/common/urls.py
from django.urls import path, include
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter

from .views import (
    AcademicPeriodViewSet, CampusViewSet, ClassroomViewSet, TeacherViewSet,
    institution_settings_view, institution_media_upload,
    ubigeo_search, ubigeo_departments, ubigeo_provinces, ubigeo_districts,
    catalog_careers,          # catálogo liviano de carreras
    academic_periods,         # <-- NUEVO: alias requerido por el front
)

router = DefaultRouter()
# Catálogos usados por el frontend
router.register(r"catalogs/periods", AcademicPeriodViewSet, basename="periods")
router.register(r"catalogs/campuses", CampusViewSet, basename="campuses")
router.register(r"catalogs/classrooms", ClassroomViewSet, basename="classrooms")
router.register(r"catalogs/teachers", TeacherViewSet, basename="teachers")

# Aliases directos que también usa el UI
router.register(r"teachers", TeacherViewSet, basename="teachers-alias")
router.register(r"classrooms", ClassroomViewSet, basename="classrooms-alias")

def health_check(request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path("", include(router.urls)),

    # ===== Aliases pedidos por el frontend =====
    path("academic/periods", academic_periods, name="academic-periods"),  # <-- AQUÍ

    # Catálogo liviano de carreras (para combos)
    path("catalogs/careers", catalog_careers, name="catalogs-careers"),

    # Institution settings / media
    path("institution/settings", institution_settings_view, name="institution-settings"),
    path("institution/media", institution_media_upload, name="institution-media"),

    # Ubigeo mínimos (stubs)
    path("ubigeo/search", ubigeo_search, name="ubigeo-search"),
    path("ubigeo/departments", ubigeo_departments, name="ubigeo-deps"),
    path("ubigeo/provinces", ubigeo_provinces, name="ubigeo-provs"),
    path("ubigeo/districts", ubigeo_districts, name="ubigeo-dists"),

    # Health
    path("health/", health_check, name="health"),
]
# --- NUEVO: endpoints de Reportes Oficiales (PDF con polling) ---
from .views import (
    report_boleta_grades_start,
    report_constancia_enrollment_start,
    report_kardex_start,
    report_job_status,
    report_job_download,
)

urlpatterns += [
    # inicia jobs (POST) → 202 {job_id}
    path("reports/boletas/grades", report_boleta_grades_start, name="rep-boleta-start"),
    path("reports/constancias/enrollment", report_constancia_enrollment_start, name="rep-constancia-start"),
    path("reports/kardex", report_kardex_start, name="rep-kardex-start"),

    # polling + descarga
    path("reports/jobs/<str:job_id>", report_job_status, name="rep-job-status"),
    path("reports/jobs/<str:job_id>/download", report_job_download, name="rep-job-dl"),
]
# Alias que pide academic.service: /academic/periods
from .views import academic_periods_alias

urlpatterns += [
    path("academic/periods", academic_periods_alias, name="academic-periods-alias"),
]
