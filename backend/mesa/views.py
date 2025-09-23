from django.shortcuts import render

# Create your views here.
from django.http import HttpResponse
from django.db.models import Q
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import *
from .serializers import *

# ===== Catálogos =====
class OfficeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Office.objects.filter(is_active=True).order_by('name')
    serializer_class = OfficeSerializer
    permission_classes = [IsAuthenticated]

# /users lo atiendes en tu app "accounts". Aquí no se duplica.

# ===== Tipos de trámite =====
class ProcedureTypeViewSet(viewsets.ModelViewSet):
    queryset = ProcedureType.objects.all().order_by('name')
    serializer_class = ProcedureTypeSerializer
    http_method_names = ['get','post','put','patch']
    permission_classes = [IsAuthenticated]

    # PATCH /procedure-types/{id} {is_active}
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

# ===== Trámites =====
class ProcedureViewSet(viewsets.ModelViewSet):
    queryset = Procedure.objects.select_related('type','office','assignee').all().order_by('-created_at')
    serializer_class = ProcedureSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        qs = self.queryset
        q = request.query_params.get('q')
        status_f = request.query_params.get('status')
        type_id = request.query_params.get('type_id')
        office_id = request.query_params.get('office_id')
        if q:
            qs = qs.filter(Q(code__icontains=q) | Q(tracking_code__icontains=q) | Q(subject__icontains=q))
        if status_f:
            qs = qs.filter(status=status_f)
        if type_id:
            qs = qs.filter(type_id=type_id)
        if office_id:
            qs = qs.filter(office_id=office_id)
        return Response(ProcedureSerializer(qs[:200], many=True).data)

    # GET /procedures/code/{code}
    @action(detail=False, methods=['get'], url_path=r'code/(?P<code>[^/]+)')
    def by_code(self, request, code=None):
        try:
            obj = Procedure.objects.get(code=code)
            return Response(ProcedureSerializer(obj).data)
        except Procedure.DoesNotExist:
            return Response({"detail":"Not found"}, status=404)

    # POST /procedures/{id}/route
    @action(detail=True, methods=['post'], url_path='route')
    def route(self, request, pk=None):
        p = self.get_object()
        from_off = p.office
        to_off_id = request.data.get('to_office_id')
        assignee_id = request.data.get('assignee_id')
        note = request.data.get('note','')
        deadline_at = request.data.get('deadline_at')
        # historizar
        ProcedureRoute.objects.create(
            procedure=p, from_office=from_off, to_office_id=to_off_id,
            assignee_id=assignee_id, note=note, deadline_at=deadline_at
        )
        # actualizar estado actual
        p.office_id = to_off_id or p.office_id
        p.assignee_id = assignee_id or p.assignee_id
        p.status = "DERIVED"
        if deadline_at: p.deadline_at = deadline_at
        p.save()
        return Response({"ok": True})

    # POST /procedures/{id}/status
    @action(detail=True, methods=['post'], url_path='status')
    def set_status(self, request, pk=None):
        p = self.get_object()
        p.status = request.data.get('status', p.status)
        p.save(update_fields=['status'])
        note = request.data.get('note')
        if note:
            ProcedureNote.objects.create(procedure=p, author=request.user, note=note)
        return Response({"ok": True, "status": p.status})

    # GET /procedures/{id}/timeline
    @action(detail=True, methods=['get'], url_path='timeline')
    def timeline(self, request, pk=None):
        p = self.get_object()
        routes = ProcedureRouteSerializer(p.routes.order_by('created_at'), many=True).data
        notes = ProcedureNoteSerializer(p.notes.order_by('created_at'), many=True).data
        return Response({"routes": routes, "notes": notes})

    # POST /procedures/{id}/notes {note}
    @action(detail=True, methods=['post'], url_path='notes')
    def add_note(self, request, pk=None):
        p = self.get_object()
        note = request.data.get('note')
        if not note: return Response({"detail":"note requerido"}, status=400)
        obj = ProcedureNote.objects.create(procedure=p, author=request.user, note=note)
        return Response(ProcedureNoteSerializer(obj).data, status=201)

    # POST /procedures/{id}/notify {channels,subject,message}
    @action(detail=True, methods=['post'], url_path='notify')
    def notify(self, request, pk=None):
        p = self.get_object()
        channels = request.data.get('channels', [])
        subject = request.data.get('subject', '')
        message = request.data.get('message', '')
        ProcedureNotification.objects.create(procedure=p, channels=channels, subject=subject, message=message)
        # Aquí integrarías Email/SMS. Por ahora ok.
        return Response({"ok": True})

    # POST /procedures/{id}/cover/pdf
    @action(detail=True, methods=['post'], url_path='cover/pdf')
    def cover_pdf(self, request, pk=None):
        content = b"%PDF-1.4\n% cover...\n"
        resp = HttpResponse(content, content_type='application/pdf')
        resp['Content-Disposition'] = 'attachment; filename="cover.pdf"'
        return resp

    # POST /procedures/{id}/cargo/pdf
    @action(detail=True, methods=['post'], url_path='cargo/pdf')
    def cargo_pdf(self, request, pk=None):
        content = b"%PDF-1.4\n% cargo...\n"
        resp = HttpResponse(content, content_type='application/pdf')
        resp['Content-Disposition'] = 'attachment; filename="cargo.pdf"'
        return resp

# ===== Archivos (privados) =====
class ProcedureFilesViewSet(viewsets.ViewSet):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    # GET /procedures/{id}/files
    def list(self, request, procedure_pk=None):
        qs = ProcedureFile.objects.filter(procedure_id=procedure_pk).order_by('-uploaded_at')
        return Response(ProcedureFileSerializer(qs, many=True).data)

    # POST /procedures/{id}/files
    def create(self, request, procedure_pk=None):
        file = request.FILES.get('file')
        if not file: return Response({"detail":"file requerido"}, status=400)
        obj = ProcedureFile.objects.create(
            procedure_id=procedure_pk,
            file=file,
            doc_type=request.POST.get('doc_type',''),
            description=request.POST.get('description',''),
            uploaded_by=request.user if request.user.is_authenticated else None
        )
        return Response(ProcedureFileSerializer(obj).data, status=201)

    # DELETE /procedures/{id}/files/{fileId}
    def destroy(self, request, pk=None, procedure_pk=None):
        ProcedureFile.objects.filter(procedure_id=procedure_pk, id=pk).delete()
        return Response(status=204)

# ===== Público =====
@api_view(['GET'])
@permission_classes([AllowAny])
def public_track(request):
    code = request.query_params.get('code')
    if not code:
        return Response({"detail":"code requerido"}, status=400)
    try:
        p = Procedure.objects.get(tracking_code=code)
    except Procedure.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    # Expón un mínimo público
    data = {
        "tracking_code": p.tracking_code,
        "code": p.code,
        "type": p.type.name,
        "subject": p.subject,
        "status": p.status,
        "created_at": p.created_at,
        "office": getattr(p.office, 'name', None),
    }
    return Response(data)

@api_view(['POST'])
@permission_classes([AllowAny])
def public_intake_create(request):
    # payload público mínimo
    payload = request.data or {}
    type_id = payload.get('type')
    subject = payload.get('subject')
    applicant_name = payload.get('applicant_name')
    applicant_doc = payload.get('applicant_doc')
    applicant_email = payload.get('applicant_email')
    code = payload.get('code') or get_random_string(10).upper()

    if not (type_id and subject and applicant_name):
        return Response({"detail":"type, subject, applicant_name requeridos"}, status=400)

    obj = Procedure.objects.create(
        code=code,
        type_id=type_id,
        subject=subject,
        applicant_name=applicant_name,
        applicant_doc=applicant_doc or '',
        applicant_email=applicant_email or '',
        status='RECEIVED'
    )
    return Response({"tracking_code": obj.tracking_code, "code": obj.code, "id": obj.id}, status=201)

@api_view(['POST'])
@permission_classes([AllowAny])
def public_intake_upload(request, trackingCode: str):
    try:
        p = Procedure.objects.get(tracking_code=trackingCode)
    except Procedure.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    file = request.FILES.get('file')
    if not file:
        return Response({"detail":"file requerido"}, status=400)
    ProcedureFile.objects.create(
        procedure=p, file=file,
        doc_type=request.POST.get('doc_type',''),
        description=request.POST.get('description','')
    )
    return Response({"ok": True}, status=201)

# ===== Reportes =====
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def procedures_report_summary(request):
    # filtros (status, type_id, office_id, date range...)
    params = dict(request.query_params)
    # TODO: sumariza real. MVP:
    return Response({"summary": {}, "params": params})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def procedures_report_sla_xlsx(request):
    resp = HttpResponse(b'', content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = 'attachment; filename="procedures_sla.xlsx"'
    return resp

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def procedures_report_volume_xlsx(request):
    resp = HttpResponse(b'', content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = 'attachment; filename="procedures_volume.xlsx"'
    return resp
