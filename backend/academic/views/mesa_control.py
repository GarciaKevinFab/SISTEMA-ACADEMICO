"""
Mesa de Control Académico — API.

Expone al sistema lo que hasta ahora solo se podía hacer por consola:
corregir matrículas confirmadas, ubicar alumnos que no aparecen en un acta o
en una nómina, y fusionar fichas duplicadas sin perder kárdex.

Toda la lógica vive en `academic/services/mesa_control.py`, que es también la
que usa `manage.py auditar_datos`: una sola implementación para las dos vías.

Endpoints (todos bajo /api/academic/mesa-control/):
    GET  incidencias?period=2026-I         panel de casos por resolver
    POST incidencias/corregir              correcciones masivas seguras
    GET  alumnos?q=                        buscador por DNI o nombre
    GET  alumno/<dni>                      radiografía completa
    POST alumno/<dni>/curso                agregar curso (section_id)
    DELETE alumno/<dni>/curso/<item_id>    quitar curso (?forzar=1)
    POST alumno/<dni>/curso/<item_id>/seccion   asignar/cambiar sección
    GET  seccion/<id>                      acta vs nómina del ciclo
    POST fusionar                          fusionar kárdex de fichas duplicadas
"""
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from academic.services import mesa_control as svc
from .utils import ok, _can_admin_enroll


class _MesaControlBase(APIView):
    """Solo Secretaría Académica / Registro / administradores.

    Se reutiliza `_can_admin_enroll` porque es exactamente el permiso de quien
    puede matricular: estas operaciones son correcciones de matrícula.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def _denegado(self, request):
        if _can_admin_enroll(request.user):
            return None
        return Response(
            {"detail": "Solo Secretaría Académica puede usar la Mesa de Control."},
            status=403)


# ══════════════════════════════════════════════════════════════
#  PANEL DE INCIDENCIAS
# ══════════════════════════════════════════════════════════════

class PeriodosView(_MesaControlBase):
    """Períodos con datos reales, para el selector. Trae cuál conviene abrir."""

    def get(self, request):
        if err := self._denegado(request):
            return err
        return Response(svc.periodos_disponibles())


class IncidenciasView(_MesaControlBase):
    def get(self, request):
        if err := self._denegado(request):
            return err
        return Response(svc.incidencias(request.query_params.get("period")))


class IncidenciasCorregirView(_MesaControlBase):
    """Correcciones masivas seguras. `accion` puede ser:

        asignar_secciones   → ítems en NULL cuyo curso tiene UNA sola sección
        sincronizar_fichas  → ciclo y período de la ficha según su matrícula
        restaurar_vacias    → devolver los cursos a matrículas sin ninguno

    Sin `aplicar` solo simula y devuelve qué haría.
    """
    ACCIONES = {
        "asignar_secciones": svc.asignar_secciones_unicas,
        "sincronizar_fichas": svc.sincronizar_fichas,
        "restaurar_vacias": svc.restaurar_matriculas_vacias,
    }

    def post(self, request):
        if err := self._denegado(request):
            return err
        body = request.data or {}
        accion = (body.get("accion") or "").strip()
        fn = self.ACCIONES.get(accion)
        if not fn:
            return Response(
                {"detail": f"Acción inválida. Opciones: {', '.join(self.ACCIONES)}"},
                status=400)
        n, detalle = fn(body.get("period"), aplicar=bool(body.get("aplicar")))
        return ok(accion=accion, aplicado=bool(body.get("aplicar")),
                  afectados=n, detalle=detalle)


# ══════════════════════════════════════════════════════════════
#  ALUMNO
# ══════════════════════════════════════════════════════════════

class AlumnosBuscarView(_MesaControlBase):
    def get(self, request):
        if err := self._denegado(request):
            return err
        return ok(students=svc.buscar_alumnos(request.query_params.get("q")))


class AlumnoDetalleView(_MesaControlBase):
    def get(self, request, dni):
        if err := self._denegado(request):
            return err
        data = svc.radiografia(dni)
        if not data:
            return Response({"detail": f"No existe ficha con DNI {dni}"}, status=404)
        return Response(data)


class AlumnoCursoView(_MesaControlBase):
    """Agregar un curso a la matrícula confirmada."""

    def post(self, request, dni):
        if err := self._denegado(request):
            return err
        body = request.data or {}
        section_id = body.get("section_id")
        if not section_id:
            return Response({"detail": "section_id es requerido"}, status=400)
        okey, msg, detalle = svc.agregar_curso(dni, section_id, body.get("period"))
        if not okey:
            return Response({"detail": msg, **detalle}, status=400)
        return ok(message=msg, **detalle)


class AlumnoCursoItemView(_MesaControlBase):
    """Quitar un curso, o asignarle sección."""

    def delete(self, request, dni, item_id):
        if err := self._denegado(request):
            return err
        forzar = str(request.query_params.get("forzar", "")).lower() in ("1", "true", "si", "sí")
        okey, msg, detalle = svc.quitar_curso(dni, item_id, forzar=forzar)
        if not okey:
            # 409 cuando solo falta confirmar (hay notas o asistencia)
            estado = 409 if detalle.get("requiere_forzar") else 400
            return Response({"detail": msg, **detalle}, status=estado)
        return ok(message=msg, **detalle)


class AlumnoCursoSeccionView(_MesaControlBase):
    def post(self, request, dni, item_id):
        if err := self._denegado(request):
            return err
        section_id = (request.data or {}).get("section_id")
        if not section_id:
            return Response({"detail": "section_id es requerido"}, status=400)
        okey, msg, detalle = svc.asignar_seccion(dni, item_id, section_id)
        if not okey:
            return Response({"detail": msg}, status=400)
        return ok(message=msg, **detalle)


# ══════════════════════════════════════════════════════════════
#  SECCIÓN Y FUSIÓN
# ══════════════════════════════════════════════════════════════

class SeccionRosterView(_MesaControlBase):
    def get(self, request, section_id):
        if err := self._denegado(request):
            return err
        data = svc.roster_seccion(section_id)
        if not data:
            return Response({"detail": f"No existe la sección #{section_id}"}, status=404)
        return Response(data)


class FusionarView(_MesaControlBase):
    """Mueve el kárdex de una ficha duplicada a la buena. Simula por defecto."""

    def post(self, request):
        if err := self._denegado(request):
            return err
        body = request.data or {}
        origen, destino = body.get("dni_origen"), body.get("dni_destino")
        if not origen or not destino:
            return Response(
                {"detail": "dni_origen y dni_destino son requeridos"}, status=400)
        okey, msg, detalle = svc.fusionar_kardex(
            origen, destino, aplicar=bool(body.get("aplicar")))
        if not okey:
            return Response({"detail": msg}, status=400)
        return ok(message=msg, **detalle)
