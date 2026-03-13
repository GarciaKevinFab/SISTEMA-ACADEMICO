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

from django.conf import settings
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

def verify_applicant_page(request):
    """
    Página HTML pública de verificación de postulante (accesible vía QR).
    No depende del frontend React — renderiza HTML completo desde Django.
    GET /public/admission/search?dni=XXXXXXXX
    """
    from django.views.decorators.csrf import csrf_exempt

    dni = request.GET.get("dni", "").strip()
    applicant_data = None
    error_msg = None

    if dni and len(dni) >= 8:
        app = (
            Application.objects
            .filter(applicant__dni=dni)
            .select_related("applicant", "call")
            .prefetch_related("preferences__career", "scores")
            .order_by("-id")
            .first()
        )
        if app:
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

            photo_url = None
            photo_doc = ApplicationDocument.objects.filter(
                application=app, document_type="FOTO_CARNET"
            ).first()
            if photo_doc and photo_doc.file:
                try:
                    photo_url = request.build_absolute_uri(
                        f"/api/applications/{app.id}/documents/{photo_doc.id}/download"
                    )
                except Exception:
                    pass

            STATUS_LABELS = {
                "REGISTERED": ("Inscrito", "#2563eb", "#dbeafe"),
                "EVALUATED":  ("Evaluado", "#7c3aed", "#ede9fe"),
                "ADMITTED":   ("INGRESANTE", "#059669", "#d1fae5"),
                "NOT_ADMITTED": ("No admitido", "#dc2626", "#fee2e2"),
                "WAITING_LIST": ("Lista de espera", "#d97706", "#fef3c7"),
            }
            st = STATUS_LABELS.get(app.status, (app.status, "#6b7280", "#f3f4f6"))

            score_obj = app.scores.first()
            applicant_data = {
                "full_name":    full_name,
                "dni":          app.applicant.dni,
                "career":       career_name,
                "status":       app.status,
                "status_label": st[0],
                "status_color": st[1],
                "status_bg":    st[2],
                "call_name":    app.call.title if app.call else "",
                "app_number":   f"{app.call.period or ''}-{app.id:04d}",
                "photo_url":    photo_url,
                "birth_date":   profile.get("fecha_nacimiento", ""),
                "gender":       profile.get("sexo", ""),
                "address":      profile.get("direccion", ""),
                "phone":        app.applicant.phone or "",
                "email":        app.applicant.email or "",
                "modalidad":    profile.get("modalidad_admision", "ORDINARIO"),
                "score":        float(score_obj.total) if score_obj else None,
            }
        else:
            error_msg = f"No se encontró ningún postulante con el DNI {dni}."
    elif dni:
        error_msg = "El DNI debe tener al menos 8 dígitos."

    # ── Construir inst info ──
    cat_data = _get_catalog_data()
    inst_name = (cat_data.get("name", "") or "GUSTAVO ALLENDE LLAVERÍA").strip('"').strip("'")

    # ── Renderizar HTML ──
    a = applicant_data

    # Helper: genera un campo de la ficha
    def _field(icon_svg, label, val, full_width=False):
        if not val:
            return ""
        w = "grid-column:1/-1;" if full_width else ""
        return f'''<div class="fd" style="{w}">
            <div class="fd-icon">{icon_svg}</div>
            <div class="fd-txt"><span class="fd-lbl">{label}</span><span class="fd-val">{val}</span></div>
        </div>'''

    # SVG icons (small, inline)
    IC = {
        "user":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        "id":    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
        "book":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
        "hash":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
        "star":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
        "cal":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        "gen":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>',
        "map":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
        "phone": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>',
        "mail":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
        "award": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
        "check": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>',
        "search":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
        "alert": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    }

    # Build fields HTML
    fields_html = ""
    if a:
        flist = [
            (IC["user"],  "Nombre completo", a["full_name"], True),
            (IC["id"],    "DNI",             a["dni"], False),
            (IC["hash"],  "N° Postulación",  a["app_number"], False),
            (IC["book"],  "Especialidad",    a["career"], True),
            (IC["star"],  "Modalidad",       a["modalidad"], False),
            (IC["cal"],   "Fecha de nacimiento", a["birth_date"], False),
            (IC["gen"],   "Sexo",            a["gender"], False),
            (IC["map"],   "Domicilio",       a["address"], True),
            (IC["phone"], "Teléfono",        a["phone"], False),
            (IC["mail"],  "Correo",          a["email"], False),
        ]
        if a["score"] is not None:
            flist.append((IC["award"], "Puntaje final", f'{a["score"]:.2f}', False))
        for ic, lbl, val, fw in flist:
            fields_html += _field(ic, lbl, val, fw)

    # Photo
    photo_html = ""
    if a:
        if a["photo_url"]:
            photo_html = f'<img src="{a["photo_url"]}" alt="Foto">'
        else:
            photo_html = f'<div class="photo-placeholder">{IC["user"]}</div>'

    # Status badge
    badge_html = ""
    if a:
        badge_html = f'<span class="badge" style="--bc:{a["status_color"]};--bg:{a["status_bg"]};">{a["status_label"]}</span>'

    # Sections
    verified_html = ""
    if a:
        verified_html = f'''
        <div class="verified-card fade-in">
            <div class="verified-icon">{IC["check"]}</div>
            <div class="verified-txt">
                <strong>Postulante Verificado</strong>
                <span>Este postulante se encuentra correctamente registrado en el proceso de admisión.</span>
            </div>
            {badge_html}
        </div>'''

    profile_html = ""
    if a:
        call_sub = f'<p class="card-sub">{a["call_name"]}</p>' if a["call_name"] else ""
        profile_html = f'''
        <div class="card fade-in" style="animation-delay:.1s;">
            <div class="card-head">
                <div>
                    <p class="card-title">{a["full_name"]}</p>
                    {call_sub}
                </div>
                {badge_html}
            </div>
            <div class="card-body">
                <div class="photo-col">
                    <div class="photo-frame">{photo_html}</div>
                    <span class="photo-label">Foto carné</span>
                </div>
                <div class="fields-grid">
                    {fields_html}
                </div>
            </div>
        </div>'''

    error_html = ""
    if error_msg:
        error_html = f'''
        <div class="alert-card alert-warn fade-in">
            <div class="alert-icon">{IC["alert"]}</div>
            <div>
                <strong>Postulante no encontrado</strong>
                <p>{error_msg}</p>
            </div>
        </div>'''

    empty_html = ""
    if not a and not error_msg:
        empty_html = f'''
        <div class="empty-state">
            <div class="empty-icon">{IC["search"]}</div>
            <strong>Verificación de Inscripción</strong>
            <p>Ingrese el número de DNI del postulante para verificar su registro en el proceso de admisión.</p>
        </div>'''

    html = f'''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verificación de Postulante — IESPP "{inst_name}"</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'Inter',system-ui,-apple-system,sans-serif;background:#f0f2f5;min-height:100vh;color:#1a1a2e}}

/* Header */
.hdr{{background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%);color:#fff;position:relative;overflow:hidden}}
.hdr::before{{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 30% 0%,rgba(99,102,241,.25) 0%,transparent 60%),radial-gradient(ellipse at 80% 100%,rgba(59,130,246,.15) 0%,transparent 50%)}}
.hdr-inner{{max-width:720px;margin:0 auto;padding:28px 20px 36px;position:relative;z-index:1}}
.hdr-top{{display:flex;align-items:center;gap:14px}}
.hdr-logo{{width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)}}
.hdr-logo svg{{width:24px;height:24px;color:#818cf8}}
.hdr h1{{font-size:20px;font-weight:800;letter-spacing:-.03em}}
.hdr p{{font-size:12px;color:#94a3b8;margin-top:2px}}
.hdr-badge{{display:inline-flex;align-items:center;gap:6px;margin-top:14px;padding:6px 14px;border-radius:20px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.25);font-size:11px;font-weight:700;color:#a5b4fc;letter-spacing:.03em;text-transform:uppercase}}
.hdr-badge svg{{width:14px;height:14px}}
.back-btn{{position:absolute;top:28px;right:20px;color:rgba(255,255,255,.4);text-decoration:none;font-size:13px;font-weight:600;display:flex;align-items:center;gap:4px;transition:color .15s}}
.back-btn:hover{{color:#fff}}

/* Container */
.container{{max-width:720px;margin:-20px auto 0;padding:0 16px 48px;position:relative;z-index:2}}

/* Search */
.search-card{{background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.04);border:1px solid #e5e7eb}}
.search-label{{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}}
.search-form{{display:flex;gap:10px}}
.search-input-wrap{{flex:1;position:relative}}
.search-input-wrap svg{{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:#9ca3af}}
.search-input{{width:100%;height:48px;padding:0 14px 0 42px;border-radius:12px;border:2px solid #e5e7eb;background:#fafafa;font-size:16px;font-weight:500;color:#1a1a2e;transition:all .2s;font-family:inherit}}
.search-input:focus{{outline:none;border-color:#6366f1;background:#fff;box-shadow:0 0 0 4px rgba(99,102,241,.1)}}
.search-input::placeholder{{color:#9ca3af;font-weight:400}}
.search-btn{{height:48px;padding:0 24px;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;font-size:15px;font-weight:700;border:none;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .2s;font-family:inherit;box-shadow:0 2px 8px rgba(99,102,241,.3)}}
.search-btn:hover{{background:linear-gradient(135deg,#4338ca,#4f46e5);transform:translateY(-1px);box-shadow:0 4px 12px rgba(99,102,241,.4)}}
.search-btn:active{{transform:translateY(0)}}
.search-btn svg{{width:16px;height:16px}}

/* Verified banner */
.verified-card{{background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1px solid #86efac;border-radius:14px;padding:18px 20px;display:flex;align-items:center;gap:14px;margin-top:20px}}
.verified-icon{{width:44px;height:44px;border-radius:12px;background:#fff;border:1px solid #86efac;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 6px rgba(16,185,129,.15)}}
.verified-icon svg{{width:22px;height:22px;color:#059669}}
.verified-txt{{flex:1}}
.verified-txt strong{{font-size:14px;color:#065f46;display:block}}
.verified-txt span{{font-size:12px;color:#047857;margin-top:2px;display:block;line-height:1.4}}

/* Badge */
.badge{{padding:5px 14px;border-radius:20px;font-size:11px;font-weight:800;color:var(--bc);background:var(--bg);border:1.5px solid var(--bc);letter-spacing:.02em;white-space:nowrap;flex-shrink:0}}

/* Profile card */
.card{{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.04);border:1px solid #e5e7eb;margin-top:16px}}
.card-head{{background:linear-gradient(135deg,#0f172a,#1e293b);padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px}}
.card-title{{color:#fff;font-size:18px;font-weight:800;letter-spacing:-.02em}}
.card-sub{{color:#94a3b8;font-size:12px;margin-top:3px}}
.card-body{{padding:24px;display:flex;gap:24px;flex-wrap:wrap}}

/* Photo */
.photo-col{{display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0}}
.photo-frame{{width:110px;height:140px;border-radius:12px;overflow:hidden;border:3px solid #e5e7eb;background:#f8fafc;box-shadow:0 2px 8px rgba(0,0,0,.06)}}
.photo-frame img{{width:100%;height:100%;object-fit:cover}}
.photo-placeholder{{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f1f5f9,#e2e8f0)}}
.photo-placeholder svg{{width:32px;height:32px;color:#94a3b8}}
.photo-label{{font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}}

/* Fields grid */
.fields-grid{{flex:1;min-width:280px;display:grid;grid-template-columns:1fr 1fr;gap:0}}
.fd{{display:flex;align-items:flex-start;gap:10px;padding:12px 8px;border-bottom:1px solid #f1f5f9;transition:background .15s}}
.fd:hover{{background:#fafbff}}
.fd-icon{{width:28px;height:28px;border-radius:8px;background:#f0f0ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}}
.fd-icon svg{{width:14px;height:14px;color:#6366f1}}
.fd-txt{{min-width:0}}
.fd-lbl{{display:block;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em}}
.fd-val{{display:block;font-size:13px;font-weight:600;color:#1e293b;margin-top:1px;word-break:break-word}}

/* Alert */
.alert-card{{border-radius:14px;padding:18px 20px;display:flex;align-items:flex-start;gap:12px;margin-top:20px}}
.alert-warn{{background:#fffbeb;border:1px solid #fcd34d}}
.alert-icon{{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}}
.alert-warn .alert-icon{{background:#fef3c7}}
.alert-warn .alert-icon svg{{width:18px;height:18px;color:#d97706}}
.alert-card strong{{font-size:14px;color:#92400e;display:block}}
.alert-card p{{font-size:12px;color:#a16207;margin-top:3px;line-height:1.4}}

/* Empty state */
.empty-state{{text-align:center;padding:64px 24px;margin-top:20px;background:#fff;border-radius:16px;border:2px dashed #e5e7eb}}
.empty-icon{{width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:flex;align-items:center;justify-content:center;margin:0 auto 18px}}
.empty-icon svg{{width:28px;height:28px;color:#94a3b8}}
.empty-state strong{{display:block;font-size:16px;color:#64748b}}
.empty-state p{{font-size:13px;color:#94a3b8;margin-top:6px;max-width:360px;margin-left:auto;margin-right:auto;line-height:1.5}}

/* Footer */
.footer{{text-align:center;padding:24px 16px;margin-top:8px}}
.footer p{{font-size:11px;color:#94a3b8}}
.footer a{{color:#6366f1;text-decoration:none;font-weight:600}}
.footer a:hover{{text-decoration:underline}}

/* Animation */
@keyframes fadeUp{{from{{opacity:0;transform:translateY(12px)}}to{{opacity:1;transform:none}}}}
.fade-in{{animation:fadeUp .4s ease both}}

/* Mobile */
@media(max-width:640px){{
    .hdr-inner{{padding:20px 16px 28px}}
    .hdr h1{{font-size:17px}}
    .search-form{{flex-direction:column}}
    .search-btn{{width:100%;justify-content:center}}
    .card-body{{flex-direction:column;align-items:center}}
    .photo-col{{order:-1}}
    .fields-grid{{grid-template-columns:1fr}}
    .card-head{{flex-direction:column;align-items:flex-start;gap:8px}}
    .verified-card{{flex-direction:column;text-align:center;gap:10px}}
    .badge{{align-self:center}}
    .back-btn{{display:none}}
}}
</style>
</head>
<body>

<div class="hdr">
    <div class="hdr-inner">
        <a href="https://academico.iesppallende.edu.pe" class="back-btn">&#8592; Volver al inicio</a>
        <div class="hdr-top">
            <div class="hdr-logo">{IC["check"]}</div>
            <div>
                <h1>Verificación de Postulante</h1>
                <p>IESPP "{inst_name}" — Sistema de Admisión</p>
            </div>
        </div>
        <div class="hdr-badge">{IC["check"]} Verificación oficial</div>
    </div>
</div>

<div class="container">
    <div class="search-card fade-in">
        <div class="search-label">Buscar postulante por DNI</div>
        <form method="get" class="search-form">
            <div class="search-input-wrap">
                {IC["id"]}
                <input type="text" name="dni" value="{dni}" placeholder="Ingrese N° de DNI" maxlength="12"
                       class="search-input" pattern="[0-9]*" inputmode="numeric" autocomplete="off">
            </div>
            <button type="submit" class="search-btn">{IC["search"]} Buscar</button>
        </form>
    </div>

    {verified_html}
    {profile_html}
    {error_html}
    {empty_html}

    <div class="footer">
        <p>IESPP "{inst_name}" &mdash; Proceso de Admisión<br>
        <a href="https://academico.iesppallende.edu.pe/">Volver al portal principal</a></p>
    </div>
</div>

</body>
</html>'''

    return HttpResponse(html, content_type="text/html; charset=utf-8")


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

    # URL de verificación para QR — apunta a la página pública del frontend
    verify_path = f"/public/admission/search?dni={app.applicant.dni}"
    base = getattr(settings, "SITE_URL", "https://sis.iesppallende.edu.pe")
    app_data["verify_url"] = f"{base}{verify_path}"
    app_data["application_number"] = f"{app.call.period or ''}-{app.id:04d}"

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
    """PDF profesional con ReportLab — Constancia de Inscripción (A4 portrait + QR)."""
    import os
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm, mm
    from reportlab.lib.colors import HexColor, black, white
    from reportlab.pdfgen import canvas as cv_mod

    try:
        from reportlab.graphics.barcode import qr as qr_module
        from reportlab.graphics.shapes import Drawing
        HAS_RL_QR = True
    except ImportError:
        HAS_RL_QR = False

    buf = BytesIO()
    pw, ph = A4  # 595.27 × 841.89 pts

    # ── Paleta de colores ──
    AZUL_OSCURO = HexColor("#0d1b3e")
    AZUL        = HexColor("#1a3a5c")
    AZUL_MED    = HexColor("#1565c0")
    AZUL_CLARO  = HexColor("#e8f0fe")
    ORO         = HexColor("#c5a44e")
    GRIS        = HexColor("#555555")
    GRIS_CLARO  = HexColor("#f7f8fa")
    GRIS_BORDE  = HexColor("#d0d5dd")
    ROJO        = HexColor("#9b1c1c")
    ROJO_FONDO  = HexColor("#fef2f2")

    mr = str(_get_media_root())
    margin = 2*cm

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
    call_name   = (app_data.get("call_name", "") or "").upper()
    modalidad   = (app_data.get("modalidad_admision", "ORDINARIO") or "INGRESO ORDINARIO").upper()
    ap_paterno  = (app_data.get("ap_paterno", "") or "").upper()
    ap_materno  = (app_data.get("ap_materno", "") or "").upper()
    nombres     = (app_data.get("nombres", "") or "").upper()
    especialidad= (app_data.get("especialidad", "") or "").upper()
    dni         = app_data.get("dni", "") or ""
    sexo        = (app_data.get("sexo", "") or "").upper()
    discapacidad= app_data.get("discapacidad", "") or "NO"
    domicilio   = (app_data.get("domicilio", "") or "").upper()
    telefono    = app_data.get("telefono", "") or ""
    email       = (app_data.get("email", "") or "").lower()
    fecha_nac   = app_data.get("fecha_nacimiento", "") or ""
    full_name   = f"{ap_paterno} {ap_materno}, {nombres}".strip(", ")
    verify_url  = app_data.get("verify_url", "") or ""
    app_number  = app_data.get("application_number", "") or ""

    inst_name      = (inst.get("institution_name", "") or "GUSTAVO ALLENDE LLAVERÍA").strip('"').strip("'")
    city           = inst.get("city", "Tarma")
    director_name  = inst.get("director_name", "")
    director_title = (inst.get("director_title", "DIRECTOR(A) GENERAL") or "").upper()

    now  = datetime.now()
    MESES = {1:"enero",2:"febrero",3:"marzo",4:"abril",5:"mayo",6:"junio",
             7:"julio",8:"agosto",9:"septiembre",10:"octubre",11:"noviembre",12:"diciembre"}
    fecha_doc = f"{city}, {now.day} de {MESES[now.month]} de {now.year}"

    c = cv_mod.Canvas(buf, pagesize=A4)
    content_w = pw - 2 * margin

    # ═══════════════════════════════════════════════════════════
    # ENCABEZADO — franja azul oscuro con degradado visual
    # ═══════════════════════════════════════════════════════════
    header_h = 2.6*cm
    header_y = ph - header_h

    # Fondo principal oscuro
    c.setFillColor(AZUL_OSCURO)
    c.rect(0, header_y, pw, header_h, fill=True, stroke=False)

    # Línea dorada decorativa inferior
    c.setFillColor(ORO)
    c.rect(0, header_y, pw, 2, fill=True, stroke=False)

    # Logo (más grande, mejor posicionado)
    logo_path = _resolve_img(inst.get("logo_path", ""))
    logo_w = 1.8*cm
    logo_h = 1.8*cm
    logo_x = margin
    logo_y = header_y + (header_h - logo_h) / 2
    if logo_path:
        try:
            c.drawImage(logo_path, logo_x, logo_y, width=logo_w, height=logo_h,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    # Textos del encabezado
    text_x = logo_x + logo_w + 0.6*cm
    c.setFillColor(white)
    c.setFont("Helvetica", 7.5)
    c.drawString(text_x, header_y + header_h - 0.7*cm, "MINISTERIO DE EDUCACIÓN")
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(text_x, header_y + header_h - 1.2*cm,
                 "INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO")
    c.setFont("Helvetica", 8)
    c.drawString(text_x, header_y + header_h - 1.7*cm,
                 f'"{inst_name}"')

    # Derecha: proceso
    c.setFillColor(ORO)
    c.setFont("Helvetica", 6.5)
    c.drawRightString(pw - margin, header_y + header_h - 0.7*cm, "PROCESO DE ADMISIÓN")
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(pw - margin, header_y + header_h - 1.2*cm, "ADMISIÓN")
    if call_name:
        c.setFont("Helvetica", 7)
        c.drawRightString(pw - margin, header_y + header_h - 1.7*cm, call_name[:40])

    # ═══════════════════════════════════════════════════════════
    # TÍTULO
    # ═══════════════════════════════════════════════════════════
    y = header_y - 1.2*cm
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 16)
    title_text = "CONSTANCIA DE INSCRIPCIÓN"
    tw = c.stringWidth(title_text, "Helvetica-Bold", 16)
    tx = (pw - tw) / 2
    c.drawString(tx, y, title_text)

    # Líneas decorativas doradas debajo del título
    c.setStrokeColor(ORO)
    c.setLineWidth(2)
    c.line(tx, y - 4, tx + tw, y - 4)
    c.setLineWidth(0.5)
    c.line(tx + tw * 0.15, y - 8, tx + tw * 0.85, y - 8)

    # N° de postulación centrado bajo título
    if app_number:
        c.setFillColor(GRIS)
        c.setFont("Helvetica", 8)
        c.drawCentredString(pw / 2, y - 20, f"N° de Postulación: {app_number}")

    # ═══════════════════════════════════════════════════════════
    # SECCIÓN DATOS DEL POSTULANTE — Foto + Tabla
    # ═══════════════════════════════════════════════════════════
    y_section = y - 1.6*cm
    photo_path = _resolve_img(app_data.get("photo_path", ""))
    photo_x = margin
    photo_w = 3*cm
    photo_h = 3.8*cm

    # Marco de foto con sombra visual
    c.setFillColor(HexColor("#e2e8f0"))
    c.roundRect(photo_x + 1, y_section - photo_h - 2, photo_w + 4, photo_h + 4,
                3, fill=True, stroke=False)
    c.setStrokeColor(AZUL)
    c.setLineWidth(1.5)
    c.roundRect(photo_x, y_section - photo_h, photo_w, photo_h, 2, fill=False)

    if photo_path:
        try:
            c.drawImage(photo_path, photo_x + 1, y_section - photo_h + 1,
                        width=photo_w - 2, height=photo_h - 2,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass
    else:
        c.setFillColor(GRIS_CLARO)
        c.rect(photo_x + 1, y_section - photo_h + 1, photo_w - 2, photo_h - 2,
               fill=True, stroke=False)
        c.setFillColor(HexColor("#94a3b8"))
        c.setFont("Helvetica", 7)
        c.drawCentredString(photo_x + photo_w / 2, y_section - photo_h / 2 + 4, "FOTO")
        c.drawCentredString(photo_x + photo_w / 2, y_section - photo_h / 2 - 6, "CARNÉ")
        c.setFillColor(black)

    # ── Tabla de datos ──
    data_x = photo_x + photo_w + 0.6*cm
    data_w = pw - data_x - margin
    row_h = 0.52*cm
    y_tbl = y_section

    fields = [
        ("CONDICIÓN DEL POSTULANTE", modalidad),
        ("APELLIDO PATERNO",         ap_paterno),
        ("APELLIDO MATERNO",         ap_materno),
        ("NOMBRES",                  nombres),
        ("ESPECIALIDAD",             especialidad),
        ("DNI",                      dni),
        ("SEXO",                     sexo),
        ("DISCAPACIDAD",             discapacidad),
        ("DOMICILIO",                domicilio),
        ("TELÉFONO",                 telefono),
        ("CORREO ELECTRÓNICO",       email),
        ("FECHA DE NACIMIENTO",      fecha_nac),
    ]

    # Borde exterior de la tabla
    table_h = len(fields) * row_h
    c.setStrokeColor(GRIS_BORDE)
    c.setLineWidth(0.5)
    c.rect(data_x, y_tbl - table_h, data_w, table_h, fill=False)

    label_col_w = data_w * 0.40
    sep_w = data_w * 0.03
    val_col_x = data_x + label_col_w + sep_w

    for i, (label, val) in enumerate(fields):
        ry = y_tbl - (i * row_h)
        # Fondo alternado
        bg = AZUL_CLARO if i % 2 == 0 else white
        c.setFillColor(bg)
        c.rect(data_x, ry - row_h, data_w, row_h, fill=True, stroke=False)

        # Línea separadora horizontal
        c.setStrokeColor(GRIS_BORDE)
        c.setLineWidth(0.3)
        c.line(data_x, ry - row_h, data_x + data_w, ry - row_h)

        # Label
        c.setFillColor(AZUL)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(data_x + 4, ry - row_h + 4, label)

        # Separador ":"
        c.setFillColor(GRIS)
        c.drawString(data_x + label_col_w - 2, ry - row_h + 4, ":")

        # Valor
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 7.5)
        # Truncar si es muy largo
        val_str = str(val)
        max_val_w = data_w - label_col_w - sep_w - 8
        while c.stringWidth(val_str, "Helvetica-Bold", 7.5) > max_val_w and len(val_str) > 5:
            val_str = val_str[:-1]
        c.drawString(val_col_x, ry - row_h + 4, val_str)

    c.setFillColor(black)

    # ═══════════════════════════════════════════════════════════
    # INDICACIONES
    # ═══════════════════════════════════════════════════════════
    y_ind = y_tbl - table_h - 0.6*cm

    c.setFillColor(AZUL)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(margin, y_ind, "Indicaciones:")

    indicaciones = [
        "Presentarse en la sede de aplicación con 1 hora de anticipación a la hora establecida.",
        "Portar su Documento de Identidad (DNI) al ingresar al local.",
        "Presentar esta constancia (con foto, sello institucional y firmas).",
    ]
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7.5)
    for idx, txt in enumerate(indicaciones, 1):
        y_ind -= 0.42*cm
        c.drawString(margin + 0.5*cm, y_ind, f"{idx}. {txt}")

    # ═══════════════════════════════════════════════════════════
    # AVISO IMPORTANTE — caja roja
    # ═══════════════════════════════════════════════════════════
    y_ind -= 0.7*cm
    aviso_h = 1.1*cm
    # Fondo rosado sutil
    c.setFillColor(ROJO_FONDO)
    c.roundRect(margin, y_ind - aviso_h + 0.3*cm, content_w, aviso_h, 3, fill=True, stroke=False)
    # Borde rojo
    c.setStrokeColor(ROJO)
    c.setLineWidth(1.2)
    c.roundRect(margin, y_ind - aviso_h + 0.3*cm, content_w, aviso_h, 3, fill=False)

    c.setFillColor(ROJO)
    c.setFont("Helvetica-Bold", 6.5)
    c.drawCentredString(pw / 2, y_ind,
        "ESTE ES EL ÚNICO DOCUMENTO QUE LO ACREDITA COMO POSTULANTE CORRECTAMENTE")
    c.drawCentredString(pw / 2, y_ind - 0.35*cm,
        "REGISTRADO EN EL SISTEMA Y PERMITE SU ACCESO AL LOCAL PARA RENDIR LAS PRUEBAS.")
    c.setFillColor(black)

    # ═══════════════════════════════════════════════════════════
    # QR DE VERIFICACIÓN
    # ═══════════════════════════════════════════════════════════
    y_qr = y_ind - aviso_h - 0.3*cm
    if verify_url and HAS_RL_QR:
        qr_size = 2.3*cm
        box_h = qr_size + 0.5*cm

        # Fondo de la caja QR
        c.setFillColor(GRIS_CLARO)
        c.roundRect(margin, y_qr - box_h + 0.3*cm, content_w, box_h, 3, fill=True, stroke=False)
        c.setStrokeColor(GRIS_BORDE)
        c.setLineWidth(0.5)
        c.roundRect(margin, y_qr - box_h + 0.3*cm, content_w, box_h, 3, fill=False)

        # QR
        qr_x = margin + 0.4*cm
        qr_y = y_qr - qr_size + 0.1*cm
        qr_widget = qr_module.QrCodeWidget(verify_url)
        qr_widget.barWidth  = qr_size
        qr_widget.barHeight = qr_size
        d = Drawing(qr_size, qr_size)
        d.add(qr_widget)
        d.drawOn(c, qr_x, qr_y)

        # Texto junto al QR
        tx = qr_x + qr_size + 0.6*cm
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(tx, y_qr - 0.2*cm, "Verificación Digital")

        c.setFillColor(GRIS)
        c.setFont("Helvetica", 7)
        c.drawString(tx, y_qr - 0.65*cm, "Escanee el código QR o ingrese al enlace:")

        c.setFillColor(AZUL_MED)
        c.setFont("Helvetica", 6.5)
        # Split URL in lines if needed
        url_max = 65
        c.drawString(tx, y_qr - 1.05*cm, verify_url[:url_max])
        if len(verify_url) > url_max:
            c.drawString(tx, y_qr - 1.4*cm, verify_url[url_max:])

        if app_number:
            c.setFillColor(AZUL_OSCURO)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(tx, y_qr - 1.85*cm, f"N° Postulación: {app_number}")

        c.setFillColor(black)
        y_qr = y_qr - box_h - 0.2*cm

    # ═══════════════════════════════════════════════════════════
    # FIRMAS
    # ═══════════════════════════════════════════════════════════
    y_firma = 3.2*cm
    left_cx = margin + 3*cm        # centro firma izquierda
    right_cx = pw - margin - 3*cm  # centro firma derecha

    # Firma postulante (izquierda)
    c.setStrokeColor(AZUL_OSCURO)
    c.setLineWidth(0.7)
    c.line(left_cx - 3*cm, y_firma, left_cx + 3*cm, y_firma)

    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7)
    c.drawCentredString(left_cx, y_firma - 0.3*cm, "Firma del Postulante")
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawCentredString(left_cx, y_firma - 0.6*cm, full_name)
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7)
    c.drawCentredString(left_cx, y_firma - 0.9*cm, f"DNI: {dni}")

    # Fecha (centrada arriba de firma derecha)
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(right_cx, y_firma + 1.6*cm, fecha_doc)

    # Firma director image
    firma_path = _resolve_img(inst.get("firma_director_path", ""))
    if firma_path:
        try:
            c.drawImage(firma_path, right_cx - 2*cm, y_firma + 0.1*cm,
                        width=4*cm, height=1.3*cm,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    # Sello
    sello_path = _resolve_img(inst.get("sello_path", ""))
    if sello_path:
        try:
            c.drawImage(sello_path, right_cx + 1*cm, y_firma - 0.5*cm,
                        width=2*cm, height=2*cm,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    c.setStrokeColor(AZUL_OSCURO)
    c.setLineWidth(0.7)
    c.line(right_cx - 3*cm, y_firma, right_cx + 3*cm, y_firma)

    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7)
    c.drawCentredString(right_cx, y_firma - 0.3*cm, director_title)
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawCentredString(right_cx, y_firma - 0.6*cm, director_name)

    # ═══════════════════════════════════════════════════════════
    # FOOTER
    # ═══════════════════════════════════════════════════════════
    # Línea dorada decorativa
    c.setStrokeColor(ORO)
    c.setLineWidth(1)
    c.line(margin, 1.3*cm, pw - margin, 1.3*cm)

    c.setFillColor(GRIS)
    c.setFont("Helvetica", 5.5)
    c.drawCentredString(pw / 2, 0.9*cm,
        f"IESPP \"{inst_name}\" — Área de Innovación e Investigación - Informática")
    c.drawCentredString(pw / 2, 0.55*cm,
        "Documento generado electrónicamente — Válido con código QR de verificación")

    c.save()
    buf.seek(0)
    return buf.read()


def _fallback_vacante_reportlab(app, app_data: dict, inst: dict) -> bytes:
    """PDF profesional con ReportLab — Constancia de Ingreso / Vacante (A4 portrait)."""
    import os
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm, mm
    from reportlab.lib.colors import HexColor, black, white
    from reportlab.lib.utils import simpleSplit
    from reportlab.pdfgen import canvas as cv_mod

    try:
        from reportlab.graphics.barcode import qr as qr_module
        from reportlab.graphics.shapes import Drawing
        HAS_RL_QR = True
    except ImportError:
        HAS_RL_QR = False

    buf = BytesIO()
    pw, ph = A4

    # ── Paleta de colores (misma que inscripción) ──
    AZUL_OSCURO = HexColor("#0d1b3e")
    AZUL        = HexColor("#1a3a5c")
    AZUL_MED    = HexColor("#1565c0")
    AZUL_CLARO  = HexColor("#e8f0fe")
    ORO         = HexColor("#c5a44e")
    GRIS        = HexColor("#555555")
    GRIS_CLARO  = HexColor("#f7f8fa")
    GRIS_BORDE  = HexColor("#d0d5dd")
    VERDE       = HexColor("#15803d")
    VERDE_CLARO = HexColor("#dcfce7")

    mr = str(_get_media_root())
    margin = 2*cm

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
    full_name    = (app_data.get("full_name", "") or "").upper()
    especialidad = (app_data.get("especialidad", "") or "").upper()
    dni          = app_data.get("dni", "") or ""
    ciclo        = app_data.get("ciclo", "") or ""
    periodo      = app_data.get("periodo", "") or app_data.get("call_period", "")
    verify_url   = app_data.get("verify_url", "") or ""
    app_number   = app_data.get("application_number", "") or ""

    inst_name      = (inst.get("institution_name", "") or "GUSTAVO ALLENDE LLAVERÍA").strip('"').strip("'")
    city           = inst.get("city", "Tarma")
    director_name  = inst.get("director_name", "")
    director_title = (inst.get("director_title", "DIRECTOR(A) GENERAL") or "").upper()
    year_motto     = inst.get("year_motto", "") or inst.get("lema_anio", "")
    rvm            = inst.get("rvm", "")

    now  = datetime.now()
    MESES = {1:"enero",2:"febrero",3:"marzo",4:"abril",5:"mayo",6:"junio",
             7:"julio",8:"agosto",9:"septiembre",10:"octubre",11:"noviembre",12:"diciembre"}
    fecha_doc = f"{city}, {now.day} de {MESES[now.month]} del {now.year}"

    content_w = pw - 2 * margin
    c = cv_mod.Canvas(buf, pagesize=A4)

    # ═══════════════════════════════════════════════════════════
    # ENCABEZADO — franja azul oscuro + línea dorada
    # ═══════════════════════════════════════════════════════════
    header_h = 2.6*cm
    header_y = ph - header_h

    c.setFillColor(AZUL_OSCURO)
    c.rect(0, header_y, pw, header_h, fill=True, stroke=False)
    c.setFillColor(ORO)
    c.rect(0, header_y, pw, 2, fill=True, stroke=False)

    # Logo
    logo_path = _resolve_img(inst.get("logo_path", ""))
    logo_w = 1.8*cm
    logo_h = 1.8*cm
    if logo_path:
        try:
            c.drawImage(logo_path, margin, header_y + (header_h - logo_h)/2,
                        width=logo_w, height=logo_h,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    text_x = margin + logo_w + 0.6*cm
    c.setFillColor(white)
    c.setFont("Helvetica", 7.5)
    c.drawString(text_x, header_y + header_h - 0.7*cm, "MINISTERIO DE EDUCACIÓN")
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(text_x, header_y + header_h - 1.2*cm,
                 "INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO")
    c.setFont("Helvetica", 8)
    c.drawString(text_x, header_y + header_h - 1.7*cm, f'"{inst_name}"')

    if rvm:
        c.setFillColor(ORO)
        c.setFont("Helvetica", 6)
        c.drawRightString(pw - margin, header_y + header_h - 0.7*cm, rvm)

    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(pw - margin, header_y + header_h - 1.2*cm, "ADMISIÓN")

    # ═══════════════════════════════════════════════════════════
    # LEMA DEL AÑO (si existe)
    # ═══════════════════════════════════════════════════════════
    y = header_y - 0.8*cm
    if year_motto:
        c.setFillColor(GRIS)
        c.setFont("Helvetica-Oblique", 8)
        c.drawCentredString(pw/2, y, f'"{year_motto}"')
        y -= 0.7*cm
    else:
        y -= 0.2*cm

    # ═══════════════════════════════════════════════════════════
    # LOGO CENTRADO
    # ═══════════════════════════════════════════════════════════
    if logo_path:
        try:
            cl_w = 2*cm
            cl_h = 2*cm
            c.drawImage(logo_path, (pw - cl_w)/2, y - cl_h,
                        width=cl_w, height=cl_h,
                        preserveAspectRatio=True, mask="auto")
            y -= cl_h + 0.4*cm
        except Exception:
            y -= 0.2*cm
    else:
        y -= 0.2*cm

    # ═══════════════════════════════════════════════════════════
    # TÍTULO
    # ═══════════════════════════════════════════════════════════
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 16)
    title_text = "CONSTANCIA DE INGRESO"
    tw = c.stringWidth(title_text, "Helvetica-Bold", 16)
    tx = (pw - tw) / 2
    c.drawString(tx, y, title_text)

    c.setStrokeColor(ORO)
    c.setLineWidth(2)
    c.line(tx, y - 4, tx + tw, y - 4)
    c.setLineWidth(0.5)
    c.line(tx + tw*0.15, y - 8, tx + tw*0.85, y - 8)

    if app_number:
        c.setFillColor(GRIS)
        c.setFont("Helvetica", 8)
        c.drawCentredString(pw/2, y - 18, f"N° de Postulación: {app_number}")
        y -= 1.4*cm
    else:
        y -= 1.0*cm

    # ═══════════════════════════════════════════════════════════
    # ENCABEZADO FORMAL
    # ═══════════════════════════════════════════════════════════
    header_text = (
        f"LA {director_title} DEL INSTITUTO DE EDUCACIÓN SUPERIOR "
        f'PEDAGÓGICO PÚBLICO "{inst_name}" de {city}, a través de '
        f"Secretaría Académica hace constar:"
    )
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 9.5)
    lines = simpleSplit(header_text, "Helvetica-Bold", 9.5, content_w)
    for line in lines:
        c.drawString(margin, y, line)
        y -= 0.42*cm
    y -= 0.4*cm

    # ═══════════════════════════════════════════════════════════
    # CUERPO
    # ═══════════════════════════════════════════════════════════
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
    c.setFillColor(black)
    c.setFont("Helvetica", 10)
    lines = simpleSplit(body_text, "Helvetica", 10, content_w)
    for line in lines:
        c.drawString(margin, y, line)
        y -= 0.42*cm
    y -= 0.3*cm

    body2 = (
        "Se expide la presente a solicitud del(la) interesado(a) para los fines "
        "que estime por conveniente."
    )
    lines = simpleSplit(body2, "Helvetica", 10, content_w)
    for line in lines:
        c.drawString(margin, y, line)
        y -= 0.42*cm
    y -= 0.4*cm

    # ═══════════════════════════════════════════════════════════
    # REQUISITOS — con caja azul clara
    # ═══════════════════════════════════════════════════════════
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

    # Medir altura de la caja
    req_line_h = 0.38*cm
    total_req_h = len(REQUISITOS) * req_line_h + 0.9*cm
    box_y = y - total_req_h

    # Fondo de la caja
    c.setFillColor(AZUL_CLARO)
    c.roundRect(margin, box_y, content_w, total_req_h, 4, fill=True, stroke=False)
    c.setStrokeColor(GRIS_BORDE)
    c.setLineWidth(0.5)
    c.roundRect(margin, box_y, content_w, total_req_h, 4, fill=False)

    # Título requisitos
    c.setFillColor(AZUL)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(margin + 0.5*cm, y - 0.45*cm, "REQUISITOS:")

    # Items
    c.setFont("Helvetica", 8.5)
    ry = y - 0.9*cm
    for req in REQUISITOS:
        c.setFillColor(AZUL_MED)
        c.circle(margin + 0.7*cm, ry + 0.08*cm, 1.5, fill=True, stroke=False)
        c.setFillColor(AZUL_OSCURO)
        c.drawString(margin + 1.1*cm, ry, req)
        ry -= req_line_h

    y = box_y - 0.3*cm

    # Nota folder
    c.setFillColor(GRIS)
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(margin, y,
        "Presentar la documentación en un folder manila tamaño A4 por mesa de partes.")
    y -= 0.7*cm

    # ═══════════════════════════════════════════════════════════
    # QR DE VERIFICACIÓN (si hay URL)
    # ═══════════════════════════════════════════════════════════
    if verify_url and HAS_RL_QR:
        qr_size = 1.8*cm
        box_h = qr_size + 0.4*cm

        c.setFillColor(GRIS_CLARO)
        c.roundRect(margin, y - box_h, content_w, box_h, 3, fill=True, stroke=False)
        c.setStrokeColor(GRIS_BORDE)
        c.setLineWidth(0.5)
        c.roundRect(margin, y - box_h, content_w, box_h, 3, fill=False)

        qr_widget = qr_module.QrCodeWidget(verify_url)
        qr_widget.barWidth  = qr_size
        qr_widget.barHeight = qr_size
        d = Drawing(qr_size, qr_size)
        d.add(qr_widget)
        d.drawOn(c, margin + 0.3*cm, y - qr_size - 0.1*cm)

        tx = margin + 0.3*cm + qr_size + 0.5*cm
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(tx, y - 0.3*cm, "Verificación Digital")
        c.setFillColor(GRIS)
        c.setFont("Helvetica", 6.5)
        c.drawString(tx, y - 0.65*cm, "Escanee el QR o ingrese al enlace:")
        c.setFillColor(AZUL_MED)
        c.setFont("Helvetica", 6)
        c.drawString(tx, y - 0.95*cm, verify_url[:70])
        c.setFillColor(black)

        y = y - box_h - 0.3*cm

    # ═══════════════════════════════════════════════════════════
    # FECHA
    # ═══════════════════════════════════════════════════════════
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(pw/2, y, fecha_doc)

    # ═══════════════════════════════════════════════════════════
    # FIRMA
    # ═══════════════════════════════════════════════════════════
    y_firma = y - 1.5*cm

    firma_path = _resolve_img(inst.get("firma_director_path", ""))
    if firma_path:
        try:
            c.drawImage(firma_path, (pw - 4*cm)/2, y_firma + 0.1*cm,
                        width=4*cm, height=1.3*cm,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    sello_path = _resolve_img(inst.get("sello_path", ""))
    if sello_path:
        try:
            c.drawImage(sello_path, pw/2 + 3.5*cm, y_firma - 0.5*cm,
                        width=2*cm, height=2*cm,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    c.setStrokeColor(AZUL_OSCURO)
    c.setLineWidth(0.7)
    line_w = 6*cm
    c.line((pw - line_w)/2, y_firma, (pw + line_w)/2, y_firma)

    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7)
    c.drawCentredString(pw/2, y_firma - 0.3*cm, director_title)
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(pw/2, y_firma - 0.6*cm, director_name)
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7)
    c.drawCentredString(pw/2, y_firma - 0.9*cm, f'I.E.S.P.P. "{inst_name}"')

    # ═══════════════════════════════════════════════════════════
    # FOOTER
    # ═══════════════════════════════════════════════════════════
    c.setStrokeColor(ORO)
    c.setLineWidth(1)
    c.line(margin, 1.3*cm, pw - margin, 1.3*cm)

    c.setFillColor(GRIS)
    c.setFont("Helvetica", 5.5)
    c.drawCentredString(pw/2, 0.9*cm,
        f'IESPP "{inst_name}" — Área de Innovación e Investigación - Informática')
    c.drawCentredString(pw/2, 0.55*cm,
        "Documento generado electrónicamente — Válido con código QR de verificación")

    c.save()
    buf.seek(0)
    return buf.read()