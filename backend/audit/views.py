from datetime import datetime
from django.utils.dateparse import parse_datetime
from django.db.models import Q
from django.utils import timezone


from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from acl.permissions import RequirePerm
from .models import AuditLog
from .serializers import AuditLogSerializer


def _parse_dt(s: str):
    if not s:
        return None

    # datetime-local: "YYYY-MM-DDTHH:MM"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        dt = parse_datetime(s)

    if not dt:
        return None

    # ✅ si viene naive, lo convertimos a aware en la TZ actual
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())

    return dt


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated, RequirePerm])
def audit_list(request):
    q         = request.query_params.get("q") or ""
    actor     = request.query_params.get("actor") or ""
    action    = request.query_params.get("action") or ""
    entity    = request.query_params.get("entity") or ""
    entity_id = request.query_params.get("entity_id") or ""

    from_dt   = _parse_dt(request.query_params.get("from") or "")
    to_dt     = _parse_dt(request.query_params.get("to") or "")

    limit     = int(request.query_params.get("limit") or 100)
    offset    = int(request.query_params.get("offset") or 0)

    qs = AuditLog.objects.all()

    if q:
        qs = qs.filter(
            Q(summary__icontains=q) |
            Q(actor_name__icontains=q) |
            Q(actor_id__icontains=q) |
            Q(request_id__icontains=q) |
            Q(ip__icontains=q)
        )
    if actor:
        qs = qs.filter(Q(actor_name__icontains=actor) | Q(actor_id__icontains=actor))
    if action:
        qs = qs.filter(action__iexact=action)
    if entity:
        qs = qs.filter(entity__iexact=entity)
    if entity_id:
        qs = qs.filter(entity_id=str(entity_id))
    if from_dt:
        qs = qs.filter(timestamp__gte=from_dt)
    if to_dt:
        qs = qs.filter(timestamp__lte=to_dt)

    total = qs.count()
    data = AuditLogSerializer(
        qs.order_by("-timestamp")[offset:offset + limit],
        many=True
    ).data

    return Response({"logs": data, "count": total, "limit": limit, "offset": offset})


# ✅ requerido para RequirePerm cuando usas @api_view
audit_list.cls.required_perm = "admin.audit.view"
