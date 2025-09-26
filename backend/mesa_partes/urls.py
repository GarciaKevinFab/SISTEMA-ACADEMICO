from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register(r'offices', OfficeViewSet, basename='offices')
router.register(r'procedure-types', ProcedureTypeViewSet, basename='procedure-types')
router.register(r'procedures', ProcedureViewSet, basename='procedures')

# Nested manual para archivos de un trámite
procedure_files_patterns = [
    path('',  ProcedureFilesViewSet.as_view({'get':'list','post':'create'})),
    path('<int:pk>/', ProcedureFilesViewSet.as_view({'delete':'destroy'})),
]

urlpatterns = [
    # Routers
    path('', include(router.urls)),

    # Files
    path('procedures/<int:procedure_pk>/files/', include((procedure_files_patterns, 'procedure-files'))),

    # Público
    path('public/procedures/track', public_track),                             # GET ?code=
    path('public/procedures', public_intake_create),                           # POST
    path('public/procedures/<str:trackingCode>/files', public_intake_upload),  # POST multipart

    # Reportes
    path('procedures/reports/summary', procedures_report_summary),             # GET
    path('procedures/reports/sla.xlsx', procedures_report_sla_xlsx),           # GET
    path('procedures/reports/volume.xlsx', procedures_report_volume_xlsx),     # GET
]
