from rest_framework import viewsets
from .models import Student
from .serializers import StudentSerializer

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import Student
from enrollment.models import Enrollment
from grades.models import Grade

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def kardex_of_student(request, student_id):
    student = get_object_or_404(Student, id=student_id)
    data = {
        "student": {
            "id": student.id,
            "dni": student.dni,
            "first_name": student.first_name,
            "last_name": student.last_name,
        },
        "periods": {}
    }
    enrolls = (
        Enrollment.objects
        .select_related("course")
        .filter(student=student)
        .order_by("period", "course__name")
    )
    for e in enrolls:
        per = e.period
        data["periods"].setdefault(per, [])
        # simple promedio (puedes ajustar a ponderado con weight si lo usas)
        grades = list(Grade.objects.filter(enrollment=e).values_list("score", flat=True))
        final = round(sum(grades)/len(grades), 2) if grades else None
        data["periods"][per].append({
            "course_id": e.course_id,
            "course_code": e.course.code,
            "course_name": e.course.name,
            "final_grade": final,
            "status": e.status,
            "section": e.section,
        })
    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def kardex_boleta_pdf(request, student_id):
    period = request.data.get("academic_period")
    # Stub: entrega URL “falsa” de PDF (ajusta cuando integres tu generador real)
    return Response({
        "pdf_url": f"/media/tmp/boleta-{student_id}-{period or 'NA'}.pdf",
        "student_id": student_id,
        "period": period,
        "status": "queued"
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def kardex_constancia_pdf(request, student_id):
    # Stub PDF
    return Response({
        "pdf_url": f"/media/tmp/constancia-{student_id}.pdf",
        "student_id": student_id,
        "status": "queued"
    })
# === KÁRDEX + PDFs directos (Boleta / Constancia) ===
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from io import BytesIO
from datetime import datetime

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import cm
    REPORTLAB_OK = True
except Exception:
    REPORTLAB_OK = False

from .models import Student
from enrollment.models import Enrollment
# Si tienes Grade y Section, podrías enriquecerlo:
# from grades.models import Grade
from courses.models import Course


def _pdf_make(title, lines):
    if not REPORTLAB_OK:
        return None
    buff = BytesIO()
    c = canvas.Canvas(buff, pagesize=A4)
    W, H = A4
    c.setFont("Helvetica-Bold", 14)
    c.drawString(2*cm, H - 2*cm, title)
    c.setFont("Helvetica", 10)
    y = H - 3*cm
    for ln in lines:
        c.drawString(2*cm, y, ln[:110])
        y -= 14
        if y < 2*cm:
            c.showPage()
            y = H - 2*cm
    c.showPage()
    c.save()
    return buff.getvalue()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def kardex_of_student(request, student_id):
    student = get_object_or_404(Student, pk=student_id)
    # Demo: usar Enrollment como base; agrega notas si ya tienes Grade
    enrolls = Enrollment.objects.filter(student=student).select_related("course").order_by("period", "course__name")
    rows = []
    for e in enrolls:
        rows.append({
            "period": e.period,
            "course_code": e.course.code,
            "course_name": e.course.name,
            "status": e.status,
            # "final_grade": ... # si tienes Grade, trae la nota final aquí
        })
    return Response({
        "student": {
            "id": student.id,
            "full_name": f"{student.last_name}, {student.first_name}",
            "document": student.dni if hasattr(student, "dni") else "",
        },
        "records": rows
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def kardex_boleta_pdf(request, student_id):
    student = get_object_or_404(Student, pk=student_id)
    period = request.data.get("academic_period") or request.data.get("period", "")
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "IESPP 'Gustavo Allende Llavería' - Boleta de Notas",
        f"Alumno: {student.last_name}, {student.first_name}",
        f"Documento: {(student.dni if hasattr(student, 'dni') else '')}",
        f"Periodo: {period or '-'}",
        f"Emitido: {now}",
        ""
    ]
    # demo: listar enrollments del periodo
    q = Enrollment.objects.filter(student=student)
    if period:
        q = q.filter(period=period)
    q = q.select_related("course")
    for e in q:
        lines.append(f"- {e.course.code} {e.course.name} · Estado: {e.status}")
    pdf = _pdf_make("Boleta de Notas", lines)
    if not pdf:
        return Response({"detail": "ReportLab no instalado"}, status=500)
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="boleta_{student.id}.pdf"'
    return resp


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def kardex_constancia_pdf(request, student_id):
    student = get_object_or_404(Student, pk=student_id)
    period = request.data.get("academic_period") or request.data.get("period", "")
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "IESPP 'Gustavo Allende Llavería' - Constancia de Matrícula",
        f"Alumno: {student.last_name}, {student.first_name}",
        f"Documento: {(student.dni if hasattr(student, 'dni') else '')}",
        f"Periodo: {period or '-'}",
        f"Fecha: {now}",
        "",
        "Se deja constancia que el alumno se encuentra matriculado en el periodo indicado."
    ]
    pdf = _pdf_make("Constancia de Matrícula", lines)
    if not pdf:
        return Response({"detail": "ReportLab no instalado"}, status=500)
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="constancia_{student.id}.pdf"'
    return resp
