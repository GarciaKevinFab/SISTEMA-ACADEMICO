"""
Panel propio del personal (lo que ve cada persona con SU sesión).

  GET    /api/personal/me                  → quién soy en este módulo
  GET    /api/personal/me/profile          → datos generales de mi ficha
  PUT    /api/personal/me/profile          → editarlos (multipart con foto)
  GET    /api/personal/me/cv               → mi hoja de vida
  POST   /api/personal/me/cv               → agregar ítem (multipart)
  PUT    /api/personal/me/cv/<id>          → editar ítem
  DELETE /api/personal/me/cv/<id>          → eliminar ítem
  GET    /api/personal/me/cv/pdf           → mi hoja de vida en PDF
  POST   /api/personal/me/plan-trabajo     → jefe de línea: subir su plan
  POST   /api/personal/me/rd               → jefe de línea: subir su R.D.
  POST   /api/personal/me/documentos       → locador 107: orden de servicio,
                                             protocolo y plan de trabajo

`GET /me` es la clave del módulo: el frontend lo consulta para saber qué
botones mostrar. Un DOCENTE designado jefe de línea entra con su misma
contraseña de siempre y lo único que le aparece de más es la carga de su
plan de trabajo; un administrativo o locador ve su hoja de vida.
"""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from catalogs.models import Teacher
from catalogs.views.hoja_vida import (TeacherCVPdfView, _aplicar_campos,
                                      _item_dict, _items_ordenados)
from personal.models import JefeLinea, Personal, PersonalCVItem

from .comun import jefe_dict, url_de
from .jefes import validar_pdf

MAX_DOC_MB = 15
MAX_FOTO_MB = 5

SECCIONES_VALIDAS = {c for c, _ in PersonalCVItem.SECCIONES}
SUBSECCIONES_VALIDAS = {c for c, _ in PersonalCVItem.SUBSECCIONES}

# Reexportadas para que staff.py sirva la hoja de vida sin importar de
# catalogs (los ítems son duck-typed: mismos campos que TeacherCVItem).
item_dict = _item_dict
items_ordenados = _items_ordenados


def _mi_ficha(request):
    """Ficha de personal del usuario autenticado (o None si es docente)."""
    return Personal.objects.filter(user=request.user).first()


def _mis_jefaturas(request):
    """Cargos de línea que ocupa el usuario (vía su ficha docente)."""
    ids = list(Teacher.objects.filter(user=request.user)
               .values_list("id", flat=True))
    if not ids:
        return JefeLinea.objects.none()
    return (JefeLinea.objects.filter(teacher_id__in=ids, activo=True)
            .select_related("teacher", "teacher__user").order_by("orden"))


class _MeView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]


class MiPersonalView(_MeView):
    """Resumen: qué soy dentro del módulo Personal."""

    def get(self, request):
        jefaturas = [jefe_dict(j, request) for j in _mis_jefaturas(request)]
        p = _mi_ficha(request)
        return Response({
            "es_jefe_linea": bool(jefaturas),
            "jefaturas": jefaturas,
            "tipo": p.tipo if p else "",
            "es_administrativo": bool(p and p.tipo == Personal.ADMINISTRATIVO),
            "es_locador": bool(p and p.tipo == Personal.LOCADOR),
            "personal_id": p.id if p else None,
            "cargo": p.cargo if p else "",
        })


class MiPerfilView(_MeView):
    """Datos generales de la ficha propia (mismo contrato que el docente)."""

    # Toda la ficha la completa la propia persona: Administración solo crea la
    # cuenta con lo mínimo y quien entra rellena el resto (pedido de Dirección).
    TEXTOS = {
        "apellido_paterno": 80, "apellido_materno": 80, "nombres": 120,
        "telefono_fijo": 30, "direccion": 200, "region": 80, "provincia": 80,
        "distrito": 80, "phone": 30, "email": 254, "specialization": 120,
        "document": 30, "cargo": 160, "area": 120, "rd_nombramiento": 120,
    }
    FECHAS = ("fecha_nac", "rd_fecha")
    OPCIONES = {
        "sexo": {"", "M", "F"},
        "grado_academico": {""} | {c for c, _ in Personal.GRADOS_ACADEMICOS},
        "condicion_laboral": {""} | {c for c, _ in Personal.CONDICIONES},
    }

    def _ficha(self, request):
        p = _mi_ficha(request)
        if not p:
            return None
        return p

    def _payload(self, request, p):
        return {
            "full_name": (getattr(request.user, "full_name", "")
                          or p.nombre_completo),
            "nombre_completo": p.nombre_completo,
            "tipo": p.tipo,
            "tipo_label": p.get_tipo_display(),
            "cargo": p.cargo or "",
            "area": p.area or "",
            "document": p.document or getattr(request.user, "username", ""),
            "fecha_nac": p.fecha_nac.isoformat() if p.fecha_nac else "",
            "grado_academico": p.grado_academico or "",
            "grado_academico_label": dict(Personal.GRADOS_ACADEMICOS).get(
                p.grado_academico, ""),
            "celular": p.phone or "",
            "email_institucional": p.email or "",
            "specialization": p.specialization or "",
            "photo_url": url_de(request, p.photo),
            "condicion_laboral": p.condicion_laboral or "",
            "condicion_laboral_label": dict(Personal.CONDICIONES).get(
                p.condicion_laboral, ""),
            "rd_nombramiento": p.rd_nombramiento or "",
            "rd_fecha": p.rd_fecha.isoformat() if p.rd_fecha else "",
            "apellido_paterno": p.apellido_paterno or "",
            "apellido_materno": p.apellido_materno or "",
            "nombres": p.nombres or "",
            "sexo": p.sexo or "",
            "sexo_label": dict(Personal.SEXOS).get(p.sexo, ""),
            "telefono_fijo": p.telefono_fijo or "",
            "direccion": p.direccion or "",
            "region": p.region or "",
            "provincia": p.provincia or "",
            "distrito": p.distrito or "",
            # Documentos del locador 107
            "orden_servicio_url": url_de(request, p.orden_servicio),
            "orden_servicio_numero": p.orden_servicio_numero or "",
            "orden_servicio_desde": (p.orden_servicio_desde.isoformat()
                                     if p.orden_servicio_desde else ""),
            "orden_servicio_hasta": (p.orden_servicio_hasta.isoformat()
                                     if p.orden_servicio_hasta else ""),
            "orden_servicio_vigente": p.orden_servicio_vigente,
            "protocolo_url": url_de(request, p.protocolo),
            "plan_trabajo_url": url_de(request, p.plan_trabajo),
        }

    def get(self, request):
        p = self._ficha(request)
        if not p:
            return Response(
                {"detail": "Tu usuario no tiene ficha de personal "
                           "administrativo. Solicítala a Administración."},
                status=404)
        return Response(self._payload(request, p))

    def put(self, request):
        p = self._ficha(request)
        if not p:
            return Response(
                {"detail": "Tu usuario no tiene ficha de personal "
                           "administrativo."}, status=404)
        data = request.data or {}

        # El frontend del CV manda "celular"/"email_institucional"
        alias = {"celular": "phone", "email_institucional": "email"}
        for origen, destino in alias.items():
            if origen in data and destino not in data:
                data = {**data, destino: data.get(origen)}

        for campo, tope in self.TEXTOS.items():
            if campo in data:
                setattr(p, campo, str(data.get(campo) or "").strip()[:tope])

        for campo, validas in self.OPCIONES.items():
            if campo in data:
                v = str(data.get(campo) or "").strip().upper()
                if v not in validas:
                    return Response({"detail": f"«{campo}» inválido: {v!r}"},
                                    status=400)
                setattr(p, campo, v)

        for campo in self.FECHAS:
            if campo not in data:
                continue
            v = str(data.get(campo) or "").strip()
            if not v:
                setattr(p, campo, None)
                continue
            d = parse_date(v)
            if not d:
                return Response(
                    {"detail": f"«{campo}» inválida (usa el formato YYYY-MM-DD)."},
                    status=400)
            setattr(p, campo, d)

        foto = request.FILES.get("photo")
        if foto is not None:
            if foto.size > MAX_FOTO_MB * 1024 * 1024:
                return Response(
                    {"detail": f"La foto no puede superar {MAX_FOTO_MB} MB."},
                    status=400)
            p.photo = foto

        if not p.full_name:
            p.full_name = p.nombre_completo
        p.save()
        return Response(self._payload(request, p))


class MiCvListView(_MeView):
    def get(self, request):
        p = _mi_ficha(request)
        if not p:
            return Response({"detail": "Sin ficha de personal."}, status=404)
        return Response({
            "personal_id": p.id,
            "items": [_item_dict(i, request) for i in _items_ordenados(p)],
        })

    def post(self, request):
        p = _mi_ficha(request)
        if not p:
            return Response({"detail": "Sin ficha de personal."}, status=404)
        seccion = str(request.data.get("seccion") or "").strip().upper()
        if seccion not in SECCIONES_VALIDAS:
            return Response({"detail": f"seccion inválida: {seccion}"},
                            status=400)
        sub = str(request.data.get("subseccion") or "").strip().upper()
        if sub and sub not in SUBSECCIONES_VALIDAS:
            return Response({"detail": f"subseccion inválida: {sub}"},
                            status=400)
        it = PersonalCVItem(personal=p, seccion=seccion, subseccion=sub)
        err = _aplicar_campos(it, request.data, request.FILES)
        if err:
            return Response({"detail": err}, status=400)
        it.save()
        return Response(_item_dict(it, request), status=201)


class MiCvDetailView(_MeView):
    def _get(self, request, item_id):
        p = _mi_ficha(request)
        if not p:
            return None
        return get_object_or_404(PersonalCVItem, id=item_id, personal=p)

    def put(self, request, item_id: int):
        it = self._get(request, item_id)
        if not it:
            return Response({"detail": "Sin ficha de personal."}, status=404)
        err = _aplicar_campos(it, request.data, request.FILES)
        if err:
            return Response({"detail": err}, status=400)
        it.save()
        return Response(_item_dict(it, request))

    def delete(self, request, item_id: int):
        it = self._get(request, item_id)
        if not it:
            return Response({"detail": "Sin ficha de personal."}, status=404)
        it.delete()
        return Response(status=204)


class MiCvPdfView(_MeView):
    def get(self, request):
        p = _mi_ficha(request)
        if not p:
            return Response({"detail": "Sin ficha de personal."}, status=404)
        # Mismo emisor que la hoja de vida docente: la ficha de personal
        # replica sus campos, así que el PDF sale idéntico.
        return TeacherCVPdfView()._emitir(p, request)


class MiPlanTrabajoView(_MeView):
    """Jefe de línea (docente): sube o quita SU plan de trabajo."""

    def post(self, request):
        jefaturas = list(_mis_jefaturas(request))
        if not jefaturas:
            return Response(
                {"detail": "No figuras como jefe (a) de línea."}, status=403)

        pedido = request.data.get("jefatura_id")
        if pedido:
            j = next((x for x in jefaturas if str(x.id) == str(pedido)), None)
            if not j:
                return Response(
                    {"detail": "Ese cargo no te corresponde."}, status=403)
            objetivo = [j]
        elif len(jefaturas) == 1:
            objetivo = jefaturas
        else:
            # Ocupa varios cargos: que diga a cuál va el plan, en vez de
            # duplicar el mismo archivo en todos.
            return Response(
                {"detail": "Ocupas más de un cargo: indica a cuál corresponde "
                           "este plan de trabajo (jefatura_id)."},
                status=400)

        f = request.FILES.get("archivo") or request.FILES.get("plan_trabajo")
        if not f:
            return Response({"detail": "Adjunta el archivo del plan."},
                            status=400)
        if f.size > MAX_DOC_MB * 1024 * 1024:
            return Response(
                {"detail": f"El plan no puede superar {MAX_DOC_MB} MB."},
                status=400)

        ahora = timezone.now()
        for j in objetivo:
            j.plan_trabajo = f
            j.plan_trabajo_subido = ahora
            j.save(update_fields=["plan_trabajo", "plan_trabajo_subido",
                                  "updated_at"])
        return Response({"jefaturas": [jefe_dict(j, request)
                                       for j in _mis_jefaturas(request)]})

    def delete(self, request):
        jefaturas = list(_mis_jefaturas(request))
        if not jefaturas:
            return Response(
                {"detail": "No figuras como jefe (a) de línea."}, status=403)
        pedido = request.data.get("jefatura_id") \
            or request.query_params.get("jefatura_id")
        for j in jefaturas:
            if pedido and str(j.id) != str(pedido):
                continue
            j.plan_trabajo = None
            j.plan_trabajo_subido = None
            j.save(update_fields=["plan_trabajo", "plan_trabajo_subido",
                                  "updated_at"])
        return Response({"jefaturas": [jefe_dict(j, request)
                                       for j in _mis_jefaturas(request)]})


class MiRdView(_MeView):
    """Jefe de línea: sube o quita el PDF de SU R.D. Regional."""

    def _jefatura(self, request):
        jefaturas = list(_mis_jefaturas(request))
        if not jefaturas:
            return None, Response(
                {"detail": "No figuras como jefe (a) de línea."}, status=403)
        pedido = (request.data.get("jefatura_id")
                  or request.query_params.get("jefatura_id"))
        if pedido:
            j = next((x for x in jefaturas if str(x.id) == str(pedido)), None)
            if not j:
                return None, Response(
                    {"detail": "Ese cargo no te corresponde."}, status=403)
            return j, None
        if len(jefaturas) == 1:
            return jefaturas[0], None
        return None, Response(
            {"detail": "Ocupas más de un cargo: indica a cuál corresponde "
                       "esta R.D. (jefatura_id)."}, status=400)

    def post(self, request):
        j, error = self._jefatura(request)
        if error:
            return error
        f = request.FILES.get("archivo") or request.FILES.get("rd")
        if not f:
            return Response({"detail": "Adjunta el PDF de tu R.D."},
                            status=400)
        err = validar_pdf(f, MAX_DOC_MB, "La R.D.")
        if err:
            return Response({"detail": err}, status=400)
        j.resolucion_archivo = f
        j.resolucion_subida = timezone.now()
        j.save(update_fields=["resolucion_archivo", "resolucion_subida",
                              "updated_at"])
        return Response({"jefaturas": [jefe_dict(x, request)
                                       for x in _mis_jefaturas(request)]})

    def delete(self, request):
        j, error = self._jefatura(request)
        if error:
            return error
        j.resolucion_archivo = None
        j.resolucion_subida = None
        j.save(update_fields=["resolucion_archivo", "resolucion_subida",
                              "updated_at"])
        return Response({"jefaturas": [jefe_dict(x, request)
                                       for x in _mis_jefaturas(request)]})


class MisDocumentosView(_MeView):
    """Locador 107: orden de servicio vigente, protocolo y plan de trabajo."""

    CAMPOS = ("orden_servicio", "protocolo", "plan_trabajo")

    def post(self, request):
        p = _mi_ficha(request)
        if not p:
            return Response({"detail": "Sin ficha de personal."}, status=404)

        tocados = []
        for campo in self.CAMPOS:
            f = request.FILES.get(campo)
            if f is None:
                continue
            if f.size > MAX_DOC_MB * 1024 * 1024:
                return Response(
                    {"detail": f"«{campo}» no puede superar {MAX_DOC_MB} MB."},
                    status=400)
            setattr(p, campo, f)
            tocados.append(campo)

        if "orden_servicio_numero" in request.data:
            p.orden_servicio_numero = str(
                request.data.get("orden_servicio_numero") or "").strip()[:120]
            tocados.append("orden_servicio_numero")

        for campo in ("orden_servicio_desde", "orden_servicio_hasta"):
            if campo not in request.data:
                continue
            v = str(request.data.get(campo) or "").strip()
            if v:
                d = parse_date(v)
                if not d:
                    return Response(
                        {"detail": f"«{campo}» inválida (YYYY-MM-DD)."},
                        status=400)
                setattr(p, campo, d)
            else:
                setattr(p, campo, None)
            tocados.append(campo)

        if not tocados:
            return Response({"detail": "No enviaste ningún documento."},
                            status=400)
        p.save()
        return Response(MiPerfilView()._payload(request, p))

    def delete(self, request):
        p = _mi_ficha(request)
        if not p:
            return Response({"detail": "Sin ficha de personal."}, status=404)
        campo = (request.data.get("campo")
                 or request.query_params.get("campo") or "").strip()
        if campo not in self.CAMPOS:
            return Response(
                {"detail": f"campo inválido: {campo!r}"}, status=400)
        setattr(p, campo, None)
        p.save(update_fields=[campo, "updated_at"])
        return Response(MiPerfilView()._payload(request, p))
