"""
Funciones auxiliares y helpers para el módulo de admisión
"""
import os
from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.response import Response


# ══════════════════════════════════════════════════════════════
# HELPERS DE VALIDACIÓN
# ══════════════════════════════════════════════════════════════

def _has_field(model, name: str) -> bool:
    """Verifica si un modelo tiene un campo específico"""
    try:
        model._meta.get_field(name)
        return True
    except Exception:
        return False


def _to_float(v, default=0.0):
    """Convierte a float de forma segura"""
    try:
        if v is None or v == "":
            return float(default)
        return float(str(v).replace(",", "."))
    except Exception:
        return float(default)


# ══════════════════════════════════════════════════════════════
# HELPERS DE EVALUACIÓN
# ══════════════════════════════════════════════════════════════

def _normalize_rubric(payload: dict):
    """
    Acepta cualquier llave, convierte valores numéricos.
    Mantiene strings si no son números.
    """
    out = {}
    for k, v in (payload or {}).items():
        if isinstance(v, (int, float)) or (
            isinstance(v, str)
            and v.strip().replace(",", ".").replace(".", "", 1).isdigit()
        ):
            out[k] = _to_float(v, 0)
        else:
            out[k] = v
    return out


def _compute_total(rubric: dict):
    """Suma de campos numéricos en una rúbrica"""
    total = 0.0
    for v in (rubric or {}).values():
        if isinstance(v, (int, float)):
            total += float(v)
    return round(total, 2)


# Campos de cada fase
_FASE1_KEYS = {"comunicacion", "resolucion_problemas", "convivencia"}
_FASE2_KEYS = {"pensamiento_critico", "trabajo_colaborativo", "tic"}


def compute_phase_totals(written_score, interview_score):
    """
    Calcula totales de F1 y F2 de forma inteligente.
    Si solo hay un score WRITTEN que contiene campos de ambas fases,
    extrae los subtotales correctamente.
    """
    phase1_total = 0.0
    phase2_total = 0.0

    if written_score:
        rubric = written_score.rubric or {}
        # Extraer campos de F1 del rubric
        for k in _FASE1_KEYS:
            phase1_total += _to_float(rubric.get(k, 0))
        # Si el score WRITTEN también tiene campos de F2 (legacy)
        has_f2_in_written = any(k in rubric for k in _FASE2_KEYS)
        if has_f2_in_written and not interview_score:
            for k in _FASE2_KEYS:
                phase2_total += _to_float(rubric.get(k, 0))
        elif not any(k in rubric for k in _FASE1_KEYS):
            # Fallback: el total del score es la fase 1
            phase1_total = _to_float(written_score.total)

    if interview_score:
        rubric = interview_score.rubric or {}
        phase2_total = 0.0
        for k in _FASE2_KEYS:
            phase2_total += _to_float(rubric.get(k, 0))
        if phase2_total == 0:
            phase2_total = _to_float(interview_score.total)

    return round(phase1_total, 2), round(phase2_total, 2)


# ══════════════════════════════════════════════════════════════
# HELPERS DE ARCHIVOS Y PDF
# ══════════════════════════════════════════════════════════════

def _ensure_media_tmp():
    """Crea y retorna el directorio temporal de media"""
    tmpdir = os.path.join(settings.MEDIA_ROOT, "tmp")
    os.makedirs(tmpdir, exist_ok=True)
    return tmpdir


def _write_stub_pdf(abs_path: str, title="Documento", subtitle=""):
    """Genera un PDF simple (stub) para testing"""
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4

        c = canvas.Canvas(abs_path, pagesize=A4)
        w, h = A4
        c.setFont("Helvetica-Bold", 16)
        c.drawString(72, h - 72, title)
        c.setFont("Helvetica", 12)
        if subtitle:
            c.drawString(72, h - 100, subtitle)
        c.drawString(72, h - 130, "Generado automáticamente.")
        c.showPage()
        c.save()
    except Exception:
        minimal_pdf = (
            b"%PDF-1.4\n"
            b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n"
            b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n"
            b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"
            b"4 0 obj<< /Length 62 >>stream\n"
            b"BT /F1 18 Tf 72 720 Td (Documento) Tj ET\n"
            b"endstream\nendobj\n"
            b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n"
            b"xref\n0 6\n"
            b"0000000000 65535 f\n0000000010 00000 n\n0000000061 00000 n\n"
            b"0000000116 00000 n\n0000000236 00000 n\n0000000404 00000 n\n"
            b"trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n500\n%%EOF\n"
        )
        with open(abs_path, "wb") as f:
            f.write(minimal_pdf)


# ══════════════════════════════════════════════════════════════
# HELPERS DE FECHAS
# ══════════════════════════════════════════════════════════════

def _parse_dt(v):
    """Acepta ISO con Z o sin Z; devuelve aware datetime o None"""
    if not v:
        return None
    if isinstance(v, str):
        s = v.strip()
        if s.endswith("Z"):
            s = s.replace("Z", "+00:00")
        dt = parse_datetime(s)
        if dt and timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return dt
    return None


# Mapeo de códigos viejos → nuevos para documentos requeridos
_LEGACY_DOC_MAP = {
    "PHOTO": "FOTO_CARNET",
    "DNI_COPY": "COPIA_DNI",
    "BIRTH_CERTIFICATE": "PARTIDA_NACIMIENTO",
    "STUDY_CERTIFICATE": "CERTIFICADO_ESTUDIOS",
    "CONADIS_COPY": "CARNET_CONADIS",
}


def _migrate_doc_codes(codes):
    """Convierte códigos viejos a nuevos y elimina duplicados."""
    if not codes or not isinstance(codes, list):
        return []
    seen = set()
    result = []
    for c in codes:
        migrated = _LEGACY_DOC_MAP.get(c, c)
        if migrated not in seen:
            seen.add(migrated)
            result.append(migrated)
    return result


def _is_active_call(call) -> bool:
    """
    Verifica si una convocatoria está activa.
    Activa = dentro del rango de inscripción y no cerrada.

    FIX: el fallback anterior (published is False → activa) era
    contraintuitivo. Ahora: sin fechas = NO activa (más seguro).
    """
    m = call.meta or {}

    # Si fue cerrada explícitamente
    if m.get("closed") is True:
        return False

    now = timezone.now()
    rs = _parse_dt(m.get("registration_start"))
    re = _parse_dt(m.get("registration_end"))

    if rs and re:
        return rs <= now <= re

    # Sin fechas = no activa (antes devolvía `not published`, lo cual era confuso)
    return False


# ══════════════════════════════════════════════════════════════
# MAPEO FE <-> MODEL
# ══════════════════════════════════════════════════════════════

def _fe_to_call(payload: dict) -> dict:
    """
    Convierte payload del frontend al formato del modelo AdmissionCall.

    FIX: career_vacancies viene con keys string desde JS ({"5": 30}).
    Ahora convertimos a str para hacer el lookup consistente.
    """
    year = payload.get("academic_year")
    period = payload.get("academic_period")

    careers = payload.get("careers") or []
    if not careers:
        ids = payload.get("available_careers") or []
        vacs = payload.get("career_vacancies") or {}
        careers = []
        for cid in ids:
            # FIX: JS envía keys como string, así que probamos ambas formas
            v = vacs.get(str(cid), vacs.get(cid, 0))
            careers.append({"career_id": cid, "vacancies": v})

    # Enriquecer careers con nombres reales del catálogo
    from catalogs.models import Career as CareerModel

    career_ids = []
    for c in careers:
        cid = c.get("career_id") or c.get("id")
        if cid:
            career_ids.append(int(cid))

    if career_ids:
        name_map = dict(
            CareerModel.objects.filter(id__in=career_ids).values_list("id", "name")
        )
        for c in careers:
            cid = c.get("career_id") or c.get("id")
            if cid and not c.get("name"):
                c["name"] = name_map.get(int(cid), f"Carrera {cid}")

    vac_total = 0
    for c in careers:
        try:
            vac_total += int(c.get("vacancies") or 0)
        except Exception:
            pass

    published = bool(payload.get("published", False))

    meta = {
        "description": payload.get("description", "") or "",
        "academic_year": year,
        "academic_period": period,
        "registration_start": payload.get("registration_start"),
        "registration_end": payload.get("registration_end"),
        "exam_date": payload.get("exam_date"),
        "results_date": payload.get("results_date"),
        "application_fee": payload.get("application_fee"),
        "max_applications_per_career": payload.get("max_applications_per_career"),
        "minimum_age": payload.get("minimum_age"),
        "maximum_age": payload.get("maximum_age"),
        "required_documents": payload.get("required_documents") or [],
        "careers": careers,
        "status": payload.get("status"),
    }

    return {
        "title": payload.get("name") or payload.get("title") or "Convocatoria",
        "period": f"{year}-{period}" if year and period else (payload.get("period") or ""),
        "published": published,
        "vacants_total": vac_total,
        "meta": meta,
    }


def _call_to_fe(obj, career_name_map=None) -> dict:
    """
    Convierte modelo AdmissionCall al formato del frontend.

    FIX: Ahora acepta un career_name_map opcional para evitar N+1 queries.
    Si no se pasa, hace la query una sola vez (pero se recomienda pasarlo
    cuando se serializa una lista).
    """
    from catalogs.models import Career as CareerModel

    m = obj.meta or {}
    careers_raw = m.get("careers") or []

    # Construir mapa de nombres solo si no viene precargado
    if career_name_map is None:
        career_ids = []
        for it in careers_raw:
            cid = it.get("career_id") or it.get("id")
            if cid:
                career_ids.append(int(cid))
        if career_ids:
            career_name_map = dict(
                CareerModel.objects.filter(id__in=career_ids).values_list("id", "name")
            )
        else:
            career_name_map = {}

    norm_careers = []
    for it in careers_raw:
        cid = it.get("career_id") or it.get("id")
        if not cid:
            continue
        cid_int = int(cid)
        name = (
            it.get("name")
            or it.get("career_name")
            or career_name_map.get(cid_int, f"Carrera {cid}")
        )
        vac = it.get("vacancies") or it.get("quota") or it.get("slots") or 0
        try:
            vac = int(vac)
        except Exception:
            vac = 0
        norm_careers.append({
            "id": cid_int,
            "career_id": cid_int,
            "name": name,
            "vacancies": vac,
        })

    apps_count = getattr(obj, "applications_count", 0)

    status = "OPEN" if _is_active_call(obj) else ("PUBLISHED" if obj.published else "CLOSED")

    return {
        "id": obj.id,
        "name": obj.title,
        "description": m.get("description", ""),
        "academic_year": m.get("academic_year"),
        "academic_period": m.get("academic_period"),
        "registration_start": m.get("registration_start"),
        "registration_end": m.get("registration_end"),
        "exam_date": m.get("exam_date"),
        "results_date": m.get("results_date"),
        "application_fee": m.get("application_fee", 0),
        "max_applications_per_career": m.get("max_applications_per_career", 1),
        "minimum_age": m.get("minimum_age"),
        "maximum_age": m.get("maximum_age"),
        "required_documents": _migrate_doc_codes(m.get("required_documents", [])),
        "careers": norm_careers,
        "total_applications": apps_count,
        "status": status,
    }


def _calls_to_fe_list(queryset) -> list:
    """
    FIX: Serializa una lista de convocatorias con un solo query de carreras
    en vez de uno por cada convocatoria (soluciona N+1).
    """
    from catalogs.models import Career as CareerModel

    # Recolectar todos los career_ids de todas las convocatorias
    all_career_ids = set()
    for obj in queryset:
        m = obj.meta or {}
        for it in (m.get("careers") or []):
            cid = it.get("career_id") or it.get("id")
            if cid:
                all_career_ids.add(int(cid))

    # Una sola query para todos los nombres
    if all_career_ids:
        career_name_map = dict(
            CareerModel.objects.filter(id__in=all_career_ids).values_list("id", "name")
        )
    else:
        career_name_map = {}

    return [_call_to_fe(obj, career_name_map=career_name_map) for obj in queryset]