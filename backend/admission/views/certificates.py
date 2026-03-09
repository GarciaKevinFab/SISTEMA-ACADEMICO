"""
admission/views/certificates.py

Vistas PÚBLICAS (sin autenticación) para:
  1. GET  /admission/public/search?dni=...           → Buscar postulante
  2. GET  /admission/public/certificates/inscripcion → PDF Constancia de Inscripción (landscape)
  3. GET  /admission/public/certificates/ingreso     → PDF Constancia de Vacante (portrait)

Los PDFs se generan con WeasyPrint HTML, fieles a los documentos originales del IESPP.
Fallback a ReportLab si WeasyPrint no está instalado.
"""
from io import BytesIO
from datetime import datetime

from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from admission.models import Application, ApplicationDocument, InstitutionSetting

from .admission_certificates_generator import (
    generate_inscripcion_pdf,
    generate_vacante_pdf,
    HAS_WEASYPRINT,
)


# ══════════════════════════════════════════════════════════════
# HELPERS DE AJUSTES INSTITUCIONALES
# ══════════════════════════════════════════════════════════════

def _get_setting(key, default=""):
    try:
        return InstitutionSetting.objects.get(key=key).value or default
    except InstitutionSetting.DoesNotExist:
        return default


def _get_setting_file_path(key) -> str:
    """Retorna la ruta absoluta del archivo del setting, o ''."""
    try:
        obj = InstitutionSetting.objects.get(key=key)
        return obj.file.path if obj.file else ""
    except (InstitutionSetting.DoesNotExist, ValueError, Exception):
        return ""


def _get_photo_path(application) -> str:
    """Ruta absoluta de la foto carné del postulante."""
    doc = ApplicationDocument.objects.filter(
        application=application, document_type="FOTO_CARNET"
    ).first()
    if doc and doc.file:
        try:
            return doc.file.path
        except Exception:
            pass
    return ""


def _build_inst_dict() -> dict:
    """Construye el dict de institución para los generadores."""
    return {
        "institution_name": _get_setting(
            "institution_name",
            '"GUSTAVO ALLENDE LLAVERÍA"'
        ),
        "city":            _get_setting("institution_city", "Tarma"),
        "region":          _get_setting("institution_region", "Junín"),
        "director_name":   _get_setting("director_name", ""),
        "director_title":  _get_setting("director_title", "DIRECTOR GENERAL"),
        "lema_anio":       _get_setting("lema_anio", ""),
        "year_motto":      _get_setting("year_motto", ""),
        "rvm":             _get_setting("rvm", ""),
        # Rutas absolutas de imágenes
        "logo_path":              _get_setting_file_path("logo"),
        "firma_director_path":    _get_setting_file_path("firma_director"),
        "sello_path":             _get_setting_file_path("sello"),
    }


def _build_app_dict(app) -> dict:
    """Construye el dict de datos del postulante para los generadores."""
    data    = app.data or {}
    profile = data.get("profile", {})

    especialidad = app.career_name or ""
    if not especialidad:
        fp = app.preferences.order_by("rank").first()
        if fp:
            especialidad = fp.career.name

    return {
        "ap_paterno":        profile.get("apellido_paterno", "") or "",
        "ap_materno":        profile.get("apellido_materno", "") or "",
        "nombres":           profile.get("nombres", "") or "",
        "especialidad":      especialidad,
        "dni":               app.applicant.dni or "",
        "sexo":              profile.get("sexo", "") or "",
        "discapacidad":      profile.get("discapacidad", "") or "",
        "domicilio":         profile.get("direccion", "") or "",
        "telefono":          app.applicant.phone or "",
        "email":             app.applicant.email or "",
        "fecha_nacimiento":  profile.get("fecha_nacimiento", "") or "",
        "modalidad_admision":profile.get("modalidad_admision", "ORDINARIO") or "ORDINARIO",
        "call_name":         (app.call.title or "").upper(),
        "call_period":       app.call.period or "",
        "photo_path":        _get_photo_path(app),
    }


# ══════════════════════════════════════════════════════════════
# BÚSQUEDA POR DNI
# GET /admission/public/search?dni=XXXXXXXX
# ══════════════════════════════════════════════════════════════

@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def search_by_dni(request):
    """Buscar postulante por DNI para descargar constancias."""
    dni = request.GET.get("dni", "").strip()
    if len(dni) < 8:
        return Response({"detail": "DNI inválido"}, status=400)

    app = (
        Application.objects
        .filter(applicant__dni=dni)
        .select_related("applicant", "call")
        .prefetch_related("preferences__career", "scores")
        .order_by("-id")
        .first()
    )
    if not app:
        return Response({"detail": "Postulante no encontrado"}, status=404)

    data    = app.data or {}
    profile = data.get("profile", {})
    nombres    = profile.get("nombres", "")
    ap_paterno = profile.get("apellido_paterno", "")
    ap_materno = profile.get("apellido_materno", "")
    full_name  = f"{ap_paterno} {ap_materno}, {nombres}".strip(", ")
    if not full_name or full_name == ",":
        full_name = app.applicant.names

    career_name = app.career_name or ""
    if not career_name:
        fp = app.preferences.order_by("rank").first()
        if fp:
            career_name = fp.career.name

    photo_doc = ApplicationDocument.objects.filter(
        application=app, document_type="FOTO_CARNET"
    ).first()
    photo_url = None
    if photo_doc and photo_doc.file:
        try:
            api_url = f"/api/applications/{app.id}/documents/{photo_doc.id}/download"
            photo_url = request.build_absolute_uri(api_url)
        except Exception:
            pass

    score_obj = app.scores.first()

    return Response({
        "id":                 app.id,
        "application_id":     app.id,
        "application_number": f"{app.call.period or ''}-{app.id:04d}",
        "dni":                app.applicant.dni,
        "full_name":          full_name,
        "career_name":        career_name,
        "status":             app.status,
        "photo_url":          photo_url,
        "birth_date":         profile.get("fecha_nacimiento", ""),
        "gender":             profile.get("sexo", ""),
        "address":            profile.get("direccion", ""),
        "phone":              app.applicant.phone or "",
        "email":              app.applicant.email or "",
        "admission_mode":     profile.get("modalidad_admision", "ORDINARIO"),
        "discapacidad":       profile.get("discapacidad", ""),
        "final_score":        float(score_obj.total) if score_obj else None,
        "merit_order":        None,
        "call_name":          app.call.title,
    })


# ══════════════════════════════════════════════════════════════
# CONSTANCIA DE INSCRIPCIÓN  (PDF A4 landscape)
# GET /admission/public/certificates/inscripcion?application_id=X
# ══════════════════════════════════════════════════════════════

@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def cert_inscripcion(request):
    """Genera PDF Constancia de Inscripción — A4 landscape."""
    app_id = request.GET.get("application_id")
    if not app_id:
        return Response({"detail": "application_id requerido"}, status=400)

    try:
        app = (
            Application.objects
            .select_related("applicant", "call")
            .prefetch_related("preferences__career")
            .get(pk=app_id)
        )
    except Application.DoesNotExist:
        return Response({"detail": "Postulación no encontrada"}, status=404)

    inst    = _build_inst_dict()
    app_data = _build_app_dict(app)

    # ── Generar PDF ──
    if HAS_WEASYPRINT:
        pdf_bytes = generate_inscripcion_pdf(app_data, inst)
    else:
        # Fallback ReportLab básico
        pdf_bytes = _fallback_inscripcion_reportlab(app, app_data, inst)

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = (
        f'attachment; filename="Constancia_Inscripcion_{app.applicant.dni}.pdf"'
    )
    return response


# ══════════════════════════════════════════════════════════════
# CONSTANCIA DE VACANTE / INGRESO  (PDF A4 portrait)
# GET /admission/public/certificates/ingreso?application_id=X
# ══════════════════════════════════════════════════════════════

@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def cert_ingreso(request):
    """
    Genera PDF Constancia de Vacante — A4 portrait.
    Solo disponible para postulantes ADMITTED o INGRESANTE.
    """
    app_id = request.GET.get("application_id")
    if not app_id:
        return Response({"detail": "application_id requerido"}, status=400)

    try:
        app = (
            Application.objects
            .select_related("applicant", "call")
            .prefetch_related("preferences__career")
            .get(pk=app_id)
        )
    except Application.DoesNotExist:
        return Response({"detail": "Postulación no encontrada"}, status=404)

    if app.status not in ("ADMITTED", "INGRESANTE"):
        return Response({"detail": "Solo disponible para ingresantes"}, status=403)

    inst     = _build_inst_dict()
    app_data = _build_app_dict(app)

    # Datos adicionales para la constancia de vacante
    data    = app.data or {}
    profile = data.get("profile", {})
    ap_paterno = profile.get("apellido_paterno", "")
    ap_materno = profile.get("apellido_materno", "")
    nombres    = profile.get("nombres", "")
    full_name  = f"{ap_paterno} {ap_materno}, {nombres}".strip(", ").upper()
    if not full_name or full_name == ",":
        full_name = app.applicant.names.upper()

    app_data["full_name"] = full_name
    app_data["periodo"]   = app.call.period or ""

    # ── Generar PDF ──
    if HAS_WEASYPRINT:
        pdf_bytes = generate_vacante_pdf(app_data, inst)
    else:
        pdf_bytes = _fallback_vacante_reportlab(app, app_data, inst)

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = (
        f'attachment; filename="Constancia_Vacante_{app.applicant.dni}.pdf"'
    )
    return response


# ══════════════════════════════════════════════════════════════
# FALLBACKS REPORTLAB (si WeasyPrint no está instalado)
# ══════════════════════════════════════════════════════════════

def _fallback_inscripcion_reportlab(app, app_data: dict, inst: dict) -> bytes:
    """Fallback mínimo con ReportLab para la Constancia de Inscripción."""
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas

    buf = BytesIO()
    w, h = landscape(A4)
    c = canvas.Canvas(buf, pagesize=landscape(A4))

    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(w / 2, h - 2 * cm, "CONSTANCIA DE INSCRIPCIÓN")
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(w / 2, h - 2.8 * cm, app_data.get("call_name", ""))

    y = h - 4.5 * cm
    c.setFont("Helvetica-Bold", 9)
    fields = [
        ("CONDICIÓN", app_data.get("modalidad_admision", "")),
        ("AP. PATERNO", app_data.get("ap_paterno", "")),
        ("AP. MATERNO", app_data.get("ap_materno", "")),
        ("NOMBRES",    app_data.get("nombres", "")),
        ("ESPECIALIDAD", app_data.get("especialidad", "")),
        ("DNI",        app_data.get("dni", "")),
        ("SEXO",       app_data.get("sexo", "")),
        ("DOMICILIO",  app_data.get("domicilio", "")),
    ]
    for label, val in fields:
        c.drawString(3 * cm, y, f"{label}: {val}")
        y -= 0.55 * cm

    ciudad = inst.get("city", "Tarma")
    now = datetime.now()
    c.setFont("Helvetica", 8)
    c.drawString(3 * cm, 2 * cm, f"{ciudad}, {now.day}/{now.month}/{now.year}")
    c.drawString(w - 8 * cm, 2 * cm, inst.get("director_name", ""))

    c.save()
    buf.seek(0)
    return buf.read()


def _fallback_vacante_reportlab(app, app_data: dict, inst: dict) -> bytes:
    """Fallback mínimo con ReportLab para la Constancia de Vacante."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import simpleSplit

    buf = BytesIO()
    w, h = A4
    c = canvas.Canvas(buf, pagesize=A4)

    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(w / 2, h - 3 * cm, "CONSTANCIA DE VACANTE")

    y = h - 5 * cm
    c.setFont("Helvetica", 10)
    texto = (
        f"Existe una plaza VACANTE DE ESTUDIOS en el programa de estudios de "
        f"{app_data.get('especialidad', '')} correspondiente al período "
        f"{app_data.get('periodo', '')}, que puede ser ocupado por el/la estudiante "
        f"{app_data.get('full_name', '')}."
    )
    for line in simpleSplit(texto, "Helvetica", 10, w - 6 * cm):
        c.drawString(3 * cm, y, line)
        y -= 0.5 * cm

    now = datetime.now()
    ciudad = inst.get("city", "Tarma")
    c.drawCentredString(w / 2, 4 * cm, f"{ciudad}, {now.day}/{now.month}/{now.year}")
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(w / 2, 3 * cm, inst.get("director_name", ""))

    c.save()
    buf.seek(0)
    return buf.read()