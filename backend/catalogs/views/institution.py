"""
Institution Settings y Media Assets
"""
import os
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from catalogs.models import InstitutionSetting, MediaAsset
from catalogs.serializers import MediaAssetSerializer

# ── Kinds válidos ─────────────────────────────────────────────
VALID_MEDIA_KINDS = (
    "LOGO",
    "LOGO_ALT",
    "SIGNATURE",
    "SECRETARY_SIGNATURE",
    "RESPONSIBLE_SIGNATURE",
)

# ── Mapeo kind → key en data JSON ────────────────────────────
KIND_TO_URL_KEY = {
    "LOGO": "logo_url",
    "LOGO_ALT": "logo_url",
    "SIGNATURE": "signature_url",
    "SECRETARY_SIGNATURE": "secretary_signature_url",
    "RESPONSIBLE_SIGNATURE": "responsible_signature_url",
}

# ── Keys de URL que necesitan absolutización ──────────────────
URL_KEYS = [
    "logo_url",
    "signature_url",
    "secretary_signature_url",
    "responsible_signature_url",
]


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def institution_settings(request):
    """GET/PATCH de configuración institucional"""
    obj, _ = InstitutionSetting.objects.get_or_create(pk=1)

    if request.method == "GET":
        data = obj.data or {}

        def abs_if_needed(u):
            if not u:
                return u
            if str(u).startswith("http://") or str(u).startswith("https://"):
                return u
            if not u.startswith("/"):
                u = "/" + u
            try:
                return request.build_absolute_uri(u)
            except Exception:
                return u

        # Absolutizar todas las URLs de media
        abs_data = {**data}
        for key in URL_KEYS:
            if key in abs_data:
                abs_data[key] = abs_if_needed(abs_data[key])

        return Response({"data": abs_data})

    # PATCH
    payload = request.data if isinstance(request.data, dict) else {}
    obj.data = {**(obj.data or {}), **payload}
    obj.save(update_fields=["data"])
    return Response({"data": obj.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def institution_media(request):
    """Upload de media (logo, firma, etc)"""
    file = request.FILES.get("file")
    kind = (request.POST.get("kind") or "").upper().strip()

    if not file or kind not in VALID_MEDIA_KINDS:
        return Response(
            {"detail": f"file y kind ({' | '.join(VALID_MEDIA_KINDS)}) requeridos"},
            status=400,
        )

    asset = MediaAsset.objects.create(kind=kind, file=file)
    rel_url = asset.file.url

    inst, _ = InstitutionSetting.objects.get_or_create(pk=1)
    data = inst.data or {}

    # Asignar URL según kind
    url_key = KIND_TO_URL_KEY.get(kind)
    if url_key:
        data[url_key] = rel_url

    inst.data = data
    inst.save(update_fields=["data"])

    abs_url = request.build_absolute_uri(rel_url)

    return Response(
        {
            "ok": True,
            "kind": kind,
            "url": rel_url,
            "absolute_url": abs_url,
            "asset": MediaAssetSerializer(asset).data,
            "institution": inst.data,
        },
        status=201,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def institution_media_delete(request, kind: str):
    """Eliminar media"""
    kind = (kind or "").upper().strip()

    if kind not in VALID_MEDIA_KINDS:
        return Response(
            {"detail": f"kind inválido ({' | '.join(VALID_MEDIA_KINDS)})"},
            status=400,
        )

    inst, _ = InstitutionSetting.objects.get_or_create(pk=1)
    data = inst.data or {}

    # Determinar key a limpiar
    url_key = KIND_TO_URL_KEY.get(kind, "")
    url = data.get(url_key)

    # Limpiar config
    if url_key:
        data[url_key] = ""
    inst.data = data
    inst.save(update_fields=["data"])

    # Borrar último asset de ese tipo
    try:
        asset = MediaAsset.objects.filter(kind=kind).order_by("-id").first()
        if asset:
            try:
                if asset.file:
                    asset.file.delete(save=False)
            except Exception:
                pass
            asset.delete()
    except Exception:
        pass

    # Borrar archivo físico si apunta a /media/
    try:
        if url and isinstance(url, str) and "/media/" in url:
            rel = url.split("/media/")[-1]
            fpath = os.path.join(settings.MEDIA_ROOT, rel)
            if os.path.exists(fpath):
                os.remove(fpath)
    except Exception:
        pass

    return Response({"ok": True, "kind": kind, "cleared": url_key, "institution": inst.data})