"""
Vista admission_params — Configuración global de admisión.

Se almacena en un registro singleton (AdmissionParam con pk=1)
usando un JSONField. Esto permite guardar cualquier campo nuevo
sin necesidad de migraciones.

Si el modelo AdmissionParam no existe todavía, se usa un archivo
JSON en MEDIA_ROOT como fallback.
"""
import json
import os
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


# ─── Estrategia de almacenamiento ───────────────────────────
# Intentamos usar el modelo AdmissionParam. Si no existe
# (porque aún no se hizo la migración), usamos archivo JSON.

_USE_MODEL = False
try:
    from admission.models import AdmissionParam
    _USE_MODEL = True
except ImportError:
    pass


# ─── Defaults ───────────────────────────────────────────────

DEFAULT_PARAMS = {
    # Plantilla para nuevas convocatorias
    "default_min_age": 16,
    "default_max_age": 35,
    "default_fee": 0,
    "default_max_applications": 1,
    "default_required_documents": [
        "BIRTH_CERTIFICATE",
        "STUDY_CERTIFICATE",
        "PHOTO",
        "DNI_COPY",
    ],

    # Datos institucionales
    "institution_name": "",
    "institution_code": "",
    "results_public_message": "Los resultados serán publicados en la fecha indicada.",

    # Generación de credenciales
    "auto_generate_credentials": True,
    "credential_password_length": 8,
}


# ─── Helpers de persistencia ────────────────────────────────

def _json_path():
    """Ruta del archivo JSON fallback."""
    media = getattr(settings, "MEDIA_ROOT", "/tmp")
    return os.path.join(media, "admission_params.json")


def _load_params():
    """Carga los parámetros desde el almacenamiento disponible."""
    if _USE_MODEL:
        try:
            obj = AdmissionParam.objects.filter(pk=1).first()
            if obj and obj.data:
                merged = {**DEFAULT_PARAMS, **obj.data}
                return merged
        except Exception:
            pass

    # Fallback: archivo JSON
    try:
        path = _json_path()
        if os.path.exists(path):
            with open(path, "r") as f:
                data = json.load(f)
            return {**DEFAULT_PARAMS, **data}
    except Exception:
        pass

    return dict(DEFAULT_PARAMS)


def _save_params(data):
    """Guarda los parámetros en el almacenamiento disponible."""
    # Merge con defaults para no perder campos
    merged = {**DEFAULT_PARAMS, **data}

    if _USE_MODEL:
        try:
            obj, _ = AdmissionParam.objects.get_or_create(pk=1, defaults={"data": merged})
            if not _:
                obj.data = merged
                obj.save(update_fields=["data"])
            return merged
        except Exception:
            pass

    # Fallback: archivo JSON
    try:
        path = _json_path()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)
    except Exception as e:
        raise e

    return merged


# ─── Vista API ──────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admission_params(request):
    """
    GET  → Retorna la configuración actual
    POST → Guarda la configuración recibida
    """
    if request.method == "GET":
        params = _load_params()
        return Response(params)

    # POST
    data = request.data or {}

    # Validaciones básicas
    if "credential_password_length" in data:
        length = int(data["credential_password_length"] or 8)
        data["credential_password_length"] = max(6, min(16, length))

    if "default_min_age" in data:
        data["default_min_age"] = max(14, int(data["default_min_age"] or 16))

    if "default_max_age" in data:
        data["default_max_age"] = max(18, int(data["default_max_age"] or 35))

    saved = _save_params(data)
    return Response(saved)