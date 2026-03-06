"""
Vistas para Gestión de Carreras y Parámetros
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from catalogs.models import Career
from admission.models import AdmissionParam
from admission.serializers import (
    CareerSerializer,
    AdmissionParamSerializer,
)
from .utils import _has_field


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def careers_collection(request):
    """Lista o crea carreras"""
    if request.method == "GET":
        qs = Career.objects.all().order_by("id")
        return Response(CareerSerializer(qs, many=True).data)

    s = CareerSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    obj = s.save()
    return Response(CareerSerializer(obj).data, status=201)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def career_detail(request, career_id: int):
    """Detalle, actualización o eliminación de carrera"""
    try:
        row = Career.objects.get(pk=career_id)
    except Career.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    if request.method == "GET":
        return Response(CareerSerializer(row).data)

    if request.method == "PUT":
        s = CareerSerializer(row, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        obj = s.save()
        return Response(CareerSerializer(obj).data)

    # DELETE
    row.delete()
    return Response(status=204)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def career_toggle_active(request, career_id: int):
    """Activar/desactivar carrera"""
    try:
        row = Career.objects.get(pk=career_id)
    except Career.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    row.is_active = not bool(row.is_active)

    fields = ["is_active"]
    if _has_field(Career, "updated_at"):
        fields.append("updated_at")

    row.save(update_fields=fields)
    return Response(CareerSerializer(row).data)


# ══════════════════════════════════════════════════════════════
# PARÁMETROS DE ADMISIÓN
# ══════════════════════════════════════════════════════════════

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admission_params(request):
    """Gestión de parámetros de admisión"""
    obj = AdmissionParam.objects.order_by("id").first()
    
    if request.method == "GET":
        if not obj:
            obj = AdmissionParam.objects.create(data={})
        return Response(AdmissionParamSerializer(obj).data)

    # POST
    if not obj:
        s = AdmissionParamSerializer(data={"data": request.data or {}})
        s.is_valid(raise_exception=True)
        obj = s.save()
        return Response(AdmissionParamSerializer(obj).data)

    obj.data = request.data or {}
    obj.save(update_fields=["data"])
    return Response(AdmissionParamSerializer(obj).data)