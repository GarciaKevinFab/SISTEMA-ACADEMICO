from django.urls import path

from .views import (
    # Jefes de línea (Ley N° 30512)
    JefesLineaListView, JefeLineaDetailView, JefeLineaPlanView,
    JefeLineaRdView, CandidatosDocentesView,
    # Administrativos y locadores 107
    StaffListView, StaffDetailView, StaffAccesoView, StaffCvPdfView,
    # Panel propio
    MiPersonalView, MiPerfilView, MiCvListView, MiCvDetailView, MiCvPdfView,
    MiPlanTrabajoView, MiRdView, MisDocumentosView,
    # Portal público
    DirectorioPublicoView, StaffCvPublicPdfView,
)

urlpatterns = [
    # ── PÚBLICO (sin login) — un solo enlace con los tres colectivos ──
    path("public/directorio",              DirectorioPublicoView.as_view()),
    path("public/staff/<int:pk>/cv.pdf",   StaffCvPublicPdfView.as_view()),

    # ── Panel propio (antes que las rutas admin con <int:pk>) ──
    path("me",                   MiPersonalView.as_view()),
    path("me/profile",           MiPerfilView.as_view()),
    path("me/cv",                MiCvListView.as_view()),
    path("me/cv/pdf",            MiCvPdfView.as_view()),
    path("me/cv/<int:item_id>",  MiCvDetailView.as_view()),
    path("me/plan-trabajo",      MiPlanTrabajoView.as_view()),
    path("me/rd",                MiRdView.as_view()),
    path("me/documentos",        MisDocumentosView.as_view()),

    # ── Jefes de línea (admin) ──
    path("jefes-linea",                 JefesLineaListView.as_view()),
    path("jefes-linea/candidatos",      CandidatosDocentesView.as_view()),
    path("jefes-linea/<int:pk>",        JefeLineaDetailView.as_view()),
    path("jefes-linea/<int:pk>/plan",   JefeLineaPlanView.as_view()),
    path("jefes-linea/<int:pk>/rd",     JefeLineaRdView.as_view()),

    # ── Administrativos y locadores (admin) ──
    path("staff",                  StaffListView.as_view()),
    path("staff/<int:pk>",         StaffDetailView.as_view()),
    path("staff/<int:pk>/acceso",  StaffAccesoView.as_view()),
    path("staff/<int:pk>/cv/pdf",  StaffCvPdfView.as_view()),
]
