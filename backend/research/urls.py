"""
research/urls.py
"""
from django.urls import path
from .views import (
    # Dashboard
    dashboard_stats,
    # Catálogos
    catalog_lines, catalog_line_detail,
    catalog_advisors, catalog_advisor_detail,
    # Proyectos
    projects_collection, project_detail, project_change_status,
    # Cronograma
    schedule_list, schedule_bulk,
    # Entregables
    deliverables_collection, deliverable_update,
    # Evaluaciones
    evaluations_collection,
    # Equipo
    team_collection, team_member_detail,
    # Presupuesto
    budget_list, budget_create_item, budget_item_detail,
    budget_upload_receipt, budget_export_xlsx, budget_export_pdf_stub,
    # Ética & PI
    ethics_ip_get, ethics_set, ethics_upload_doc, ip_set, ip_upload_doc,
    # Publicaciones
    publications_collection, publication_detail,
    # Convocatorias / Propuestas / Revisión
    calls_collection, call_detail, proposals_collection, proposal_submit,
    review_assign, review_rubric_get, review_save, calls_ranking, calls_ranking_export,
    # Reportes
    reports_summary, reports_summary_export_stub,
)

app_name = "research"

urlpatterns = [
    # ── Dashboard ──
    path("dashboard",                   dashboard_stats),

    # ── Catálogos ──
    path("catalog/lines",             catalog_lines),
    path("catalog/lines/<int:id>",    catalog_line_detail),
    path("catalog/advisors",          catalog_advisors),
    path("catalog/advisors/<int:id>", catalog_advisor_detail),

    # ── Proyectos ──
    path("projects",                       projects_collection),
    path("projects/<int:id>",              project_detail),
    path("projects/<int:id>/status",       project_change_status),

    # ── Cronograma ──
    path("projects/<int:projectId>/schedule",      schedule_list),
    path("projects/<int:projectId>/schedule/bulk",  schedule_bulk),

    # ── Entregables ──
    path("projects/<int:projectId>/deliverables",   deliverables_collection),
    path("deliverables/<int:deliverableId>",        deliverable_update),

    # ── Evaluaciones ──
    path("projects/<int:projectId>/evaluations",    evaluations_collection),

    # ── Equipo ──
    path("projects/<int:projectId>/team",                        team_collection),
    path("projects/<int:projectId>/team/<int:memberId>",         team_member_detail),

    # ── Presupuesto ──
    path("projects/<int:projectId>/budget",                              budget_list),
    path("projects/<int:projectId>/budget/items",                        budget_create_item),
    path("projects/<int:projectId>/budget/items/<int:itemId>",           budget_item_detail),
    path("projects/<int:projectId>/budget/items/<int:itemId>/receipt",   budget_upload_receipt),
    path("projects/<int:projectId>/budget/export",                       budget_export_xlsx),
    path("projects/<int:projectId>/budget/export-pdf",                   budget_export_pdf_stub),

    # ── Ética & PI ──
    path("projects/<int:projectId>/ethics-ip",  ethics_ip_get),
    path("projects/<int:projectId>/ethics",     ethics_set),
    path("projects/<int:projectId>/ethics/doc", ethics_upload_doc),
    path("projects/<int:projectId>/ip",         ip_set),
    path("projects/<int:projectId>/ip/doc",     ip_upload_doc),

    # ── Publicaciones ──
    path("projects/<int:projectId>/publications",              publications_collection),
    path("projects/<int:projectId>/publications/<int:pubId>",  publication_detail),

    # ── Convocatorias / Revisión ──
    path("calls",                                                     calls_collection),
    path("calls/<int:id>",                                            call_detail),
    path("calls/<int:callId>/proposals",                              proposals_collection),
    path("calls/<int:callId>/proposals/<int:proposalId>/submit",      proposal_submit),
    path("calls/<int:callId>/proposals/<int:proposalId>/assign",      review_assign),
    path("calls/<int:callId>/proposals/<int:proposalId>/rubric",      review_rubric_get),
    path("calls/<int:callId>/proposals/<int:proposalId>/review",      review_save),
    path("calls/<int:callId>/ranking",                                calls_ranking),
    path("calls/<int:callId>/ranking/export",                         calls_ranking_export),

    # ── Reportes ──
    path("reports/summary",        reports_summary),
    path("reports/summary/export", reports_summary_export_stub),
]