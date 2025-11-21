from django.urls import path
from . import views

urlpatterns = [
    # Conceptos
    path("concepts", views.concepts_list_create),
    path("concepts/<int:pk>", views.concepts_detail),

    # Caja / bancos
    path("cashbanks/sessions", views.cash_sessions),
    path("cashbanks/<int:pk>/movements", views.cash_movements),
    path("cashbanks/<int:pk>/close", views.cash_session_close),
    path("cashbanks/<int:pk>/export", views.cash_session_export_pdf),

    # Estados de cuenta
    path("accounts/statement", views.accounts_statement),
    path("accounts/charge", views.accounts_charge),
    path("accounts/pay", views.accounts_pay),
    path("accounts/statement/pdf", views.accounts_statement_export_pdf),

    # Conciliación
    path("bank-accounts", views.bank_accounts),
    path("reconciliation/movements", views.reconciliation_movements),
    path("reconciliation/save", views.reconciliation_save),
    path("reconciliation/export", views.reconciliation_export_pdf),

    # Reportes
    path("reports/income", views.reports_income),
    path("reports/income/export", views.reports_income_export_pdf),

    # Pagos / e-factura
    path("payments/checkout", views.payments_checkout),
    path("einvoice/issue", views.einvoice_issue),
]
