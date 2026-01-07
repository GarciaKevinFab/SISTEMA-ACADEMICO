from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PeriodsViewSet, CampusesViewSet, ClassroomsViewSet, TeachersViewSet,
    ubigeo_search, ubigeo_departments, ubigeo_provinces, ubigeo_districts,
    institution_settings, institution_media,
    imports_template, imports_start, imports_status,
    backups_collection, backup_download, export_dataset,
)

router = DefaultRouter(trailing_slash=False)
router.register(r"periods", PeriodsViewSet, basename="periods")
router.register(r"campuses", CampusesViewSet, basename="campuses")
router.register(r"classrooms", ClassroomsViewSet, basename="classrooms")
router.register(r"teachers", TeachersViewSet, basename="teachers")

urlpatterns = [
    # CRUD
    path("", include(router.urls)),

    # Ubigeo
    path("ubigeo/search", ubigeo_search),
    path("ubigeo/departments", ubigeo_departments),
    path("ubigeo/provinces", ubigeo_provinces),
    path("ubigeo/districts", ubigeo_districts),

    # Institution
    path("institution/settings", institution_settings),
    path("institution/media", institution_media),

    # Imports
    path("imports/templates/<str:type>", imports_template),
    path("imports/<str:type>", imports_start),
    path("imports/status/<int:jobId>", imports_status),

    # Backups / Export
    path("exports/backups", backups_collection),
    path("exports/backups/<int:id>/download", backup_download),
    path("exports/dataset", export_dataset),
]
