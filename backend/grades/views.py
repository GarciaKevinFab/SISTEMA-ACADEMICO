# backend/grades/views.py
from django.http import HttpResponse
from rest_framework import viewsets, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Grade
from .serializers import GradeSerializer


class GradeViewSet(viewsets.ModelViewSet):
    queryset = Grade.objects.select_related("student", "course").all()
    serializer_class = GradeSerializer
    permission_classes = [permissions.IsAuthenticated]


# ========= Kárdex JSON =========
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def kardex_of_student(request, student_id):
    """
    Devuelve un kárdex simple para el alumno: cursos + promedios por periodo.
    Mejora luego integrando tus reglas reales.
    """
    rows = [
        {"period": "2025-I", "course_code": "MAT101", "course_name": "Matemática I", "final": 15},
        {"period": "2025-I", "course_code": "COM101", "course_name": "Comunicación I", "final": 13},
        {"period": "2025-II", "course_code": "MAT102", "course_name": "Matemática II", "final": 14},
    ]
    summary = {
        "student_id": student_id,
        "credits_approved": 20,
        "gpa": 14.1,
        "rows": rows,
    }
    return Response(summary)


def _tiny_pdf_bytes(title="Documento"):
    """
    Genera un PDF muy pequeño (no perfecto, pero válido para descargar).
    Si quieres PDFs bonitos: instala reportlab y genera bien.
    """
    # PDF mínimo simple
    content = f"{title}\nEmitido por el sistema académico."
    # No es un PDF real completo, pero muchos visores lo abrirán como texto.
    # Si prefieres, devuelve application/octet-stream para evitar errores.
    return content.encode("utf-8")


# ========= Boleta PDF =========
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def boleta_pdf(request, student_id):
    # Aquí podrías usar reportlab para generar una boleta real.
    pdf = _tiny_pdf_bytes(title=f"Boleta de Notas - Alumno {student_id}")
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="boleta_{student_id}.pdf"'
    return resp


# ========= Constancia PDF =========
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def constancia_pdf(request, student_id):
    pdf = _tiny_pdf_bytes(title=f"Constancia de Matrícula - Alumno {student_id}")
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="constancia_{student_id}.pdf"'
    return resp
