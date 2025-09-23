# backend/grades/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import GradeViewSet, kardex_of_student, boleta_pdf, constancia_pdf

router = DefaultRouter()
router.register(r"", GradeViewSet, basename="grade")

urlpatterns = [
    path("", include(router.urls)),

    # Kárdex + PDFs
    path("kardex/<int:student_id>", kardex_of_student, name="kardex-student"),
    path("kardex/<int:student_id>/boleta/pdf", boleta_pdf, name="kardex-boleta-pdf"),
    path("kardex/<int:student_id>/constancia/pdf", constancia_pdf, name="kardex-constancia-pdf"),
]
