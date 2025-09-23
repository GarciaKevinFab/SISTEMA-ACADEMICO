from django.shortcuts import render

# Create your views here.
from pathlib import Path
from django.http import FileResponse, HttpResponse
from django.utils.timezone import now
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import ReportJob
from .serializers import ReportJobSerializer
from .pdf_utils import write_dummy_pdf

# ==================== CATÁLOGOS (MVP) ====================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catalog_periods(request):
    # TODO: enlazar a tu app académico real
    return Response([{"id": 1, "name": "2025-I"}, {"id": 2, "name": "2025-II"}])

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catalog_careers(request):
    return Response([{"id": 10, "code": "EDU-INI", "name": "Educación Inicial"},
                     {"id": 11, "code": "EDU-PRI", "name": "Educación Primaria"}])

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catalog_sections(request):
    # filtros: period_id, career_id, course_id
    return Response([{"id": 100, "label": "SEC-100 - Matemática I (2025-I)"}])

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catalog_courses(request):
    # optional: career_id
    return Response([{"id": 200, "code": "MAT101", "name": "Matemática I"}])

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def students_search(request):
    q = request.query_params.get("q", "")
    return Response([{"id": 5000, "document": "12345678", "full_name": f"Alumno Demo ({q})"}])

# =============== CORE GENERADOR (POST 202 + polling) ===============
def _create_ready_job(report_type: str, payload: dict) -> ReportJob:
    job = ReportJob.objects.create(type=report_type, payload=payload, status="PENDING")
    # Generar PDF “al vuelo” (MVP) y marcar READY
    out = Path("media") / "reports" / f"job_{job.id}.pdf"
    write_dummy_pdf(out, title=f"{report_type} {now().date()}")
    job.file_path = str(out)
    job.status = "READY"
    job.save(update_fields=["file_path","status","updated_at"])
    return job

def _accepted(job: ReportJob, request):
    poll = f"/api/reports/jobs/{job.id}"
    headers = {"Location": poll}
    body = {"job_id": job.id, "status": job.status, "poll_url": poll}
    return Response(body, status=status.HTTP_202_ACCEPTED, headers=headers)

# ---- Endpoints oficiales que llama tu front ----
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def actas_academic(request):
    job = _create_ready_job("ACADEMIC_ACTA", request.data or {})
    return _accepted(job, request)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def actas_admission(request):
    job = _create_ready_job("ADMISSION_ACTA", request.data or {})
    return _accepted(job, request)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def boletas_grades(request):
    job = _create_ready_job("GRADE_SLIP", request.data or {})
    return _accepted(job, request)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def constancias_enrollment(request):
    job = _create_ready_job("ENROLLMENT_CONST", request.data or {})
    return _accepted(job, request)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def kardex(request):
    job = _create_ready_job("KARDEX", request.data or {})
    return _accepted(job, request)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def certificates(request):
    job = _create_ready_job("CERTIFICATE", request.data or {})
    return _accepted(job, request)

# ---- Polling + descarga ----
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def report_job_get(request, job_id: int):
    try:
        job = ReportJob.objects.get(pk=job_id)
    except ReportJob.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    data = ReportJobSerializer(job).data
    if job.status == "READY":
        data["download_url"] = f"/api/reports/jobs/{job.id}/download"
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def report_job_download(request, job_id: int):
    try:
        job = ReportJob.objects.get(pk=job_id)
    except ReportJob.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    if job.status != "READY" or not job.file_path:
        return Response({"detail":"Not ready"}, status=409)
    return FileResponse(open(job.file_path, "rb"), content_type="application/pdf",
                        as_attachment=True, filename=f"report_{job_id}.pdf")

# =================== EXPORTS EXCEL ===================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reports_export(request, type: str):
    # Devuelve un XLSX vacío (MVP). Sustituye por tu generador real.
    resp = HttpResponse(b'', content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = f'attachment; filename="{type}.xlsx"'
    return resp
