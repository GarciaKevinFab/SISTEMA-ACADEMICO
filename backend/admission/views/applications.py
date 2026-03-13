"""
Vistas para Postulaciones y Applicants

FIX: 
  - applications_collection GET ahora usa select_related("applicant", "call")
    y prefetch_related("preferences__career") para que el serializer
    pueda expandir applicant_detail, applicant_name, applicant_dni, call_name
  - applications_me igual
"""
import json
import logging
from django.db import transaction, models
from rest_framework.decorators import (
    api_view,
    permission_classes,
    authentication_classes,
)
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from admission.models import (
    AdmissionCall,
    Applicant,
    Application,
    ApplicationDocument,
    ApplicationPreference,
    Payment,
)
from admission.serializers import (
    ApplicantSerializer,
    ApplicationSerializer,
)
from catalogs.models import Career
from .utils import _has_field, _is_active_call, _call_to_fe

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════
# APPLICANT - Perfil del postulante
# ══════════════════════════════════════════════════════════════


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def applicant_me(request):
    """Obtiene perfil del postulante actual"""
    app = Applicant.objects.filter(user=request.user).first()
    if not app:
        return Response({"exists": False})
    return Response({"exists": True, "applicant": ApplicantSerializer(app).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def applicant_create(request):
    """Crea perfil de postulante"""
    data = request.data.copy()
    data["user"] = request.user.id
    s = ApplicantSerializer(data=data)
    s.is_valid(raise_exception=True)
    obj = s.save()
    return Response(ApplicantSerializer(obj).data, status=201)


# ══════════════════════════════════════════════════════════════
# APPLICATIONS - Admin
# ══════════════════════════════════════════════════════════════


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def applications_collection(request):
    """Lista o crea postulaciones"""
    if request.method == "GET":
        # FIX: select_related + prefetch para que el serializer
        # pueda resolver applicant_detail, call_name, preferences
        qs = (
            Application.objects
            .select_related("applicant", "call")
            .prefetch_related("preferences__career")
            .all()
            .order_by("id")
        )
        call_id = request.query_params.get("call_id")
        career_id = request.query_params.get("career_id")

        if call_id:
            qs = qs.filter(call_id=call_id)

        if career_id:
            qs = qs.filter(preferences__career_id=career_id).distinct()

        return Response(ApplicationSerializer(qs, many=True).data)

    # POST
    payload = request.data or {}

    if "call" not in payload:
        if payload.get("call_id"):
            payload = {**payload, "call": payload.get("call_id")}
        elif payload.get("admission_call_id"):
            payload = {**payload, "call": payload.get("admission_call_id")}

    applicant_id = payload.get("applicant")
    if not applicant_id:
        app = Applicant.objects.filter(user=request.user).first()
        if not app:
            return Response(
                {"detail": "Primero crea tu perfil de postulante (/applicants)."},
                status=400,
            )
        payload = {**payload, "applicant": app.id}

    s = ApplicationSerializer(data=payload)
    if not s.is_valid():
        return Response(
            {"detail": "validation_error", "errors": s.errors},
            status=400,
        )

    obj = s.save()
    return Response(ApplicationSerializer(obj).data, status=201)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def application_detail(request, application_id):
    """Detalle, edición o eliminación de una postulación individual."""
    try:
        app = (
            Application.objects
            .select_related("applicant", "call")
            .prefetch_related("preferences__career")
            .get(pk=application_id)
        )
    except Application.DoesNotExist:
        return Response({"detail": "Postulación no encontrada"}, status=404)

    # ── GET ──
    if request.method == "GET":
        return Response(ApplicationSerializer(app).data)

    # ── PATCH ── Actualizar campos editables
    if request.method == "PATCH":
        payload = request.data or {}

        # Campos directos del modelo Application
        if "status" in payload:
            app.status = payload["status"]
        if "career_name" in payload:
            app.career_name = payload["career_name"]

        # Datos del JSON (data.profile, data.school)
        data = app.data if isinstance(app.data, dict) else {}
        profile = data.get("profile") or {}
        school = data.get("school") or {}

        # Mapeo: campo del formulario → dónde se guarda
        profile_fields = [
            "nombres", "apellido_paterno", "apellido_materno",
            "dni", "sexo", "fecha_nacimiento", "nacionalidad",
            "email", "phone", "direccion", "estado_civil",
            "lengua_materna", "autoidentificacion_etnica",
            "discapacidad", "tipo_discapacidad", "numero_conadis",
            "modalidad_admision",
            "ubigeo_nacimiento", "ubigeo_domicilio",
            # Aliases en inglés
            "first_names", "last_name_father", "last_name_mother",
            "document_number", "birth_date", "nationality",
            "address", "mother_tongue", "ethnic_identity",
            "birth_department", "address_department",
        ]
        school_fields = [
            "colegio_procedencia", "anio_egreso",
            "anio_finalizo_estudios_secundarios",
            "school_name", "school_type", "school_department",
            "promotion_year", "tipo_colegio", "depto_colegio",
        ]

        changed_data = False
        for key in profile_fields:
            if key in payload:
                profile[key] = payload[key]
                changed_data = True
        for key in school_fields:
            if key in payload:
                school[key] = payload[key]
                changed_data = True

        if changed_data:
            data["profile"] = profile
            data["school"] = school
            app.data = data

        # Actualizar Applicant FK si vienen datos de identidad
        if app.applicant:
            applicant_dirty = False
            if "dni" in payload or "document_number" in payload:
                new_dni = payload.get("dni") or payload.get("document_number")
                if new_dni and new_dni != app.applicant.dni:
                    app.applicant.dni = new_dni
                    applicant_dirty = True
            if "nombres" in payload or "first_names" in payload:
                full = payload.get("nombres") or payload.get("first_names", "")
                ap_pat = payload.get("apellido_paterno") or payload.get("last_name_father", "")
                ap_mat = payload.get("apellido_materno") or payload.get("last_name_mother", "")
                parts = [p for p in [ap_pat, ap_mat, full] if p]
                if parts:
                    app.applicant.names = " ".join(parts)
                    applicant_dirty = True
            if "email" in payload and payload["email"] != (app.applicant.email or ""):
                app.applicant.email = payload["email"]
                applicant_dirty = True
            if "phone" in payload and payload["phone"] != (app.applicant.phone or ""):
                app.applicant.phone = payload["phone"]
                applicant_dirty = True
            if applicant_dirty:
                app.applicant.save()

        app.save()

        # Refetch para serializar limpio
        app.refresh_from_db()
        app = (
            Application.objects
            .select_related("applicant", "call")
            .prefetch_related("preferences__career")
            .get(pk=application_id)
        )
        return Response(ApplicationSerializer(app).data)

    # ── DELETE ──
    if request.method == "DELETE":
        app.delete()
        return Response({"ok": True}, status=204)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def applications_me(request):
    """Mis postulaciones"""
    app = Applicant.objects.filter(user=request.user).first()
    if not app:
        return Response([])
    # FIX: select_related + prefetch
    qs = (
        Application.objects
        .select_related("applicant", "call")
        .prefetch_related("preferences__career")
        .filter(applicant=app)
        .order_by("-id")
    )
    return Response(ApplicationSerializer(qs, many=True).data)


# ══════════════════════════════════════════════════════════════
# PUBLIC APPLY - Postulacion publica sin autenticacion
# Soporta JSON puro y FormData con documentos adjuntos
# ══════════════════════════════════════════════════════════════


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def public_apply(request):
    """Postulacion publica (sin login previo)"""
    try:
        # ── Soporte FormData (con documentos) o JSON puro ──
        content_type = request.content_type or ""
        if "multipart" in content_type and "data" in request.data:
            raw = request.data.get("data", "{}")
            payload = json.loads(raw) if isinstance(raw, str) else raw
        else:
            payload = request.data or {}

        call_id = payload.get("call_id") or payload.get("call")
        prefs = payload.get("career_preferences") or []
        app_data = payload.get("applicant") or {}

        dni = (app_data.get("dni") or "").strip()
        names = (app_data.get("names") or "").strip()
        email = (app_data.get("email") or "").strip().lower()
        phone = (app_data.get("phone") or "").strip()

        if not call_id:
            return Response({"detail": "call_id requerido"}, status=400)
        if not dni or not names or not email:
            return Response(
                {"detail": "DNI, nombres y email son obligatorios"},
                status=400,
            )

        # Validar formato de DNI: solo dígitos, 8 caracteres
        if not dni.isdigit() or len(dni) != 8:
            return Response(
                {"detail": "El DNI debe contener exactamente 8 dígitos numéricos"},
                status=400,
            )
        if not isinstance(prefs, list) or len(prefs) == 0:
            return Response(
                {"detail": "Seleccione al menos una carrera"},
                status=400,
            )

        profile = payload.get("profile") or {}
        school = payload.get("school") or {}
        photo_base64 = payload.get("photo_base64")

        try:
            first_pref = int(prefs[0])
        except Exception:
            return Response({"detail": "Preferencias invalidas"}, status=400)

        with transaction.atomic():
            call = AdmissionCall.objects.select_for_update().get(pk=call_id)

            if not _is_active_call(call):
                return Response(
                    {"detail": "Convocatoria no esta abierta"},
                    status=400,
                )

            # Buscar o crear applicant
            applicant = Applicant.objects.filter(dni=dni).first() or Applicant.objects.filter(
                email=email
            ).first()

            if not applicant:
                applicant = Applicant.objects.create(
                    dni=dni, names=names, email=email, phone=phone
                )
            else:
                dirty = False
                if names and applicant.names != names:
                    applicant.names = names
                    dirty = True
                if email and applicant.email != email:
                    applicant.email = email
                    dirty = True
                if phone and applicant.phone != phone:
                    applicant.phone = phone
                    dirty = True
                if dirty:
                    applicant.save()

            # Verificar postulacion existente
            existing = Application.objects.filter(
                call=call, applicant=applicant
            ).first()

            if existing:
                call_ui = AdmissionCall.objects.annotate(
                    applications_count=models.Count("applications")
                ).get(pk=call.id)

                return Response(
                    {
                        "ok": True,
                        "application_id": existing.id,
                        "status": existing.status,
                        "updated_call": _call_to_fe(call_ui),
                    },
                    status=200,
                )

            # Descontar vacantes
            meta = call.meta or {}
            meta_careers = meta.get("careers")

            if isinstance(meta_careers, list) and len(meta_careers) > 0:
                found = None
                for it in meta_careers:
                    cid = it.get("career_id") or it.get("id")
                    if cid is not None and int(cid) == first_pref:
                        found = it
                        break

                if not found:
                    return Response(
                        {"detail": "Carrera no valida en esta convocatoria"},
                        status=400,
                    )

                try:
                    vac = int(found.get("vacancies") or 0)
                except Exception:
                    vac = 0

                if vac <= 0:
                    return Response(
                        {
                            "detail": "Ya no hay vacantes disponibles para la carrera seleccionada."
                        },
                        status=400,
                    )

                found["vacancies"] = vac - 1
                meta["careers"] = meta_careers
                call.meta = meta
                call.save(update_fields=["meta"])

            else:
                try:
                    career = Career.objects.select_for_update().get(pk=first_pref)
                except Career.DoesNotExist:
                    return Response({"detail": "Carrera no encontrada"}, status=400)

                vac = int(getattr(career, "vacancies", 0) or 0)
                if vac <= 0:
                    return Response(
                        {
                            "detail": "Ya no hay vacantes disponibles para la carrera seleccionada."
                        },
                        status=400,
                    )

                career.vacancies = vac - 1
                if _has_field(Career, "updated_at"):
                    career.save(update_fields=["vacancies", "updated_at"])
                else:
                    career.save(update_fields=["vacancies"])

                meta["careers"] = [
                    {
                        "career_id": career.id,
                        "name": career.name,
                        "vacancies": int(career.vacancies),
                    }
                ]
                call.meta = meta
                call.save(update_fields=["meta"])

            # Crear postulacion
            app = Application.objects.create(
                call=call,
                applicant=applicant,
                status="REGISTERED",
                career_name="",
                data={
                    "source": "PUBLIC",
                    "profile": profile,
                    "school": school,
                    "photo_base64": photo_base64,
                },
            )

            # Preferencias
            careers = Career.objects.filter(id__in=prefs)
            map_careers = {c.id: c for c in careers}

            rows = []
            for i, cid in enumerate(prefs, start=1):
                c = map_careers.get(int(cid))
                if c:
                    rows.append(
                        ApplicationPreference(application=app, career=c, rank=i)
                    )

            if not rows:
                app.delete()
                return Response({"detail": "Carreras invalidas"}, status=400)

            ApplicationPreference.objects.bulk_create(rows)

            # Actualizar career_name
            first = map_careers.get(first_pref)
            if first:
                app.career_name = first.name
                app.save(update_fields=["career_name"])

            # ── Guardar documentos adjuntos del FormData ──
            if "multipart" in content_type:
                for key, uploaded_file in request.FILES.items():
                    if key.startswith("doc_"):
                        doc_type = key[4:]  # "doc_FOTO_CARNET" -> "FOTO_CARNET"
                        ApplicationDocument.objects.create(
                            application=app,
                            document_type=doc_type,
                            file=uploaded_file,
                            original_name=uploaded_file.name,
                            status="UPLOADED",
                        )

            # ── Crear Payment con datos de comprobante si hay fee ──
            fee = 0
            try:
                fee = float(meta.get("application_fee") or 0)
            except (ValueError, TypeError):
                fee = 0

            payment_data = None
            if fee > 0:
                nro_sec = (
                    payload.get("nro_secuencia") or ""
                ).strip()
                cod_caja = (
                    payload.get("codigo_caja") or ""
                ).strip()
                fecha_mov_str = (
                    payload.get("fecha_movimiento") or ""
                ).strip()
                channel = (
                    payload.get("channel") or "AGENCIA_BN"
                ).strip()

                from datetime import date as date_cls

                fecha_mov = None
                if fecha_mov_str:
                    try:
                        fecha_mov = date_cls.fromisoformat(fecha_mov_str)
                    except ValueError:
                        pass

                voucher_file = None
                if "multipart" in content_type:
                    voucher_file = request.FILES.get("voucher")

                pmt = Payment.objects.create(
                    application=app,
                    method=channel,
                    status="PENDING_REVIEW",
                    amount=fee,
                    channel=channel,
                    nro_secuencia=nro_sec,
                    codigo_caja=cod_caja,
                    fecha_movimiento=fecha_mov,
                    voucher=voucher_file,
                )
                payment_data = {
                    "id": pmt.id,
                    "status": pmt.status,
                    "amount": str(pmt.amount),
                }

            # Refetch para UI con conteo
            call_ui = AdmissionCall.objects.annotate(
                applications_count=models.Count("applications")
            ).get(pk=call.id)

            resp = {
                "ok": True,
                "application_id": app.id,
                "status": app.status,
                "updated_call": _call_to_fe(call_ui),
            }
            if payment_data:
                resp["payment"] = payment_data

            return Response(resp, status=201)

    except AdmissionCall.DoesNotExist:
        return Response({"detail": "Convocatoria no encontrada"}, status=404)

    except Exception as e:
        logger.exception("public_apply failed")
        return Response(
            {"detail": "server_error", "error": str(e)},
            status=500,
        )