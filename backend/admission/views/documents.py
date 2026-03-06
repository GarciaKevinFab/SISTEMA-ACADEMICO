"""
admission/views_documents.py

Vistas para Documentos de Postulación (autenticadas).
Incluye:
  - GET/POST  /applications/{id}/documents
  - DELETE    /applications/{id}/documents/{doc_id}
  - POST      /applications/{id}/documents/{doc_id}/review
  - GET       /applications/{id}/documents/{doc_id}/download  (sirve archivo)
"""
import mimetypes
from django.http import FileResponse, Http404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from admission.models import Application, ApplicationDocument
from admission.serializers import ApplicationDocumentSerializer


def serialize_doc(obj, data=None, request=None):
    """Serializa un documento con campos adicionales."""
    if data is None:
        data = ApplicationDocumentSerializer(obj).data

    # Siempre incluir document_type explícitamente
    data["document_type"] = obj.document_type or ""

    # URL del archivo: usar endpoint de descarga propio (funciona sin nginx /media/)
    if obj.file and obj.application_id:
        api_url = f"/api/applications/{obj.application_id}/documents/{obj.id}/download"
        if request:
            data["file_url"] = request.build_absolute_uri(api_url)
        else:
            data["file_url"] = api_url
    else:
        data["file_url"] = None

    data["file_name"] = (
        getattr(obj, "original_name", "")
        or (obj.file.name.split("/")[-1] if obj.file else "")
    )
    data["review_status"] = obj.status or "UPLOADED"
    data["observations"] = getattr(obj, "note", "") or ""
    return data


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def application_docs_collection(request, application_id: int):
    """Lista o sube documentos de una postulación"""
    try:
        Application.objects.get(pk=application_id)
    except Application.DoesNotExist:
        return Response({"detail": "application not found"}, status=404)

    if request.method == "GET":
        qs = ApplicationDocument.objects.filter(
            application_id=application_id
        ).order_by("id")
        return Response([serialize_doc(obj, request=request) for obj in qs])

    # POST multipart
    data = request.data.copy()
    data["application"] = application_id
    s = ApplicationDocumentSerializer(data=data)
    s.is_valid(raise_exception=True)
    obj = s.save()

    # Guardar nombre original
    if request.FILES.get("file"):
        obj.original_name = request.FILES["file"].name
        obj.save(update_fields=["original_name"])

    return Response(serialize_doc(obj, request=request), status=201)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def application_doc_delete(request, application_id: int, document_id: int):
    """Eliminar un documento (solo si no está aprobado)."""
    try:
        doc = ApplicationDocument.objects.get(
            pk=document_id,
            application_id=application_id,
        )
    except ApplicationDocument.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    # No permitir eliminar documentos ya aprobados
    if doc.status == "APPROVED":
        return Response(
            {"detail": "No se puede eliminar un documento aprobado"},
            status=400,
        )

    # Eliminar archivo físico
    if doc.file:
        doc.file.delete(save=False)

    doc.delete()
    return Response({"detail": "Documento eliminado"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def application_doc_review(request, application_id: int, document_id: int):
    """Revisar/aprobar documento"""
    try:
        doc = ApplicationDocument.objects.get(
            pk=document_id,
            application_id=application_id,
        )
    except ApplicationDocument.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    data = request.data or {}

    if "status" in data:
        doc.status = data.get("status")

    note = data.get("note")
    if note is None:
        note = data.get("observations")
    if note is not None:
        doc.note = str(note)

    doc.save()
    return Response(serialize_doc(doc, request=request))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def application_doc_download(request, application_id: int, document_id: int):
    """
    Sirve el archivo del documento directamente a través de Django.
    Esto funciona en producción sin necesidad de configurar nginx para /media/.
    """
    try:
        doc = ApplicationDocument.objects.get(
            pk=document_id,
            application_id=application_id,
        )
    except ApplicationDocument.DoesNotExist:
        raise Http404("Documento no encontrado")

    if not doc.file:
        raise Http404("Sin archivo asociado")

    # Detectar tipo MIME
    filename = doc.original_name or doc.file.name.split("/")[-1]
    content_type, _ = mimetypes.guess_type(filename)
    if not content_type:
        content_type = "application/octet-stream"

    # Servir el archivo (streaming para archivos grandes)
    response = FileResponse(doc.file.open("rb"), content_type=content_type)
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    return response