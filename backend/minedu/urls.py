from django.urls import path
from .views import *

urlpatterns = [
    # Stats
    path('dashboard/stats', dashboard_stats),

    # Exports
    path('export/enrollments', export_enqueue_enrollments),
    path('export/grades', export_enqueue_grades),
    path('exports', exports_list),
    path('exports/<int:exportId>/retry', export_retry),

    # Validation
    path('validation/data-integrity', validation_integrity),

    # Catalogs
    path('catalogs/remote', catalogs_remote),
    path('catalogs/local', catalogs_local),

    # Mapping
    path('mappings', mappings_list),              # GET ?type=
    path('mappings/bulk', mappings_bulk_save),    # POST {type, mappings[]}

    # Jobs
    path('jobs', jobs_list),                      # GET
    path('jobs', jobs_create),                    # POST (nota: Django no diferencia; si quieres separarlo, usa views distintas o revisa routers)
    path('jobs/<int:id>', jobs_update),           # PATCH
    path('jobs/<int:id>/run', jobs_run_now),      # POST
    path('jobs/<int:id>/pause', jobs_pause),      # POST
    path('jobs/<int:id>/resume', jobs_resume),    # POST
    path('jobs/<int:id>/runs', jobs_runs),        # GET
    path('jobs/runs/<int:runId>/retry', jobs_retry_run),  # POST

    # Logs
    path('jobs/runs/<int:runId>/logs', logs_for_run),     # GET
]
