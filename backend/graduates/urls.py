"""
graduates/urls.py
─────────────────
URL configuration para el módulo de egresados.

Incluir en el urls.py principal:

    from django.urls import path, include

    urlpatterns = [
        ...
        path("api/", include("graduates.urls")),
        ...
    ]

Endpoints resultantes:
  PUBLIC:
    GET  /api/public/graduates/search/
    GET  /api/public/graduates/<pk>/constancia/
  ADMIN CRUD (router):
    GET    /api/graduates/              → list
    POST   /api/graduates/              → create
    GET    /api/graduates/<pk>/          → retrieve
    PUT    /api/graduates/<pk>/          → update
    PATCH  /api/graduates/<pk>/          → partial_update
    DELETE /api/graduates/<pk>/          → destroy (soft delete)
    GET    /api/graduates/stats/         → stats
    GET    /api/graduates/export/xlsx/   → export Excel
  CATÁLOGO:
    GET/POST   /api/graduates/grado-titulo-types/
    GET/PUT/PATCH/DELETE /api/graduates/grado-titulo-types/<pk>/
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# ── Router para el ViewSet admin ──
router = DefaultRouter()
router.register(r"graduates", views.GraduateAdminViewSet, basename="graduate")

urlpatterns = [
    # ── Público ───────────────────────────────────────────────────────────
    path(
        "public/graduates/search/",
        views.GraduateSearchView.as_view(),
        name="graduate-search",
    ),
    path(
        "public/graduates/<int:pk>/constancia/",
        views.GraduateConstanciaView.as_view(),
        name="graduate-constancia",
    ),

    # ── Admin: Catálogo de Grado/Título Types ─────────────────────────────
    path(
        "graduates/grado-titulo-types/",
        views.GradoTituloTypeListCreateView.as_view(),
        name="grado-titulo-type-list",
    ),
    path(
        "graduates/grado-titulo-types/<int:pk>/",
        views.GradoTituloTypeDetailView.as_view(),
        name="grado-titulo-type-detail",
    ),

    # ── Admin CRUD (ViewSet via router) ───────────────────────────────────
    path("", include(router.urls)),
]