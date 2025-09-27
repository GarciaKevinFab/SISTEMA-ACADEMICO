# backend/admission/urls.py
from django.urls import path
from . import views as v

urlpatterns = [
    # Dashboard
    path("admission/dashboard", v.admission_dashboard),

    # Convocatorias
    path("admission-calls/public", v.calls_list_public),
    path("admission-calls", v.calls_collection),
    path("admission-calls/<int:call_id>/schedule", v.call_schedule_collection),
    path("admission-calls/<int:call_id>/schedule/<int:item_id>", v.call_schedule_detail),

    # Carreras (sin importaciones extra y sin duplicados)
    path("careers", v.careers_collection),                       # GET lista / POST crea
    path("careers/<int:career_id>", v.career_detail),            # GET detalle / PUT edita / DELETE elimina
    path("careers/<int:career_id>/toggle", v.career_toggle_active),  # POST alterna activo

    # Postulaciones
    path("applications", v.applications_collection),
    path("applications/me", v.applications_me),

    # Documentos del postulante
    path("applications/<int:application_id>/documents", v.application_docs_collection),
    path("applications/<int:application_id>/documents/<int:document_id>/review", v.application_doc_review),

    # Pago
    path("applications/<int:application_id>/payment", v.application_payment_start),
    path("applications/<int:application_id>/payment/status", v.application_payment_status),

    # Evaluación
    path("evaluation/applications", v.eval_list_for_scoring),
    path("evaluation/<int:application_id>/scores", v.eval_save_scores),
    path("evaluation/compute", v.eval_bulk_compute),

    # Resultados
    path("results", v.results_list),
    path("results/publish", v.results_publish),
    path("results/close", v.results_close),
    path("results/acta.pdf", v.results_acta_pdf),

    # Reportes
    path("reports/admission.xlsx", v.reports_admission_xlsx),
    path("reports/admission/summary", v.reports_admission_summary),
    path("reports/admission/ranking.xlsx", v.reports_ranking_xlsx),
    path("reports/admission/vacants-vs.xlsx", v.reports_vacants_vs_xlsx),

    # Parámetros
    path("admission/params", v.admission_params),

    # Perfil postulante
    path("applicants/me", v.applicant_me),
    path("applicants", v.applicant_create),

    # Pagos (bandeja admin)
    path("admission-payments", v.payments_list),
    path("admission-payments/<int:payment_id>/confirm", v.payment_confirm),
    path("admission-payments/<int:payment_id>/void", v.payment_void),
    path("admission-payments/<int:payment_id>/receipt.pdf", v.payment_receipt_pdf),
]
