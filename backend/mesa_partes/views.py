# mesa_partes/views.py
import uuid, datetime as dt
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Office, ProcedureType, Procedure, ProcedureEvent, ProcedureFile
from .serializers import (
    OfficeSer, ProcedureTypeSer, ProcedureSer,
    ProcedureEventSer, ProcedureFileSer
)
from django.db.models import Avg, F
from django.db.models.functions import ExtractDay
from django.utils.dateparse import parse_date
from django.http import HttpResponse
import io, csv

def _track_code():
    # MP-AAAA-XXXXXX
    return f"MP-{dt.datetime.now():%Y}-{uuid.uuid4().hex[:6].upper()}"

# ---------- Catálogos ----------
class OfficeView(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Office.objects.all().order_by("name")
    serializer_class = OfficeSer

class UsersCatalogView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    def list(self, request):
        qs = request.user.__class__.objects.filter(is_staff=True)
        users = [{"id": u.id, "full_name": (u.get_full_name() or u.username)} for u in qs]
        return Response({"users": users})

# ---------- Tipos ----------
class ProcedureTypeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = ProcedureType.objects.all().order_by("name")
    serializer_class = ProcedureTypeSer

# ---------- Trámites ----------
class ProcedureViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Procedure.objects.select_related("procedure_type", "current_office", "assignee").all().order_by("-created_at")
    serializer_class = ProcedureSer

    def list(self, request, *args, **kwargs):
        objs = self.get_queryset()
        data = self.get_serializer(objs, many=True).data
        return Response({"procedures": data})

    def create(self, request, *args, **kwargs):
        # GENERA el tracking aquí
        data = request.data.copy()
        data["tracking_code"] = _track_code()

        ser = self.get_serializer(data=data)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        ProcedureEvent.objects.create(
            procedure=obj, type="CREATED", description="Trámite creado", actor=request.user
        )
        return Response({"procedure": self.get_serializer(obj).data}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def code(self, request):
        code = request.query_params.get("code")
        try:
            p = Procedure.objects.get(tracking_code=code)
        except Procedure.DoesNotExist:
            return Response(status=404)
        return Response({"procedure": self.get_serializer(p).data})

    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        p = self.get_object()
        evs = p.events.order_by("-at")
        return Response({"timeline": ProcedureEventSer(evs, many=True).data})

    @action(detail=True, methods=["post"])
    def route(self, request, pk=None):
        p = self.get_object()
        to_office_id = request.data.get("to_office_id")
        assignee_id  = request.data.get("assignee_id")
        note         = request.data.get("note", "")
        deadline     = request.data.get("deadline_at") or None

        if to_office_id:
            p.current_office_id = int(to_office_id)
        p.assignee_id = int(assignee_id) if assignee_id else None
        p.deadline_at = deadline
        p.save()

        ProcedureEvent.objects.create(
            procedure=p, type="ROUTED", description=note or "Derivado", actor=request.user
        )
        return Response({"ok": True})

    @action(detail=True, methods=["post"])
    def status(self, request, pk=None):
        p = self.get_object()
        new_status = request.data.get("status")
        note       = request.data.get("note", "")
        if new_status:
            p.status = new_status
            p.save()
            ProcedureEvent.objects.create(
                procedure=p, type="STATUS_CHANGED", description=f"{new_status}. {note}", actor=request.user
            )
        return Response({"ok": True})

    # ---- Archivos
    @action(detail=True, methods=["get", "post"], url_path="files")
    def files(self, request, pk=None):
        p = self.get_object()
        if request.method == "GET":
            return Response({"files": ProcedureFileSer(p.files.all(), many=True).data})

        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "file requerido"}, status=400)

        pf = ProcedureFile.objects.create(
            procedure=p, file=f, original_name=getattr(f, "name", ""), size=f.size,
            doc_type=request.POST.get("doc_type", "")
        )
        ProcedureEvent.objects.create(
            procedure=p, type="FILE_UPLOADED", description=pf.original_name, actor=request.user
        )
        return Response(ProcedureFileSer(pf).data, status=201)

    @action(detail=True, methods=["delete"], url_path=r"files/(?P<file_id>\d+)")
    def delete_file(self, request, pk=None, file_id=None):
        p = self.get_object()
        try:
            pf = p.files.get(id=file_id)
        except ProcedureFile.DoesNotExist:
            return Response(status=404)
        name = pf.original_name
        pf.file.delete(save=False)
        pf.delete()
        ProcedureEvent.objects.create(
            procedure=p, type="FILE_DELETED", description=name, actor=request.user
        )
        return Response(status=204)

    # ---- PDFs dummy (coinciden con tu front /procedures/:id/cover y /cargo)
    @action(detail=True, methods=["post"], url_path="cover")
    def cover(self, request, pk=None):
        p = self.get_object()
        content = f"Carátula\nExpediente: {p.tracking_code}\nSolicitante: {p.applicant_name}\n".encode()
        path = f"procedures/generated/cover-{p.tracking_code}.pdf"
        default_storage.save(path, ContentFile(content))
        return Response({"success": True, "downloadUrl": default_storage.url(path)})

    @action(detail=True, methods=["post"], url_path="cargo")
    def cargo(self, request, pk=None):
        p = self.get_object()
        content = f"Cargo de recepción\nExpediente: {p.tracking_code}\nFecha: {p.created_at:%Y-%m-%d}\n".encode()
        path = f"procedures/generated/cargo-{p.tracking_code}.pdf"
        default_storage.save(path, ContentFile(content))
        return Response({"success": True, "downloadUrl": default_storage.url(path)})

# ---------- Dashboard ----------
@api_view(["GET"])
def dashboard_stats(request):
    pending = Procedure.objects.exclude(status__in=["COMPLETED", "REJECTED"]).count()
    completed_today = Procedure.objects.filter(
        status="COMPLETED", updated_at__date=dt.date.today()
    ).count()
    avg_processing_time = 0
    return Response({"stats": {
        "pending_procedures": pending,
        "completed_today": completed_today,
        "avg_processing_time": avg_processing_time,
        "procedure_types": ProcedureType.objects.count(),
    }})

# ---------- Público ----------
@api_view(["POST"])
@permission_classes([AllowAny])
def public_create(request):
    data = request.data.copy()
    data["tracking_code"] = _track_code()
    ser = ProcedureSer(data=data)
    ser.is_valid(raise_exception=True)
    p = ser.save()
    ProcedureEvent.objects.create(procedure=p, type="CREATED_PUBLIC", description="Alta pública")
    return Response({"procedure": ProcedureSer(p).data}, status=201)

@api_view(["POST"])
@permission_classes([AllowAny])
def public_upload_file(request, code):
    try:
        p = Procedure.objects.get(tracking_code=code)
    except Procedure.DoesNotExist:
        return Response(status=404)
    f = request.FILES.get("file")
    if not f:
        return Response({"detail": "file requerido"}, status=400)
    pf = ProcedureFile.objects.create(
        procedure=p, file=f, original_name=getattr(f, "name", ""), size=f.size,
        doc_type=request.POST.get("doc_type","")
    )
    ProcedureEvent.objects.create(procedure=p, type="FILE_UPLOADED_PUBLIC", description=pf.original_name)
    return Response(ProcedureFileSer(pf).data, status=201)

@api_view(["GET"])
@permission_classes([AllowAny])
def public_track(request):
    code = request.GET.get("code")
    try:
        p = Procedure.objects.get(tracking_code=code)
    except Procedure.DoesNotExist:
        return Response(status=404)
    data = ProcedureSer(p).data
    data["timeline"] = ProcedureEventSer(p.events.order_by("-at"), many=True).data
    return Response({"procedure": data})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def procedures_summary(request):
    qs = Procedure.objects.all()

    q = request.query_params
    d_from = parse_date(q.get("from") or "")
    d_to   = parse_date(q.get("to") or "")
    status = q.get("status")

    if d_from:
        qs = qs.filter(created_at__date__gte=d_from)
    if d_to:
        qs = qs.filter(created_at__date__lte=d_to)  # inclusivo
    if status:
        qs = qs.filter(status=status)

    total = qs.count()
    # promedio días (ajusta a completed_at si lo tienes)
    avg_days = (
        qs.annotate(days=ExtractDay(F("updated_at") - F("created_at")))
          .aggregate(v=Avg("days"))["v"]
    )
    overdue = qs.filter(
        deadline_at__isnull=False,
        deadline_at__lt=F("updated_at")
    ).exclude(status="COMPLETED").count()
    in_review = qs.filter(status="IN_REVIEW").count()

    return Response({
        "summary": {
            "total": total,
            "avg_days": round(avg_days, 2) if avg_days is not None else None,
            "overdue": overdue,
            "in_review": in_review,
        }
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def procedures_report_sla(request):
    # DUMMY: crea un CSV con cabeceras; si usas XLSX real, reemplázalo por openpyxl/xlsxwriter
    buffer = io.StringIO()
    w = csv.writer(buffer)
    w.writerow(["procedure_id", "tracking_code", "dias"])
    for p in Procedure.objects.all()[:100]:
        dias = (p.updated_at - p.created_at).days
        w.writerow([p.id, p.tracking_code, dias])
    out = buffer.getvalue().encode("utf-8")
    res = HttpResponse(out, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res["Content-Disposition"] = 'attachment; filename="sla.xlsx"'
    return res

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def procedures_report_volume(request):
    # DUMMY simple
    buffer = io.StringIO()
    w = csv.writer(buffer)
    w.writerow(["fecha", "cantidad"])
    for p in Procedure.objects.all()[:100]:
        w.writerow([p.created_at.date().isoformat(), 1])
    out = buffer.getvalue().encode("utf-8")
    res = HttpResponse(out, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res["Content-Disposition"] = 'attachment; filename="volume.xlsx"'
    return res

def get_model(app_label, candidates):
    for name in candidates:
        try:
            return apps.get_model(app_label, name)
        except Exception:
            continue
    return None

def has_field(model, name: str) -> bool:
    try:
        model._meta.get_field(name)
        return True
    except Exception:
        return False

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def procedures_reports_summary(request):
    """
    Shape para tu DashboardHome:
      total, open, sla_breached, by_status, trend
    """

    Procedure = get_model("mesa_partes", ["Procedure", "Tramite", "Process", "ProcedureModel"])

    if not Procedure:
        return Response({
            "total": 0,
            "open": 0,
            "sla_breached": 0,
            "by_status": [],
            "trend": [],
        })

    total = Procedure.objects.count()

    status_field = "status" if has_field(Procedure, "status") else None

    open_count = 0
    by_status = []
    if status_field:
        rows = (
            Procedure.objects.values(status_field)
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        by_status = [{"name": r[status_field], "value": r["count"]} for r in rows]

        open_count = Procedure.objects.filter(**{f"{status_field}__in": ["OPEN", "PENDING", "IN_PROGRESS"]}).count()
    else:
        open_count = total

    # SLA breached: deadline_at / due_at / expires_at
    deadline_field = None
    for fld in ["deadline_at", "due_at", "expires_at", "limit_at"]:
        if has_field(Procedure, fld):
            deadline_field = fld
            break

    sla_breached = 0
    if deadline_field and status_field:
        now = timezone.now()
        sla_breached = Procedure.objects.filter(
            **{
                f"{deadline_field}__lt": now,
            }
        ).exclude(**{f"{status_field}__in": ["CLOSED", "DONE", "RESOLVED"]}).count()

    # Trend: últimos 14 días por created_at/date
    date_field = None
    for fld in ["created_at", "created", "date", "registered_at"]:
        if has_field(Procedure, fld):
            date_field = fld
            break

    trend = []
    if date_field:
        since = timezone.now() - timedelta(days=14)
        qs = (
            Procedure.objects.filter(**{f"{date_field}__gte": since})
            .annotate(d=TruncDate(date_field))
            .values("d")
            .annotate(count=Count("id"))
            .order_by("d")
        )
        trend = [{"date": str(r["d"]), "value": r["count"]} for r in qs]

    return Response({
        "total": total,
        "open": open_count,
        "sla_breached": sla_breached,
        "by_status": by_status,   # ✅ tu PieChart lo usa directo
        "trend": trend,
    })