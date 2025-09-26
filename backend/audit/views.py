from django.utils.dateparse import parse_datetime
from django.db.models import Q
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from acl.permissions import RequirePerm
from .models import AuditLog
from .serializers import AuditLogSerializer

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated, RequirePerm])
def audit_list(request):
    # required_perm lo resolvemos con atributo en request para el guard
    setattr(request, 'required_perm', 'admin.audit.view')

    q        = request.query_params.get('q') or ""
    actor    = request.query_params.get('actor') or ""
    action   = request.query_params.get('action') or ""
    entity   = request.query_params.get('entity') or ""
    entity_id= request.query_params.get('entity_id') or ""
    from_dt  = request.query_params.get('from')
    to_dt    = request.query_params.get('to')
    limit    = int(request.query_params.get('limit') or 100)
    offset   = int(request.query_params.get('offset') or 0)

    qs = AuditLog.objects.all()
    if q:
        qs = qs.filter(Q(summary__icontains=q) | Q(actor_name__icontains=q) | Q(actor_id__icontains=q))
    if actor:
        qs = qs.filter(Q(actor_name__icontains=actor) | Q(actor_id__icontains=actor))
    if action:
        qs = qs.filter(action__iexact=action)
    if entity:
        qs = qs.filter(entity__iexact=entity)
    if entity_id:
        qs = qs.filter(entity_id=str(entity_id))
    if from_dt:
        dt = parse_datetime(from_dt)
        if dt: qs = qs.filter(timestamp__gte=dt)
    if to_dt:
        dt = parse_datetime(to_dt)
        if dt: qs = qs.filter(timestamp__lte=dt)

    total = qs.count()
    data = AuditLogSerializer(qs.order_by('-timestamp')[offset:offset+limit], many=True).data
    return Response({"logs": data, "count": total, "limit": limit, "offset": offset})
