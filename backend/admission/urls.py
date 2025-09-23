from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
# Convocatorias
router.register(r'admission-calls', AdmissionCallViewSet, basename='admission-calls')
# Applicants
router.register(r'applicants', ApplicantViewSet, basename='applicants')
# Applications
router.register(r'applications', ApplicationViewSet, basename='applications')
# Payments admin
router.register(r'admission-payments', AdmissionPaymentsViewSet, basename='admission-payments')

# Nested manual para documentos
application_docs_patterns = [
    path('', ApplicationDocumentsViewSet.as_view({'get':'list','post':'create'})),
    path('<int:pk>/review', ApplicationDocumentsViewSet.as_view({'post':'review'})),
]

urlpatterns = [
    # Dashboard
    path('admission/dashboard', admission_dashboard),

    # Routers
    path('', include(router.urls)),

    # Payment por aplicación
    path('applications/<int:application_id>/payment', application_payment_start),
    path('applications/<int:application_id>/payment/status', application_payment_status),

    # Documentos de aplicación
    path('applications/<int:application_id>/documents/', include((application_docs_patterns, 'application-docs'))),

    # Evaluación
    path('evaluation/applications', evaluation_list_for_scoring),
    path('evaluation/<int:application_id>/scores', evaluation_save_scores),
    path('evaluation/compute', evaluation_bulk_compute),

    # Resultados
    path('results', results_list),
    path('results/publish', results_publish),
    path('results/close', results_close),
    path('results/acta.pdf', results_acta_pdf),

    # Reportes
    path('reports/admission.xlsx', reports_admission_excel),
    path('reports/admission/summary', reports_admission_summary),
    path('reports/admission/ranking.xlsx', reports_ranking_excel),
    path('reports/admission/vacants-vs.xlsx', reports_vacants_vs_excel),

    # Parámetros
    path('admission/params', admission_params),

    # Perfil postulante (/applicants/me ya está como action en ApplicantViewSet SI QUISIERAS duplicar):
    path('applicants/me', applicant_me),   # alias explícito
]
