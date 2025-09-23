# backend/courses/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CareerViewSet, CourseViewSet, AcademicPlanViewSet, SectionViewSet,
    sections_schedule_conflicts,
    academic_kardex,
    proc_withdraw, proc_reservation, proc_validation, proc_transfer, proc_rejoin,
    academic_reports_summary,
)

# Rutas REST
router = DefaultRouter()
router.register(r'careers', CareerViewSet, basename='career')
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'academic/plans', AcademicPlanViewSet, basename='academic-plan')
router.register(r'sections', SectionViewSet, basename='section')

urlpatterns = [
    path("", include(router.urls)),

    # Conflictos de horario
    path("sections/schedule/conflicts", sections_schedule_conflicts, name="sections_schedule_conflicts"),

    # --- Academic (kárdex / procesos / reportes) ---
    path("academic/kardex/<int:student_id>", academic_kardex, name="academic-kardex"),

    path("academic/processes/withdraw", proc_withdraw, name="academic-proc-withdraw"),
    path("academic/processes/reservation", proc_reservation, name="academic-proc-reservation"),
    path("academic/processes/validation", proc_validation, name="academic-proc-validation"),
    path("academic/processes/transfer", proc_transfer, name="academic-proc-transfer"),
    path("academic/processes/rejoin", proc_rejoin, name="academic-proc-rejoin"),

    path("academic/reports/summary", academic_reports_summary, name="academic-reports-summary"),
]
