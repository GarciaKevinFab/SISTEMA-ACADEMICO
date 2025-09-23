from django.shortcuts import render

# Create your views here.
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

from .models import *
from .serializers import *
from .utils import render_template

# ========= Templates =========
class TemplateViewSet(viewsets.ModelViewSet):
    queryset = NotificationTemplate.objects.all().order_by('-updated_at')
    serializer_class = NotificationTemplateSerializer
    http_method_names = ['get','post','patch','delete']

    def list(self, request, *args, **kwargs):
        qs = self.queryset
        q = request.query_params.get('q')
        ch = request.query_params.get('channel')
        active = request.query_params.get('is_active')
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(email_subject__icontains=q))
        if ch:
            qs = qs.filter(channel=ch)
        if active is not None:
            if str(active).lower() in ('1','true','yes'):
                qs = qs.filter(is_active=True)
            elif str(active).lower() in ('0','false','no'):
                qs = qs.filter(is_active=False)
        return Response(self.serializer_class(qs[:200], many=True).data)

    # POST /notifications/templates/{id}/active {is_active}
    @action(detail=True, methods=['post'], url_path='active')
    def set_active(self, request, pk=None):
        t = self.get_object()
        t.is_active = bool(request.data.get('is_active', True))
        t.save(update_fields=['is_active'])
        return Response({'ok': True, 'id': t.id, 'is_active': t.is_active})

# POST /notifications/templates/preview
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def template_preview(request):
    payload = request.data or {}
    channel = payload.get('channel') or 'EMAIL'
    tpl = payload.get('template') or {}   # {email_subject,email_html|sms_text|in_app_text}
    data = payload.get('data') or {}
    rendered = render_template(tpl, data, channel)
    return Response({'rendered': rendered})

# ========= Events (bindings) =========
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def events_list(request):
    # Devuelve eventos soportados y los bindings actuales
    bindings = EventBindingSerializer(EventBinding.objects.all(), many=True).data
    # El front ya trae EVENT_DEFS; igual devolvemos una lista mínima (opcionalmente fuente de verdad)
    supported = [
        {"key":"ADMISSION.PREINSCRIPTION_RECEIVED"},
        {"key":"ADMISSION.DOCS_VALIDATED"},
        {"key":"ADMISSION.RESULTS_PUBLISHED"},
        {"key":"ACADEMIC.ENROLLMENT_CONFIRMED"},
        {"key":"ACADEMIC.GRADEBOOK_PUBLISHED"},
        {"key":"MP.DERIVATION"},
        {"key":"MP.ATTENDED"},
    ]
    return Response({"events": supported, "bindings": bindings})

# POST /notifications/events/binding {event_key, channel, template_id}
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def events_set_binding(request):
    event_key = request.data.get('event_key')
    channel = request.data.get('channel')
    template_id = request.data.get('template_id')
    if not (event_key and channel and template_id):
        return Response({"detail":"event_key, channel y template_id son requeridos"}, status=400)
    tpl = NotificationTemplate.objects.get(pk=template_id)
    obj, _ = EventBinding.objects.update_or_create(
        event_key=event_key, channel=channel, defaults={'template': tpl}
    )
    return Response(EventBindingSerializer(obj).data)

# ========= Send/Test =========
# POST /notifications/send-test {channel,to,template_id,data}
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_test(request):
    channel = request.data.get('channel', 'EMAIL')
    to = request.data.get('to', '')
    data = request.data.get('data') or {}

    tpl_id = request.data.get('template_id')
    if tpl_id:
        tpl_obj = NotificationTemplate.objects.get(pk=tpl_id)
        tpl = NotificationTemplateSerializer(tpl_obj).data
    else:
        # soporte de envío con plantilla inline (opcional)
        tpl = request.data.get('template') or {}

    rendered = render_template(tpl, data, channel)
    # Stub envío: lo marcamos como SENT y guardamos log
    log = NotificationLog.objects.create(
        event_key="TEST",
        channel=channel,
        to=to,
        subject=rendered.get('subject', ''),
        payload=data,
        rendered=rendered,
        status='SENT',
        error=''
    )
    return Response({"ok": True, "log_id": log.id, "rendered": rendered})

# ========= Logs =========
# GET /notifications/logs?event_key=&channel=&status=
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def logs_list(request):
    qs = NotificationLog.objects.all().order_by('-created_at')
    event_key = request.query_params.get('event_key')
    channel = request.query_params.get('channel')
    status_f = request.query_params.get('status')
    if event_key: qs = qs.filter(event_key=event_key)
    if channel: qs = qs.filter(channel=channel)
    if status_f: qs = qs.filter(status=status_f)
    return Response(NotificationLogSerializer(qs[:500], many=True).data)

# POST /notifications/logs/{id}/retry
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logs_retry(request, id: int):
    try:
        log = NotificationLog.objects.get(pk=id)
    except NotificationLog.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    # “reintento” simple: duplicamos log como SENT
    newlog = NotificationLog.objects.create(
        event_key=log.event_key, channel=log.channel, to=log.to,
        subject=log.subject, payload=log.payload, rendered=log.rendered,
        status='SENT', error=''
    )
    return Response({"ok": True, "log_id": newlog.id})
