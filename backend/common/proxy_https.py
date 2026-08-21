"""Middleware: dar por segura la request cuando el sitio va detrás de TLS.

Django ya tiene SECURE_PROXY_SSL_HEADER, pero solo sirve si nginx reenvía
X-Forwarded-Proto. Cuando no lo hace, request.is_secure() da False y todo
build_absolute_uri() emite http://, incluidas las URLs de media: el
navegador entonces reporta "Mixed Content" en una página servida por HTTPS
y bloquea o fuerza el recurso.

Se activa con FORCE_HTTPS (por defecto, activo cuando DEBUG es False).
Ponerlo en 0 permite servir por HTTP plano en un entorno interno.
"""
import os

from django.conf import settings


def _activo() -> bool:
    crudo = os.getenv("FORCE_HTTPS")
    if crudo is not None:
        return crudo.strip().lower() not in ("0", "false", "no", "")
    return not settings.DEBUG


class ForzarHttpsDetrasDelProxy:
    def __init__(self, get_response):
        self.get_response = get_response
        self.activo = _activo()

    def __call__(self, request):
        if self.activo:
            # Combina con SECURE_PROXY_SSL_HEADER: is_secure() pasa a True y
            # build_absolute_uri() emite https:// en toda la aplicación.
            request.META["HTTP_X_FORWARDED_PROTO"] = "https"
        return self.get_response(request)
