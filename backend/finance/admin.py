from django.contrib import admin
from .models import (
    Concept,
    BankAccount,
    CashSession,
    CashMovement,
    StudentAccountCharge,
    StudentAccountPayment,
    BankMovement,
    ReconciliationRun,
    ReconciliationItem,
    IncomeEntry,
)

admin.site.register(Concept)
admin.site.register(BankAccount)
admin.site.register(CashSession)
admin.site.register(CashMovement)
admin.site.register(StudentAccountCharge)
admin.site.register(StudentAccountPayment)
admin.site.register(BankMovement)
admin.site.register(ReconciliationRun)
admin.site.register(ReconciliationItem)
admin.site.register(IncomeEntry)
