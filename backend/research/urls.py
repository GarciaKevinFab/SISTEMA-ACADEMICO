from django.urls import path
from .views import *

urlpatterns = [
    # Catálogos
    path('catalog/lines', catalog_lines),
    path('catalog/advisors', catalog_advisors),

    # Proyectos
    path('projects', projects_collection),
    path('projects/<int:id>', project_detail),
    path('projects/<int:id>/status', project_change_status),

    # Cronograma
    path('projects/<int:projectId>/schedule', schedule_list),
    path('projects/<int:projectId>/schedule/bulk', schedule_bulk),

    # Entregables
    path('projects/<int:projectId>/deliverables', deliverables_collection),
    path('deliverables/<int:deliverableId>', deliverable_update),

    # Evaluaciones
    path('projects/<int:projectId>/evaluations', evaluations_collection),

    # Equipo
    path('projects/<int:projectId>/team', team_collection),
    path('projects/<int:projectId>/team/<int:memberId>', team_member_detail),

    # Presupuesto
    path('projects/<int:projectId>/budget', budget_list),
    path('projects/<int:projectId>/budget/items', budget_create_item),
    path('projects/<int:projectId>/budget/items/<int:itemId>', budget_item_detail),
    path('projects/<int:projectId>/budget/items/<int:itemId>/receipt', budget_upload_receipt),
    path('projects/<int:projectId>/budget/export', budget_export_xlsx),

    # Ética & PI
    path('projects/<int:projectId>/ethics-ip', ethics_ip_get),
    path('projects/<int:projectId>/ethics', ethics_set),
    path('projects/<int:projectId>/ethics/doc', ethics_upload_doc),
    path('projects/<int:projectId>/ip', ip_set),
    path('projects/<int:projectId>/ip/doc', ip_upload_doc),

    # Publicaciones
    path('projects/<int:projectId>/publications', publications_collection),
    path('projects/<int:projectId>/publications/<int:pubId>', publication_detail),

    # Convocatorias / Propuestas / Revisión
    path('calls', calls_collection),                 # GET, POST
    path('calls/<int:id>', call_detail),            # PATCH, DELETE
    path('calls/<int:callId>/proposals', proposals_collection),                         # GET, POST
    path('calls/<int:callId>/proposals/<int:proposalId>/submit', proposal_submit),      # POST
    path('calls/<int:callId>/proposals/<int:proposalId>/assign', review_assign),        # POST
    path('calls/<int:callId>/proposals/<int:proposalId>/rubric', review_rubric_get),    # GET
    path('calls/<int:callId>/proposals/<int:proposalId>/review', review_save),          # POST
    path('calls/<int:callId>/ranking', calls_ranking),                                  # GET
    path('calls/<int:callId>/ranking/export', calls_ranking_export),                    # GET

    # Reportes
    path('reports/summary', reports_summary),
]
