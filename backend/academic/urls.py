# backend/academic/urls.py
from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter

from .views import (
    PlansViewSet, SectionsViewSet, TeachersViewSet, ClassroomsViewSet,

    KardexView, KardexBoletaPDFView, KardexConstanciaPDFView,
    SectionsScheduleConflictsView,

    ProcessesCreateView, ProcessesListView, ProcessesMineView, ProcessDetailView,
    ProcessStatusView, ProcessNotifyView, ProcessFilesView, ProcessFileDeleteView,

    AttendanceSessionsView, AttendanceSessionCloseView, AttendanceSessionSetView,
    SyllabusView, EvaluationConfigView,

    AcademicReportsSummaryView, AcademicReportPerformanceXlsxView, AcademicReportOccupancyXlsxView,

    AvailableCoursesView,

    EnrollmentValidateView, EnrollmentSuggestionsView, EnrollmentCommitView,
    EnrollmentCertificateView, EnrollmentCertificatePDFView,
    ScheduleExportView, ScheduleExportPDFView,

    # ✅ NUEVOS
    TeacherSectionsView, SectionStudentsView,
    SectionGradesView, GradesSaveView, GradesSubmitView, GradesReopenView,
    SectionActaView, SectionActaPDFView, SectionActaQRView, SectionActaQRPngView,
    AttendanceImportPreviewView, AttendanceImportSaveView,
)

router = DefaultRouter(trailing_slash=False)
router.register(r'academic/plans', PlansViewSet, basename='plans')
router.register(r'sections', SectionsViewSet, basename='sections')
router.register(r'teachers', TeachersViewSet, basename='teachers')
router.register(r'classrooms', ClassroomsViewSet, basename='classrooms')

sections_list = SectionsViewSet.as_view({"get": "list", "post": "create"})
sections_detail = SectionsViewSet.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy",
})

urlpatterns = [
    path('', include(router.urls)),

    # Courses
    path('courses/available', AvailableCoursesView.as_view()),

    # Enrollment
    path('enrollments/validate', EnrollmentValidateView.as_view()),
    path('enrollments/suggestions', EnrollmentSuggestionsView.as_view()),
    path('enrollments/commit', EnrollmentCommitView.as_view()),
    path('enrollments/<int:enrollment_id>/certificate', EnrollmentCertificateView.as_view()),
    path('enrollments/<int:enrollment_id>/certificate/pdf', EnrollmentCertificatePDFView.as_view()),

    # Schedule export
    path('schedules/export', ScheduleExportView.as_view()),
    path('schedules/export/pdf', ScheduleExportPDFView.as_view()),

    # Hard routes sections / sections/
    re_path(r'^sections/?$', sections_list, name='sections-list-hard'),
    re_path(r'^sections/(?P<pk>[^/.]+)/?$', sections_detail, name='sections-detail-hard'),

    path('sections/schedule/conflicts', SectionsScheduleConflictsView.as_view()),

    # Attendance
    path('sections/<int:section_id>/attendance/sessions', AttendanceSessionsView.as_view()),
    path('sections/<int:section_id>/attendance/sessions/<int:session_id>/close', AttendanceSessionCloseView.as_view()),
    path('sections/<int:section_id>/attendance/sessions/<int:session_id>', AttendanceSessionSetView.as_view()),

    # Attendance Import
    path('attendance/import/preview', AttendanceImportPreviewView.as_view()),
    path('attendance/import/save', AttendanceImportSaveView.as_view()),

    # Syllabus
    path('sections/<int:section_id>/syllabus', SyllabusView.as_view()),

    # Evaluation config
    path('sections/<int:section_id>/evaluation', EvaluationConfigView.as_view()),

    # Kardex + PDFs
    path('kardex/<str:student_id>', KardexView.as_view()),
    path('kardex/<str:student_id>/boleta', KardexBoletaPDFView.as_view()),
    path('kardex/<str:student_id>/boleta/pdf', KardexBoletaPDFView.as_view()),
    path('kardex/<str:student_id>/constancia', KardexConstanciaPDFView.as_view()),
    path('kardex/<str:student_id>/constancia/pdf', KardexConstanciaPDFView.as_view()),

    # Procesos
    path('processes/withdraw', ProcessesCreateView.as_view(), {'ptype': 'RETIRO'}),
    path('processes/reservation', ProcessesCreateView.as_view(), {'ptype': 'RESERVA'}),
    path('processes/validation', ProcessesCreateView.as_view(), {'ptype': 'CONVALIDACION'}),
    path('processes/transfer', ProcessesCreateView.as_view(), {'ptype': 'TRASLADO'}),
    path('processes/rejoin', ProcessesCreateView.as_view(), {'ptype': 'REINCORPORACION'}),

    path('processes', ProcessesListView.as_view()),
    path('processes/my', ProcessesMineView.as_view()),
    path('processes/<int:pid>', ProcessDetailView.as_view()),
    path('processes/<int:pid>/status', ProcessStatusView.as_view()),
    path('processes/<int:pid>/notify', ProcessNotifyView.as_view()),
    path('processes/<int:pid>/files', ProcessFilesView.as_view()),
    path('processes/<int:pid>/files/<int:file_id>', ProcessFileDeleteView.as_view()),

    # Reportes
    path('academic/reports/summary', AcademicReportsSummaryView.as_view()),
    path('academic/reports/performance.xlsx', AcademicReportPerformanceXlsxView.as_view()),
    path('academic/reports/occupancy.xlsx', AcademicReportOccupancyXlsxView.as_view()),

    # ✅ Docente / Estudiantes / Notas
    path('teachers/<int:teacher_user_id>/sections', TeacherSectionsView.as_view()),
    path('sections/<int:section_id>/students', SectionStudentsView.as_view()),
    path('sections/<int:section_id>/grades', SectionGradesView.as_view()),
    path('grades/save', GradesSaveView.as_view()),
    path('grades/submit', GradesSubmitView.as_view()),
    path('grades/reopen', GradesReopenView.as_view()),

    # ✅ Acta
    path('sections/<int:section_id>/acta', SectionActaView.as_view()),
    path('sections/<int:section_id>/acta/pdf', SectionActaPDFView.as_view()),
    path('sections/<int:section_id>/acta/qr', SectionActaQRView.as_view()),
    path('sections/<int:section_id>/acta/qr/png', SectionActaQRPngView.as_view()),
]
