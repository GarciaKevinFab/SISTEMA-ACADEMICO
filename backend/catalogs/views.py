from django.shortcuts import render

# Create your views here.
from django.http import HttpResponse, FileResponse, Http404
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import *
from .serializers import *
from django.db.models import Q
import io

# ------------------ Catálogos ------------------

class PeriodsViewSet(viewsets.ModelViewSet):
    queryset = Period.objects.all().order_by('-start')
    serializer_class = PeriodSerializer
    http_method_names = ['get','post','patch','delete']

    # POST /catalogs/periods/{id}/active {is_active:true|false}
    @action(detail=True, methods=['post'], url_path='active')
    def set_active(self, request, pk=None):
        is_active = bool(request.data.get('is_active', False))
        Period.objects.update(is_active=False)  # única activa
        p = self.get_object()
        p.is_active = is_active
        p.save(update_fields=['is_active'])
        return Response({'ok': True, 'id': p.id, 'is_active': p.is_active})

class CampusesViewSet(viewsets.ModelViewSet):
    queryset = Campus.objects.all().order_by('name')
    serializer_class = CampusSerializer
    http_method_names = ['get','post','patch','delete']

class ClassroomsViewSet(viewsets.ModelViewSet):
    queryset = Classroom.objects.select_related('campus').all().order_by('campus__name','code')
    serializer_class = ClassroomSerializer
    http_method_names = ['get','post','patch','delete']

    def list(self, request, *args, **kwargs):
        qs = self.queryset
        campus_id = request.query_params.get('campus_id')
        if campus_id: qs = qs.filter(campus_id=campus_id)
        return Response(self.serializer_class(qs, many=True).data)

class TeachersViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.all().order_by('full_name')
    serializer_class = TeacherSerializer
    http_method_names = ['get','post','patch','delete']

    def list(self, request, *args, **kwargs):
        qs = self.queryset
        q = request.query_params.get('q')
        if q:
            qs = qs.filter(
                Q(full_name__icontains=q) | Q(dni__icontains=q) | Q(email__icontains=q)
            )
        return Response(self.serializer_class(qs, many=True).data)

# ------------------ Ubigeo (MVP estático) ------------------

# Puedes reemplazar por una tabla real o por ubigeo oficial RENIEC/INEI.
UBIGEO_DATA = {
    "LIMA": {
        "LIMA": ["LIMA", "LA MOLINA", "SURCO", "MIRAFLORES"],
        "HUAURA": ["HUACHO", "HUALMAY"],
    },
    "PIURA": {
        "PIURA": ["PIURA", "CASTILLA"],
    },
}

@api_view(['GET'])
def ubigeo_search(request):
    q = (request.query_params.get('q') or '').strip().upper()
    res = []
    if q:
        for dep, provs in UBIGEO_DATA.items():
            if q in dep:
                res.append({"department": dep})
            for prov, dists in provs.items():
                if q in prov:
                    res.append({"department": dep, "province": prov})
                for dist in dists:
                    if q in dist:
                        res.append({"department": dep, "province": prov, "district": dist})
    return Response(res[:50])

@api_view(['GET'])
def ubigeo_departments(request):
    return Response(sorted(list(UBIGEO_DATA.keys())))

@api_view(['GET'])
def ubigeo_provinces(request):
    dep = (request.query_params.get('department') or '').upper()
    provs = sorted(list(UBIGEO_DATA.get(dep, {}).keys()))
    return Response(provs)

@api_view(['GET'])
def ubigeo_districts(request):
    dep = (request.query_params.get('department') or '').upper()
    prov = (request.query_params.get('province') or '').upper()
    dists = UBIGEO_DATA.get(dep, {}).get(prov, [])
    return Response(sorted(dists))

# ------------------ Institución (settings + media) ------------------

@api_view(['GET','PATCH'])
def institution_settings(request):
    obj, _ = InstitutionSetting.objects.get_or_create(pk=1)
    if request.method == 'GET':
        return Response(obj.data)
    obj.data = {**obj.data, **(request.data or {})}
    obj.save(update_fields=['data'])
    return Response({"ok": True, "data": obj.data})

@api_view(['POST'])
def institution_media(request):
    parser_classes = (MultiPartParser, FormParser)
    file = request.FILES.get('file')
    kind = request.POST.get('kind')
    if not file or not kind:
        return Response({"detail":"file y kind requeridos"}, status=400)
    asset = MediaAsset.objects.create(kind=kind, file=file)
    return Response(MediaAssetSerializer(asset).data, status=201)

# ------------------ Importadores ------------------

@api_view(['GET'])
def imports_template(request, type: str):
    # Devuelve un CSV/XLSX “placeholder” por tipo
    content = b"col1,col2,col3\n"
    resp = HttpResponse(content, content_type='text/csv')
    resp['Content-Disposition'] = f'attachment; filename="{type}_template.csv"'
    return resp

@api_view(['POST'])
def imports_start(request, type: str):
    file = request.FILES.get('file')
    mapping_raw = request.POST.get('mapping')
    mapping = {}
    if mapping_raw:
        try:
            import json
            mapping = json.loads(mapping_raw)
        except Exception:
            pass
    if not file:
        return Response({"detail":"file requerido"}, status=400)
    job = ImportJob.objects.create(type=type, file=file, mapping=mapping, status='RUNNING')
    # TODO: encolar job async / procesar
    job.status = 'DONE'
    job.result = {"imported": 0, "errors": []}
    job.save(update_fields=['status','result'])
    return Response({"jobId": job.id, "status": job.status})

@api_view(['GET'])
def imports_status(request, jobId: int):
    try:
        job = ImportJob.objects.get(pk=jobId)
    except ImportJob.DoesNotExist:
        return Response({"detail":"job not found"}, status=404)
    return Response(ImportJobSerializer(job).data)

# ------------------ Respaldo / Export ------------------

@api_view(['GET','POST'])
def backups_collection(request):
    if request.method == 'GET':
        items = BackupExport.objects.all().order_by('-created_at')
        return Response([{
            "id": b.id, "scope": b.scope, "file": b.file.url if b.file else None, "created_at": b.created_at
        } for b in items])
    # POST: crear backup “dummy”
    content = b'backup-bytes'
    from django.core.files.base import ContentFile
    obj = BackupExport.objects.create(scope=(request.data.get('scope') or 'FULL'))
    obj.file.save('backup.bin', ContentFile(content))
    obj.save()
    return Response({"id": obj.id, "scope": obj.scope, "file": obj.file.url}, status=201)

@api_view(['GET'])
def backup_download(request, id: int):
    try:
        b = BackupExport.objects.get(pk=id)
    except BackupExport.DoesNotExist:
        raise Http404
    return FileResponse(b.file.open('rb'), as_attachment=True, filename=b.file.name.split('/')[-1])

@api_view(['POST'])
def export_dataset(request):
    dataset = request.data.get('dataset', 'DATA')
    # Devuelve JSON “exportado” como confirmación
    return Response({"ok": True, "dataset": dataset})
