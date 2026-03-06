from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    PeriodsViewSet, CampusesViewSet, ClassroomsViewSet, TeachersViewSet,
    ubigeo_search, ubigeo_departments, ubigeo_provinces, ubigeo_districts,
    institution_settings, institution_media, institution_media_delete,
    imports_template, imports_start, imports_status,
    backups_collection, backup_download, backup_delete, export_dataset, backups_cleanup,
    egresados_list, egresados_stats, egresados_update, egresados_export,
)

router = DefaultRouter(trailing_slash=False)
router.register(r"periods", PeriodsViewSet, basename="periods")
router.register(r"campuses", CampusesViewSet, basename="campuses")
router.register(r"classrooms", ClassroomsViewSet, basename="classrooms")
router.register(r"teachers", TeachersViewSet, basename="teachers")

urlpatterns = [
    # CRUD viewsets
    path("", include(router.urls)),

    # Ubigeo
    path("ubigeo/search", ubigeo_search),
    path("ubigeo/departments", ubigeo_departments),
    path("ubigeo/provinces", ubigeo_provinces),
    path("ubigeo/districts", ubigeo_districts),

    # Institution
    path("institution/settings", institution_settings),
    path("institution/media", institution_media),
    path("institution/media/<str:kind>", institution_media_delete),

    # Imports
    path("imports/templates/<str:type>", imports_template),
    path("imports/<str:type>", imports_start),
    path("imports/status/<int:jobId>", imports_status),
    
    # Egresados
    path("egresados", egresados_list),
    path("egresados/stats", egresados_stats),
    path("egresados/export", egresados_export),
    path("egresados/<int:pk>", egresados_update),

    # Backups / Export
    path("exports/backups", backups_collection),                 # GET list / POST create
    path("exports/backups/<int:id>", backup_delete),            # DELETE
    path("exports/backups/<int:id>/download", backup_download), # GET blob
    path("exports/backups/cleanup", backups_cleanup),           # POST cleanup
    path("exports/dataset", export_dataset),                    # POST dataset => creates backup + returns download url
]
