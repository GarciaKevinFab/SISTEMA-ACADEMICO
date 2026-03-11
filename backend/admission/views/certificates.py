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

from admission.models import Application, ApplicationDocument
from admission.models import InstitutionSetting as AdmissionSetting

from .admission_certificates_generator import (
    generate_inscripcion_pdf,
    generate_vacante_pdf,
    HAS_WEASYPRINT,
    _get_media_root,
)


# ══════════════════════════════════════════════════════════════
# HELPERS DE AJUSTES INSTITUCIONALES
# ══════════════════════════════════════════════════════════════

def _get_catalog_data() -> dict:
    """Lee el JSON data de catalogs.InstitutionSetting (pk=1)."""
    try:
        from catalogs.models import InstitutionSetting as CatSetting
        obj = CatSetting.objects.filter(pk=1).first()
        return (obj.data or {}) if obj else {}
    except Exception:
        return {}


def _get_setting(key, default=""):
    """Fallback: lee de admission.InstitutionSetting (key/value)."""
    try:
        return AdmissionSetting.objects.get(key=key).value or default
    except AdmissionSetting.DoesNotExist:
        return default


def _get_setting_file_path(key) -> str:
    """Retorna la ruta absoluta del archivo del setting, o ''."""
    try:
        obj = AdmissionSetting.objects.get(key=key)
        return obj.file.path if obj.file else ""
    except (AdmissionSetting.DoesNotExist, ValueError, Exception):
        return ""


def _url_to_filepath(url_str) -> str:
    """Convierte URL relativa (/media/...) a ruta absoluta en disco."""
    import os
    if not url_str:
        return ""
    u = str(url_str)
    # Quitar host si es URL absoluta
    if "://" in u:
        from urllib.parse import urlparse
        u = urlparse(u).path
    mr = str(_get_media_root())
    if "/media/" in u:
        rel = u.split("/media/")[-1]
        p = os.path.join(mr, rel)
        return p if os.path.exists(p) else ""
    if u.startswith("/"):
        p = os.path.join(mr, u.lstrip("/"))
        return p if os.path.exists(p) else ""
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
    """
    Construye el dict de institución para los generadores de PDF.
    Fuente principal: catalogs.InstitutionSetting (JSON data, pk=1).
    Fallback: admission.InstitutionSetting (key/value legacy).
    """
    cat = _get_catalog_data()

    # Nombre de la institución (sin comillas — las agrega el template)
    inst_name = (
        cat.get("name", "")
        or _get_setting("institution_name", "")
        or "GUSTAVO ALLENDE LLAVERÍA"
    )
    # Limpiar comillas si el valor ya las tiene
    inst_name = inst_name.strip('"').strip("'")

    # Logo: catalogs MediaAsset (logo_url) → admission fallback
    logo_path = (
        _url_to_filepath(cat.get("logo_url", ""))
        or _get_setting_file_path("logo")
    )

    # Firma del director: catalogs (signature_url) → admission fallback
    firma_path = (
        _url_to_filepath(cat.get("signature_url", ""))
        or _get_setting_file_path("firma_director")
    )

    # Sello: solo admission (no existe en catalogs aún)
    sello_path = _get_setting_file_path("sello")

    # Campos de texto: catalogs data keys → admission fallback
    return {
        "institution_name": inst_name,
        "city":            cat.get("city", "") or _get_setting("institution_city", "Tarma"),
        "region":          cat.get("region", "") or _get_setting("institution_region", "Junín"),
        "director_name":   cat.get("director_name", "") or _get_setting("director_name", ""),
        "director_title":  cat.get("director_title", "") or _get_setting("director_title", "DIRECTOR GENERAL"),
        "lema_anio":       cat.get("lema_anio", "") or _get_setting("lema_anio", ""),
        "year_motto":      cat.get("year_motto", "") or cat.get("lema_anio", "") or _get_setting("year_motto", ""),
        "rvm":             cat.get("rvm", "") or _get_setting("rvm", ""),
        # Rutas absolutas de imágenes
        "logo_path":           logo_path,
        "firma_director_path": firma_path,
        "sello_path":          sello_path,
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
    """PDF profesional con ReportLab — Constancia de Inscripción (A4 landscape)."""
    import os
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.units import cm, mm
    from reportlab.lib.colors import HexColor, black, white
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image,
    )
    from reportlab.lib.utils import ImageReader

    buf = BytesIO()
    pw, ph = landscape(A4)

    AZUL = HexColor("#1a237e")
    AZUL_MED = HexColor("#1565c0")
    GRIS = HexColor("#555555")
    GRIS_CLARO = HexColor("#f5f5f5")

    mr = str(_get_media_root())

    def _resolve_img(path_str):
        p = str(path_str or "")
        if not p:
            return None
        if "/media/" in p:
            p = os.path.join(mr, p.split("/media/")[-1])
        elif not os.path.isabs(p):
            p = os.path.join(mr, p.lstrip("/"))
        return p if os.path.exists(p) else None

    # Estilos
    s_title = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=15,
                             alignment=TA_CENTER, textColor=AZUL, spaceAfter=2*mm)
    s_subtitle = ParagraphStyle("sub", fontName="Helvetica-Bold", fontSize=11,
                                alignment=TA_CENTER, textColor=black, spaceAfter=4*mm)
    s_constancia = ParagraphStyle("const", fontName="Helvetica-Bold", fontSize=13,
                                  alignment=TA_CENTER, textColor=black, spaceAfter=3*mm,
                                  underline=True)
    s_label = ParagraphStyle("lbl", fontName="Helvetica-Bold", fontSize=8.5,
                             textColor=GRIS)
    s_value = ParagraphStyle("val", fontName="Helvetica-Bold", fontSize=8.5,
                             textColor=black)
    s_small = ParagraphStyle("sm", fontName="Helvetica", fontSize=7,
                             textColor=GRIS, alignment=TA_CENTER)
    s_indicacion = ParagraphStyle("ind", fontName="Helvetica", fontSize=7.5,
                                  textColor=black, leading=10)
    s_aviso = ParagraphStyle("aviso", fontName="Helvetica-Bold", fontSize=6.5,
                             textColor=black, leading=9, spaceAfter=3*mm)
    s_firma_label = ParagraphStyle("flbl", fontName="Helvetica", fontSize=7,
                                   alignment=TA_CENTER, textColor=GRIS)
    s_firma_name = ParagraphStyle("fname", fontName="Helvetica-Bold", fontSize=7.5,
                                  alignment=TA_CENTER)
    s_firma_cargo = ParagraphStyle("fcargo", fontName="Helvetica", fontSize=7,
                                   alignment=TA_CENTER, textColor=GRIS)

    # Datos
    call_name = (app_data.get("call_name", "") or "").upper()
    modalidad = (app_data.get("modalidad_admision", "ORDINARIO") or "").upper()
    ap_paterno = (app_data.get("ap_paterno", "") or "").upper()
    ap_materno = (app_data.get("ap_materno", "") or "").upper()
    nombres = (app_data.get("nombres", "") or "").upper()
    especialidad = (app_data.get("especialidad", "") or "").upper()
    dni = app_data.get("dni", "") or ""
    sexo = (app_data.get("sexo", "") or "").upper()
    discapacidad = app_data.get("discapacidad", "") or "-"
    domicilio = (app_data.get("domicilio", "") or "").upper()
    telefono = app_data.get("telefono", "") or ""
    email = (app_data.get("email", "") or "").lower()
    fecha_nac = app_data.get("fecha_nacimiento", "") or ""
    full_name = f"{nombres} {ap_paterno} {ap_materno}".strip()

    inst_name = (inst.get("institution_name", "") or "GUSTAVO ALLENDE LLAVERÍA").strip('"').strip("'")
    city = inst.get("city", "Tarma")
    director_name = inst.get("director_name", "")
    director_title = (inst.get("director_title", "DIRECTOR GENERAL") or "").upper()
    rvm = inst.get("rvm", "")

    now = datetime.now()
    MESES = {1:"enero",2:"febrero",3:"marzo",4:"abril",5:"mayo",6:"junio",
             7:"julio",8:"agosto",9:"septiembre",10:"octubre",11:"noviembre",12:"diciembre"}
    fecha_doc = f"{city}, {now.day} de {MESES[now.month]} de {now.year}"

    # ── Canvas drawing ──
    from reportlab.pdfgen import canvas as cv_mod
    c = cv_mod.Canvas(buf, pagesize=landscape(A4))

    # ── Franja azul superior ──
    c.setFillColor(AZUL)
    c.rect(0, ph - 2.2*cm, pw, 2.2*cm, fill=True, stroke=False)

    # Logo en franja
    logo_path = _resolve_img(inst.get("logo_path", ""))
    if logo_path:
        try:
            c.drawImage(logo_path, 1.5*cm, ph - 2*cm, width=1.5*cm, height=1.5*cm,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    # Texto en franja
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(3.5*cm, ph - 1.1*cm, "INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(3.5*cm, ph - 1.8*cm, f'"{inst_name}"')
    if rvm:
        c.setFont("Helvetica", 7)
        c.drawString(3.5*cm, ph - 2.1*cm, rvm)

    # Nombre del proceso (derecha)
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(pw - 1.5*cm, ph - 1.3*cm, "PROCESO DE ADMISIÓN")
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(pw - 1.5*cm, ph - 1.9*cm, call_name)

    # ── Título ──
    y_start = ph - 3.2*cm
    c.setFillColor(black)
    c.setFont("Helvetica-Bold", 16)
    title_text = "CONSTANCIA DE INSCRIPCIÓN"
    tw = c.stringWidth(title_text, "Helvetica-Bold", 16)
    tx = (pw - tw) / 2
    c.drawString(tx, y_start, title_text)
    c.setLineWidth(1.5)
    c.line(tx, y_start - 2, tx + tw, y_start - 2)

    # ── Foto ──
    y_data = y_start - 1.2*cm
    photo_path = _resolve_img(app_data.get("photo_path", ""))
    photo_x = 2*cm
    photo_w = 2.8*cm
    photo_h = 3.5*cm

    # Borde de foto
    c.setStrokeColor(AZUL_MED)
    c.setLineWidth(2)
    c.rect(photo_x - 1, y_data - photo_h - 1, photo_w + 2, photo_h + 2, fill=False)
    if photo_path:
        try:
            c.drawImage(photo_path, photo_x, y_data - photo_h, width=photo_w,
                        height=photo_h, preserveAspectRatio=True, mask="auto")
        except Exception:
            c.setFont("Helvetica", 8)
            c.setFillColor(GRIS)
            c.drawCentredString(photo_x + photo_w/2, y_data - photo_h/2, "Foto carné")
            c.setFillColor(black)
    else:
        c.setFillColor(GRIS_CLARO)
        c.rect(photo_x, y_data - photo_h, photo_w, photo_h, fill=True, stroke=False)
        c.setFillColor(GRIS)
        c.setFont("Helvetica", 8)
        c.drawCentredString(photo_x + photo_w/2, y_data - photo_h/2, "Foto carné")
        c.setFillColor(black)

    # Etiqueta foto
    c.setFont("Helvetica", 6)
    c.setFillColor(GRIS)
    c.drawCentredString(photo_x + photo_w/2, y_data - photo_h - 0.4*cm, "Foto carné")
    c.setFillColor(black)

    # ── Tabla de datos ──
    data_x = photo_x + photo_w + 1*cm
    data_w = pw - data_x - 1.5*cm
    row_h = 0.50*cm
    y = y_data

    fields = [
        ("CONDICIÓN DEL POSTULANTE", modalidad),
        ("APELLIDO PATERNO", ap_paterno),
        ("APELLIDO MATERNO", ap_materno),
        ("NOMBRES", nombres),
        ("ESPECIALIDAD", especialidad),
        ("DNI", dni),
        ("SEXO", sexo),
        ("DISCAPACIDAD", discapacidad),
        ("DOMICILIO", domicilio),
        ("TELÉFONO", telefono),
        ("CORREO ELECTRÓNICO", email),
        ("FECHA DE NACIMIENTO", fecha_nac),
    ]

    for i, (label, val) in enumerate(fields):
        ry = y - (i * row_h)
        # Fondo alterno
        if i % 2 == 0:
            c.setFillColor(GRIS_CLARO)
            c.rect(data_x, ry - row_h + 2, data_w, row_h, fill=True, stroke=False)
            c.setFillColor(black)
        # Label
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(data_x + 3, ry - row_h + 5, label)
        # Separador
        c.drawString(data_x + data_w * 0.42, ry - row_h + 5, ":")
        # Valor
        c.setFont("Helvetica-Bold", 8)
        c.drawString(data_x + data_w * 0.45, ry - row_h + 5, str(val))

    # ── Indicaciones ──
    y_ind = y - len(fields) * row_h - 0.6*cm
    c.setFont("Helvetica-Bold", 8)
    c.drawString(2*cm, y_ind, "Indicaciones:")
    indicaciones = [
        "Presentarse en la sede de aplicación con 1 hora de anticipación a la hora establecida.",
        "Portar su Documento de Identidad (DNI) al ingresar al local.",
        "Presentar esta constancia (con foto, sello institucional y firmas).",
    ]
    c.setFont("Helvetica", 7.5)
    for idx, txt in enumerate(indicaciones, 1):
        y_ind -= 0.4*cm
        c.drawString(2.5*cm, y_ind, f"{idx}. {txt}")

    # ── Aviso ──
    y_ind -= 0.6*cm
    c.setFont("Helvetica-Bold", 6.5)
    c.drawString(2*cm, y_ind,
        "ESTE ES EL ÚNICO DOCUMENTO QUE LO ACREDITA COMO POSTULANTE CORRECTAMENTE")
    y_ind -= 0.35*cm
    c.drawString(2*cm, y_ind,
        "REGISTRADO EN EL SISTEMA Y PERMITE SU ACCESO AL LOCAL PARA RENDIR LAS PRUEBAS.")

    # ── Zona de firmas ──
    y_firma = 2.8*cm

    # Firma postulante (izquierda)
    c.setLineWidth(0.5)
    c.line(3*cm, y_firma, 9*cm, y_firma)
    c.setFont("Helvetica", 7)
    c.drawCentredString(6*cm, y_firma - 0.35*cm, "Firma del Postulante")
    c.setFont("Helvetica-Bold", 7.5)
    c.drawCentredString(6*cm, y_firma - 0.7*cm, full_name)
    c.setFont("Helvetica", 7)
    c.drawCentredString(6*cm, y_firma - 1*cm, f"DNI: {dni}")

    # Fecha + Firma director (derecha)
    c.setFont("Helvetica", 8)
    c.drawCentredString(pw - 7*cm, y_firma + 0.8*cm, fecha_doc)

    firma_path = _resolve_img(inst.get("firma_director_path", ""))
    if firma_path:
        try:
            c.drawImage(firma_path, pw - 9*cm, y_firma + 0.2*cm, width=4*cm,
                        height=1.2*cm, preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    c.line(pw - 10*cm, y_firma, pw - 4*cm, y_firma)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawCentredString(pw - 7*cm, y_firma - 0.35*cm, director_name)
    c.setFont("Helvetica", 7)
    c.drawCentredString(pw - 7*cm, y_firma - 0.65*cm, director_title)

    sello_path = _resolve_img(inst.get("sello_path", ""))
    if sello_path:
        try:
            c.drawImage(sello_path, pw - 5.5*cm, y_firma - 0.8*cm, width=1.8*cm,
                        height=1.8*cm, preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    # ── Footer ──
    c.setFont("Helvetica", 6)
    c.setFillColor(GRIS)
    c.drawRightString(pw - 1.5*cm, 0.8*cm, "Área de Innovación e Investigación - Informática")

    c.save()
    buf.seek(0)
    return buf.read()


def _fallback_vacante_reportlab(app, app_data: dict, inst: dict) -> bytes:
    """PDF profesional con ReportLab — Constancia de Vacante (A4 portrait)."""
    import os
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm, mm
    from reportlab.lib.colors import HexColor, black, white
    from reportlab.lib.utils import simpleSplit
    from reportlab.pdfgen import canvas as cv_mod

    buf = BytesIO()
    w, h = A4   # 595 × 842 pts

    AZUL = HexColor("#1a237e")
    AZUL_MED = HexColor("#1565c0")
    GRIS = HexColor("#555555")
    GRIS_CLARO = HexColor("#f5f5f5")

    mr = str(_get_media_root())

    def _resolve_img(path_str):
        p = str(path_str or "")
        if not p:
            return None
        if "/media/" in p:
            p = os.path.join(mr, p.split("/media/")[-1])
        elif not os.path.isabs(p):
            p = os.path.join(mr, p.lstrip("/"))
        return p if os.path.exists(p) else None

    # ── Datos ──
    full_name = (app_data.get("full_name", "") or "").upper()
    especialidad = (app_data.get("especialidad", "") or "").upper()
    ciclo = app_data.get("ciclo", "") or ""
    periodo = app_data.get("periodo", "") or app_data.get("call_period", "")

    inst_name = (inst.get("institution_name", "") or "GUSTAVO ALLENDE LLAVERÍA").strip('"').strip("'")
    city = inst.get("city", "Tarma")
    director_name = inst.get("director_name", "")
    director_title = (inst.get("director_title", "DIRECTOR GENERAL") or "").upper()
    year_motto = inst.get("year_motto", "") or inst.get("lema_anio", "")
    rvm = inst.get("rvm", "")

    now = datetime.now()
    MESES = {1: "enero", 2: "febrero", 3: "marzo", 4: "abril", 5: "mayo",
             6: "junio", 7: "julio", 8: "agosto", 9: "septiembre",
             10: "octubre", 11: "noviembre", 12: "diciembre"}
    fecha_doc = f"{city}, {now.day} de {MESES[now.month]} del {now.year}"

    REQUISITOS = [
        "Fotocopia del DNI del estudiante",
        "Partida de Nacimiento original",
        "Certificado de estudios secundarios",
        "Certificado de estudios superiores originales visado por la DRE.",
        "Resolución Directoral que autorice el Traslado Externo",
        "Resolución de autorización del programa de estudios de procedencia.",
        "Pago por derecho de traslado",
        "01 foto tamaño pasaporte con terno azul y blusa blanca.",
    ]

    c = cv_mod.Canvas(buf, pagesize=A4)
    margin_l = 2.5 * cm
    margin_r = 2.5 * cm
    content_w = w - margin_l - margin_r

    # ══════════════════════════════════════════════
    # FRANJA AZUL SUPERIOR
    # ══════════════════════════════════════════════
    c.setFillColor(AZUL)
    c.rect(0, h - 1.8 * cm, w, 1.8 * cm, fill=True, stroke=False)

    # Logo en franja
    logo_path = _resolve_img(inst.get("logo_path", ""))
    if logo_path:
        try:
            c.drawImage(logo_path, margin_l, h - 1.6 * cm, width=1.2 * cm,
                        height=1.2 * cm, preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    # Texto en franja
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin_l + 1.5 * cm, h - 0.85 * cm,
                 "INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_l + 1.5 * cm, h - 1.45 * cm, f'"{inst_name}"')

    if rvm:
        c.setFont("Helvetica", 6)
        c.drawRightString(w - margin_r, h - 1.0 * cm, rvm)

    # ══════════════════════════════════════════════
    # LEMA DEL AÑO
    # ══════════════════════════════════════════════
    y = h - 2.8 * cm
    if year_motto:
        c.setFillColor(GRIS)
        c.setFont("Helvetica-Oblique", 9)
        lema_text = f'"{year_motto}"'
        c.drawCentredString(w / 2, y, lema_text)
        y -= 0.8 * cm
    else:
        y -= 0.3 * cm

    # ══════════════════════════════════════════════
    # LOGO CENTRADO
    # ══════════════════════════════════════════════
    if logo_path:
        try:
            logo_w = 1.8 * cm
            logo_h = 1.8 * cm
            c.drawImage(logo_path, (w - logo_w) / 2, y - logo_h,
                        width=logo_w, height=logo_h,
                        preserveAspectRatio=True, mask="auto")
            y -= logo_h + 0.5 * cm
        except Exception:
            y -= 0.3 * cm
    else:
        y -= 0.3 * cm

    # ══════════════════════════════════════════════
    # TÍTULO: CONSTANCIA DE VACANTE
    # ══════════════════════════════════════════════
    c.setFillColor(black)
    c.setFont("Helvetica-Bold", 16)
    title_text = "CONSTANCIA DE VACANTE"
    tw = c.stringWidth(title_text, "Helvetica-Bold", 16)
    tx = (w - tw) / 2
    c.drawString(tx, y, title_text)
    # Subrayado
    c.setLineWidth(1.5)
    c.setStrokeColor(black)
    c.line(tx, y - 3, tx + tw, y - 3)
    y -= 1.2 * cm

    # ══════════════════════════════════════════════
    # ENCABEZADO: LA DIRECTORA GENERAL...
    # ══════════════════════════════════════════════
    header_text = (
        f"LA {director_title} DEL INSTITUTO DE EDUCACIÓN SUPERIOR "
        f'PEDAGÓGICO PÚBLICO "{inst_name}" de {city}, a través de '
        f"Secretaría Académica hace constar:"
    )
    c.setFont("Helvetica-Bold", 10)
    lines = simpleSplit(header_text, "Helvetica-Bold", 10, content_w)
    for line in lines:
        c.drawString(margin_l, y, line)
        y -= 0.45 * cm
    y -= 0.4 * cm

    # ══════════════════════════════════════════════
    # CUERPO: TEXTO DE VACANTE
    # ══════════════════════════════════════════════
    # Construir frase del período
    where_parts = []
    if ciclo:
        where_parts.append(f"correspondiente al {ciclo}")
    if periodo:
        where_parts.append(f"en el periodo académico {periodo}")
    where_text = ", ".join(where_parts) + ("," if where_parts else "")

    body_text = (
        f"Que, en el INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO "
        f'"{inst_name}" de la ciudad de {city}, existe una plaza VACANTE DE '
        f"ESTUDIOS en el programa de estudios de {especialidad} "
        f"{where_text} que puede ser ocupado por la(el) estudiante "
        f"{full_name}."
    )
    c.setFont("Helvetica", 10.5)
    lines = simpleSplit(body_text, "Helvetica", 10.5, content_w)
    for line in lines:
        c.drawString(margin_l, y, line)
        y -= 0.45 * cm
    y -= 0.3 * cm

    # Segundo párrafo
    body2 = (
        "Se expide la presente a solicitud de la interesada para los fines "
        "que estime por conveniente."
    )
    lines = simpleSplit(body2, "Helvetica", 10.5, content_w)
    for line in lines:
        c.drawString(margin_l, y, line)
        y -= 0.45 * cm
    y -= 0.5 * cm

    # ══════════════════════════════════════════════
    # REQUISITOS
    # ══════════════════════════════════════════════
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(margin_l, y, "REQUISITOS:")
    y -= 0.55 * cm

    c.setFont("Helvetica", 9.5)
    bullet_indent = margin_l + 0.6 * cm
    for req in REQUISITOS:
        # Viñeta (bullet)
        c.setFillColor(AZUL_MED)
        c.circle(margin_l + 0.3 * cm, y + 0.1 * cm, 1.5, fill=True, stroke=False)
        c.setFillColor(black)
        req_lines = simpleSplit(req, "Helvetica", 9.5, content_w - 0.8 * cm)
        for rl in req_lines:
            c.drawString(bullet_indent, y, rl)
            y -= 0.4 * cm
        y -= 0.05 * cm

    y -= 0.2 * cm

    # Nota del folder
    c.setFont("Helvetica", 9)
    folder_text = (
        "Presentar la documentación en un folder manila tamaño A4 "
        "por mesa de partes de la Institución."
    )
    lines = simpleSplit(folder_text, "Helvetica", 9, content_w)
    for line in lines:
        c.drawString(margin_l, y, line)
        y -= 0.4 * cm

    # ══════════════════════════════════════════════
    # FECHA CENTRADA
    # ══════════════════════════════════════════════
    y -= 0.6 * cm
    c.setFont("Helvetica", 10)
    c.drawCentredString(w / 2, y, fecha_doc)

    # ══════════════════════════════════════════════
    # FIRMA DIRECTOR
    # ══════════════════════════════════════════════
    y_firma = y - 1.5 * cm

    # Imagen de firma
    firma_path = _resolve_img(inst.get("firma_director_path", ""))
    if firma_path:
        try:
            c.drawImage(firma_path, (w - 4 * cm) / 2, y_firma + 0.2 * cm,
                        width=4 * cm, height=1.3 * cm,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    # Línea de firma
    line_w = 7 * cm
    c.setLineWidth(0.5)
    c.setStrokeColor(black)
    c.line((w - line_w) / 2, y_firma, (w + line_w) / 2, y_firma)

    # Nombre
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(w / 2, y_firma - 0.4 * cm, director_name)

    # Cargo
    c.setFont("Helvetica", 8.5)
    c.drawCentredString(w / 2, y_firma - 0.75 * cm, director_title)

    # Institución
    c.setFont("Helvetica", 8)
    c.setFillColor(GRIS)
    c.drawCentredString(w / 2, y_firma - 1.05 * cm, f'I.E.S.P.P. "{inst_name}"')

    # Sello
    sello_path = _resolve_img(inst.get("sello_path", ""))
    if sello_path:
        try:
            c.drawImage(sello_path, w / 2 + 4 * cm, y_firma - 0.8 * cm,
                        width=1.8 * cm, height=1.8 * cm,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    # ══════════════════════════════════════════════
    # FOOTER
    # ══════════════════════════════════════════════
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 6)
    c.drawRightString(w - margin_r, 0.8 * cm,
                      "Área de Innovación e Investigación - Informática")

    # Línea decorativa inferior
    c.setStrokeColor(AZUL)
    c.setLineWidth(3)
    c.line(0, 0.5 * cm, w, 0.5 * cm)

    c.save()
    buf.seek(0)
    return buf.read()