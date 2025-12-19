# minedu/urls.py
from django.urls import re_path
from .views import (
    DashboardStatsView,
    EnqueueEnrollmentsExportView,
    EnqueueGradesExportView,
    ExportBatchListView,
    ExportBatchRetryView,
    DataIntegrityValidationView,
    RemoteCatalogView,
    LocalCatalogView,
    CatalogMappingsView,
    CatalogMappingsBulkSaveView,
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
    re_path(r"^dashboard/stats/?$", DashboardStatsView.as_view()),

    re_path(r"^export/enrollments/?$", EnqueueEnrollmentsExportView.as_view()),
    re_path(r"^export/grades/?$", EnqueueGradesExportView.as_view()),
    re_path(r"^exports/?$", ExportBatchListView.as_view()),
    re_path(r"^exports/(?P<pk>\d+)/retry/?$", ExportBatchRetryView.as_view()),

    re_path(r"^validation/data-integrity/?$", DataIntegrityValidationView.as_view()),

    re_path(r"^catalogs/remote/?$", RemoteCatalogView.as_view()),
    re_path(r"^catalogs/local/?$", LocalCatalogView.as_view()),

    re_path(r"^mappings/?$", CatalogMappingsView.as_view()),
    re_path(r"^mappings/bulk/?$", CatalogMappingsBulkSaveView.as_view()),

    re_path(r"^jobs/?$", JobListCreateView.as_view()),
    re_path(r"^jobs/(?P<pk>\d+)/?$", JobUpdateView.as_view()),
    re_path(r"^jobs/(?P<pk>\d+)/run/?$", JobRunNowView.as_view()),
    re_path(r"^jobs/(?P<pk>\d+)/pause/?$", JobPauseView.as_view()),
    re_path(r"^jobs/(?P<pk>\d+)/resume/?$", JobResumeView.as_view()),
    re_path(r"^jobs/(?P<pk>\d+)/runs/?$", JobRunsListView.as_view()),
    re_path(r"^jobs/runs/(?P<run_id>\d+)/retry/?$", JobRunRetryView.as_view()),
    re_path(r"^jobs/runs/(?P<run_id>\d+)/logs/?$", JobRunLogsView.as_view()),
]
