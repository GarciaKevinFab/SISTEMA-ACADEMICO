"""
CRUD de modalidades de admisión.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from ..models import AdmissionModality


@api_view(["GET", "POST"])
def modalities_collection(request):
    """
    GET  → lista modalidades (público, sin auth).
    POST → crea modalidad (requiere auth).
    """
    if request.method == "GET":
        qs = AdmissionModality.objects.filter(active=True)
        return Response([
            {"id": m.id, "name": m.name, "order": m.order}
            for m in qs
        ])

    # POST — requiere auth
    if not request.user or not request.user.is_authenticated:
        return Response({"detail": "No autorizado"}, status=401)

    name = (request.data.get("name") or "").strip()
    if not name:
        return Response({"detail": "El nombre es obligatorio"}, status=400)

    if AdmissionModality.objects.filter(name__iexact=name).exists():
        return Response({"detail": "Ya existe una modalidad con ese nombre"}, status=400)

    order = request.data.get("order", 0)
    obj = AdmissionModality.objects.create(name=name, order=order)
    return Response({"id": obj.id, "name": obj.name, "order": obj.order}, status=201)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def modality_detail(request, modality_id: int):
    """
    PUT    → actualizar nombre/orden.
    DELETE → desactivar (soft delete).
    """
    try:
        obj = AdmissionModality.objects.get(pk=modality_id)
    except AdmissionModality.DoesNotExist:
        return Response({"detail": "No encontrada"}, status=404)

    if request.method == "DELETE":
        obj.active = False
        obj.save(update_fields=["active"])
        return Response({"ok": True})

    # PUT
    name = (request.data.get("name") or "").strip()
    if name:
        if AdmissionModality.objects.filter(name__iexact=name).exclude(pk=modality_id).exists():
            return Response({"detail": "Ya existe una modalidad con ese nombre"}, status=400)
        obj.name = name
    if "order" in request.data:
        obj.order = request.data["order"]
    obj.save()
    return Response({"id": obj.id, "name": obj.name, "order": obj.order})
