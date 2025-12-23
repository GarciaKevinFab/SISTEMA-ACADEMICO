from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PagesViewSet, NewsViewSet, DocumentsViewSet,
    public_contact, public_preinscription,
    inbox_list, inbox_get, inbox_set_status,
    AdmissionCallsViewSet, public_admission_calls
)

router = DefaultRouter()
router.register(r"portal/pages", PagesViewSet, basename="portal-pages")
router.register(r"portal/news", NewsViewSet, basename="portal-news")
router.register(r"portal/documents", DocumentsViewSet, basename="portal-docs")
router.register(r"portal/admission-calls", AdmissionCallsViewSet, basename="portal-admission-calls")

urlpatterns = [
    path("", include(router.urls)),

    # públicos (tus forms)
    path("public/contact", public_contact),
    path("public/preinscriptions", public_preinscription),

    # inbox
    path("portal/inbox", inbox_list),
    path("portal/inbox/<int:id>", inbox_get),
    path("portal/inbox/<int:id>/status", inbox_set_status),

    # ✅ ESTE ES EL QUE TE FALTA (sin slash final, tal cual tu request)
    path("portal/public/admission-calls", public_admission_calls),
]
