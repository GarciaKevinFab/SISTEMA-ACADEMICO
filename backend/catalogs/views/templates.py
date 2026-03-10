"""
Descarga de templates para imports
"""
import os
from django.conf import settings
from django.http import Http404, FileResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .utils import _require_staff_or_teacher


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def imports_template(request, type: str):
    """Descarga template de Excel para imports"""
    not_ok = _require_staff_or_teacher(request)
    if not_ok:
        return not_ok
    
    type = (type or "").lower().strip()
    
    FILES = {
        "students": "students_template.xlsx",
        "grades": "grades_template.xlsx",
        "plans": "plan_estudios.xlsx",
        "traslados": "traslados_template.xlsx",
    }
    
    filename = FILES.get(type)
    if not filename:
        return Response({"detail": "Tipo inválido"}, status=400)
    
    candidates = [
        os.path.join(settings.BASE_DIR, "templates", "imports", filename),
        os.path.join(settings.BASE_DIR, "backend", "templates", "imports", filename),
        os.path.join(os.getcwd(), "templates", "imports", filename),
        os.path.join(os.getcwd(), "backend", "templates", "imports", filename),
    ]
    
    file_path = next((p for p in candidates if os.path.exists(p)), None)
    
    if not file_path:
        raise Http404("Plantilla no encontrada")
    
    return FileResponse(
        open(file_path, "rb"),
        as_attachment=True,
        filename=filename,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )