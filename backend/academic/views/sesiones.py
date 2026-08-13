"""
Sesiones de aprendizaje del docente — un PDF por semana/día de clase.

  GET    /academic/sections/<id>/sesiones        → sesiones de la sección
  POST   /academic/sections/<id>/sesiones        → subir (multipart)
  PUT    /academic/sesiones/<id>                 → editar
  DELETE /academic/sesiones/<id>                 → eliminar

Reglas (las mismas de la asistencia):
  · Un docente solo gestiona las sesiones de SUS secciones (admin: todas).
  · La fecha debe ser DÍA DE DICTADO según el horario de la sección
    (o L-V si no hay horario cargado) y estar dentro de la vigencia del
    período (Configuración → Periodos Académicos).
  · Solo PDF, máximo 15 MB.
"""
from datetime import datetime

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework_simplejwt.authentication import JWTAuthentication

from academic.models import Section, SesionAprendizaje
from .attendance import (_schedule_weekdays, _vigencia_de_periodo,
                         _fuera_de_vigencia)

DIAS_NOMBRE = {0: "lunes", 1: "martes", 2: "miércoles", 3: "jueves",
               4: "viernes", 5: "sábado", 6: "domingo"}


def _sesion_dict(s, request=None):
    url = ""
    try:
        if s.archivo:
            url = s.archivo.url
            if request:
                url = request.build_absolute_uri(url)
    except Exception:
        url = ""
    return {
        "id": s.id, "section_id": s.section_id,
        "fecha": str(s.fecha), "semana": s.semana, "tema": s.tema,
        "archivo_url": url,
        "archivo_nombre": (s.archivo.name.rsplit("/", 1)[-1]
                           if s.archivo else ""),
        "subido": s.created_at.strftime("%d/%m/%Y %H:%M"),
    }


def _validar(sec, data, files, requiere_archivo):
    """(fecha, semana, tema, archivo, error). Aplica las reglas de dictado."""
    tema = str(data.get("tema") or "").strip()
    if not tema:
        return None, None, "", None, "El tema de la sesión es obligatorio."

    raw = str(data.get("fecha") or "").strip()
    try:
        fecha = datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return None, None, "", None, "fecha inválida (YYYY-MM-DD)."

    # Día de dictado según horario (o L-V sin horario) + vigencia del período
    horario = set(_schedule_weekdays(sec.id))
    wd = fecha.weekday()
    es_dictado = ((wd + 1) in horario) if horario else (wd < 5)
    if not es_dictado:
        dias = ", ".join(DIAS_NOMBRE[w - 1] for w in sorted(horario)) \
            if horario else "lunes a viernes"
        return None, None, "", None, (
            f"El {fecha.strftime('%d/%m/%Y')} ({DIAS_NOMBRE[wd]}) no es día "
            f"de clase de esta sección. El curso se dicta: {dias}.")
    ini, fin = _vigencia_de_periodo(sec.period)
    if _fuera_de_vigencia(fecha, ini, fin):
        rango = (f"{ini.strftime('%d/%m/%Y') if ini else '—'} al "
                 f"{fin.strftime('%d/%m/%Y') if fin else '—'}")
        return None, None, "", None, (
            f"El {fecha.strftime('%d/%m/%Y')} está fuera de la vigencia del "
            f"período {sec.period} ({rango}).")

    semana = None
    if str(data.get("semana") or "").strip():
        try:
            semana = max(1, min(52, int(data.get("semana"))))
        except (TypeError, ValueError):
            return None, None, "", None, "semana inválida."

    archivo = files.get("archivo")
    if archivo is not None:
        if not (archivo.name or "").lower().endswith(".pdf"):
            return None, None, "", None, "Solo se aceptan archivos PDF."
        if archivo.size > 15 * 1024 * 1024:
            return None, None, "", None, "El PDF no puede superar 15 MB."
    elif requiere_archivo:
        return None, None, "", None, "Adjunta el PDF de la sesión."

    return fecha, semana, tema, archivo, ""


class SectionSesionesView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def _seccion(self, request, section_id):
        from .teachers import _grades_section_access_denied
        sec = get_object_or_404(
            Section.objects.select_related("plan_course__course",
                                           "teacher__user"),
            id=section_id)
        err = _grades_section_access_denied(request, sec)
        return sec, err

    def get(self, request, section_id: int):
        sec, err = self._seccion(request, section_id)
        if err:
            return err
        horario = sorted(_schedule_weekdays(sec.id))
        ini, fin = _vigencia_de_periodo(sec.period)
        return Response({
            "section_id": sec.id,
            "period": sec.period,
            "schedule_weekdays": horario,
            "period_start": str(ini) if ini else "",
            "period_end": str(fin) if fin else "",
            "sesiones": [_sesion_dict(s, request)
                         for s in sec.sesiones_aprendizaje.all()],
        })

    def post(self, request, section_id: int):
        sec, err = self._seccion(request, section_id)
        if err:
            return err
        fecha, semana, tema, archivo, error = _validar(
            sec, request.data, request.FILES, requiere_archivo=True)
        if error:
            return Response({"detail": error}, status=400)
        s = SesionAprendizaje.objects.create(
            section=sec, fecha=fecha, semana=semana, tema=tema,
            archivo=archivo, created_by=request.user)
        return Response(_sesion_dict(s, request), status=201)


class SesionDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def _sesion(self, request, sesion_id):
        from .teachers import _grades_section_access_denied
        s = get_object_or_404(
            SesionAprendizaje.objects.select_related(
                "section__teacher__user", "section__plan_course__course"),
            id=sesion_id)
        err = _grades_section_access_denied(request, s.section)
        return s, err

    def put(self, request, sesion_id: int):
        s, err = self._sesion(request, sesion_id)
        if err:
            return err
        fecha, semana, tema, archivo, error = _validar(
            s.section, request.data, request.FILES, requiere_archivo=False)
        if error:
            return Response({"detail": error}, status=400)
        s.fecha, s.semana, s.tema = fecha, semana, tema
        if archivo is not None:
            s.archivo = archivo
        s.save()
        return Response(_sesion_dict(s, request))

    def delete(self, request, sesion_id: int):
        s, err = self._sesion(request, sesion_id)
        if err:
            return err
        s.delete()
        return Response(status=204)
