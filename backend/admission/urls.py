# backend/admission/urls.py
from django.urls import path
from . import views as v

urlpatterns = [
    # ══════════════════════════════════════════════════════════
    # Dashboard
    # ══════════════════════════════════════════════════════════
    path("admission/dashboard", v.admission_dashboard),

    # ══════════════════════════════════════════════════════════
    # Convocatorias — RUTAS ESTÁTICAS ANTES DE DINÁMICAS
    # FIX: "public" antes de "<int:call_id>" para que Django
    #       no intente parsear "public" como entero.
    # ══════════════════════════════════════════════════════════
    path("admission-calls/public", v.calls_list_public),
    path("admission-calls/public/<int:call_id>", v.call_detail_public),
    path("admission-calls/<int:call_id>", v.call_detail_admin),
    path("admission-calls/<int:call_id>/schedule", v.call_schedule_collection),
    path("admission-calls/<int:call_id>/schedule/<int:item_id>", v.call_schedule_detail),
    path("admission-calls", v.calls_collection),

    # ══════════════════════════════════════════════════════════
    # Postulación pública (sin auth)
    # ══════════════════════════════════════════════════════════
    path("admission/public/apply", v.public_apply),

    # Búsqueda por DNI + Constancias PDF
    path("admission/public/search", v.search_by_dni),
    path("admission/public/certificates/inscripcion", v.cert_inscripcion),
    path("admission/public/certificates/ingreso", v.cert_ingreso),

    # FIX: Soportar ambos formatos:
    #   - query params:  /admission/public/results?call_id=X&dni=Y
    #   - path params:   /admission/public/results/<call_id>/<dni>
    path("admission/public/results", v.public_results),
    path("admission/public/results/<int:call_id>/<str:dni>", v.public_results_by_path),

    # También el FE intenta /public/results/... (ver PublicAdmissionCalls.jsx)
    path("public/results/<int:call_id>/<str:dni>", v.public_results_by_path),

    # ══════════════════════════════════════════════════════════
    # Carreras
    # ══════════════════════════════════════════════════════════
    path("careers", v.careers_collection),
    path("careers/<int:career_id>", v.career_detail),
    path("careers/<int:career_id>/toggle", v.career_toggle_active),

    # ══════════════════════════════════════════════════════════
    # Postulaciones
    # ══════════════════════════════════════════════════════════
    path("applications/me", v.applications_me),
    path("applications/<int:application_id>", v.application_detail),
    path("applications", v.applications_collection),

    # ══════════════════════════════════════════════════════════
    # Documentos del postulante
    # ══════════════════════════════════════════════════════════
    path("applications/<int:application_id>/documents", v.application_docs_collection),
    path(
        "applications/<int:application_id>/documents/<int:document_id>/review",
        v.application_doc_review,
    ),

    # ══════════════════════════════════════════════════════════
    # Pago
    # ══════════════════════════════════════════════════════════
    path("applications/<int:application_id>/payment", v.application_payment_start),
    path("applications/<int:application_id>/payment/status", v.application_payment_status),

    # ══════════════════════════════════════════════════════════
    # Evaluación
    # ══════════════════════════════════════════════════════════
    path("evaluation/applications", v.eval_list_for_scoring),
    path("evaluation/<int:application_id>/scores", v.eval_save_scores),
    path("evaluation/compute", v.eval_bulk_compute),
    path("evaluation/import", v.eval_import_scores),

    # ══════════════════════════════════════════════════════════
    # Resultados
    # ══════════════════════════════════════════════════════════
    path("results", v.results_list),
    path("results/publish", v.results_publish),
    path("results/close", v.results_close),
    path("results/acta.pdf", v.results_acta_pdf),

    # ══════════════════════════════════════════════════════════
    # Reportes
    # ══════════════════════════════════════════════════════════
    path("reports/admission.xlsx", v.reports_admission_xlsx),
    path("reports/admission/summary", v.reports_admission_summary),
    path("reports/admission/ranking.xlsx", v.reports_ranking_xlsx),
    path("reports/admission/vacants-vs.xlsx", v.reports_vacants_vs_xlsx),

    # ══════════════════════════════════════════════════════════
    # Parámetros
    # ══════════════════════════════════════════════════════════
    path("admission/params", v.admission_params),

    # ══════════════════════════════════════════════════════════
    # Perfil postulante
    # ══════════════════════════════════════════════════════════
    path("applicants/me", v.applicant_me),
    path("applicants", v.applicant_create),

    # ══════════════════════════════════════════════════════════
    # Pagos (bandeja admin)
    # ══════════════════════════════════════════════════════════
    path("admission-payments", v.payments_list),
    path("admission-payments/<int:payment_id>/confirm", v.payment_confirm),
    path("admission-payments/<int:payment_id>/void", v.payment_void),
    path("admission-payments/<int:payment_id>/receipt.pdf", v.payment_receipt_pdf),
]