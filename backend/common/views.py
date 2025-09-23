# backend/common/views.py
from django.http import JsonResponse
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Period, Campus, Classroom, Teacher, InstitutionSettings
from .serializers import (
    PeriodSerializer, CampusSerializer, ClassroomSerializer,
    TeacherSerializer, InstitutionSettingsSerializer
)

# Importamos Career desde courses para el catálogo liviano
from courses.models import Career


# ====== ViewSets de catálogos ======
class AcademicPeriodViewSet(viewsets.ModelViewSet):
    queryset = Period.objects.all()
    serializer_class = PeriodSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "label"]
    ordering_fields = ["start_date", "end_date", "code", "label", "is_active"]
    ordering = ["-is_active", "-start_date"]


class CampusViewSet(viewsets.ModelViewSet):
    queryset = Campus.objects.all()
    serializer_class = CampusSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "short_name", "address"]
    ordering_fields = ["name", "short_name", "is_active"]
    ordering = ["name"]


class ClassroomViewSet(viewsets.ModelViewSet):
    queryset = Classroom.objects.select_related("campus").all()
    serializer_class = ClassroomSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "name", "campus__name"]
    ordering_fields = ["code", "capacity", "is_active"]
    ordering = ["code"]

    def get_queryset(self):
        qs = super().get_queryset()
        campus_id = self.request.query_params.get("campus_id")
        if campus_id:
            qs = qs.filter(campus_id=campus_id)
        return qs


class TeacherViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.all()
    serializer_class = TeacherSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "document_number", "email"]
    ordering_fields = ["last_name", "first_name", "is_active"]
    ordering = ["last_name", "first_name"]


# ====== Institution Settings (GET / PATCH) ======
@api_view(["GET", "PATCH"])
@permission_classes([permissions.IsAuthenticated])
def institution_settings_view(request):
    obj, _ = InstitutionSettings.objects.get_or_create(id=1)
    if request.method == "GET":
        return Response(InstitutionSettingsSerializer(obj).data)

    # PATCH
    serializer = InstitutionSettingsSerializer(obj, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


# ====== Subida de media institucional (logo, alt, firma) ======
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def institution_media_upload(request):
    """
    Espera multipart/form-data con:
      - file (binario)
      - kind: LOGO | LOGO_ALT | SIGNATURE
    """
    kind = request.data.get("kind")
    f = request.FILES.get("file")
    if not kind or not f:
        return Response({"detail": "kind y file son requeridos"}, status=status.HTTP_400_BAD_REQUEST)

    obj, _ = InstitutionSettings.objects.get_or_create(id=1)
    if kind == "LOGO":
        obj.logo = f
    elif kind == "LOGO_ALT":
        obj.logo_alt = f
    elif kind == "SIGNATURE":
        obj.signature = f
    else:
        return Response({"detail": "kind inválido"}, status=status.HTTP_400_BAD_REQUEST)
    obj.save()
    return Response(InstitutionSettingsSerializer(obj).data)


# ====== Ubigeo (stubs mínimos) ======
@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def ubigeo_search(request):
    q = (request.GET.get("q") or "").lower()
    base = [
        {"department": "Junín", "province": "Huancayo", "district": "El Tambo", "ubigeo": "120101"},
        {"department": "Junín", "province": "Huancayo", "district": "Huancayo", "ubigeo": "120102"},
        {"department": "Lima", "province": "Lima", "district": "Miraflores", "ubigeo": "150122"},
        {"department": "Lima", "province": "Lima", "district": "San Isidro", "ubigeo": "150131"},
    ]
    if q:
        base = [r for r in base if q in r["department"].lower() or q in r["province"].lower() or q in r["district"].lower()]
    return Response(base)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def ubigeo_departments(request):
    return Response([
        {"code": "12", "name": "Junín"},
        {"code": "15", "name": "Lima"},
        {"code": "08", "name": "Cusco"},
    ])


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def ubigeo_provinces(request):
    dep = request.GET.get("department")
    data = []
    if dep == "12":
        data = [{"code": "1201", "name": "Huancayo"}]
    elif dep == "15":
        data = [{"code": "1501", "name": "Lima"}]
    elif dep == "08":
        data = [{"code": "0801", "name": "Cusco"}]
    return Response(data)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def ubigeo_districts(request):
    dep = request.GET.get("department")
    prov = request.GET.get("province")
    data = []
    if dep == "12" and prov == "1201":
        data = [
            {"code": "120101", "name": "Huancayo"},
            {"code": "120104", "name": "El Tambo"},
        ]
    elif dep == "15" and prov == "1501":
        data = [
            {"code": "150122", "name": "Miraflores"},
            {"code": "150131", "name": "San Isidro"},
        ]
    elif dep == "08" and prov == "0801":
        data = [
            {"code": "080101", "name": "Cusco"},
        ]
    return Response(data)


# ====== Catálogo liviano de carreras (para combos del UI) ======
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def catalog_careers(request):
    """
    Devuelve [{id, code, name}] consumido por:
      - Academic service: Careers.list() -> GET /api/careers  (CRUD en courses)
      - Catalogs service: Periods/Campuses/Classrooms/Teachers (aquí)
      - Y combos rápidos vía /api/catalogs/careers (este endpoint)
    """
    data = list(Career.objects.values("id", "code", "name").order_by("name"))
    return Response(data)
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def academic_periods(request):
    qs = Period.objects.all().order_by("-is_active", "-start_date", "code")
    return Response(PeriodSerializer(qs, many=True).data)
# === NUEVO: Reportes oficiales con polling en memoria ===
from io import BytesIO
from datetime import datetime
import uuid
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.http import HttpResponse
from django.urls import reverse

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import cm
    REPORTLAB_OK = True
except Exception:
    REPORTLAB_OK = False

# Job store en memoria (para desarrollo)
REPORT_JOBS = {}  # job_id -> {"status": "PENDING|READY|ERROR", "filename": str, "bytes": bytes}


def _pdf_make(title="Documento", lines=None):
    """
    Genera un PDF simple con ReportLab y devuelve bytes.
    """
    if not REPORTLAB_OK:
        return None
    buff = BytesIO()
    c = canvas.Canvas(buff, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 14)
    c.drawString(2*cm, (height - 2*cm), title)

    c.setFont("Helvetica", 10)
    y = height - 3*cm
    lines = lines or []
    for ln in lines:
        c.drawString(2*cm, y, ln[:110])
        y -= 14
        if y < 2*cm:
            c.showPage()
            y = height - 2*cm

    c.showPage()
    c.save()
    return buff.getvalue()


def _create_job(filename, pdf_bytes):
    """
    Crea un job en memoria y devuelve job_id.
    """
    job_id = uuid.uuid4().hex
    REPORT_JOBS[job_id] = {
        "status": "READY" if pdf_bytes else "ERROR",
        "filename": filename,
        "bytes": pdf_bytes or b"",
    }
    return job_id


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def report_boleta_grades_start(request):
    """
    Inicia generación de Boleta de Notas (PDF).
    request.data esperado: { student_id, period, ... }
    """
    student_id = request.data.get("student_id")
    period = request.data.get("period", "")
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    # Arma contenido de ejemplo (cuando tengas tu modelo de notas, reemplaza)
    lines = [
        f"IESPP 'Gustavo Allende Llavería' - Boleta de Notas",
        f"Alumno ID: {student_id or '-'}",
        f"Periodo: {period or '-'}",
        f"Emitido: {now}",
        "",
        "Cursos (demo):",
        " - MAT101 - Matemática I - Nota final: 15",
        " - COM102 - Comunicación - Nota final: 14",
        " - INF103 - Informática - Nota final: 16",
    ]
    pdf = _pdf_make("Boleta de Notas", lines)
    job_id = _create_job(f"boleta_{student_id or 'alumno'}.pdf", pdf)
    # 202 con job_id
    return Response({"job_id": job_id}, status=202)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def report_constancia_enrollment_start(request):
    """
    Inicia generación de Constancia de Matrícula (PDF).
    request.data: { student_id, period, ... }
    """
    student_id = request.data.get("student_id")
    period = request.data.get("period", "")
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines = [
        f"IESPP 'Gustavo Allende Llavería' - Constancia de Matrícula",
        f"Alumno ID: {student_id or '-'}",
        f"Periodo: {period or '-'}",
        f"Fecha: {now}",
        "",
        "Se deja constancia que el alumno se encuentra matriculado en el periodo indicado.",
    ]
    pdf = _pdf_make("Constancia de Matrícula", lines)
    job_id = _create_job(f"constancia_{student_id or 'alumno'}.pdf", pdf)
    return Response({"job_id": job_id}, status=202)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def report_kardex_start(request):
    """
    Inicia generación de Kárdex (PDF).
    request.data: { student_id }
    """
    student_id = request.data.get("student_id")
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines = [
        f"IESPP 'Gustavo Allende Llavería' - Kárdex Académico",
        f"Alumno ID: {student_id or '-'}",
        f"Emitido: {now}",
        "",
        "Resumen (demo):",
        " Periodo 2024-II: 5 cursos, promedio 14.6",
        " Periodo 2025-I: 6 cursos, promedio 15.2",
    ]
    pdf = _pdf_make("Kárdex Académico", lines)
    job_id = _create_job(f"kardex_{student_id or 'alumno'}.pdf", pdf)
    return Response({"job_id": job_id}, status=202)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_job_status(request, job_id):
    """
    Devuelve estado del job + URL de descarga si está READY.
    """
    job = REPORT_JOBS.get(job_id)
    if not job:
        return Response({"status": "NOT_FOUND"}, status=404)
    data = {"status": job["status"]}
    if job["status"] == "READY":
        data["download_url"] = request.build_absolute_uri(
            reverse("common:rep-job-dl", kwargs={"job_id": job_id})
        )
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_job_download(request, job_id):
    """
    Descarga el PDF generado para el job.
    """
    job = REPORT_JOBS.get(job_id)
    if not job:
        return Response({"detail": "job not found"}, status=404)
    if job["status"] != "READY":
        return Response({"detail": "job not ready"}, status=409)
    resp = HttpResponse(job["bytes"], content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{job["filename"]}"'
    return resp
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from .models import Period
from .serializers import PeriodSerializer

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def academic_periods_alias(request):
    qs = Period.objects.all().order_by("-is_active", "-start_date", "code")
    return Response(PeriodSerializer(qs, many=True).data)
