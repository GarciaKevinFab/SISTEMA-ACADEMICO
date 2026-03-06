from datetime import datetime, timedelta
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

    # si viene naive, lo convertimos a aware en la TZ actual
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())

    return dt


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated, RequirePerm])
def audit_list(request):
    # -----------------------------
    # Query params
    # -----------------------------
    q         = (request.query_params.get("q") or "").strip()
    actor     = (request.query_params.get("actor") or "").strip()
    action    = (request.query_params.get("action") or "").strip()
    entity    = (request.query_params.get("entity") or "").strip()
    entity_id = (request.query_params.get("entity_id") or "").strip()

    from_dt   = _parse_dt(request.query_params.get("from") or "")
    to_dt     = _parse_dt(request.query_params.get("to") or "")

    # Si viene datetime-local sin segundos, hacemos "to" inclusivo
    # (para que "hasta 10:30" incluya el minuto completo)
    if to_dt and to_dt.second == 0 and to_dt.microsecond == 0:
        to_dt = to_dt + timedelta(seconds=59)

    # Paginación segura (SIEMPRE 10)
    DEFAULT_LIMIT = 10
    try:
        limit = int(request.query_params.get("limit") or DEFAULT_LIMIT)
    except ValueError:
        limit = DEFAULT_LIMIT

    # acotamos por seguridad: máximo 10 (fijo)
    limit = 10

    try:
        offset = int(request.query_params.get("offset") or 0)
    except ValueError:
        offset = 0

    offset = max(0, offset)

    # Debug opcional
    debug = (request.query_params.get("debug") or "").strip() in ("1", "true", "True")

    # -----------------------------
    # Queryset base
    # -----------------------------
    qs = AuditLog.objects.all()

    # -----------------------------
    # Filtros
    # -----------------------------
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

    # -----------------------------
    # Respuesta paginada
    # -----------------------------
    total = qs.count()
    page = qs.order_by("-timestamp")[offset:offset + limit]
    data = AuditLogSerializer(page, many=True).data

    payload = {"logs": data, "count": total, "limit": limit, "offset": offset}

    # Debug: confirma si la DB tiene algo y muestra 3 filas
    if debug:
        sample = AuditLog.objects.all().order_by("-timestamp")[:3]
        payload["debug"] = {
            "total_db": AuditLog.objects.count(),
            "sample": AuditLogSerializer(sample, many=True).data
        }

    return Response(payload)


# requerido para RequirePerm cuando usas @api_view
audit_list.cls.required_perm = "admin.audit.view"
