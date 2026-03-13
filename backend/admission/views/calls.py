"""
Vistas para Convocatorias (Públicas y Admin)
"""
import os
from django.conf import settings
from django.db import models
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from admission.models import AdmissionCall, AdmissionScheduleItem
from admission.serializers import (
    AdmissionCallSerializer,
    AdmissionScheduleItemSerializer,
)
from .utils import _is_active_call, _fe_to_call, _call_to_fe, _calls_to_fe_list


# ══════════════════════════════════════════════════════════════
# PÚBLICAS - Lista y detalle de convocatorias activas
# ══════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([AllowAny])
def calls_list_public(request):
    """Lista convocatorias activas para el portal público"""
    qs = (
        AdmissionCall.objects.all()
        .order_by("id")
        .annotate(applications_count=models.Count("applications"))
    )
    active = [c for c in qs if _is_active_call(c)]
    # FIX: usar _calls_to_fe_list para evitar N+1 queries
    return Response(_calls_to_fe_list(active))


@api_view(["GET"])
@permission_classes([AllowAny])
def call_detail_public(request, call_id: int):
    """Detalle de convocatoria para portal público"""
    try:
        obj = AdmissionCall.objects.annotate(
            applications_count=models.Count("applications")
        ).get(pk=call_id)
    except AdmissionCall.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    if not _is_active_call(obj):
        return Response({"detail": "Not found"}, status=404)

    return Response(_call_to_fe(obj))


# ══════════════════════════════════════════════════════════════
# ADMIN - CRUD completo de convocatorias
# ══════════════════════════════════════════════════════════════

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def calls_collection(request):
    """Lista todas las convocatorias (GET) o crea una nueva (POST)"""
    if request.method == "GET":
        qs = (
            AdmissionCall.objects.all()
            .order_by("id")
            .annotate(applications_count=models.Count("applications"))
        )
        # FIX: usar _calls_to_fe_list para evitar N+1 queries
        return Response(_calls_to_fe_list(qs))

    # POST - Crear nueva convocatoria
    payload = request.data or {}
    mapped = _fe_to_call(payload)
    s = AdmissionCallSerializer(data=mapped)
    s.is_valid(raise_exception=True)
    obj = s.save()
    return Response(_call_to_fe(obj), status=201)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def call_detail_admin(request, call_id: int):
    """Detalle, actualización o eliminación de convocatoria"""
    try:
        obj = AdmissionCall.objects.annotate(
            applications_count=models.Count("applications")
        ).get(pk=call_id)
    except AdmissionCall.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    if request.method == "GET":
        return Response(_call_to_fe(obj))

    if request.method == "PUT":
        payload = request.data or {}
        mapped = _fe_to_call(payload)

        # Preservar campos del meta existente que no vienen en el payload
        # (ej: regulation_url subido por endpoint separado)
        existing_meta = obj.meta or {}
        new_meta = mapped.get("meta", {})
        for key in ("regulation_url",):
            if key not in new_meta and key in existing_meta:
                new_meta[key] = existing_meta[key]
        mapped["meta"] = new_meta

        s = AdmissionCallSerializer(obj, data=mapped, partial=True)
        s.is_valid(raise_exception=True)
        obj = s.save()

        obj = AdmissionCall.objects.annotate(
            applications_count=models.Count("applications")
        ).get(pk=obj.id)

        return Response(_call_to_fe(obj))

    # DELETE
    if getattr(obj, "applications_count", 0) > 0:
        return Response(
            {
                "detail": "No se puede eliminar: la convocatoria tiene postulaciones registradas."
            },
            status=400,
        )

    obj.delete()
    return Response(status=204)


# ══════════════════════════════════════════════════════════════
# SCHEDULE - Cronograma de la convocatoria
# ══════════════════════════════════════════════════════════════

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def call_schedule_collection(request, call_id: int):
    """Lista o crea items del cronograma"""
    if request.method == "GET":
        qs = AdmissionScheduleItem.objects.filter(call_id=call_id).order_by("id")
        return Response(AdmissionScheduleItemSerializer(qs, many=True).data)

    # POST
    payload = request.data.copy()
    payload["call"] = call_id
    s = AdmissionScheduleItemSerializer(data=payload)
    s.is_valid(raise_exception=True)
    obj = s.save()
    return Response(AdmissionScheduleItemSerializer(obj).data, status=201)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def call_schedule_detail(request, call_id: int, item_id: int):
    """Actualiza o elimina item del cronograma"""
    try:
        obj = AdmissionScheduleItem.objects.get(pk=item_id, call_id=call_id)
    except AdmissionScheduleItem.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    if request.method == "PUT":
        s = AdmissionScheduleItemSerializer(obj, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        obj = s.save()
        return Response(AdmissionScheduleItemSerializer(obj).data)

    # DELETE
    obj.delete()
    return Response(status=204)


# ══════════════════════════════════════════════════════════════
# REGLAMENTO - Subir PDF de reglamento para la convocatoria
# ══════════════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def call_upload_regulation(request, call_id: int):
    """Sube el PDF de reglamento de una convocatoria."""
    try:
        obj = AdmissionCall.objects.get(pk=call_id)
    except AdmissionCall.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    file = request.FILES.get("file")
    if not file:
        return Response({"detail": "No se envió archivo"}, status=400)

    # Validar que sea PDF
    if not file.name.lower().endswith(".pdf"):
        return Response({"detail": "Solo se permiten archivos PDF"}, status=400)

    # Guardar en media/admission/reglamentos/
    upload_dir = os.path.join(settings.MEDIA_ROOT, "admission", "reglamentos")
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"reglamento_call_{call_id}.pdf"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        for chunk in file.chunks():
            f.write(chunk)

    # Guardar URL en meta
    url = f"{settings.MEDIA_URL}admission/reglamentos/{filename}"
    meta = obj.meta or {}
    meta["regulation_url"] = url
    obj.meta = meta
    obj.save(update_fields=["meta"])

    return Response({"ok": True, "regulation_url": url})