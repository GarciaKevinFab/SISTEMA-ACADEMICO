from .models import AuditLog

def write_audit(
    *,
    action: str,
    entity: str,
    actor_id: str = "",
    actor_name: str = "",
    entity_id: str = "",
    summary: str = "",
    detail=None,
    ip: str = "",
    request_id: str = "",
):
    return AuditLog.objects.create(
        actor_id=str(actor_id or ""),
        actor_name=str(actor_name or ""),
        action=str(action),
        entity=str(entity),
        entity_id=str(entity_id or ""),
        summary=summary or "",
        detail=detail,
        ip=ip or None,
        request_id=request_id or "",
    )

def write_audit_from_request(
    request,
    *,
    action: str,
    entity: str,
    entity_id: str = "",
    summary: str = "",
    detail=None,
    actor_id: str = "",
    actor_name: str = "",
):
    # actor por defecto desde request.user
    u = getattr(request, "user", None)
    if not actor_id and u and getattr(u, "is_authenticated", False):
        actor_id = str(getattr(u, "id", "") or "")
    if not actor_name and u and getattr(u, "is_authenticated", False):
        actor_name = (
            getattr(u, "username", "") or
            getattr(u, "email", "") or
            getattr(u, "full_name", "") or
            ""
        )

    ip = getattr(request, "client_ip", "") or request.META.get("REMOTE_ADDR", "")
    rid = getattr(request, "request_id", "") or ""

    return write_audit(
        action=action,
        entity=entity,
        entity_id=entity_id,
        summary=summary,
        detail=detail,
        actor_id=actor_id,
        actor_name=actor_name,
        ip=ip,
        request_id=rid,
    )
