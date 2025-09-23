from django.shortcuts import render

# Create your views here.
from datetime import datetime
from django.utils.timezone import now
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status

from .models import *
from .serializers import *

# ---------- Stats / Dashboard ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    data = {
        "exports_total": MineduExport.objects.count(),
        "exports_queued": MineduExport.objects.filter(status='QUEUED').count(),
        "exports_error": MineduExport.objects.filter(status='ERROR').count(),
        "jobs": IntegrationJob.objects.count(),
        "last_export": MineduExport.objects.order_by('-updated_at').values('type','status','updated_at').first(),
    }
    return Response(data)

# ---------- Exports ----------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def export_enqueue_enrollments(request):
    obj = MineduExport.objects.create(type='ENROLLMENTS', payload=request.data or {}, status='QUEUED')
    return Response(MineduExportSerializer(obj).data, status=201)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def export_enqueue_grades(request):
    obj = MineduExport.objects.create(type='GRADES', payload=request.data or {}, status='QUEUED')
    return Response(MineduExportSerializer(obj).data, status=201)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def exports_list(request):
    qs = MineduExport.objects.all().order_by('-created_at')[:200]
    return Response(MineduExportSerializer(qs, many=True).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def export_retry(request, exportId: int):
    try:
        obj = MineduExport.objects.get(pk=exportId)
    except MineduExport.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    obj.status = 'RETRY'; obj.tries = obj.tries + 1; obj.save(update_fields=['status','tries','updated_at'])
    return Response({"ok": True, "id": obj.id, "status": obj.status, "tries": obj.tries})

# ---------- Validation ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def validation_integrity(request):
    # TODO: aquí corres chequeos reales de integridad (alumnos sin plan, notas sin curso, etc.)
    issues = []
    return Response({"ok": True, "issues": issues})

# ---------- Catalogs ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catalogs_remote(request):
    # Simula respuesta del MINEDU según 'type'
    t = request.query_params.get('type') or ''
    sample = {
        "CAREER": [{"code":"EDU-01","name":"Educación Inicial"}, {"code":"EDU-02","name":"Educación Primaria"}],
        "COURSE": [{"code":"MAT101","name":"Matemática I"}, {"code":"COM101","name":"Comunicación I"}],
        "CAMPUS": [{"code":"MAIN","name":"Sede Central"}],
    }
    return Response(sample.get(t.upper(), []))

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catalogs_local(request):
    t = (request.query_params.get('type') or '').upper()
    params = dict(request.query_params)
    # MVP: devolvemos los mappings como "catálogo local" cuando existan
    items = list(Mapping.objects.filter(type=t).values('local_code','remote_code','label'))
    return Response(items)

# ---------- Mapping ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mappings_list(request):
    t = request.query_params.get('type')
    qs = Mapping.objects.all()
    if t: qs = qs.filter(type=t)
    return Response(MappingSerializer(qs, many=True).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mappings_bulk_save(request):
    t = request.data.get('type')
    mappings = request.data.get('mappings', [])
    if not t or not isinstance(mappings, list):
        return Response({"detail":"type y mappings[] requeridos"}, status=400)
    # reescribe todo por tipo (MVP)
    Mapping.objects.filter(type=t).delete()
    objs = [Mapping(type=t,
                    local_code=m.get('local_code',''),
                    remote_code=m.get('remote_code',''),
                    label=m.get('label','')) for m in mappings]
    Mapping.objects.bulk_create(objs)
    return Response({"ok": True, "count": len(objs)})

# ---------- Jobs ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def jobs_list(request):
    qs = IntegrationJob.objects.all().order_by('-id')
    return Response(IntegrationJobSerializer(qs, many=True).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def jobs_create(request):
    ser = IntegrationJobSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    job = ser.save()
    return Response(IntegrationJobSerializer(job).data, status=201)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def jobs_update(request, id: int):
    try:
        job = IntegrationJob.objects.get(pk=id)
    except IntegrationJob.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    ser = IntegrationJobSerializer(job, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(IntegrationJobSerializer(job).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def jobs_run_now(request, id: int):
    try:
        job = IntegrationJob.objects.get(pk=id)
    except IntegrationJob.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    run = JobRun.objects.create(job=job, status='RUNNING', meta={'manual': True})
    RunLog.objects.create(run=run, level='INFO', message='Run disparado manualmente', meta={})
    # Simular finalización inmediata
    run.status = 'SUCCESS'; run.ended_at = now(); run.save(update_fields=['status','ended_at'])
    RunLog.objects.create(run=run, level='INFO', message='Run finalizado OK', meta={})
    return Response({"ok": True, "run_id": run.id})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def jobs_pause(request, id: int):
    IntegrationJob.objects.filter(pk=id).update(enabled=False)
    return Response({"ok": True})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def jobs_resume(request, id: int):
    IntegrationJob.objects.filter(pk=id).update(enabled=True)
    return Response({"ok": True})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def jobs_runs(request, id: int):
    qs = JobRun.objects.filter(job_id=id).order_by('-started_at')[:200]
    return Response(JobRunSerializer(qs, many=True).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def jobs_retry_run(request, runId: int):
    try:
        run = JobRun.objects.get(pk=runId)
    except JobRun.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    new_run = JobRun.objects.create(job=run.job, status='RUNNING', meta={'retry_of': run.id})
    RunLog.objects.create(run=new_run, level='INFO', message=f"Retry de run {run.id}", meta={})
    new_run.status = 'SUCCESS'; new_run.ended_at = now(); new_run.save(update_fields=['status','ended_at'])
    RunLog.objects.create(run=new_run, level='INFO', message="Retry finalizado OK", meta={})
    return Response({"ok": True, "run_id": new_run.id})

# ---------- Logs ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def logs_for_run(request, runId: int):
    qs = RunLog.objects.filter(run_id=runId).order_by('timestamp')
    return Response(RunLogSerializer(qs, many=True).data)
