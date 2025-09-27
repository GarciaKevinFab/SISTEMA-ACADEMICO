from django.urls import path
from .views import mfa_setup, mfa_verify, mfa_disable, mfa_backup_codes, mfa_challenge

urlpatterns = [
    path('auth/mfa/setup', mfa_setup),
    path('auth/mfa/verify', mfa_verify),
    path('auth/mfa/disable', mfa_disable),
    path('auth/mfa/backup-codes', mfa_backup_codes),
    path('auth/mfa/challenge', mfa_challenge),
]
