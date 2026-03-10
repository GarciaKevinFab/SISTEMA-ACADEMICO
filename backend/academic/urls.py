# backend/academic/urls.py
from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter

from .views import (
    PlansViewSet, SectionsViewSet, TeachersViewSet, ClassroomsViewSet,

    KardexView, KardexExportXlsxView, KardexBoletaPDFView,
    KardexBoletaPeriodoPDFView, KardexBoletaAnioPDFView, KardexConstanciaPDFView,
    KardexRecordNotasPDFView,

    SectionsScheduleConflictsView,
    AvailableCoursesView,

    EnrollmentValidateView, EnrollmentSuggestionsView, EnrollmentCommitView,
    EnrollmentCertificateView, EnrollmentCertificatePDFView,
    EnrollmentFichaView, EnrollmentFichaPDFView,
    EnrollmentBulkFichasView,

    ScheduleExportView, ScheduleExportPDFView,

    AttendanceSessionsView, AttendanceSessionCloseView, AttendanceSessionSetView,
    AttendanceImportPreviewView, AttendanceImportSaveView,

    SyllabusView, syllabus_download, StudentSyllabusesView, EvaluationConfigView,

    AcademicReportsSummaryView, AcademicReportPerformanceXlsxView, AcademicReportOccupancyXlsxView,

    TeacherSectionsView, SectionStudentsView,
    SectionGradesView, GradesSaveView, GradesSubmitView, GradesReopenView,

    SectionActaView, SectionActaPDFView, SectionActaQRView, SectionActaQRPngView,

    # ── Notas históricas ──
    HistoricalGradesView,

    # ── Procesos (EXPANDIDO) ──
    ProcessTypesView,
    ProcessesCreateView, ProcessesListView, ProcessesMineView, ProcessDetailView,
    ProcessStatusView, ProcessNotifyView, ProcessFilesView, ProcessFileDeleteView,
    ProcessDashboardView,

    AcademicCareersListView, CoursesListView, TeacherSectionsMeView,
    EnrollmentAvailableView,

    # ── Períodos académicos ──
    AcademicPeriodsListView,
    AcademicPeriodEnrollmentWindowView,

    # ── NUEVO: overview de alumnos para admin ──
    StudentsOverviewView,

    # ── Pago de matrícula ──
    EnrollmentPaymentStatusView,
    EnrollmentPaymentUploadView,
    EnrollmentPaymentReUploadView,
    EnrollmentPaymentPendingView,
    EnrollmentPaymentDetailView,
    EnrollmentPaymentApproveView,
    EnrollmentPaymentRejectView,
    EnrollmentPaymentDeleteView,

    # ── Dashboards ──
    student_dashboard, student_grades_summary, student_schedule,
    teacher_dashboard, teacher_schedule_today,
    enrollment_stats, acts_pending, sections_conflicts_get,
)

from .views.process_document_gen import ProcessGenerateDocumentView

# ── Router ──────────────────────────────────────────────────────
router = DefaultRouter(trailing_slash=False)
router.register(r"plans",      PlansViewSet,      basename="plans")
router.register(r"sections",   SectionsViewSet,   basename="sections")
router.register(r"teachers",   TeachersViewSet,   basename="teachers")
router.register(r"classrooms", ClassroomsViewSet, basename="classrooms")

sections_list = SectionsViewSet.as_view({"get": "list", "post": "create"})
sections_detail = SectionsViewSet.as_view({
    "get":    "retrieve",
    "put":    "update",
    "patch":  "partial_update",
    "delete": "destroy",
})

urlpatterns = [
    # ── Router ──────────────────────────────────────────────────
    path("", include(router.urls)),

    # ── Cursos ──────────────────────────────────────────────────
    path("courses",           CoursesListView.as_view()),
    path("courses/available", AvailableCoursesView.as_view()),

    # ── Carreras ────────────────────────────────────────────────
    path("careers", AcademicCareersListView.as_view()),

    # ── Matrícula ────────────────────────────────────────────────
    path("enrollments/students-overview",                    StudentsOverviewView.as_view()),      # ← NUEVO
    path("enrollments/available",                            EnrollmentAvailableView.as_view()),
    path("enrollments/validate",                             EnrollmentValidateView.as_view()),
    path("enrollments/suggestions",                          EnrollmentSuggestionsView.as_view()),
    path("enrollments/commit",                               EnrollmentCommitView.as_view()),
    path("enrollments/<int:enrollment_id>/certificate",      EnrollmentCertificateView.as_view()),
    path("enrollments/<int:enrollment_id>/certificate/pdf",  EnrollmentCertificatePDFView.as_view()),
    path("enrollments/<int:enrollment_id>/ficha",            EnrollmentFichaView.as_view()),
    path("enrollments/<int:enrollment_id>/ficha/pdf",        EnrollmentFichaPDFView.as_view()),
    path("enrollments/generate-fichas",                      EnrollmentBulkFichasView.as_view()),
    path("enrollments/reset-student",                        EnrollmentResetStudentView.as_view()),

    # ── Períodos académicos ──────────────────────────────────────
    path("periods",                                      AcademicPeriodsListView.as_view()),
    path("periods/<str:code>/enrollment-window",         AcademicPeriodEnrollmentWindowView.as_view()),

    # ── Kardex / PDFs ────────────────────────────────────────────
    path("kardex/<str:student_id>",                      KardexView.as_view()),
    path("kardex/<str:student_id>/export/xlsx",          KardexExportXlsxView.as_view()),
    path("kardex/<str:student_id>/boleta/pdf",           KardexBoletaPDFView.as_view()),
    path("kardex/<str:student_id>/boleta/periodo/pdf",   KardexBoletaPeriodoPDFView.as_view()),
    path("kardex/<str:student_id>/boleta/anio/pdf",      KardexBoletaAnioPDFView.as_view()),
    path("kardex/<str:student_id>/constancia/pdf",       KardexConstanciaPDFView.as_view()),
    path("kardex/<str:student_id>/record-notas/pdf",     KardexRecordNotasPDFView.as_view()),

    # ── Horarios export ──────────────────────────────────────────
    path("schedules/export",     ScheduleExportView.as_view()),
    path("schedules/export/pdf", ScheduleExportPDFView.as_view()),

    # ── Sections "hard" (compat) ─────────────────────────────────
    re_path(r"^sections/?$",                  sections_list,   name="sections-list-hard"),
    re_path(r"^sections/(?P<pk>[^/.]+)/?$",   sections_detail, name="sections-detail-hard"),
    path("sections/schedule/conflicts",       SectionsScheduleConflictsView.as_view()),

    # ── Asistencia ───────────────────────────────────────────────
    path("sections/<int:section_id>/attendance/sessions",
         AttendanceSessionsView.as_view()),
    path("sections/<int:section_id>/attendance/sessions/<int:session_id>/close",
         AttendanceSessionCloseView.as_view()),
    path("sections/<int:section_id>/attendance/sessions/<int:session_id>",
         AttendanceSessionSetView.as_view()),
    path("attendance/import/preview", AttendanceImportPreviewView.as_view()),
    path("attendance/import/save",    AttendanceImportSaveView.as_view()),

    # ── Sílabos / Evaluación ─────────────────────────────────────
    path("sections/<int:section_id>/syllabus",            SyllabusView.as_view()),
    path("sections/<int:section_id>/syllabus/download",   syllabus_download),
    path("sections/<int:section_id>/evaluation", EvaluationConfigView.as_view()),
    path("students/me/syllabuses",                        StudentSyllabusesView.as_view()),

    # ══════════════════════════════════════════════════════════════
    #  PROCESOS ACADÉMICOS — EXPANDIDO
    # ══════════════════════════════════════════════════════════════
    path("processes/types",     ProcessTypesView.as_view()),
    path("processes/dashboard", ProcessDashboardView.as_view()),
    path("processes",     ProcessesListView.as_view()),
    path("processes/my",  ProcessesMineView.as_view()),

    path("processes/withdraw",    ProcessesCreateView.as_view(), {"ptype": "RETIRO"}),
    path("processes/reservation", ProcessesCreateView.as_view(), {"ptype": "RESERVA"}),
    path("processes/validation",  ProcessesCreateView.as_view(), {"ptype": "CONVALIDACION"}),
    path("processes/transfer",    ProcessesCreateView.as_view(), {"ptype": "TRASLADO"}),
    path("processes/rejoin",      ProcessesCreateView.as_view(), {"ptype": "REINCORPORACION"}),

    path("processes/retiro",           ProcessesCreateView.as_view(), {"ptype": "RETIRO"}),
    path("processes/reserva",          ProcessesCreateView.as_view(), {"ptype": "RESERVA"}),
    path("processes/reingreso",        ProcessesCreateView.as_view(), {"ptype": "REINGRESO"}),
    path("processes/reincorporacion",  ProcessesCreateView.as_view(), {"ptype": "REINCORPORACION"}),
    path("processes/baja-definitiva",  ProcessesCreateView.as_view(), {"ptype": "BAJA_DEFINITIVA"}),
    path("processes/traslado-interno", ProcessesCreateView.as_view(), {"ptype": "TRASLADO_INTERNO"}),
    path("processes/cambio-programa",  ProcessesCreateView.as_view(), {"ptype": "CAMBIO_PROGRAMA"}),

    path("processes/anulacion-matricula",     ProcessesCreateView.as_view(), {"ptype": "ANULACION_MATRICULA"}),
    path("processes/rectificacion-matricula", ProcessesCreateView.as_view(), {"ptype": "RECTIFICACION_MATRICULA"}),
    path("processes/matricula-extemporanea",  ProcessesCreateView.as_view(), {"ptype": "MATRICULA_EXTEMPORANEA"}),

    path("processes/reapertura-acta",      ProcessesCreateView.as_view(), {"ptype": "REAPERTURA_ACTA"}),
    path("processes/rectificacion-nota",   ProcessesCreateView.as_view(), {"ptype": "RECTIFICACION_NOTA"}),
    path("processes/anulacion-evaluacion", ProcessesCreateView.as_view(), {"ptype": "ANULACION_EVALUACION"}),
    path("processes/nota-subsanacion",     ProcessesCreateView.as_view(), {"ptype": "NOTA_SUBSANACION"}),

    path("processes/convalidacion",    ProcessesCreateView.as_view(), {"ptype": "CONVALIDACION"}),
    path("processes/equivalencia",     ProcessesCreateView.as_view(), {"ptype": "EQUIVALENCIA"}),
    path("processes/traslado-externo", ProcessesCreateView.as_view(), {"ptype": "TRASLADO_EXTERNO"}),

    path("processes/<str:ptype>/create", ProcessesCreateView.as_view()),

    path("processes/<int:pid>",                      ProcessDetailView.as_view()),
    path("processes/<int:pid>/status",               ProcessStatusView.as_view()),
    path("processes/<int:pid>/notify",               ProcessNotifyView.as_view()),
    path("processes/<int:pid>/files",                ProcessFilesView.as_view()),
    path("processes/<int:pid>/files/<int:file_id>",  ProcessFileDeleteView.as_view()),
    path("processes/<int:pid>/generate-document",    ProcessGenerateDocumentView.as_view()),

    # ── Pago de Matrícula ──────────────────────────────────────────
    path("enrollment-payment/status",          EnrollmentPaymentStatusView.as_view()),
    path("enrollment-payment/upload",          EnrollmentPaymentUploadView.as_view()),
    path("enrollment-payment/re-upload",       EnrollmentPaymentReUploadView.as_view()),
    path("enrollment-payment/pending",         EnrollmentPaymentPendingView.as_view()),
    path("enrollment-payment/<int:pk>",        EnrollmentPaymentDetailView.as_view()),
    path("enrollment-payment/<int:pk>/approve", EnrollmentPaymentApproveView.as_view()),
    path("enrollment-payment/<int:pk>/reject",  EnrollmentPaymentRejectView.as_view()),
    path("enrollment-payment/<int:pk>/delete",  EnrollmentPaymentDeleteView.as_view()),

    # ── Reportes ─────────────────────────────────────────────────
    path("reports/summary",            AcademicReportsSummaryView.as_view()),
    path("reports/performance.xlsx",   AcademicReportPerformanceXlsxView.as_view()),
    path("reports/occupancy.xlsx",     AcademicReportOccupancyXlsxView.as_view()),

    # ── Docentes / Notas ─────────────────────────────────────────
    path("teachers/me/sections",                       TeacherSectionsMeView.as_view()),
    path("teachers/<int:teacher_user_id>/sections",    TeacherSectionsView.as_view()),
    path("sections/<int:section_id>/students",         SectionStudentsView.as_view()),
    path("sections/<int:section_id>/grades",           SectionGradesView.as_view()),
    path("grades/save",                                GradesSaveView.as_view()),
    path("grades/submit",                              GradesSubmitView.as_view()),
    path("grades/reopen",                              GradesReopenView.as_view()),

    # ── Notas Históricas ────────────────────────────────────────
    path("grades/historical",                          HistoricalGradesView.as_view()),
    path("grades/historical/<int:record_id>",          HistoricalGradesView.as_view()),

    # ── Actas ────────────────────────────────────────────────────
    path("sections/<int:section_id>/acta",         SectionActaView.as_view()),
    path("sections/<int:section_id>/acta/pdf",     SectionActaPDFView.as_view()),
    path("sections/<int:section_id>/acta/qr",      SectionActaQRView.as_view()),
    path("sections/<int:section_id>/acta/qr/png",  SectionActaQRPngView.as_view()),

    # ── Dashboards ───────────────────────────────────────────────
    path("student/dashboard",      student_dashboard),
    path("student/grades/summary", student_grades_summary),
    path("student/schedule",       student_schedule),
    path("teacher/dashboard",      teacher_dashboard),
    path("teacher/schedule/today", teacher_schedule_today),
    path("enrollment/stats",       enrollment_stats),
    path("acts/pending",           acts_pending),
    path("sections/conflicts",     sections_conflicts_get),
]