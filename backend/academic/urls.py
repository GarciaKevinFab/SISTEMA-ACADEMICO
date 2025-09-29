# backend/academic/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PlansViewSet, SectionsViewSet, TeachersViewSet, ClassroomsViewSet,
    KardexView, KardexBoletaPDFView, KardexConstanciaPDFView,
    SectionsScheduleConflictsView,
    ProcessesCreateView, ProcessesListView, ProcessesMineView, ProcessDetailView,
    ProcessStatusView, ProcessNotifyView, ProcessFilesListView, ProcessFileUploadView, ProcessFileDeleteView,
    AttendanceSessionsView, AttendanceSessionCloseView, AttendanceSessionSetView,
    SyllabusView, EvaluationConfigView,
    AcademicReportsSummaryView, AcademicReportPerformanceXlsxView, AcademicReportOccupancyXlsxView,
)

# Rutas sin slash final
router = DefaultRouter(trailing_slash=False)
router.register(r'academic/plans', PlansViewSet, basename='plans')
router.register(r'sections', SectionsViewSet, basename='sections')
router.register(r'teachers', TeachersViewSet, basename='teachers')
router.register(r'classrooms', ClassroomsViewSet, basename='classrooms')

urlpatterns = [
    # Router (plans/sections/teachers/classrooms)
    path('', include(router.urls)),

    # Schedules – validación de conflictos
    path('sections/schedule/conflicts', SectionsScheduleConflictsView.as_view()),

    # Attendance
    path('sections/<int:section_id>/attendance/sessions', AttendanceSessionsView.as_view()),
    path('sections/<int:section_id>/attendance/sessions/<int:session_id>/close', AttendanceSessionCloseView.as_view()),
    path('sections/<int:section_id>/attendance/sessions/<int:session_id>', AttendanceSessionSetView.as_view()),

    # Syllabus
    path('sections/<int:section_id>/syllabus', SyllabusView.as_view()),

    # Evaluation config
    path('sections/<int:section_id>/evaluation', EvaluationConfigView.as_view()),

    # Kardex + PDFs
    path('kardex/<str:student_id>', KardexView.as_view()),
    path('kardex/<str:student_id>/boleta', KardexBoletaPDFView.as_view()),          # usado por generatePDFWithPolling
    path('kardex/<str:student_id>/boleta/pdf', KardexBoletaPDFView.as_view()),     # usado por service directo
    path('kardex/<str:student_id>/constancia', KardexConstanciaPDFView.as_view()),
    path('kardex/<str:student_id>/constancia/pdf', KardexConstanciaPDFView.as_view()),

    # Procesos académicos (creación directa por tipo)
    path('processes/withdraw', ProcessesCreateView.as_view(),      {'ptype': 'RETIRO'}),
    path('processes/reservation', ProcessesCreateView.as_view(),   {'ptype': 'RESERVA'}),
    path('processes/validation', ProcessesCreateView.as_view(),    {'ptype': 'CONVALIDACION'}),
    path('processes/transfer', ProcessesCreateView.as_view(),      {'ptype': 'TRASLADO'}),
    path('processes/rejoin', ProcessesCreateView.as_view(),        {'ptype': 'REINCORPORACION'}),

    # Procesos – bandeja / detalle / acciones
    path('processes', ProcessesListView.as_view()),
    path('processes/my', ProcessesMineView.as_view()),
    path('processes/<int:pid>', ProcessDetailView.as_view()),
    path('processes/<int:pid>/status', ProcessStatusView.as_view()),
    path('processes/<int:pid>/notify', ProcessNotifyView.as_view()),
    path('processes/<int:pid>/files', ProcessFilesListView.as_view()),
    path('processes/<int:pid>/files/<int:file_id>', ProcessFileDeleteView.as_view()),
    path('processes/<int:pid>/files', ProcessFileUploadView.as_view()),

    # Reportes académicos
    path('academic/reports/summary', AcademicReportsSummaryView.as_view()),
    path('academic/reports/performance.xlsx', AcademicReportPerformanceXlsxView.as_view()),
    path('academic/reports/occupancy.xlsx', AcademicReportOccupancyXlsxView.as_view()),
]
