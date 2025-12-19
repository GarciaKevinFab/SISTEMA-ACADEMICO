from django.urls import path
from . import views

urlpatterns = [
    # Dashboard
    path("dashboard/stats", views.dashboard_stats),

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
    path("accounts/statement/pdf", views.accounts_statement_pdf),

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

    # Receipts (te recomiendo consistencia sin slash final)
    path("receipts", views.receipts_list_create),
    path("receipts/<int:pk>/pay", views.receipt_pay),
    path("receipts/<int:pk>/cancel", views.receipt_cancel),
    path("receipts/<int:pk>/pdf", views.receipt_pdf),

    # Inventario
    path("inventory/items", views.inventory_items),
    path("inventory/items/<int:pk>", views.inventory_item_detail),
    path("inventory/movements", views.inventory_movements),
    path("inventory/alerts", views.inventory_alerts),
    path("inventory/items/<int:pk>/kardex", views.inventory_kardex),

    # Logística
    path("logistics/suppliers", views.logistics_suppliers),
    path("logistics/suppliers/<int:pk>", views.logistics_supplier_detail),
    path("logistics/suppliers/export/csv", views.logistics_suppliers_csv),

    path("logistics/requirements", views.logistics_requirements),
    path("logistics/requirements/<int:pk>", views.logistics_requirement_detail),
    path("logistics/requirements/<int:pk>/submit", views.logistics_requirement_submit),
    path("logistics/requirements/<int:pk>/approve", views.logistics_requirement_approve),
    path("logistics/requirements/<int:pk>/reject", views.logistics_requirement_reject),
    path("logistics/requirements/<int:pk>/pdf", views.logistics_requirement_pdf),

    path("logistics/purchase-orders", views.purchase_orders),
    path("logistics/purchase-orders/<int:pk>", views.purchase_order_detail),
    path("logistics/purchase-orders/<int:pk>/send", views.purchase_order_send),
    path("logistics/purchase-orders/<int:pk>/receive", views.purchase_order_receive),
    path("logistics/purchase-orders/<int:pk>/cancel", views.purchase_order_cancel),
    path("logistics/purchase-orders/<int:pk>/pdf", views.purchase_order_pdf),

    # HR
    path("hr/employees/", views.hr_employees),
    path("hr/employees/<int:pk>/", views.hr_employee_detail),
    path("hr/attendance/", views.hr_attendance),

    path("hr/contracts/", views.hr_contracts),
    path("hr/contracts/<int:pk>/", views.hr_contract_detail),

]
