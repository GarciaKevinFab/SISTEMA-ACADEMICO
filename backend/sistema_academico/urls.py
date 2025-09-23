# backend/sistema_academico/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Vistas directas para /api/kardex/*
from students.views import kardex_of_student, kardex_boleta_pdf, kardex_constancia_pdf
from enrollment.views import enrollment_suggestions  # lo agregamos abajo

urlpatterns = [
    path("admin/", admin.site.urls),

    # Common (catálogos, health, institution, ubigeo, etc)
    path("api/", include(("common.urls", "common"), namespace="common")),

    # Accounts en dos prefijos
    path("api/accounts/", include(("accounts.urls", "accounts"), namespace="accounts")),
    path("api/", include(("accounts.urls", "accounts_alias"), namespace="accounts_alias")),

    # Courses SIN prefijo extra (para /api/careers, /api/sections, /api/academic/plans)
    path("api/", include(("courses.urls", "courses"), namespace="courses")),

    # Resto de apps con prefijos
    path("api/students/", include(("students.urls", "students"), namespace="students")),
    path("api/enrollment/", include(("enrollment.urls", "enrollment"), namespace="enrollment")),
    path("api/grades/", include(("grades.urls", "grades"), namespace="grades")),
    path("api/procedures/", include(("procedures.urls", "procedures"), namespace="procedures")),

    # === Endpoints requeridos por academic.service ===
    # Kardex JSON y PDFs directos:
    path("api/kardex/<int:student_id>", kardex_of_student, name="kardex-json"),
    path("api/kardex/<int:student_id>/boleta/pdf", kardex_boleta_pdf, name="kardex-boleta-pdf"),
    path("api/kardex/<int:student_id>/constancia/pdf", kardex_constancia_pdf, name="kardex-constancia-pdf"),

    # Sugerencias de matrícula:
    path("api/enrollments/suggestions", enrollment_suggestions, name="enrollments-suggestions"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
