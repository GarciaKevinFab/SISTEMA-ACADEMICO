from rest_framework import status
from rest_framework.response import Response

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 3 * 1024 * 1024  # 3MB

def validate_photo_upload(request):
    f = request.FILES.get("photo")
    if not f:
        return None, Response({"detail": "Falta archivo 'photo'."}, status=400)

    ct = getattr(f, "content_type", "")
    if ct not in ALLOWED_MIME:
        return None, Response({"detail": "Formato no permitido. Usa JPG/PNG/WEBP."}, status=400)

    if f.size and f.size > MAX_BYTES:
        return None, Response({"detail": "Archivo demasiado grande (máx 3MB)."}, status=400)

    return f, None
