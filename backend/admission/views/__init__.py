"""
Admission views module - Estructura modular

Importa todas las vistas para mantener compatibilidad con urls.py
"""

# Convocatorias
from .calls import (
    calls_list_public,
    call_detail_public,
    calls_collection,
    call_detail_admin,
    call_schedule_collection,
    call_schedule_detail,
    call_upload_regulation,
)

# Postulaciones y Applicants
from .applications import (
    applications_collection,
    application_detail,
    applications_me,
    applicant_me,
    applicant_create,
    public_apply,
)

# Documentos
from .documents import (
    application_docs_collection,
    application_doc_review,
    application_doc_download,
)

# Pagos
from .payments import (
    payments_list,
    application_payment_start,
    application_payment_status,
    payment_confirm,
    payment_void,
    payment_delete,
    payment_receipt_pdf,
)

# Evaluaciones
from .evaluations import (
    eval_list_for_scoring,
    eval_save_scores,
    eval_bulk_compute,
    eval_import_scores,
)

# Resultados
from .results import (
    results_list,
    public_results,
    public_results_by_path,
    results_publish,
    results_close,
    results_acta_pdf,
)

# Reportes y Dashboard
from .reports import (
    admission_dashboard,
    reports_admission_xlsx,
    reports_admission_summary,
    reports_ranking_xlsx,
    reports_vacants_vs_xlsx,
)

# Carreras (sin admission_params)
from .careers import (
    careers_collection,
    career_detail,
    career_toggle_active,
)

# Parámetros (FIX: importar de params.py donde está la lógica completa)
from .params import (
    admission_params,
)

# Constancias y Búsqueda por DNI
from .certificates import (
    search_by_dni,
    cert_inscripcion,
    cert_ingreso,
)

__all__ = [
    # Calls
    'calls_list_public',
    'call_detail_public',
    'calls_collection',
    'call_detail_admin',
    'call_schedule_collection',
    'call_schedule_detail',
    'call_upload_regulation',
    # Applications
    'applications_collection',
    'application_detail',
    'applications_me',
    'applicant_me',
    'applicant_create',
    'public_apply',
    # Documents
    'application_docs_collection',
    'application_doc_review',
    'application_doc_download',
    # Payments
    'payments_list',
    'application_payment_start',
    'application_payment_status',
    'payment_confirm',
    'payment_void',
    'payment_delete',
    'payment_receipt_pdf',
    # Evaluations
    'eval_list_for_scoring',
    'eval_save_scores',
    'eval_bulk_compute',
    'eval_import_scores',
    # Results
    'results_list',
    'public_results',
    'public_results_by_path',
    'results_publish',
    'results_close',
    'results_acta_pdf',
    # Reports
    'admission_dashboard',
    'reports_admission_xlsx',
    'reports_admission_summary',
    'reports_ranking_xlsx',
    'reports_vacants_vs_xlsx',
    # Careers
    'careers_collection',
    'career_detail',
    'career_toggle_active',
    # Params
    'admission_params',
    # Certificates
    'search_by_dni',
    'cert_inscripcion',
    'cert_ingreso',
]