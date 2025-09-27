from django.urls import path
from .views import (
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

urlpatterns = [
    # Catálogos
    path('catalog/lines', catalog_lines),                 # GET | POST
    path('catalog/lines/<int:id>', catalog_line_detail),  # PATCH | DELETE
    path('catalog/advisors', catalog_advisors),           # GET | POST
    path('catalog/advisors/<int:id>', catalog_advisor_detail),  # PATCH | DELETE

    # Proyectos
    path('projects', projects_collection),                       # GET | POST
    path('projects/<int:id>', project_detail),                   # GET | PATCH | DELETE
    path('projects/<int:id>/status', project_change_status),     # POST

    # Cronograma
    path('projects/<int:projectId>/schedule', schedule_list),           # GET
    path('projects/<int:projectId>/schedule/bulk', schedule_bulk),      # POST

    # Entregables
    path('projects/<int:projectId>/deliverables', deliverables_collection),  # GET | POST
    path('deliverables/<int:deliverableId>', deliverable_update),            # PATCH

    # Evaluaciones
    path('projects/<int:projectId>/evaluations', evaluations_collection),    # GET | POST

    # Equipo
    path('projects/<int:projectId>/team', team_collection),                  # GET | POST
    path('projects/<int:projectId>/team/<int:memberId>', team_member_detail),# PATCH | DELETE

    # Presupuesto
    path('projects/<int:projectId>/budget', budget_list),                    # GET
    path('projects/<int:projectId>/budget/items', budget_create_item),       # POST
    path('projects/<int:projectId>/budget/items/<int:itemId>', budget_item_detail),  # PATCH | DELETE
    path('projects/<int:projectId>/budget/items/<int:itemId>/receipt', budget_upload_receipt),  # POST
    path('projects/<int:projectId>/budget/export', budget_export_xlsx),      # GET
    path('projects/<int:projectId>/budget/export-pdf', budget_export_pdf_stub),  # GET (stub)

    # Ética & PI
    path('projects/<int:projectId>/ethics-ip', ethics_ip_get),               # GET
    path('projects/<int:projectId>/ethics', ethics_set),                     # PUT
    path('projects/<int:projectId>/ethics/doc', ethics_upload_doc),          # POST
    path('projects/<int:projectId>/ip', ip_set),                             # PUT
    path('projects/<int:projectId>/ip/doc', ip_upload_doc),                  # POST

    # Publicaciones
    path('projects/<int:projectId>/publications', publications_collection),        # GET | POST
    path('projects/<int:projectId>/publications/<int:pubId>', publication_detail), # PATCH | DELETE

    # Convocatorias / Revisión
    path('calls', calls_collection),                                   # GET | POST
    path('calls/<int:id>', call_detail),                               # PATCH | DELETE
    path('calls/<int:callId>/proposals', proposals_collection),        # GET | POST
    path('calls/<int:callId>/proposals/<int:proposalId>/submit', proposal_submit),  # POST
    path('calls/<int:callId>/proposals/<int:proposalId>/assign', review_assign),    # POST
    path('calls/<int:callId>/proposals/<int:proposalId>/rubric', review_rubric_get),# GET
    path('calls/<int:callId>/proposals/<int:proposalId>/review', review_save),      # POST
    path('calls/<int:callId>/ranking', calls_ranking),                               # GET
    path('calls/<int:callId>/ranking/export', calls_ranking_export),                 # GET (stub)

    # Reportes
    path('reports/summary', reports_summary),                           # GET
    path('reports/summary/export', reports_summary_export_stub),        # POST | GET (stub)
]
