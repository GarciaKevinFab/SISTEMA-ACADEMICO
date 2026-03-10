"""
Academic views module — estructura modular
Centraliza todos los imports para mantener compatibilidad con urls.py
"""

# ── Planes ─────────────────────────────────────────────────────────────────
from .plans import PlansViewSet

# ── Secciones ──────────────────────────────────────────────────────────────
from .sections import (
    SectionsViewSet,
    SectionsScheduleConflictsView,
)

# ── Matrícula ──────────────────────────────────────────────────────────────
from .enrollment import (
    AvailableCoursesView,
    EnrollmentValidateView,
    EnrollmentSuggestionsView,
    EnrollmentCommitView,
    EnrollmentAvailableView,
    AcademicPeriodsListView,              # ← NUEVO: GET /periods + POST /periods
    AcademicPeriodEnrollmentWindowView,   # GET/PUT /periods/{code}/enrollment-window
    EnrollmentCertificateView,
    EnrollmentCertificatePDFView,
    EnrollmentFichaView,
    EnrollmentFichaPDFView,
    ScheduleExportView,
    ScheduleExportPDFView,
    StudentsOverviewView,
    EnrollmentBulkFichasView,
)

# ── Kardex ─────────────────────────────────────────────────────────────────
from .kardex import (
    KardexView,
    KardexExportXlsxView,
    KardexBoletaPDFView,
    KardexConstanciaPDFView,
    KardexBoletaPeriodoPDFView,
    KardexBoletaAnioPDFView,
    KardexRecordNotasPDFView,
)

# ── Docentes ───────────────────────────────────────────────────────────────
from .teachers import (
    TeachersViewSet,
    TeacherSectionsView,
    TeacherSectionsMeView,
    SectionStudentsView,
    SectionGradesView,
    GradesSaveView,
    GradesSubmitView,
    GradesReopenView,
    SectionActaView,
    SectionActaPDFView,
    SectionActaQRView,
    SectionActaQRPngView,
    HistoricalGradesView,
)

# ── Reportes ───────────────────────────────────────────────────────────────
from .reports import (
    AcademicReportsSummaryView,
    AcademicCareersListView,
    AcademicReportPerformanceXlsxView,
    AcademicReportOccupancyXlsxView,
)

# ── Procesos académicos (17 tipos, 4 grupos) ───────────────────────────────
from .processes import (
    ProcessTypesView,
    ProcessesCreateView,
    ProcessesListView,
    ProcessesMineView,
    ProcessDetailView,
    ProcessStatusView,
    ProcessNotifyView,
    ProcessFilesView,
    ProcessFileDeleteView,
    ProcessDashboardView,
)
from .process_document_gen import ProcessGenerateDocumentView

# ── Asistencia ─────────────────────────────────────────────────────────────
from .attendance import (
    AttendanceSessionsView,
    AttendanceSessionCloseView,
    AttendanceSessionSetView,
    AttendanceImportPreviewView,
    AttendanceImportSaveView,
    SyllabusView, syllabus_download,
    StudentSyllabusesView,
    EvaluationConfigView,
)

# ── Vistas simples ─────────────────────────────────────────────────────────
from .classrooms import ClassroomsViewSet
from .courses    import CoursesListView

# ── Pago de Matrícula ─────────────────────────────────────────────────────
from .enrollment_payment import (
    EnrollmentPaymentStatusView,
    EnrollmentPaymentUploadView,
    EnrollmentPaymentReUploadView,
    EnrollmentPaymentPendingView,
    EnrollmentPaymentDetailView,
    EnrollmentPaymentApproveView,
    EnrollmentPaymentRejectView,
    EnrollmentPaymentDeleteView,
)

# ── Dashboards ─────────────────────────────────────────────────────────────
from .dashboard_student import (
    student_dashboard,
    student_grades_summary,
    student_schedule,
)
from .dashboard_teacher import (
    teacher_dashboard,
    teacher_schedule_today,
)
from .dashboard_academic import (
    enrollment_stats,
    acts_pending,
    sections_conflicts_get,
)


# ══════════════════════════════════════════════════════════════
#  __all__
# ══════════════════════════════════════════════════════════════
__all__ = [
    # Plans
    "PlansViewSet",
    # Sections
    "SectionsViewSet",
    "SectionsScheduleConflictsView",
    # Enrollment
    "AvailableCoursesView",
    "EnrollmentValidateView",
    "EnrollmentSuggestionsView",
    "EnrollmentCommitView",
    "EnrollmentAvailableView",
    "AcademicPeriodsListView",             # ← NUEVO
    "AcademicPeriodEnrollmentWindowView",
    "EnrollmentCertificateView",
    "EnrollmentCertificatePDFView",
    "EnrollmentFichaView",
    "EnrollmentFichaPDFView",
    "ScheduleExportView",
    "ScheduleExportPDFView",
    "EnrollmentBulkFichasView",
    # Kardex
    "KardexView",
    "KardexExportXlsxView",
    "KardexBoletaPDFView",
    "KardexConstanciaPDFView",
    "KardexBoletaPeriodoPDFView",
    "KardexBoletaAnioPDFView",
    "KardexRecordNotasPDFView",
    # Teachers
    "TeachersViewSet",
    "TeacherSectionsView",
    "TeacherSectionsMeView",
    "SectionStudentsView",
    "SectionGradesView",
    "GradesSaveView",
    "GradesSubmitView",
    "GradesReopenView",
    "SectionActaView",
    "SectionActaPDFView",
    "SectionActaQRView",
    "SectionActaQRPngView",
    "HistoricalGradesView",
    # Reports
    "AcademicReportsSummaryView",
    "AcademicCareersListView",
    "AcademicReportPerformanceXlsxView",
    "AcademicReportOccupancyXlsxView",
    # Processes
    "ProcessTypesView",
    "ProcessesCreateView",
    "ProcessesListView",
    "ProcessesMineView",
    "ProcessDetailView",
    "ProcessStatusView",
    "ProcessNotifyView",
    "ProcessFilesView",
    "ProcessFileDeleteView",
    "ProcessDashboardView",
    "ProcessGenerateDocumentView",
    # Attendance
    "AttendanceSessionsView",
    "AttendanceSessionCloseView",
    "AttendanceSessionSetView",
    "AttendanceImportPreviewView",
    "AttendanceImportSaveView",
    "SyllabusView", "syllabus_download", "StudentSyllabusesView",
    "EvaluationConfigView",
    # Simple
    "ClassroomsViewSet",
    "CoursesListView",
    # Dashboards
    "student_dashboard",
    "student_grades_summary",
    "student_schedule",
    "teacher_dashboard",
    "teacher_schedule_today",
    "enrollment_stats",
    "acts_pending",
    "sections_conflicts_get",
    # Enrollment Payment
    "EnrollmentPaymentStatusView",
    "EnrollmentPaymentUploadView",
    "EnrollmentPaymentReUploadView",
    "EnrollmentPaymentPendingView",
    "EnrollmentPaymentDetailView",
    "EnrollmentPaymentApproveView",
    "EnrollmentPaymentRejectView",
    "EnrollmentPaymentDeleteView",
]