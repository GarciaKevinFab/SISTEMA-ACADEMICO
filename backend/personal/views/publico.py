"""
Portal público de transparencia del personal (sin login).

  GET /api/personal/public/directorio            → los tres colectivos
  GET /api/personal/public/staff/<id>/cv.pdf     → hoja de vida en PDF

Un solo endpoint (y en el frontend, un solo enlace) con los tres bloques en
el orden que pidió la asistencia del MINEDU:

  1. Jefes de línea (Ley N° 30512) — datos generales, plan de trabajo,
     grado académico y foto.
  2. Administrativos — datos generales, foto y cargo.
  3. Locadores 107 – MINEDU — además, orden de servicio vigente, protocolo,
     plan de trabajo y hoja de vida.

Va aparte de la plana docente (/public/docentes) porque son la parte
administrativa, no personal docente.
"""
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from personal.models import JefeLinea, Personal

from .comun import jefe_dict, personal_dict, sembrar_cargos


class DirectorioPublicoView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        sembrar_cargos()

        jefes = (JefeLinea.objects
                 .select_related("teacher", "teacher__user")
                 .filter(activo=True).order_by("orden", "id"))
        # En el portal solo tienen sentido los cargos con responsable
        # designado; los vacantes se ven en el panel admin.
        jefes_rows = [jefe_dict(j, request, publico=True)
                      for j in jefes if j.teacher_id]

        base = (Personal.objects.filter(activo=True)
                .prefetch_related("cv_items"))
        admin_rows = [personal_dict(p, request, publico=True)
                      for p in base.filter(tipo=Personal.ADMINISTRATIVO)]
        loc_rows = [personal_dict(p, request, publico=True)
                    for p in base.filter(tipo=Personal.LOCADOR)]

        try:
            from students.name_utils import clave_orden
            admin_rows.sort(key=lambda r: (r["orden"], clave_orden(r["nombre"])))
            loc_rows.sort(key=lambda r: (r["orden"], clave_orden(r["nombre"])))
        except Exception:
            admin_rows.sort(key=lambda r: (r["orden"], r["nombre"]))
            loc_rows.sort(key=lambda r: (r["orden"], r["nombre"]))

        return Response({
            "secciones": [
                {"clave": "jefes", "titulo": "Jefes de Línea",
                 "subtitulo": "Cargos del Reglamento de la Ley N° 30512",
                 "total": len(jefes_rows)},
                {"clave": "administrativos", "titulo": "Administrativos",
                 "subtitulo": "Cargos según el Reglamento Institucional",
                 "total": len(admin_rows)},
                {"clave": "locadores", "titulo": "Locadores 107 – MINEDU",
                 "subtitulo": "Personal por locación de servicios",
                 "total": len(loc_rows)},
            ],
            "jefes_linea": jefes_rows,
            "administrativos": admin_rows,
            "locadores": loc_rows,
        })


class StaffCvPublicPdfView(APIView):
    """Hoja de vida pública de un administrativo / locador."""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk: int):
        p = get_object_or_404(Personal, pk=pk, activo=True)
        from catalogs.views.hoja_vida import TeacherCVPdfView
        return TeacherCVPdfView()._emitir(p, request)
