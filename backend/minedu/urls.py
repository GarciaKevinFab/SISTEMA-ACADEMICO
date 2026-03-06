from django.urls import re_path
from .views import (
    DashboardStatsView,
    # Exportaciones
    ExportGenerateView,
    ExportBatchListView,
    ExportBatchRetryView,
    ExportBatchDownloadView,
    # Validación
    DataIntegrityValidationView,
    # Códigos MINEDU (CRUD)
    MineduCodeListCreateView,
    MineduCodeDeleteView,
    # Catálogos
    RemoteCatalogView,
    LocalCatalogView,
    # Mapeos
    CatalogMappingsView,
    CatalogMappingsBulkSaveView,
    # Jobs
    JobListCreateView,
    JobUpdateView,
    JobRunNowView,
    JobPauseView,
    JobResumeView,
    JobRunsListView,
    JobRunRetryView,
    JobRunLogsView,
)

urlpatterns = [
    # Dashboard
    re_path(r"^dashboard/stats/?$", DashboardStatsView.as_view()),

    # Exportaciones (endpoint unificado)
    re_path(r"^export/generate/?$", ExportGenerateView.as_view()),
    re_path(r"^exports/?$", ExportBatchListView.as_view()),
    re_path(r"^exports/(?P<pk>\d+)/retry/?$", ExportBatchRetryView.as_view()),
    re_path(r"^exports/(?P<pk>\d+)/download/?$", ExportBatchDownloadView.as_view()),

    # Validación
    re_path(r"^validation/data-integrity/?$", DataIntegrityValidationView.as_view()),

    # Códigos MINEDU (admin registra manualmente)
    re_path(r"^codes/?$", MineduCodeListCreateView.as_view()),
    re_path(r"^codes/(?P<pk>\d+)/?$", MineduCodeDeleteView.as_view()),

    # Catálogos (local = datos reales BD, remote = códigos MineduCode)
    re_path(r"^catalogs/remote/?$", RemoteCatalogView.as_view()),
    re_path(r"^catalogs/local/?$", LocalCatalogView.as_view()),

    # Mapeos
    re_path(r"^mappings/?$", CatalogMappingsView.as_view()),
    re_path(r"^mappings/bulk/?$", CatalogMappingsBulkSaveView.as_view()),

    # Jobs
    re_path(r"^jobs/?$", JobListCreateView.as_view()),
    re_path(r"^jobs/(?P<pk>\d+)/?$", JobUpdateView.as_view()),
    re_path(r"^jobs/(?P<pk>\d+)/run/?$", JobRunNowView.as_view()),
    re_path(r"^jobs/(?P<pk>\d+)/pause/?$", JobPauseView.as_view()),
    re_path(r"^jobs/(?P<pk>\d+)/resume/?$", JobResumeView.as_view()),
    re_path(r"^jobs/(?P<pk>\d+)/runs/?$", JobRunsListView.as_view()),
    re_path(r"^jobs/runs/(?P<run_id>\d+)/retry/?$", JobRunRetryView.as_view()),
    re_path(r"^jobs/runs/(?P<run_id>\d+)/logs/?$", JobRunLogsView.as_view()),
]