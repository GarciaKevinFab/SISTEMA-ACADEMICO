"""
Administrativos y locadores 107 – MINEDU (gestión admin).

  GET    /api/personal/staff?tipo=ADMINISTRATIVO|LOCADOR&q=
  POST   /api/personal/staff              → alta de ficha + usuario y acceso
  GET    /api/personal/staff/<id>         → ficha + hoja de vida
  PUT    /api/personal/staff/<id>         → editar ficha
  DELETE /api/personal/staff/<id>         → baja de la ficha
  POST   /api/personal/staff/<id>/acceso  → crear/reponer usuario, o resetear
                                            la contraseña (?reset=1)
  GET    /api/personal/staff/<id>/cv/pdf  → hoja de vida en PDF

Aquí es donde se crean los usuarios y accesos de los administrativos y del
personal 107: al entrar al sistema con su rol les aparece su hoja de vida
(los mismos ítems que los docentes) y, en el caso de los locadores, la carga
de orden de servicio, protocolo y plan de trabajo.
"""
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from personal.models import Personal

from .comun import (asegurar_rol, es_admin_personal, personal_dict,
                    provisionar_usuario, ROL_POR_TIPO)

MAX_DOC_MB = 15
MAX_FOTO_MB = 5

TEXTOS = {
    "cargo": 160, "area": 120, "document": 30, "full_name": 160,
    "email": 254, "phone": 30, "specialization": 120,
    "apellido_paterno": 80, "apellido_materno": 80, "nombres": 120,
    "telefono_fijo": 30, "direccion": 200, "region": 80, "provincia": 80,
    "distrito": 80, "rd_nombramiento": 120, "orden_servicio_numero": 120,
}
FECHAS = ["fecha_nac", "rd_fecha", "orden_servicio_desde",
          "orden_servicio_hasta"]
ARCHIVOS = {"photo": MAX_FOTO_MB, "orden_servicio": MAX_DOC_MB,
            "protocolo": MAX_DOC_MB, "plan_trabajo": MAX_DOC_MB}
OPCIONES = {
    "tipo": {c for c, _ in Personal.TIPOS},
    "sexo": {"", "M", "F"},
    "grado_academico": {""} | {c for c, _ in Personal.GRADOS_ACADEMICOS},
    "condicion_laboral": {""} | {c for c, _ in Personal.CONDICIONES},
}


def _aplicar(p, data, files):
    """Vuelca el payload sobre la ficha. Devuelve "" o el mensaje de error."""
    for campo, tope in TEXTOS.items():
        if campo in data:
            setattr(p, campo, str(data.get(campo) or "").strip()[:tope])

    for campo in FECHAS:
        if campo in data:
            v = str(data.get(campo) or "").strip()
            if not v:
                setattr(p, campo, None)
                continue
            d = parse_date(v)
            if not d:
                return f"«{campo}» inválida (usa el formato YYYY-MM-DD)."
            setattr(p, campo, d)

    for campo, validas in OPCIONES.items():
        if campo in data:
            v = str(data.get(campo) or "").strip().upper()
            if v not in validas:
                return f"«{campo}» inválido: {v!r}"
            setattr(p, campo, v)

    if "activo" in data:
        p.activo = str(data.get("activo")).lower() not in ("false", "0", "")
    if "orden" in data:
        try:
            p.orden = max(0, int(data.get("orden") or 0))
        except (TypeError, ValueError):
            pass

    for campo, tope_mb in ARCHIVOS.items():
        f = files.get(campo) if files else None
        if f is None:
            continue
        if f.size > tope_mb * 1024 * 1024:
            return f"«{campo}» no puede superar {tope_mb} MB."
        setattr(p, campo, f)

    if not p.full_name:
        p.full_name = p.nombre_completo
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


class StaffListView(_AdminView):
    def get(self, request):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        qs = Personal.objects.select_related("user").prefetch_related("cv_items")
        tipo = (request.query_params.get("tipo") or "").strip().upper()
        if tipo in OPCIONES["tipo"]:
            qs = qs.filter(tipo=tipo)
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(document__icontains=q) | Q(full_name__icontains=q)
                | Q(nombres__icontains=q) | Q(apellido_paterno__icontains=q)
                | Q(apellido_materno__icontains=q) | Q(cargo__icontains=q)
                | Q(area__icontains=q) | Q(email__icontains=q))
        if (request.query_params.get("solo_activos") or "") in ("1", "true"):
            qs = qs.filter(activo=True)
        rows = [personal_dict(p, request) for p in qs]
        return Response({"rows": rows, "total": len(rows)})

    def post(self, request):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        tipo = str(request.data.get("tipo") or "").strip().upper()
        if tipo not in OPCIONES["tipo"]:
            return Response(
                {"detail": "Indica el tipo: ADMINISTRATIVO o LOCADOR."},
                status=400)

        p = Personal(tipo=tipo)
        err = _aplicar(p, request.data, request.FILES)
        if err:
            return Response({"detail": err}, status=400)
        if not p.nombre_completo:
            return Response(
                {"detail": "Ingresa al menos los apellidos y nombres."},
                status=400)
        p.save()

        # Alta del usuario y acceso (se puede omitir con crear_acceso=0)
        temporal = None
        if str(request.data.get("crear_acceso", "1")).lower() not in ("0", "false"):
            user, temporal, err = provisionar_usuario(
                p, p.document, p.nombre_completo, p.email)
            if err:
                # La ficha ya existe: se informa el problema del acceso sin
                # perder los datos cargados.
                return Response({**personal_dict(p, request),
                                 "acceso_error": err}, status=201)
            p.user = user
            p.save(update_fields=["user", "updated_at"])

        out = personal_dict(p, request)
        if temporal:
            out["temporary_password"] = temporal
            out["must_change_password"] = True
        return Response(out, status=201)


class StaffDetailView(_AdminView):
    def get(self, request, pk: int):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        p = get_object_or_404(Personal, pk=pk)
        from .mi_panel import item_dict, items_ordenados
        return Response({
            **personal_dict(p, request),
            "items": [item_dict(i, request) for i in items_ordenados(p)],
        })

    def put(self, request, pk: int):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        p = get_object_or_404(Personal, pk=pk)
        tipo_previo = p.tipo
        err = _aplicar(p, request.data, request.FILES)
        if err:
            return Response({"detail": err}, status=400)
        p.save()
        # Cambió de administrativo a locador (o al revés): que el rol siga
        # al tipo, si no entra al sistema y no ve su panel.
        if p.user and p.tipo != tipo_previo:
            asegurar_rol(p.user, ROL_POR_TIPO.get(p.tipo))
        return Response(personal_dict(p, request))

    def delete(self, request, pk: int):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        p = get_object_or_404(Personal, pk=pk)
        # Se desactiva la cuenta pero NO se borra el usuario: puede tener
        # rastro en auditoría y en mesa de partes.
        if p.user:
            p.user.is_active = False
            p.user.save(update_fields=["is_active"])
        p.delete()
        return Response(status=204)


class StaffAccesoView(_AdminView):
    """Crea el acceso de la ficha, o resetea su contraseña (?reset=1)."""

    def post(self, request, pk: int):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        p = get_object_or_404(Personal, pk=pk)
        reset = (str(request.query_params.get("reset")
                     or request.data.get("reset") or "").lower()
                 in ("1", "true"))

        if p.user and not reset:
            asegurar_rol(p.user, ROL_POR_TIPO.get(p.tipo))
            if not p.user.is_active:
                p.user.is_active = True
                p.user.save(update_fields=["is_active"])
            return Response({**personal_dict(p, request),
                             "detail": "El acceso ya existía; quedó activo."})

        if p.user and reset:
            from django.utils.crypto import get_random_string
            temporal = get_random_string(12)
            p.user.set_password(temporal)
            p.user.is_active = True
            campos = ["password", "is_active"]
            if hasattr(p.user, "must_change_password"):
                p.user.must_change_password = True
                campos.append("must_change_password")
            p.user.save(update_fields=campos)
            return Response({**personal_dict(p, request),
                             "temporary_password": temporal,
                             "must_change_password": True})

        user, temporal, err = provisionar_usuario(
            p, p.document, p.nombre_completo, p.email)
        if err:
            return Response({"detail": err}, status=400)
        p.user = user
        p.save(update_fields=["user", "updated_at"])
        out = personal_dict(p, request)
        if temporal:
            out["temporary_password"] = temporal
            out["must_change_password"] = True
        return Response(out)


class StaffCvPdfView(_AdminView):
    """Hoja de vida en PDF de un administrativo/locador (descarga admin)."""

    def get(self, request, pk: int):
        bloqueo = self._gate(request)
        if bloqueo:
            return bloqueo
        p = get_object_or_404(Personal, pk=pk)
        from catalogs.views.hoja_vida import TeacherCVPdfView
        return TeacherCVPdfView()._emitir(p, request)
