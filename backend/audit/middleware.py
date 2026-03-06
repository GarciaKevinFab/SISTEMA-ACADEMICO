# audit/middleware.py
import uuid
import time
from django.utils.deprecation import MiddlewareMixin

from .utils import write_audit_from_request


def _get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


class RequestIdMiddleware(MiddlewareMixin):
    """
    Middleware que asegura:
    - request.request_id
    - request.client_ip
    """

    def process_request(self, request):
        rid = request.META.get("HTTP_X_REQUEST_ID", "")
        if not rid:
            rid = uuid.uuid4().hex
            request.META["HTTP_X_REQUEST_ID"] = rid

        request.request_id = rid
        request.client_ip = _get_client_ip(request)


class AuditLogMiddleware(MiddlewareMixin):
    """
    Middleware que ESCRIBE en audit_logs por cada request.
    Si no quieres auditar TODO, ajusta ONLY_PREFIXES y EXCLUDE_PATHS.
    """

    ONLY_PREFIXES = ("/api/",)  # si tu API no usa /api, cámbialo o ponlo en ()
    EXCLUDE_PATHS = (
        "/api/audit/",
        "/api/audit",      # por si te pegan sin slash
        "/admin/",
        "/static/",
        "/media/",
        "/favicon.ico",
    )

    def process_request(self, request):
        request._audit_start = time.time()

    def process_response(self, request, response):
        path = getattr(request, "path", "") or ""

        # solo auditar rutas API
        if self.ONLY_PREFIXES and not path.startswith(self.ONLY_PREFIXES):
            return response

        # excluir rutas
        for p in self.EXCLUDE_PATHS:
            if path.startswith(p):
                return response

        # tiempo
        dur_ms = None
        if hasattr(request, "_audit_start"):
            dur_ms = int((time.time() - request._audit_start) * 1000)

        method = (getattr(request, "method", "") or "").upper()
        status = getattr(response, "status_code", 0)

        # acción por HTTP method
        if method == "POST":
            action = "create"
        elif method in ("PUT", "PATCH"):
            action = "update"
        elif method == "DELETE":
            action = "delete"
        else:
            action = "access"

        if status >= 400:
            action = "error"

        summary = f"{method} {path} -> {status} ({dur_ms}ms)"

        detail = {
            "method": method,
            "path": path,
            "status": status,
            "duration_ms": dur_ms,
            "query": dict(getattr(request, "GET", {}) or {}),
        }

        # Guardar log (nunca tumbar la respuesta si falla auditoría)
        try:
            write_audit_from_request(
                request,
                action=action,
                entity="request",
                entity_id="",
                summary=summary,
                detail=detail,
            )
        except Exception:
            pass

        return response
