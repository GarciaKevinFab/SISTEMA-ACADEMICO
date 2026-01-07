from django.http import HttpResponse, FileResponse, Http404
from django.db.models import Q
from django.core.files.base import ContentFile

from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import *
from .serializers import *


# ------------------ helpers ------------------
def list_items(serializer_cls, queryset):
    return Response({"items": serializer_cls(queryset, many=True).data})


# ------------------ Catálogos ------------------
class PeriodsViewSet(viewsets.ModelViewSet):
    queryset = Period.objects.all()
    serializer_class = PeriodSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(Period, "start_date"):
            return qs.order_by("-start_date")
        if hasattr(Period, "start"):
            return qs.order_by("-start")
        return qs.order_by("-id")

    def list(self, request, *args, **kwargs):
        return list_items(self.serializer_class, self.get_queryset())

    @action(detail=True, methods=["post"], url_path="active")
    def set_active(self, request, pk=None):
        is_active = bool(request.data.get("is_active", False))
        p = self.get_object()
        if is_active:
            Period.objects.update(is_active=False)
        p.is_active = is_active
        p.save(update_fields=["is_active"])
        return Response({"ok": True, "id": p.id, "is_active": p.is_active})


class CampusesViewSet(viewsets.ModelViewSet):
    queryset = Campus.objects.all().order_by("name")
    serializer_class = CampusSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]

    def list(self, request, *args, **kwargs):
        return list_items(self.serializer_class, self.get_queryset())


class ClassroomsViewSet(viewsets.ModelViewSet):
    queryset = Classroom.objects.select_related("campus").all()
    serializer_class = ClassroomSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = super().get_queryset()
        campus_id = self.request.query_params.get("campus_id")
        if campus_id:
            qs = qs.filter(campus_id=campus_id)

        if hasattr(Classroom, "code"):
            return qs.order_by("campus__name", "code")
        return qs.order_by("campus__name", "id")

    def list(self, request, *args, **kwargs):
        return list_items(self.serializer_class, self.get_queryset())


class TeachersViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.select_related("user").all()
    serializer_class = TeacherSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = super().get_queryset()
        q = (self.request.query_params.get("q") or "").strip()

        if q:
            cond = Q()

            # Campos Teacher (si existen)
            if hasattr(Teacher, "document"):
                cond |= Q(document__icontains=q)
            if hasattr(Teacher, "email"):
                cond |= Q(email__icontains=q)
            if hasattr(Teacher, "phone"):
                cond |= Q(phone__icontains=q)
            if hasattr(Teacher, "specialization"):
                cond |= Q(specialization__icontains=q)

            # ✅ tu User NO tiene first_name/last_name -> usa full_name/username/email
            cond |= (
                Q(user__full_name__icontains=q) |
                Q(user__username__icontains=q) |
                Q(user__email__icontains=q)
            )

            qs = qs.filter(cond)

        return qs.order_by("user__full_name", "user__username", "id")

    def list(self, request, *args, **kwargs):
        return list_items(self.serializer_class, self.get_queryset())


# ------------------ Ubigeo (MVP estático) ------------------
UBIGEO_DATA = {
    "LIMA": {
        "LIMA": ["LIMA", "LA MOLINA", "SURCO", "MIRAFLORES"],
        "HUAURA": ["HUACHO", "HUALMAY"],
    },
    "PIURA": {
        "PIURA": ["PIURA", "CASTILLA"],
    },
}

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ubigeo_search(request):
    q = (request.query_params.get("q") or "").strip().upper()
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

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ubigeo_departments(request):
    return Response(sorted(list(UBIGEO_DATA.keys())))

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ubigeo_provinces(request):
    dep = (request.query_params.get("department") or "").upper()
    provs = sorted(list(UBIGEO_DATA.get(dep, {}).keys()))
    return Response(provs)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ubigeo_districts(request):
    dep = (request.query_params.get("department") or "").upper()
    prov = (request.query_params.get("province") or "").upper()
    dists = UBIGEO_DATA.get(dep, {}).get(prov, [])
    return Response(sorted(dists))


# ------------------ Institución ------------------
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def institution_settings(request):
    obj, _ = InstitutionSetting.objects.get_or_create(pk=1)

    if request.method == "GET":
        return Response(obj.data or {})

    obj.data = {**(obj.data or {}), **(request.data or {})}
    obj.save(update_fields=["data"])
    return Response(obj.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def institution_media(request):
    file = request.FILES.get("file")
    kind = request.POST.get("kind")

    if not file or not kind:
        return Response({"detail": "file y kind requeridos"}, status=400)

    asset = MediaAsset.objects.create(kind=kind, file=file)
    return Response(MediaAssetSerializer(asset).data, status=201)


# ------------------ Importadores ------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def imports_template(request, type: str):
    content = b"col1,col2,col3\n"
    resp = HttpResponse(content, content_type="text/csv")
    resp["Content-Disposition"] = f'attachment; filename="{type}_template.csv"'
    return resp


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def imports_start(request, type: str):
    file = request.FILES.get("file")
    mapping_raw = request.POST.get("mapping")
    mapping = {}

    if mapping_raw:
        try:
            import json
            mapping = json.loads(mapping_raw)
        except Exception:
            mapping = {}

    if not file:
        return Response({"detail": "file requerido"}, status=400)

    job = ImportJob.objects.create(type=type, file=file, mapping=mapping, status="RUNNING", result={})

    job.status = "COMPLETED"
    job.result = {"imported": 0, "errors": []}
    job.save(update_fields=["status", "result"])

    return Response({"job_id": job.id})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def imports_status(request, jobId: int):
    try:
        job = ImportJob.objects.get(pk=jobId)
    except ImportJob.DoesNotExist:
        return Response({"detail": "job not found"}, status=404)

    errors = []
    if isinstance(job.result, dict):
        errors = job.result.get("errors") or []

    return Response({
        "id": job.id,
        "state": job.status,
        "progress": 100 if job.status == "COMPLETED" else 0,
        "errors": errors,
    })


# ------------------ Respaldo / Export ------------------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def backups_collection(request):
    if request.method == "GET":
        qs = BackupExport.objects.all().order_by("-created_at")
        return Response({"items": BackupExportSerializer(qs, many=True).data})

    scope = (request.data.get("scope") or "FULL")
    obj = BackupExport.objects.create(scope=scope)
    obj.file.save("backup.bin", ContentFile(b"backup-bytes"))
    obj.save()
    return Response({
        "id": obj.id,
        "scope": obj.scope,
        "file": obj.file.url if obj.file else None,
    }, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def backup_download(request, id: int):
    try:
        b = BackupExport.objects.get(pk=id)
    except BackupExport.DoesNotExist:
        raise Http404

    if not b.file:
        raise Http404

    return FileResponse(b.file.open("rb"), as_attachment=True, filename=b.file.name.split("/")[-1])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def export_dataset(request):
    dataset = request.data.get("dataset", "DATA")
    return Response({"ok": True, "dataset": dataset})
