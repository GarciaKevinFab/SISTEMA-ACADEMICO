from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register(r'catalogs/periods', PeriodsViewSet, basename='periods')
router.register(r'catalogs/campuses', CampusesViewSet, basename='campuses')
router.register(r'catalogs/classrooms', ClassroomsViewSet, basename='classrooms')
router.register(r'catalogs/teachers', TeachersViewSet, basename='teachers')

urlpatterns = [
    path('', include(router.urls)),

    # Ubigeo
    path('ubigeo/search', ubigeo_search),
    path('ubigeo/departments', ubigeo_departments),
    path('ubigeo/provinces', ubigeo_provinces),
    path('ubigeo/districts', ubigeo_districts),

    # Institution
    path('institution/settings', institution_settings),        # GET, PATCH
    path('institution/media', institution_media),              # POST multipart (file, kind)

    # Imports
    path('imports/templates/<str:type>', imports_template),    # GET (descarga)
    path('imports/<str:type>', imports_start),                 # POST (multipart: file, mapping?)
    path('imports/status/<int:jobId>', imports_status),        # GET

    # Backups / Export
    path('exports/backups', backups_collection),               # GET list / POST create
    path('exports/backups/<int:id>/download', backup_download),
    path('exports/dataset', export_dataset),                   # POST {dataset}
]
