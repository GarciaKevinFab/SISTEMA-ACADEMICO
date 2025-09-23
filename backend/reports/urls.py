from django.urls import path
from .views import *

urlpatterns = [
    # Catálogos mínimos
    path('catalogs/periods', catalog_periods),
    path('catalogs/careers', catalog_careers),
    path('catalogs/sections', catalog_sections),
    path('catalogs/courses', catalog_courses),
    path('students/search', students_search),

    # PDFs oficiales (POST -> 202 -> polling)
    path('reports/actas/academic', actas_academic),
    path('reports/actas/admission', actas_admission),
    path('reports/boletas/grades', boletas_grades),
    path('reports/constancias/enrollment', constancias_enrollment),
    path('reports/kardex', kardex),
    path('reports/certificates', certificates),

    # Polling + descarga
    path('reports/jobs/<int:job_id>', report_job_get),
    path('reports/jobs/<int:job_id>/download', report_job_download),

    # Excel exports
    path('reports/export/<str:type>', reports_export),
]
