from django.shortcuts import render

# Create your views here.
from django.http import HttpResponse
from django.db.models import Q, Count
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import *
from .serializers import *

# ===== Dashboard =====
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admission_dashboard(request):
    stats = {
        "calls": AdmissionCall.objects.count(),
        "applications": Application.objects.count(),
        "paid": Payment.objects.filter(status='CONFIRMED').count(),
    }
    return Response(stats)

# ===== Convocatorias =====
class AdmissionCallViewSet(viewsets.ModelViewSet):
    queryset = AdmissionCall.objects.all().order_by('-id')
    serializer_class = AdmissionCallSerializer

    def get_permissions(self):
        if self.action in ('list_public',):
            return [AllowAny()]
        if self.request.method in ('GET',):
            return [IsAuthenticated()]
        return [IsAdminUser()]  # crear/editar/borrar solo admin

    # GET /admission-calls/public
    @action(detail=False, methods=['get'], url_path='public', permission_classes=[AllowAny])
    def list_public(self, request):
        qs = AdmissionCall.objects.filter(published=True).order_by('-id')
        return Response(AdmissionCallSerializer(qs, many=True).data)

    # --- Schedule por convocatoria ---
    # GET /admission-calls/{id}/schedule
    @action(detail=True, methods=['get'], url_path='schedule')
    def schedule_list(self, request, pk=None):
        qs = AdmissionScheduleItem.objects.filter(call_id=pk).order_by('start')
        return Response(AdmissionScheduleItemSerializer(qs, many=True).data)

    # POST /admission-calls/{id}/schedule
    @action(detail=True, methods=['post'], url_path='schedule', permission_classes=[IsAdminUser])
    def schedule_create(self, request, pk=None):
        data = request.data.copy(); data['call'] = pk
        ser = AdmissionScheduleItemSerializer(data=data); ser.is_valid(raise_exception=True); ser.save()
        return Response(ser.data, status=201)

    # PUT /admission-calls/{id}/schedule/{item_id}
    @action(detail=True, methods=['put'], url_path=r'schedule/(?P<item_id>\d+)', permission_classes=[IsAdminUser])
    def schedule_update(self, request, pk=None, item_id=None):
        item = AdmissionScheduleItem.objects.get(call_id=pk, id=item_id)
        ser = AdmissionScheduleItemSerializer(item, data=request.data, partial=True); ser.is_valid(raise_exception=True); ser.save()
        return Response(ser.data)

    # DELETE /admission-calls/{id}/schedule/{item_id}
    @action(detail=True, methods=['delete'], url_path=r'schedule/(?P<item_id>\d+)', permission_classes=[IsAdminUser])
    def schedule_delete(self, request, pk=None, item_id=None):
        AdmissionScheduleItem.objects.filter(call_id=pk, id=item_id).delete()
        return Response(status=204)

# ===== Applicants =====
class ApplicantViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = Applicant.objects.all()
    serializer_class = ApplicantSerializer

    # GET /applicants/me
    @action(detail=False, methods=['get'], url_path='me', permission_classes=[IsAuthenticated])
    def me(self, request):
        app = Applicant.objects.filter(user=request.user).first()
        return Response(ApplicantSerializer(app).data if app else None)

# ===== Applications =====
class ApplicationViewSet(viewsets.ModelViewSet):
    queryset = Application.objects.all().order_by('-id')
    serializer_class = ApplicationSerializer

    def get_permissions(self):
        if self.action in ('me', 'list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated()]  # crea/edita: ajusta si quieres solo applicant

    # GET /applications/me
    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        apps = Application.objects.filter(applicant__user=request.user).order_by('-id')
        return Response(ApplicationSerializer(apps, many=True).data)

# ===== Pago de postulaciones =====
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def application_payment_start(request, application_id: int):
    method = request.data.get('method', 'EFECTIVO')
    app = Application.objects.get(pk=application_id)
    pay, _ = Payment.objects.get_or_create(application=app, defaults={'method': method, 'status': 'STARTED'})
    pay.method = method
    pay.status = 'STARTED'
    pay.save()
    return Response({"status":"STARTED","payment_id": pay.id})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def application_payment_status(request, application_id: int):
    try:
        pay = Payment.objects.get(application_id=application_id)
        return Response({"status": pay.status, "method": pay.method, "amount": str(pay.amount)})
    except Payment.DoesNotExist:
        return Response({"status":"NONE"})

# ===== Evaluación =====
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def evaluation_list_for_scoring(request):
    # filtros por params (call_id, estado, etc.)
    call_id = request.query_params.get('call_id')
    qs = Application.objects.all()
    if call_id: qs = qs.filter(call_id=call_id)
    data = ApplicationSerializer(qs, many=True).data
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def evaluation_save_scores(request, application_id: int):
    rubric = request.data or {}
    total = sum([float(v) for v in rubric.values() if isinstance(v, (int, float, str))])
    obj, _ = EvaluationScore.objects.update_or_create(
        application_id=application_id, defaults={'rubric': rubric, 'total': total}
    )
    return Response({"ok": True, "total": total})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def evaluation_bulk_compute(request):
    call_id = request.data.get('call_id')
    # TODO: computar ranking real. por ahora OK
    return Response({"ok": True, "call_id": call_id})

# ===== Resultados =====
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def results_list(request):
    params = dict(request.query_params)
    # TODO: query real de resultados
    return Response({"items": [], "params": params})

@api_view(['POST'])
@permission_classes([IsAdminUser])
def results_publish(request):
    call_id = request.data.get('call_id')
    pub, _ = ResultPublication.objects.get_or_create(call_id=call_id)
    pub.published = True; pub.payload = request.data.get('payload', {}); pub.save()
    return Response({"ok": True})

@api_view(['POST'])
@permission_classes([IsAdminUser])
def results_close(request):
    call_id = request.data.get('call_id')
    pub, _ = ResultPublication.objects.get_or_create(call_id=call_id)
    pub.published = False; pub.save()
    return Response({"ok": True})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def results_acta_pdf(request):
    # devuelve PDF vacío (placeholder) con content-disposition
    resp = HttpResponse(b"%PDF-1.4\n%...\n", content_type='application/pdf')
    resp['Content-Disposition'] = 'attachment; filename="acta.pdf"'
    return resp

# ===== Reportes =====
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reports_admission_excel(request):
    resp = HttpResponse(b'', content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = 'attachment; filename="admission.xlsx"'
    return resp

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reports_admission_summary(request):
    # TODO: resumen real
    return Response({"summary": {}})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reports_ranking_excel(request):
    resp = HttpResponse(b'', content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = 'attachment; filename="ranking.xlsx"'
    return resp

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reports_vacants_vs_excel(request):
    resp = HttpResponse(b'', content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = 'attachment; filename="vacants-vs.xlsx"'
    return resp

# ===== Parámetros =====
@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def admission_params(request):
    obj, _ = AdmissionParam.objects.get_or_create(pk=1)
    if request.method == 'GET':
        return Response(AdmissionParamSerializer(obj).data['data'])
    obj.data = request.data or {}
    obj.save(update_fields=['data'])
    return Response({"ok": True})

# ===== Perfil postulante =====
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def applicant_me(request):
    app = Applicant.objects.filter(user=request.user).first()
    return Response(ApplicantSerializer(app).data if app else None)

# ===== Documentos del postulante =====
class ApplicationDocumentsViewSet(viewsets.ViewSet):
    parser_classes = [MultiPartParser, FormParser]

    # GET /applications/{application_id}/documents
    def list(self, request, application_id=None):
        qs = ApplicationDocument.objects.filter(application_id=application_id)
        return Response(ApplicationDocumentSerializer(qs, many=True).data)

    # POST /applications/{application_id}/documents
    def create(self, request, application_id=None):
        file = request.data.get('file'); document_type = request.data.get('document_type')
        if not file or not document_type:
            return Response({"detail":"file y document_type requeridos"}, status=400)
        obj = ApplicationDocument.objects.create(application_id=application_id, file=file, document_type=document_type)
        return Response(ApplicationDocumentSerializer(obj).data, status=201)

    # POST /applications/{application_id}/documents/{document_id}/review
    @action(detail=True, methods=['post'], url_path='review')
    def review(self, request, pk=None, application_id=None):
        status_val = request.data.get('status')  # APPROVED / REJECTED
        note = request.data.get('note','')
        ApplicationDocument.objects.filter(application_id=application_id, id=pk)\
            .update(status=status_val or 'PENDING', note=note)
        return Response({"ok": True})

# ===== Pagos (bandeja admin) =====
class AdmissionPaymentsViewSet(viewsets.ViewSet):
    # GET /admission-payments
    def list(self, request):
        qs = Payment.objects.all().order_by('-created_at')
        data = [{"id": p.id, "application_id": p.application_id, "status": p.status,
                 "method": p.method, "amount": str(p.amount)} for p in qs]
        return Response({"items": data, "total": len(data)})

    # POST /admission-payments/{payment_id}/confirm
    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm(self, request, pk=None):
        Payment.objects.filter(id=pk).update(status='CONFIRMED')
        return Response({"ok": True})

    # POST /admission-payments/{payment_id}/void
    @action(detail=True, methods=['post'], url_path='void')
    def void(self, request, pk=None):
        Payment.objects.filter(id=pk).update(status='VOID')
        return Response({"ok": True})

    # GET /admission-payments/{payment_id}/receipt.pdf
    @action(detail=True, methods=['get'], url_path='receipt\.pdf')
    def receipt_pdf(self, request, pk=None):
        resp = HttpResponse(b"%PDF-1.4\n%...\n", content_type='application/pdf')
        resp['Content-Disposition'] = 'attachment; filename="receipt.pdf"'
        return resp
