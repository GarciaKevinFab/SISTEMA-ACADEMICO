from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
# Catálogos
router.register(r'careers', CareersViewSet, basename='careers')
# Planes (prefijo /academic/plans)
router.register(r'academic/plans', PlansViewSet, basename='plans')
# Secciones
router.register(r'sections', SectionsViewSet, basename='sections')
# Rooms & Teachers
router.register(r'classrooms', ClassroomsViewSet, basename='classrooms')
router.register(r'teachers', TeachersViewSet, basename='teachers')
# Periodos
router.register(r'academic/periods', PeriodsViewSet, basename='periods')
# Bandeja de procesos
router.register(r'processes', ProcessesInboxViewSet, basename='processes')

# Archivos de proceso (nested manual simple)
process_files_patterns = [
    path('', ProcessFilesViewSet.as_view({'get':'list', 'post':'create'})),
    path('<int:pk>/', ProcessFilesViewSet.as_view({'delete':'destroy'})),
]

urlpatterns = [
    path('', include(router.urls)),
    # Enrollment suggestions
    path('enrollments/suggestions', enrollment_suggestions),
    # Kardex
    path('kardex/<int:student_id>', kardex_of_student),
    path('kardex/<int:student_id>/boleta/pdf', kardex_boleta_pdf),
    path('kardex/<int:student_id>/constancia/pdf', kardex_constancia_pdf),
    # Procesos académicos (acciones)
    path('processes/withdraw', process_withdraw),
    path('processes/reservation', process_reservation),
    path('processes/validation', process_validation),
    path('processes/transfer', process_transfer),
    path('processes/rejoin', process_rejoin),
    # Files nested
    path('processes/<int:process_pk>/files/', include((process_files_patterns, 'process_files'))),
    # Reportes
    path('academic/reports/summary', academic_reports_summary),
    path('academic/reports/performance.xlsx', academic_reports_performance),
    path('academic/reports/occupancy.xlsx', academic_reports_occupancy),
]
