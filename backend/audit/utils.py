from .models import AuditLog


def write_audit(actor_id: str = "", actor_name: str = "", *, action: str, entity: str,
entity_id: str = "", summary: str = "", detail=None, ip: str = "",
request_id: str = ""):
    AuditLog.objects.create(
    actor_id=actor_id or "",
    actor_name=actor_name or "",
    action=action,
    entity=entity,
    entity_id=str(entity_id or ""),
    summary=summary or "",
    detail=detail,
    ip=ip or None,
    request_id=request_id or "",
    )