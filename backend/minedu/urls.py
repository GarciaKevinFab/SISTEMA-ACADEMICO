from django.urls import path

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

app_name = "minedu"

urlpatterns = [
    # Dashboard
    path("dashboard/stats", DashboardStatsView.as_view(), name="dashboard-stats"),

    # Exports
    path("export/enrollments", EnqueueEnrollmentsExportView.as_view(), name="export-enrollments"),
    path("export/grades", EnqueueGradesExportView.as_view(), name="export-grades"),
    path("exports", ExportBatchListView.as_view(), name="exports-list"),
    path("exports/<int:pk>/retry", ExportBatchRetryView.as_view(), name="exports-retry"),

    # Validation
    path("validation/data-integrity", DataIntegrityValidationView.as_view(), name="validation-data-integrity"),

    # Catalogs
    path("catalogs/remote", RemoteCatalogView.as_view(), name="catalogs-remote"),
    path("catalogs/local", LocalCatalogView.as_view(), name="catalogs-local"),

    # Mappings
    path("mappings", CatalogMappingsView.as_view(), name="mappings-list"),
    path("mappings/bulk", CatalogMappingsBulkSaveView.as_view(), name="mappings-bulk"),

    # Jobs
    path("jobs", JobListCreateView.as_view(), name="jobs-list-create"),
    path("jobs/<int:pk>", JobUpdateView.as_view(), name="jobs-update"),
    path("jobs/<int:pk>/run", JobRunNowView.as_view(), name="jobs-run-now"),
    path("jobs/<int:pk>/pause", JobPauseView.as_view(), name="jobs-pause"),
    path("jobs/<int:pk>/resume", JobResumeView.as_view(), name="jobs-resume"),
    path("jobs/<int:pk>/runs", JobRunsListView.as_view(), name="jobs-runs"),
    path("jobs/runs/<int:run_id>/retry", JobRunRetryView.as_view(), name="jobs-runs-retry"),
    path("jobs/runs/<int:run_id>/logs", JobRunLogsView.as_view(), name="jobs-runs-logs"),
]
