"""
Jefes de línea — cargos del Reglamento de la Ley N° 30512 (p. 31).

  GET    /api/personal/jefes-linea             → los 13 cargos + responsable
  PUT    /api/personal/jefes-linea/<id>        → asignar/quitar responsable
  POST   /api/personal/jefes-linea/<id>/rd     → subir la R.D. Regional (PDF)
  DELETE /api/personal/jefes-linea/<id>/rd     → quitar la R.D. Regional
  POST   /api/personal/jefes-linea/<id>/plan   → subir plan de trabajo (admin)
  DELETE /api/personal/jefes-linea/<id>/plan   → quitar plan de trabajo
  GET    /api/personal/jefes-linea/candidatos  → docentes del módulo Académico

El RESPONSABLE se jala del directorio de docentes: son docentes que además
ocupan un cargo, así que NO se les crea usuario — siguen entrando con su
misma contraseña de docente. Lo único que cambia al designarlos es que en su
panel les aparece el botón para subir su plan de trabajo.
"""
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from catalogs.models import Teacher
from personal.models import JefeLinea

from .comun import es_admin_personal, jefe_dict, nombre_de_teacher, \
    sembrar_cargos, url_de

MAX_PLAN_MB = 15
MAX_RD_MB = 15


def validar_pdf(f, tope_mb, rotulo):
    """La R.D. va en PDF (pedido de Dirección). Devuelve "" o el error."""
    if f.size > tope_mb * 1024 * 1024:
        return f"{rotulo} no puede superar {tope_mb} MB."
    nombre = (getattr(f, "name", "") or "").lower()
    tipo = (getattr(f, "content_type", "") or "").lower()
    if not nombre.endswith(".pdf") and tipo != "application/pdf":
        return f"{rotulo} debe ser un archivo PDF."
    return ""


class _AdminView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def _gate(self, request):
        if not es_admin_personal(request.user):
            return Response(
                {"detail": "No autorizado para gestionar el personal."},
                status=403)
        return None


class JefesLineaListView(_AdminView):
    def get(self, request):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        sembrar_cargos()
        filas = (JefeLinea.objects
                 .select_related("teacher", "teacher__user")
                 .order_by("orden", "id"))
        rows = [jefe_dict(j, request) for j in filas]
        return Response({
            "rows": rows,
            "total": len(rows),
            "asignados": sum(1 for r in rows if r["responsable"]),
            "con_plan": sum(1 for r in rows if r["plan_trabajo_url"]),
            "con_rd": sum(1 for r in rows if r["rd_url"]),
        })


class JefeLineaDetailView(_AdminView):
    def put(self, request, pk: int):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        j = get_object_or_404(JefeLinea, pk=pk)
        data = request.data or {}

        if "teacher_id" in data:
            raw = data.get("teacher_id")
            if raw in (None, "", "null", 0, "0"):
                # Quitar al responsable también retira su plan de trabajo:
                # el plan pertenece a la persona, no al cargo.
                j.teacher = None
                j.plan_trabajo = None
                j.plan_trabajo_subido = None
                j.resolucion_archivo = None
                j.resolucion_subida = None
            else:
                try:
                    j.teacher = Teacher.objects.get(pk=int(raw))
                except (Teacher.DoesNotExist, TypeError, ValueError):
                    return Response(
                        {"detail": "El docente indicado no existe en el "
                                   "directorio del módulo Académico."},
                        status=400)

        if "resolucion" in data:
            j.resolucion = str(data.get("resolucion") or "").strip()[:160]

        if "designado_desde" in data:
            v = str(data.get("designado_desde") or "").strip()
            if v:
                d = parse_date(v)
                if not d:
                    return Response(
                        {"detail": "designado_desde inválida (YYYY-MM-DD)"},
                        status=400)
                j.designado_desde = d
            else:
                j.designado_desde = None

        if "activo" in data:
            j.activo = str(data.get("activo")).lower() not in ("false", "0", "")

        j.save()
        return Response(jefe_dict(j, request))


class JefeLineaPlanView(_AdminView):
    """Plan de trabajo cargado desde el panel admin (respaldo del docente)."""

    def post(self, request, pk: int):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        j = get_object_or_404(JefeLinea, pk=pk)
        f = request.FILES.get("archivo") or request.FILES.get("plan_trabajo")
        if not f:
            return Response({"detail": "Adjunta el archivo del plan."},
                            status=400)
        if f.size > MAX_PLAN_MB * 1024 * 1024:
            return Response(
                {"detail": f"El plan no puede superar {MAX_PLAN_MB} MB."},
                status=400)
        j.plan_trabajo = f
        j.plan_trabajo_subido = timezone.now()
        j.save(update_fields=["plan_trabajo", "plan_trabajo_subido",
                              "updated_at"])
        return Response(jefe_dict(j, request))

    def delete(self, request, pk: int):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        j = get_object_or_404(JefeLinea, pk=pk)
        j.plan_trabajo = None
        j.plan_trabajo_subido = None
        j.save(update_fields=["plan_trabajo", "plan_trabajo_subido",
                              "updated_at"])
        return Response(jefe_dict(j, request))


class JefeLineaRdView(_AdminView):
    """R.D. Regional de la designación, en PDF."""

    def post(self, request, pk: int):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        j = get_object_or_404(JefeLinea, pk=pk)
        f = request.FILES.get("archivo") or request.FILES.get("rd")
        if not f:
            return Response({"detail": "Adjunta el PDF de la R.D."},
                            status=400)
        err = validar_pdf(f, MAX_RD_MB, "La R.D.")
        if err:
            return Response({"detail": err}, status=400)
        j.resolucion_archivo = f
        j.resolucion_subida = timezone.now()
        campos = ["resolucion_archivo", "resolucion_subida", "updated_at"]
        # El número de R.D. puede venir junto con el archivo
        if "resolucion" in request.data:
            j.resolucion = str(request.data.get("resolucion") or "").strip()[:160]
            campos.append("resolucion")
        j.save(update_fields=campos)
        return Response(jefe_dict(j, request))

    def delete(self, request, pk: int):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        j = get_object_or_404(JefeLinea, pk=pk)
        j.resolucion_archivo = None
        j.resolucion_subida = None
        j.save(update_fields=["resolucion_archivo", "resolucion_subida",
                              "updated_at"])
        return Response(jefe_dict(j, request))


class CandidatosDocentesView(_AdminView):
    """Docentes del módulo Académico para el filtro de «Responsable»."""

    def get(self, request):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        q = (request.query_params.get("q") or "").strip()
        qs = Teacher.objects.select_related("user").all()
        if q:
            qs = qs.filter(
                Q(document__icontains=q)
                | Q(full_name__icontains=q)
                | Q(nombres__icontains=q)
                | Q(apellido_paterno__icontains=q)
                | Q(apellido_materno__icontains=q)
                | Q(specialization__icontains=q)
                | Q(user__full_name__icontains=q)
                | Q(user__username__icontains=q)
            )
        rows = [{
            "teacher_id": t.id,
            "nombre": nombre_de_teacher(t),
            "documento": t.document or "",
            "especialidad": t.specialization or "",
            "grado_label": dict(Teacher.GRADOS_ACADEMICOS).get(
                t.grado_academico, ""),
            "foto_url": url_de(request, t.photo),
        } for t in qs[:400]]
        try:
            from students.name_utils import clave_orden
            rows.sort(key=lambda r: clave_orden(r["nombre"]))
        except Exception:
            rows.sort(key=lambda r: r["nombre"])
        return Response({"rows": rows, "total": len(rows)})
