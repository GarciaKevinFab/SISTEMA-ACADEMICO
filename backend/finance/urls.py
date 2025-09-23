from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register(r'concepts', ConceptViewSet, basename='concepts')

urlpatterns = [
    # CRUD conceptos
    path('', include(router.urls)),

    # Estados de cuenta
    path('accounts/statement', account_statement),
    path('accounts/charge', account_charge),
    path('accounts/pay', account_pay),

    # Conciliación
    path('bank-accounts', bank_accounts),
    path('reconciliation/movements', reconciliation_movements),
    path('reconciliation/save', reconciliation_save),

    # Reportes
    path('reports/income', report_income),

    # PSP / Facturación
    path('payments/checkout', payments_checkout),
    path('einvoice/issue', einvoice_issue),
]
