# mesa_partes/views.py
import os
import uuid
import datetime as dt
import io
import csv

from django.conf import settings
from django.db.models import F, Count, Avg, ExpressionWrapper, DurationField
from django.db.models.functions import TruncDate
from django.utils.dateparse import parse_date
from django.utils import timezone
from django.http import HttpResponse

from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

# ReportLab
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Table, TableStyle,
    Spacer, HRFlowable, Image,
)
from reportlab.graphics.barcode import qr as qr_module
from reportlab.graphics.shapes import Drawing

from .models import Office, ProcedureType, Procedure, ProcedureEvent, ProcedureFile
from .serializers import (
    OfficeSer, ProcedureTypeSer, ProcedureSer,
    ProcedureEventSer, ProcedureFileSer,
)

# ── Colores institucionales ──────────────────────────────────────────
C_SECTION   = HexColor("#1e40af")
C_TABLE_H   = HexColor("#dbeafe")
C_BORDER    = HexColor("#cbd5e1")
C_ACCENT    = HexColor("#1d4ed8")
C_DARK      = HexColor("#1e293b")
C_MUTED     = HexColor("#64748b")
C_ROW_ALT   = HexColor("#f8fafc")
C_GREEN_BG  = HexColor("#dcfce7")
C_GREEN_TXT = HexColor("#15803d")
C_AMBER_BG  = HexColor("#fef3c7")
C_AMBER_BD  = HexColor("#f59e0b")
C_AMBER_TXT = HexColor("#92400e")


def _track_code():
    return f"MP-{dt.datetime.now():%Y}-{uuid.uuid4().hex[:6].upper()}"


# ── Helpers PDF ──────────────────────────────────────────────────────

def _get_institution_data():
    defaults = {
        "name":      "IESPP \"GUSTAVO ALLENDE LLAVERÍA\"",
        "short_name":"IESPP GAL",
        "address":   "Tarma · Junín · Perú",
        "logo_path": None,
    }
    try:
        from catalogs.models import InstitutionSetting
        obj = InstitutionSetting.objects.filter(pk=1).first()
        if not obj or not obj.data:
            return defaults
        d = obj.data
        name       = d.get("name") or d.get("institution_name") or defaults["name"]
        short_name = d.get("short_name") or defaults["short_name"]
        address    = d.get("address") or d.get("city") or defaults["address"]
        logo_path  = None
        logo_url   = d.get("logo_url") or ""
        if logo_url:
            if "/media/" in logo_url:
                rel = logo_url.split("/media/")[-1]
                candidate = os.path.join(settings.MEDIA_ROOT, rel)
                if os.path.exists(candidate):
                    logo_path = candidate
            elif logo_url.startswith("/"):
                candidate = os.path.join(
                    settings.BASE_DIR if hasattr(settings, "BASE_DIR") else "",
                    logo_url.lstrip("/"),
                )
                if os.path.exists(candidate):
                    logo_path = candidate
        return {"name": name, "short_name": short_name, "address": address, "logo_path": logo_path}
    except Exception:
        return defaults


def _make_qr(url: str, size_cm: float = 3.2) -> Drawing:
    size = size_cm * cm
    qr_widget = qr_module.QrCodeWidget(url)
    qr_widget.barWidth  = size
    qr_widget.barHeight = size
    qr_widget.qrVersion = 1
    d = Drawing(size, size)
    d.add(qr_widget)
    return d


def _tracking_url(tracking_code: str, request=None) -> str:
    path = f"/public/procedures/track/{tracking_code}"
    if request is not None:
        try:
            return request.build_absolute_uri(path)
        except Exception:
            pass
    base = getattr(settings, "SITE_URL", "https://academico.iesppallende.edu.pe")
    return f"{base}{path}"


def _style(name, parent_styles, **kw):
    return ParagraphStyle(name, parent=parent_styles["Normal"], **kw)


def _section_header(label, page_w, s_sec):
    t = Table([[Paragraph(label, s_sec)]], colWidths=[page_w])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), C_SECTION),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
    ]))
    return t


def _data_table(rows, page_w, s_label, s_value, col1_w=5.5):
    w1 = col1_w * cm
    w2 = page_w - w1
    data = [
        [Paragraph(str(k), s_label), Paragraph(str(v) if v else "—", s_value)]
        for k, v in rows
    ]
    t = Table(data, colWidths=[w1, w2])
    ts = TableStyle([
        ("GRID",         (0, 0), (-1, -1), 0.4, C_BORDER),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
    ])
    for i in range(len(data)):
        if i % 2 == 1:
            ts.add("BACKGROUND", (0, i), (-1, i), C_ROW_ALT)
    t.setStyle(ts)
    return t


# ════════════════════════════════════════════════════════════════════
#   CARGO DE RECEPCIÓN  (modelo MINEDU)
# ════════════════════════════════════════════════════════════════════

def _build_cargo_pdf(p: Procedure, request=None) -> bytes:
    buf    = io.BytesIO()
    PAGE_W = A4[0] - 3.6 * cm

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=1.8 * cm, leftMargin=1.8 * cm,
        topMargin=1.8 * cm,   bottomMargin=1.8 * cm,
    )
    styles = getSampleStyleSheet()

    def st(name, **kw):
        return _style(name, styles, **kw)

    s_inst   = st("inst",   fontSize=8,    textColor=C_MUTED,     alignment=TA_CENTER, leading=11)
    s_title  = st("title",  fontSize=16,   textColor=C_DARK,      fontName="Helvetica-Bold", alignment=TA_CENTER)
    s_code   = st("code",   fontSize=9,    textColor=C_MUTED,     alignment=TA_RIGHT)
    s_intro  = st("intro",  fontSize=9,    textColor=C_DARK,      leading=13, spaceAfter=2)
    s_sec    = st("sec",    fontSize=8,    textColor=white,       fontName="Helvetica-Bold", alignment=TA_CENTER)
    s_label  = st("label",  fontSize=8,    textColor=C_MUTED)
    s_value  = st("value",  fontSize=8.5,  textColor=C_DARK,      fontName="Helvetica-Bold")
    s_small  = st("small",  fontSize=7.5,  textColor=C_DARK,      leading=11)
    s_track  = st("track",  fontSize=22,   textColor=C_ACCENT,    fontName="Helvetica-Bold", alignment=TA_CENTER)
    s_status = st("status", fontSize=9,    textColor=C_GREEN_TXT, fontName="Helvetica-Bold", alignment=TA_CENTER)
    s_note   = st("note",   fontSize=7.5,  textColor=C_AMBER_TXT, leading=11)
    s_footer = st("footer", fontSize=7,    textColor=C_MUTED,     alignment=TA_CENTER)

    inst       = _get_institution_data()
    now_str    = (p.created_at or dt.datetime.now(tz=timezone.utc)).strftime("%d/%m/%Y %H:%M:%S")
    type_name  = getattr(p.procedure_type, "name", "—") if p.procedure_type else "—"
    office_nm  = getattr(p.current_office, "name", "MESA DE PARTES") if p.current_office else "MESA DE PARTES"
    asunto     = (p.description or "—").strip() or "—"
    doc_num    = p.applicant_document or "—"
    file_count = p.files.count() if hasattr(p, "files") else 0
    # ── Nuevos campos ──
    num_folios  = getattr(p, "num_folios", None)
    canal_map   = {"VIRTUAL": "Mesa de Partes Virtual", "PRESENCIAL": "Mesa de Partes Presencial",
                   "EMAIL": "Correo Electrónico", "FAXSIMIL": "Fax / Facsímil"}
    canal_lbl   = canal_map.get(getattr(p, "canal_ingreso", ""), "—")
    urgency_map = {"LOW": "Baja", "NORMAL": "Normal", "HIGH": "Alta", "URGENT": "Urgente"}
    urgency_lbl = urgency_map.get(getattr(p, "urgency_level", ""), "Normal")

    status_map = {
        "RECEIVED": "Recibido", "IN_REVIEW": "En Revisión",
        "APPROVED": "Aprobado", "REJECTED": "Rechazado", "COMPLETED": "Completado",
    }
    status_lbl = status_map.get(p.status, p.status or "—")
    track_url  = _tracking_url(p.tracking_code, request)

    story = []

    # 1. CABECERA
    logo_cell = ""
    if inst["logo_path"]:
        try:
            logo_img = Image(inst["logo_path"], width=1.8 * cm, height=1.8 * cm, kind="proportional")
            logo_cell = Table(
                [[logo_img, Paragraph(
                    f'<b>{inst["name"]}</b><br/>'
                    f'<font size="7" color="#64748b">{inst["address"]}</font>',
                    st("inst_name", fontSize=8, textColor=C_DARK, leading=11),
                )]],
                colWidths=[2.0 * cm, PAGE_W * 0.55 - 2.0 * cm],
            )
            logo_cell.setStyle(TableStyle([
                ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING",   (0, 0), (-1, -1), 0),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
                ("TOPPADDING",    (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]))
        except Exception:
            logo_cell = Paragraph(
                f'<b>{inst["name"]}</b><br/><font size="7">{inst["address"]}</font>', s_inst)
    else:
        logo_cell = Paragraph(
            f'<b>{inst["name"]}</b><br/><font size="7">{inst["address"]}</font>', s_inst)

    hdr = Table(
        [[logo_cell, Paragraph(f'Expediente: <b>{p.tracking_code}</b>', s_code)]],
        colWidths=[PAGE_W * 0.65, PAGE_W * 0.35],
    )
    hdr.setStyle(TableStyle([
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW",    (0, 0), (-1, -1), 1, C_ACCENT),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
    ]))
    story.append(hdr)
    story.append(Spacer(1, 10))

    # 2. Título
    story.append(Paragraph("Constancia de recepción", s_title))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width=PAGE_W, thickness=1.5, color=C_ACCENT))
    story.append(Spacer(1, 10))

    # 3. Saludo
    story.append(Paragraph(
        f"Estimado(a) ciudadano(a) <b>{p.applicant_name}</b>,", s_intro))
    story.append(Paragraph(
        f"Le comunicamos que su expediente N° <b>{p.tracking_code}</b> ha sido registrado "
        "satisfactoriamente con los siguientes datos:", s_intro))
    story.append(Spacer(1, 10))

    # 4. DATOS DEL SOLICITANTE
    story.append(_section_header("DATOS DEL SOLICITANTE", PAGE_W, s_sec))
    story.append(_data_table([
        ("Nombres y Apellidos", p.applicant_name),
        ("Número de Documento", doc_num),
        ("Correo Electrónico",  p.applicant_email or "—"),
        ("Celular",             p.applicant_phone or "—"),
    ], PAGE_W, s_label, s_value))
    story.append(Spacer(1, 8))

    # 5. DATOS DEL EXPEDIENTE
    story.append(_section_header("DATOS DEL EXPEDIENTE", PAGE_W, s_sec))
    story.append(_data_table([
        ("N° Expediente",            p.tracking_code),
        ("Fecha y hora de registro", now_str),
        ("Tipo de trámite",          type_name),
        ("Canal de ingreso",         canal_lbl),
        ("N° de folios / archivos",  f"{num_folios or '—'} folios / {file_count} archivo(s) digital(es)"),
        ("Entidad",                  inst["name"]),
        ("Oficina que recibe",       office_nm),
        ("Asunto",                   asunto),
        ("Nivel de urgencia",        urgency_lbl),
        ("Medio de notificación",    "BUZÓN ELECTRÓNICO"),
        ("Estado",                   status_lbl),
    ], PAGE_W, s_label, s_value))
    story.append(Spacer(1, 8))

    # 6. SEGUIMIENTO
    story.append(_section_header("SEGUIMIENTO DEL EXPEDIENTE", PAGE_W, s_sec))
    qr_size  = 3.2 * cm
    left_w   = PAGE_W - qr_size - 0.2 * cm
    seg_left = Paragraph(
        f'Ingresar al siguiente enlace (Opción 1):<br/>'
        f'<font color="#1d4ed8"><u>{track_url}</u></font><br/><br/>'
        f'Consignando el código de seguimiento:<br/><br/>'
        f'<b>Código:</b> {p.tracking_code}',
        s_small,
    )
    seg_right_label = Paragraph(
        "Utilizar este QR<br/>(Opción 2):",
        st("qrlbl", fontSize=7.5, textColor=C_MUTED, alignment=TA_CENTER),
    )
    qr_drawing = _make_qr(track_url, size_cm=3.2)
    qr_cell = Table([[seg_right_label], [qr_drawing]], colWidths=[qr_size])
    qr_cell.setStyle(TableStyle([
        ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",   (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 2),
    ]))
    seg_table = Table([[seg_left, qr_cell]], colWidths=[left_w, qr_size])
    seg_table.setStyle(TableStyle([
        ("GRID",          (0, 0), (-1, -1), 0.4, C_BORDER),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    story.append(seg_table)
    story.append(Spacer(1, 8))

    # Código grande
    track_t = Table([[Paragraph(p.tracking_code, s_track)]], colWidths=[PAGE_W])
    track_t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), C_TABLE_H),
        ("TOPPADDING",   (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 12),
    ]))
    story.append(track_t)
    story.append(Spacer(1, 6))

    # Badge de estado
    status_t = Table([[Paragraph(f"Estado actual: {status_lbl}", s_status)]], colWidths=[PAGE_W])
    status_t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), C_GREEN_BG),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LINEABOVE",    (0, 0), (-1, 0), 0.8, HexColor("#86efac")),
        ("LINEBELOW",    (0,-1), (-1,-1), 0.8, HexColor("#86efac")),
    ]))
    story.append(status_t)
    story.append(Spacer(1, 14))

    # 7. NOTA IMPORTANTE
    note_t = Table([[Paragraph(
        "<b>NOTA IMPORTANTE:</b><br/>"
        "1.- La Mesa de Partes Virtual estará habilitada las veinticuatro (24) horas "
        "del día y los siete (07) días de la semana para la presentación de documentos.<br/>"
        "2.- El expediente presentado se sujeta a la verificación y eventual observación "
        "de los requisitos procedimentales, conforme a lo establecido en los artículos 124 "
        "y 136 del Texto Único Ordenado de la Ley N° 27444, Ley del Procedimiento "
        "Administrativo General.",
        s_note,
    )]], colWidths=[PAGE_W])
    note_t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), C_AMBER_BG),
        ("LINEABOVE",    (0, 0), (-1,  0), 1, C_AMBER_BD),
        ("LINEBELOW",    (0,-1), (-1, -1), 1, C_AMBER_BD),
        ("LINEBEFORE",   (0, 0), ( 0,-1), 3, C_AMBER_BD),
        ("TOPPADDING",   (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
        ("LEFTPADDING",  (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(note_t)
    story.append(Spacer(1, 18))

    # 8. Firma
    story.append(Paragraph("Atentamente,", s_intro))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f'<b>{inst["name"]}</b>',
        ParagraphStyle("firma", parent=styles["Normal"], fontSize=9,
                       textColor=C_DARK, fontName="Helvetica-Bold", leading=13),
    ))
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width=PAGE_W, thickness=0.5, color=C_BORDER))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"Documento generado automáticamente el "
        f"{dt.datetime.now().strftime('%d/%m/%Y %H:%M:%S')} — "
        f"{inst['name']} · Mesa de Partes Virtual",
        s_footer,
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ════════════════════════════════════════════════════════════════════
#   CARÁTULA (uso interno)
# ════════════════════════════════════════════════════════════════════

def _build_cover_pdf(p: Procedure, request=None) -> bytes:
    """PDF profesional — Carátula de Expediente (diseño institucional)."""
    from reportlab.pdfgen import canvas as cv_mod

    buf = io.BytesIO()
    pw, ph = A4  # 595.27 × 841.89 pts

    # ── Paleta profesional ──
    AZUL_OSCURO = HexColor("#0d1b3e")
    AZUL        = HexColor("#1a3a5c")
    AZUL_MED    = HexColor("#1565c0")
    AZUL_CLARO  = HexColor("#e8f0fe")
    ORO         = HexColor("#c5a44e")
    GRIS        = HexColor("#555555")
    GRIS_CLARO  = HexColor("#f7f8fa")
    GRIS_BORDE  = HexColor("#d0d5dd")

    margin   = 2 * cm
    content_w = pw - 2 * margin

    # ── Datos del trámite ──
    inst        = _get_institution_data()
    inst_name   = inst["name"]
    now_str     = (p.created_at or dt.datetime.now(tz=timezone.utc)).strftime("%d/%m/%Y %H:%M")
    type_name   = getattr(p.procedure_type, "name", "—") if p.procedure_type else "—"
    office_nm   = getattr(p.current_office, "name", "MESA DE PARTES") if p.current_office else "MESA DE PARTES"
    assignee    = (
        getattr(p.assignee, "get_full_name", lambda: None)() or
        getattr(p.assignee, "username", "—")
    ) if p.assignee else "—"
    status_map  = {
        "RECEIVED": "Recibido", "IN_REVIEW": "En Revisión",
        "APPROVED": "Aprobado", "REJECTED": "Rechazado", "COMPLETED": "Completado",
    }
    status_lbl  = status_map.get(p.status, p.status or "—")
    canal_map   = {"VIRTUAL": "Mesa de Partes Virtual", "PRESENCIAL": "Mesa de Partes Presencial",
                   "EMAIL": "Correo Electrónico", "FAXSIMIL": "Fax / Facsímil"}
    canal_lbl   = canal_map.get(getattr(p, "canal_ingreso", ""), "—")
    urgency_map = {"LOW": "Baja", "NORMAL": "Normal", "HIGH": "Alta", "URGENT": "Urgente"}
    urgency_lbl = urgency_map.get(getattr(p, "urgency_level", ""), "Normal")
    num_folios  = getattr(p, "num_folios", None)
    track_url   = _tracking_url(p.tracking_code, request)

    c = cv_mod.Canvas(buf, pagesize=A4)

    # ═══════════════════════════════════════════════════════════
    # ENCABEZADO — franja azul oscuro
    # ═══════════════════════════════════════════════════════════
    header_h = 2.6 * cm
    header_y = ph - header_h

    c.setFillColor(AZUL_OSCURO)
    c.rect(0, header_y, pw, header_h, fill=True, stroke=False)

    # Línea dorada decorativa inferior
    c.setFillColor(ORO)
    c.rect(0, header_y, pw, 2, fill=True, stroke=False)

    # Logo en el encabezado
    logo_path = inst.get("logo_path")
    logo_w = 1.8 * cm
    logo_h = 1.8 * cm
    logo_x = margin
    logo_y = header_y + (header_h - logo_h) / 2
    if logo_path and os.path.exists(logo_path):
        try:
            c.drawImage(logo_path, logo_x, logo_y, width=logo_w, height=logo_h,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    # Textos del encabezado
    text_x = logo_x + logo_w + 0.6 * cm
    c.setFillColor(white)
    c.setFont("Helvetica", 7.5)
    c.drawString(text_x, header_y + header_h - 0.7 * cm, "MINISTERIO DE EDUCACIÓN")
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(text_x, header_y + header_h - 1.2 * cm,
                 "INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO")
    c.setFont("Helvetica", 8)
    c.drawString(text_x, header_y + header_h - 1.7 * cm, f'"{inst_name}"')

    # Derecha: Mesa de Partes
    c.setFillColor(ORO)
    c.setFont("Helvetica", 6.5)
    c.drawRightString(pw - margin, header_y + header_h - 0.7 * cm, "MESA DE PARTES")
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(pw - margin, header_y + header_h - 1.2 * cm, p.tracking_code)
    c.setFont("Helvetica", 7)
    c.drawRightString(pw - margin, header_y + header_h - 1.7 * cm, canal_lbl[:35])

    # ═══════════════════════════════════════════════════════════
    # TÍTULO
    # ═══════════════════════════════════════════════════════════
    y = header_y - 1.4 * cm
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 16)
    title_text = "CARÁTULA DE EXPEDIENTE"
    tw = c.stringWidth(title_text, "Helvetica-Bold", 16)
    tx = (pw - tw) / 2
    c.drawString(tx, y, title_text)

    # Líneas doradas debajo del título
    c.setStrokeColor(ORO)
    c.setLineWidth(2)
    c.line(tx, y - 4, tx + tw, y - 4)
    c.setLineWidth(0.5)
    c.line(tx + tw * 0.15, y - 8, tx + tw * 0.85, y - 8)

    # Código centrado bajo título
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 8)
    c.drawCentredString(pw / 2, y - 20, f"Expediente: {p.tracking_code}")

    # ═══════════════════════════════════════════════════════════
    # SECCIÓN: DATOS DEL EXPEDIENTE
    # ═══════════════════════════════════════════════════════════
    y_section = y - 1.6 * cm

    # Barra de sección
    sec_h = 0.55 * cm
    c.setFillColor(AZUL_OSCURO)
    c.roundRect(margin, y_section - sec_h, content_w, sec_h, 2, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(pw / 2, y_section - sec_h + 4, "DATOS DEL EXPEDIENTE")

    # Tabla de datos del expediente
    exp_fields = [
        ("N° Expediente",     p.tracking_code),
        ("Tipo de trámite",   type_name),
        ("Canal de ingreso",  canal_lbl),
        ("N° de folios",      str(num_folios) if num_folios else "—"),
        ("Urgencia",          urgency_lbl),
        ("Estado",            status_lbl),
        ("Fecha de registro", now_str),
        ("Oficina actual",    office_nm),
        ("Responsable",       assignee),
        ("Descripción",       (p.description or "—")[:120]),
    ]

    row_h = 0.52 * cm
    y_tbl = y_section - sec_h - 0.05 * cm
    label_col_w = content_w * 0.35
    val_col_x   = margin + label_col_w + 0.15 * cm

    # Borde exterior de la tabla
    table_h = len(exp_fields) * row_h
    c.setStrokeColor(GRIS_BORDE)
    c.setLineWidth(0.5)
    c.rect(margin, y_tbl - table_h, content_w, table_h, fill=False)

    for i, (label, val) in enumerate(exp_fields):
        ry = y_tbl - (i * row_h)
        # Fondo alternado azul claro / blanco
        bg = AZUL_CLARO if i % 2 == 0 else white
        c.setFillColor(bg)
        c.rect(margin, ry - row_h, content_w, row_h, fill=True, stroke=False)
        # Línea separadora
        c.setStrokeColor(GRIS_BORDE)
        c.setLineWidth(0.3)
        c.line(margin, ry - row_h, margin + content_w, ry - row_h)
        # Label
        c.setFillColor(AZUL)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(margin + 6, ry - row_h + 4, label)
        # Separador
        c.setFillColor(GRIS)
        c.drawString(margin + label_col_w - 4, ry - row_h + 4, ":")
        # Valor
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 7.5)
        val_str = str(val) if val else "—"
        max_val_w = content_w - label_col_w - 0.3 * cm - 8
        while c.stringWidth(val_str, "Helvetica-Bold", 7.5) > max_val_w and len(val_str) > 5:
            val_str = val_str[:-1]
        c.drawString(val_col_x, ry - row_h + 4, val_str)

    # ═══════════════════════════════════════════════════════════
    # SECCIÓN: DATOS DEL SOLICITANTE
    # ═══════════════════════════════════════════════════════════
    y_sol = y_tbl - table_h - 0.6 * cm

    c.setFillColor(AZUL_OSCURO)
    c.roundRect(margin, y_sol - sec_h, content_w, sec_h, 2, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(pw / 2, y_sol - sec_h + 4, "DATOS DEL SOLICITANTE")

    sol_fields = [
        ("Nombres y Apellidos", (p.applicant_name or "—").upper()),
        ("N° Documento",        p.applicant_document or "—"),
        ("Correo electrónico",  p.applicant_email or "—"),
        ("Celular",             p.applicant_phone or "—"),
    ]

    y_tbl2 = y_sol - sec_h - 0.05 * cm
    table_h2 = len(sol_fields) * row_h
    c.setStrokeColor(GRIS_BORDE)
    c.setLineWidth(0.5)
    c.rect(margin, y_tbl2 - table_h2, content_w, table_h2, fill=False)

    for i, (label, val) in enumerate(sol_fields):
        ry = y_tbl2 - (i * row_h)
        bg = AZUL_CLARO if i % 2 == 0 else white
        c.setFillColor(bg)
        c.rect(margin, ry - row_h, content_w, row_h, fill=True, stroke=False)
        c.setStrokeColor(GRIS_BORDE)
        c.setLineWidth(0.3)
        c.line(margin, ry - row_h, margin + content_w, ry - row_h)
        c.setFillColor(AZUL)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(margin + 6, ry - row_h + 4, label)
        c.setFillColor(GRIS)
        c.drawString(margin + label_col_w - 4, ry - row_h + 4, ":")
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 7.5)
        val_str = str(val) if val else "—"
        max_val_w = content_w - label_col_w - 0.3 * cm - 8
        while c.stringWidth(val_str, "Helvetica-Bold", 7.5) > max_val_w and len(val_str) > 5:
            val_str = val_str[:-1]
        c.drawString(val_col_x, ry - row_h + 4, val_str)

    # ═══════════════════════════════════════════════════════════
    # QR DE VERIFICACIÓN / SEGUIMIENTO
    # ═══════════════════════════════════════════════════════════
    y_qr = y_tbl2 - table_h2 - 0.8 * cm
    qr_size = 2.3 * cm
    box_h = qr_size + 0.6 * cm

    # Caja de fondo gris claro con borde redondeado
    c.setFillColor(GRIS_CLARO)
    c.roundRect(margin, y_qr - box_h + 0.3 * cm, content_w, box_h, 4, fill=True, stroke=False)
    c.setStrokeColor(GRIS_BORDE)
    c.setLineWidth(0.5)
    c.roundRect(margin, y_qr - box_h + 0.3 * cm, content_w, box_h, 4, fill=False)

    # QR Code
    qr_x = margin + 0.4 * cm
    qr_y = y_qr - qr_size + 0.1 * cm
    try:
        qr_widget = qr_module.QrCodeWidget(track_url)
        qr_widget.barWidth  = qr_size
        qr_widget.barHeight = qr_size
        d = Drawing(qr_size, qr_size)
        d.add(qr_widget)
        d.drawOn(c, qr_x, qr_y)
    except Exception:
        pass

    # Texto junto al QR
    txt_x = qr_x + qr_size + 0.6 * cm
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(txt_x, y_qr - 0.15 * cm, "Verificación / Seguimiento del Trámite")
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7)
    c.drawString(txt_x, y_qr - 0.55 * cm, "Escanee el código QR para consultar el")
    c.drawString(txt_x, y_qr - 0.85 * cm, "estado actual de este expediente.")
    c.setFillColor(AZUL_MED)
    c.setFont("Helvetica", 6)
    url_display = track_url[:70] + ("…" if len(track_url) > 70 else "")
    c.drawString(txt_x, y_qr - 1.25 * cm, url_display)

    # ═══════════════════════════════════════════════════════════
    # PIE DE PÁGINA — línea dorada + texto institucional
    # ═══════════════════════════════════════════════════════════
    footer_y = 1.5 * cm
    c.setStrokeColor(ORO)
    c.setLineWidth(1.5)
    c.line(margin, footer_y + 0.3 * cm, pw - margin, footer_y + 0.3 * cm)

    c.setFillColor(GRIS)
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(pw / 2, footer_y - 0.15 * cm,
                        f"Generado el {dt.datetime.now().strftime('%d/%m/%Y %H:%M:%S')} — "
                        f"{inst_name} · Mesa de Partes Virtual")
    c.setFont("Helvetica", 5.5)
    c.drawCentredString(pw / 2, footer_y - 0.5 * cm,
                        f"{inst.get('address', 'Tarma · Junín · Perú')}")

    c.save()
    buf.seek(0)
    return buf.read()


# ════════════════════════════════════════════════════════════════════
#   CATÁLOGOS
# ════════════════════════════════════════════════════════════════════

class OfficeView(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    queryset           = Office.objects.all().order_by("name")
    serializer_class   = OfficeSer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("active_only") == "1":
            qs = qs.filter(is_active=True)
        return qs


# ════════════════════════════════════════════════════════════════════
#   GESTIÓN DE PERSONAL DE MESA DE PARTES
# ════════════════════════════════════════════════════════════════════

_MP_ROLES = ["MPV_OFFICER", "MPV_MANAGER"]


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def mp_staff_view(request):
    """Listar y crear personal de Mesa de Partes."""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    if request.method == "GET":
        # Recolectar roles de AMBAS tablas, filtrar solo MPV
        roles_map = _get_user_roles_map(only_roles=_MP_ROLES)
        mp_user_ids = list(roles_map.keys())
        users = User.objects.filter(id__in=mp_user_ids, is_active=True).order_by("full_name", "username")
        # Oficinas asignadas como encargado
        offices_map = {}
        for off in Office.objects.filter(head_id__in=mp_user_ids):
            offices_map.setdefault(off.head_id, []).append(off.name)

        data = []
        for u in users:
            data.append({
                "id": u.id,
                "username": u.username,
                "full_name": getattr(u, 'full_name', '') or u.get_full_name() or u.username,
                "email": u.email,
                "roles": roles_map.get(u.id, []),
                "offices": offices_map.get(u.id, []),
                "is_active": u.is_active,
            })
        return Response({"staff": data})

    # POST — crear nuevo usuario de Mesa de Partes
    full_name = (request.data.get("full_name") or "").strip()
    username = (request.data.get("username") or "").strip()
    email = (request.data.get("email") or "").strip()
    password = (request.data.get("password") or "").strip()
    role = (request.data.get("role") or "MPV_OFFICER").strip()

    if not full_name:
        return Response({"detail": "El nombre completo es requerido."}, status=status.HTTP_400_BAD_REQUEST)
    if not username:
        # Auto-generar username a partir del nombre
        username = full_name.lower().replace(" ", "_")[:30]
    if not email:
        return Response({"detail": "El correo electrónico es requerido."}, status=status.HTTP_400_BAD_REQUEST)
    if not password or len(password) < 6:
        return Response({"detail": "La contraseña debe tener al menos 6 caracteres."}, status=status.HTTP_400_BAD_REQUEST)
    if role not in _MP_ROLES:
        role = "MPV_OFFICER"

    # Verificar unicidad
    if User.objects.filter(username=username).exists():
        return Response({"detail": f"El usuario '{username}' ya existe."}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        return Response({"detail": f"El correo '{email}' ya está registrado."}, status=status.HTTP_400_BAD_REQUEST)

    # full_name se guarda directo en el campo

    user = User(
        username=username,
        email=email,
        full_name=full_name,
        is_active=True,
        is_staff=True,
    )
    user.set_password(password)
    user.save()

    # Asignar rol en AMBAS tablas
    try:
        from acl.models import Role as AclRole
        role_obj, _ = AclRole.objects.get_or_create(name=role)
        user.roles.add(role_obj)  # M2M directo
        # También en acl_userrole
        try:
            from acl.models import UserRole
            UserRole.objects.get_or_create(user=user, role=role_obj)
        except Exception:
            pass
    except Exception:
        pass

    return Response({
        "id": user.id,
        "username": user.username,
        "full_name": getattr(user, 'full_name', '') or user.username,
        "email": user.email,
        "role": role,
    }, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def mp_staff_detail(request, pk):
    """Editar o desactivar un usuario de Mesa de Partes."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PATCH":
        full_name = request.data.get("full_name")
        email = request.data.get("email")
        role = request.data.get("role")
        password = request.data.get("password")

        if full_name:
            user.full_name = full_name.strip()
        if email:
            user.email = email.strip()
        if password and len(password) >= 6:
            user.set_password(password)
        user.save()

        if role and role in _MP_ROLES:
            try:
                from acl.models import Role as AclRole
                old_mp = AclRole.objects.filter(name__in=_MP_ROLES)
                user.roles.remove(*old_mp)
                new_role, _ = AclRole.objects.get_or_create(name=role)
                user.roles.add(new_role)
                # También sincronizar acl_userrole
                try:
                    from acl.models import UserRole
                    UserRole.objects.filter(user=user, role__name__in=_MP_ROLES).delete()
                    UserRole.objects.get_or_create(user=user, role=new_role)
                except Exception:
                    pass
            except Exception:
                pass

        return Response({"ok": True, "full_name": getattr(user, 'full_name', '') or user.username})

    # DELETE — desactivar
    user.is_active = False
    user.save(update_fields=["is_active"])
    return Response({"ok": True, "detail": "Usuario desactivado."})


_EXCLUDED_ROLES_SET = {"STUDENT", "ALUMNO", "ESTUDIANTE"}


def _get_user_roles_map(only_roles=None):
    """Recolecta roles usando raw SQL en AMBAS tablas M2M.
    Retorna {user_id: [role_name, ...]}
    """
    from django.db import connection
    from django.contrib.auth import get_user_model
    User = get_user_model()
    roles_map = {}

    # Detectar nombres de tablas
    m2m_table = User.roles.through._meta.db_table  # accounts_user_roles o similar

    # 1) M2M auto (accounts_user_roles)
    sql1 = f"""
        SELECT m2m.user_id, r.name
        FROM {m2m_table} m2m
        JOIN acl_role r ON r.id = m2m.role_id
    """
    with connection.cursor() as cur:
        cur.execute(sql1)
        for uid, rname in cur.fetchall():
            roles_map.setdefault(uid, set()).add(rname)

    # 2) acl_userrole (explícito)
    sql2 = """
        SELECT ur.user_id, r.name
        FROM acl_userrole ur
        JOIN acl_role r ON r.id = ur.role_id
    """
    try:
        with connection.cursor() as cur:
            cur.execute(sql2)
            for uid, rname in cur.fetchall():
                roles_map.setdefault(uid, set()).add(rname)
    except Exception:
        pass  # Tabla podría no existir

    # Filtrar por roles específicos si se solicita
    if only_roles:
        only_set = set(only_roles)
        roles_map = {
            uid: rset for uid, rset in roles_map.items()
            if rset & only_set
        }

    return {uid: sorted(rset) for uid, rset in roles_map.items()}


class UsersCatalogView(viewsets.ViewSet):
    """Catálogo de usuarios para encargados/responsables."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        roles_map = _get_user_roles_map()

        # Solo usuarios con al menos un rol NO-estudiantil
        valid_ids = [
            uid for uid, roles in roles_map.items()
            if any(r not in _EXCLUDED_ROLES_SET for r in roles)
        ]

        users = []
        for u in User.objects.filter(id__in=valid_ids, is_active=True).order_by("full_name", "username"):
            all_roles = roles_map.get(u.id, [])
            non_student = [r for r in all_roles if r not in _EXCLUDED_ROLES_SET]
            label = getattr(u, 'full_name', '') or u.get_full_name() or u.username
            if non_student:
                label += f" ({', '.join(non_student)})"
            users.append({
                "id": u.id,
                "full_name": getattr(u, 'full_name', '') or u.get_full_name() or u.username,
                "label": label,
                "roles": all_roles,
            })
        return Response({"users": users})


# ════════════════════════════════════════════════════════════════════
#   TIPOS DE TRÁMITE
# ════════════════════════════════════════════════════════════════════

class ProcedureTypeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset           = ProcedureType.objects.all().order_by("name")
    serializer_class   = ProcedureTypeSer


# ════════════════════════════════════════════════════════════════════
#   TRÁMITES (PRIVADO)
# ════════════════════════════════════════════════════════════════════

class ProcedureViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = (
        Procedure.objects
        .select_related("procedure_type", "current_office", "assignee")
        .prefetch_related("files")
        .order_by("-created_at")
    )
    serializer_class = ProcedureSer

    def get_queryset(self):
        qs = super().get_queryset()
        p  = self.request.query_params
        # Filtros opcionales desde la URL
        status_f  = p.get("status")
        urgency_f = p.get("urgency_level")
        canal_f   = p.get("canal_ingreso")
        date_from = parse_date(p.get("date_from") or "")
        date_to   = parse_date(p.get("date_to") or "")
        overdue   = p.get("overdue")   # "1" → solo vencidos
        if status_f:   qs = qs.filter(status=status_f)
        if urgency_f:  qs = qs.filter(urgency_level=urgency_f)
        if canal_f:    qs = qs.filter(canal_ingreso=canal_f)
        if date_from:  qs = qs.filter(created_at__date__gte=date_from)
        if date_to:    qs = qs.filter(created_at__date__lte=date_to)
        if overdue == "1":
            qs = qs.filter(
                deadline_at__isnull=False,
                deadline_at__lt=timezone.now(),
            ).exclude(status__in=["COMPLETED", "REJECTED"])
        return qs

    def list(self, request, *args, **kwargs):
        qs   = self.get_queryset().prefetch_related("files")
        data = self.get_serializer(qs, many=True, context={"request": request}).data
        return Response({"procedures": data})

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data["tracking_code"] = _track_code()
        ser = self.get_serializer(data=data)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        ProcedureEvent.objects.create(
            procedure=obj, type="CREATED",
            description="Trámite creado", actor=request.user
        )
        return Response({"procedure": self.get_serializer(obj).data}, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        """Solo permite eliminar trámites creados hace menos de 24 horas."""
        p = self.get_object()
        if p.created_at and (timezone.now() - p.created_at).total_seconds() > 86400:
            return Response(
                {"detail": "Solo se puede eliminar un trámite dentro de las primeras 24 horas."},
                status=403,
            )
        # Eliminar archivos físicos
        for pf in p.files.all():
            try:
                pf.file.delete(save=False)
            except Exception:
                pass
        p.delete()
        return Response(status=204)

    @action(detail=False, methods=["get"])
    def code(self, request):
        code = request.query_params.get("code")
        if not code:
            return Response({"detail": "code requerido"}, status=400)
        try:
            p = Procedure.objects.get(tracking_code=code)
        except Procedure.DoesNotExist:
            return Response(status=404)
        return Response({"procedure": self.get_serializer(p).data})

    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        p   = self.get_object()
        evs = p.events.order_by("-at")
        return Response({"timeline": ProcedureEventSer(evs, many=True).data})

    @action(detail=True, methods=["post"])
    def route(self, request, pk=None):
        p = self.get_object()
        to_office_id = request.data.get("to_office_id")
        assignee_id  = request.data.get("assignee_id")
        note         = request.data.get("note", "")
        deadline     = request.data.get("deadline_at") or None
        if to_office_id:
            p.current_office_id = int(to_office_id)
            # Auto-asignar encargado de la oficina si no se eligió uno manualmente
            if not assignee_id:
                try:
                    office = Office.objects.get(pk=int(to_office_id))
                    if office.head_id:
                        assignee_id = office.head_id
                except Office.DoesNotExist:
                    pass
        p.assignee_id = int(assignee_id) if assignee_id else None
        p.deadline_at = deadline
        p.save()
        ProcedureEvent.objects.create(
            procedure=p, type="ROUTED",
            description=note or "Derivado", actor=request.user
        )
        return Response({"ok": True})

    @action(detail=True, methods=["post"])
    def status(self, request, pk=None):
        p          = self.get_object()
        new_status = request.data.get("status")
        note       = request.data.get("note", "")
        if new_status:
            p.status = new_status
            p.save()
            ProcedureEvent.objects.create(
                procedure=p, type="STATUS_CHANGED",
                description=f"{new_status}. {note}", actor=request.user
            )
        return Response({"ok": True})

    @action(detail=True, methods=["post"], url_path="notes")
    def notes(self, request, pk=None):
        p    = self.get_object()
        note = request.data.get("note", "")
        if not note:
            return Response({"detail": "note requerido"}, status=400)
        ProcedureEvent.objects.create(
            procedure=p, type="NOTE", description=note, actor=request.user
        )
        return Response({"ok": True})

    @action(detail=True, methods=["post"], url_path="notify")
    def notify(self, request, pk=None):
        from django.core.mail import send_mail as django_send_mail

        p        = self.get_object()
        channels = request.data.get("channels", ["EMAIL"])
        subject  = (request.data.get("subject") or "").strip()
        message  = (request.data.get("message") or "").strip()

        if not subject:
            subject = f"Notificación sobre su trámite {p.tracking_code}"
        if not message:
            message = (
                f"Estimado(a) {p.applicant_name},\n\n"
                f"Le informamos sobre el estado de su trámite {p.tracking_code}."
            )

        results = {}

        # ── EMAIL ──
        if "EMAIL" in channels:
            to_email = (p.applicant_email or "").strip()
            if not to_email:
                results["email"] = "sin_correo"
            else:
                try:
                    django_send_mail(
                        subject=subject,
                        message=message,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[to_email],
                        fail_silently=False,
                    )
                    results["email"] = "sent"
                except Exception as exc:
                    results["email"] = f"error: {exc}"
            # Log
            try:
                from notifications.models import NotificationLog
                NotificationLog.objects.create(
                    event_key="MP.NOTIFY", channel="EMAIL",
                    to=to_email,
                    subject=subject,
                    payload={"tracking_code": p.tracking_code, "message": message},
                    rendered={"subject": subject, "html": message},
                    status="SENT" if results.get("email") == "sent" else "ERROR",
                    error="" if results.get("email") == "sent" else str(results.get("email", "")),
                )
            except Exception:
                pass

        # ── SMS (requiere proveedor externo) ──
        if "SMS" in channels:
            results["sms"] = "no_provider"

        ProcedureEvent.objects.create(
            procedure=p, type="NOTIFIED",
            description=f"Canales: {', '.join(channels)}. Asunto: {subject}",
            actor=request.user,
        )
        return Response({"ok": True, "results": results})

    # ── Archivos ────────────────────────────────────────────────────
    @action(detail=True, methods=["get", "post"], url_path="files")
    def files(self, request, pk=None):
        p = self.get_object()
        if request.method == "GET":
            return Response({"files": ProcedureFileSer(
                p.files.all(), many=True, context={"request": request}
            ).data})
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "file requerido"}, status=400)
        pf = ProcedureFile.objects.create(
            procedure=p, file=f,
            original_name=getattr(f, "name", ""), size=f.size,
            doc_type=request.POST.get("doc_type", ""),
        )
        ProcedureEvent.objects.create(
            procedure=p, type="FILE_UPLOADED",
            description=pf.original_name, actor=request.user
        )
        return Response(ProcedureFileSer(pf).data, status=201)

    @action(detail=True, methods=["delete"], url_path=r"files/(?P<file_id>\d+)")
    def delete_file(self, request, pk=None, file_id=None):
        p = self.get_object()
        try:
            pf = p.files.get(id=file_id)
        except ProcedureFile.DoesNotExist:
            return Response(status=404)
        name = pf.original_name
        pf.file.delete(save=False)
        pf.delete()
        ProcedureEvent.objects.create(
            procedure=p, type="FILE_DELETED",
            description=name, actor=request.user
        )
        return Response(status=204)

    # ── PDFs ────────────────────────────────────────────────────────
    @action(detail=True, methods=["get", "post"], url_path="cover",
            permission_classes=[IsAuthenticated])
    def cover(self, request, pk=None):
        p = self.get_object()
        try:
            pdf_bytes = _build_cover_pdf(p, request=request)
        except Exception as e:
            return Response({"detail": f"Error generando PDF: {e}"}, status=500)
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="caratula-{p.tracking_code}.pdf"'
        resp["Content-Length"]      = len(pdf_bytes)
        return resp

    @action(detail=True, methods=["get", "post"], url_path="cargo",
            permission_classes=[AllowAny])
    def cargo(self, request, pk=None):
        p = self.get_object()
        try:
            pdf_bytes = _build_cargo_pdf(p, request=request)
        except Exception as e:
            return Response({"detail": f"Error generando PDF: {e}"}, status=500)
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="cargo-{p.tracking_code}.pdf"'
        resp["Content-Length"]      = len(pdf_bytes)
        return resp


# ════════════════════════════════════════════════════════════════════
#   DASHBOARD
# ════════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    now     = timezone.now()
    soon    = now + dt.timedelta(days=2)
    pending = Procedure.objects.exclude(status__in=["COMPLETED", "REJECTED"])

    # avg_processing_time real (segundos → días)
    completed = Procedure.objects.filter(status="COMPLETED")
    avg_days  = 0
    if completed.exists():
        total_secs = sum(
            (p.updated_at - p.created_at).total_seconds()
            for p in completed.values_list("created_at", "updated_at", named=True)
        )
        avg_days = round(total_secs / completed.count() / 86400, 1)

    overdue      = pending.filter(deadline_at__isnull=False, deadline_at__lt=now).count()
    near_deadline = pending.filter(
        deadline_at__isnull=False,
        deadline_at__gte=now,
        deadline_at__lte=soon,
    ).count()

    completed_today = Procedure.objects.filter(
        status="COMPLETED", updated_at__date=dt.date.today()
    ).count()

    return Response({"stats": {
        "pending_procedures":  pending.count(),
        "completed_today":     completed_today,
        "avg_processing_time": avg_days,
        "procedure_types":     ProcedureType.objects.count(),
        "overdue":             overdue,
        "near_deadline":       near_deadline,
    }})


# ════════════════════════════════════════════════════════════════════
#   PÚBLICO
# ════════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([AllowAny])
def public_procedure_types(request):
    qs = ProcedureType.objects.filter(is_active=True).order_by("name")
    return Response({"procedure_types": ProcedureTypeSer(qs, many=True).data})


@api_view(["POST"])
@permission_classes([AllowAny])
def public_create(request):
    data                  = request.data.copy()
    data["tracking_code"] = _track_code()
    ser = ProcedureSer(data=data)
    ser.is_valid(raise_exception=True)
    p = ser.save()
    ProcedureEvent.objects.create(
        procedure=p, type="CREATED_PUBLIC",
        description=f"Ingreso por {data.get('canal_ingreso', 'VIRTUAL')}"
    )
    return Response({"procedure": ProcedureSer(p).data}, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def public_upload_file(request, code):
    try:
        p = Procedure.objects.get(tracking_code=code)
    except Procedure.DoesNotExist:
        return Response(status=404)
    f = request.FILES.get("file")
    if not f:
        return Response({"detail": "file requerido"}, status=400)
    pf = ProcedureFile.objects.create(
        procedure=p, file=f,
        original_name=getattr(f, "name", ""), size=f.size,
        doc_type=request.POST.get("doc_type", ""),
    )
    ProcedureEvent.objects.create(
        procedure=p, type="FILE_UPLOADED_PUBLIC",
        description=pf.original_name
    )
    return Response(ProcedureFileSer(pf).data, status=201)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_track(request):
    code = (request.GET.get("code") or "").strip()
    if not code:
        return Response({"detail": "code requerido"}, status=400)
    try:
        p = Procedure.objects.select_related(
            "procedure_type", "current_office", "assignee"
        ).get(tracking_code=code)
    except Procedure.DoesNotExist:
        return Response(status=404)
    data             = ProcedureSer(p).data
    data["timeline"] = ProcedureEventSer(p.events.order_by("-at"), many=True).data
    # Incluir archivos para que el tracking los muestre
    data["files"]    = ProcedureFileSer(p.files.all(), many=True, context={"request": request}).data
    return Response({"procedure": data})


# ════════════════════════════════════════════════════════════════════
#   PÁGINA PÚBLICA DE SEGUIMIENTO (HTML — QR de carátula)
# ════════════════════════════════════════════════════════════════════

def track_procedure_page(request, code=""):
    """
    Página HTML pública para seguimiento de trámite (accesible vía QR).
    No depende del frontend React — renderiza HTML completo desde Django.
    GET /public/procedures/track/<code>
    """
    from django.http import HttpResponse as HR

    code = (code or request.GET.get("code", "")).strip().upper()
    procedure_data = None
    timeline_data = []
    error_msg = None

    if code:
        try:
            p = Procedure.objects.select_related(
                "procedure_type", "current_office", "assignee"
            ).get(tracking_code=code)

            status_map = {
                "RECEIVED": ("Recibido", "#2563eb", "#dbeafe"),
                "IN_REVIEW": ("En Revisión", "#d97706", "#fef3c7"),
                "APPROVED": ("Aprobado", "#059669", "#d1fae5"),
                "REJECTED": ("Rechazado", "#dc2626", "#fee2e2"),
                "COMPLETED": ("Completado", "#059669", "#d1fae5"),
            }
            canal_map = {"VIRTUAL": "Mesa de Partes Virtual", "PRESENCIAL": "Presencial",
                         "EMAIL": "Correo Electrónico", "FAXSIMIL": "Fax"}
            urgency_map = {"LOW": "Baja", "NORMAL": "Normal", "HIGH": "Alta", "URGENT": "Urgente"}

            st = status_map.get(p.status, (p.status, "#6b7280", "#f3f4f6"))
            type_name = getattr(p.procedure_type, "name", "—") if p.procedure_type else "—"
            office_nm = getattr(p.current_office, "name", "—") if p.current_office else "—"

            procedure_data = {
                "tracking_code": p.tracking_code,
                "type": type_name,
                "canal": canal_map.get(getattr(p, "canal_ingreso", ""), "—"),
                "urgency": urgency_map.get(getattr(p, "urgency_level", ""), "Normal"),
                "status": p.status,
                "status_label": st[0],
                "status_color": st[1],
                "status_bg": st[2],
                "office": office_nm,
                "applicant_name": p.applicant_name or "—",
                "applicant_document": p.applicant_document or "—",
                "description": (p.description or "—")[:200],
                "created_at": p.created_at.strftime("%d/%m/%Y %H:%M") if p.created_at else "—",
            }

            # Timeline
            events = p.events.order_by("-at")[:20]
            event_type_map = {
                "CREATED_PUBLIC": ("Trámite registrado", "#2563eb", "#dbeafe"),
                "CREATED": ("Trámite registrado", "#2563eb", "#dbeafe"),
                "STATUS_CHANGED": ("Estado actualizado", "#7c3aed", "#ede9fe"),
                "DERIVED": ("Derivado a otra oficina", "#d97706", "#fef3c7"),
                "FILE_UPLOADED_PUBLIC": ("Documento adjuntado", "#0891b2", "#cffafe"),
                "FILE_UPLOADED": ("Documento adjuntado", "#0891b2", "#cffafe"),
                "NOTIFIED": ("Notificación enviada", "#059669", "#d1fae5"),
                "COMMENT": ("Comentario", "#6b7280", "#f3f4f6"),
            }
            for ev in events:
                et = event_type_map.get(ev.type, (ev.type, "#6b7280", "#f3f4f6"))
                timeline_data.append({
                    "date": ev.at.strftime("%d/%m/%Y %H:%M") if ev.at else "",
                    "label": et[0],
                    "color": et[1],
                    "bg": et[2],
                    "description": ev.description or "",
                })

        except Procedure.DoesNotExist:
            error_msg = f"No se encontró ningún trámite con el código {code}."
    elif request.GET.get("code"):
        error_msg = "Código de trámite no válido."

    # ── Institution info ──
    inst = _get_institution_data()
    inst_name = inst["name"]

    # ── SVG Icons ──
    IC = {
        "file":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        "search": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
        "check":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>',
        "alert":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        "clock":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        "user":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        "id":     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
        "office": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
        "tag":    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
        "cal":    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        "dot":    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>',
    }

    d = procedure_data  # shortcut

    # ── Build detail fields ──
    def _field(icon_svg, label, val, full_width=False):
        if not val or val == "—":
            return ""
        w = "grid-column:1/-1;" if full_width else ""
        return f'''<div class="fd" style="{w}">
            <div class="fd-icon">{icon_svg}</div>
            <div class="fd-txt"><span class="fd-lbl">{label}</span><span class="fd-val">{val}</span></div>
        </div>'''

    # ── Status badge ──
    badge_html = ""
    if d:
        badge_html = f'<span class="badge" style="--bc:{d["status_color"]};--bg:{d["status_bg"]};">{d["status_label"]}</span>'

    # ── Found banner ──
    found_html = ""
    if d:
        found_html = f'''
        <div class="verified-card fade-in">
            <div class="verified-icon">{IC["check"]}</div>
            <div class="verified-txt">
                <strong>Trámite Localizado</strong>
                <span>El expediente <b>{d["tracking_code"]}</b> se encuentra registrado en el sistema de Mesa de Partes.</span>
            </div>
            {badge_html}
        </div>'''

    # ── Detail card ──
    detail_html = ""
    if d:
        fields = ""
        fields += _field(IC["file"],   "N° Expediente", d["tracking_code"])
        fields += _field(IC["tag"],    "Tipo de trámite", d["type"])
        fields += _field(IC["office"], "Canal de ingreso", d["canal"])
        fields += _field(IC["clock"],  "Urgencia", d["urgency"])
        fields += _field(IC["cal"],    "Fecha de registro", d["created_at"])
        fields += _field(IC["office"], "Oficina actual", d["office"])
        fields += _field(IC["user"],   "Solicitante", d["applicant_name"], True)
        fields += _field(IC["id"],     "N° Documento", d["applicant_document"])
        fields += _field(IC["file"],   "Asunto", d["description"], True)

        detail_html = f'''
        <div class="card fade-in" style="animation-delay:.1s;">
            <div class="card-head">
                <div>
                    <p class="card-title">{d["tracking_code"]}</p>
                    <p class="card-sub">{d["type"]}</p>
                </div>
                {badge_html}
            </div>
            <div class="card-body">
                <div class="fields-grid">
                    {fields}
                </div>
            </div>
        </div>'''

    # ── Timeline ──
    timeline_html = ""
    if timeline_data:
        items = ""
        for i, ev in enumerate(timeline_data):
            delay = f"animation-delay:{0.15 + i * 0.05:.2f}s;"
            desc_html = f'<p class="tl-desc">{ev["description"]}</p>' if ev["description"] else ""
            items += f'''
            <div class="tl-item fade-in" style="{delay}">
                <div class="tl-dot" style="background:{ev["color"]};"></div>
                <div class="tl-content">
                    <div class="tl-head">
                        <span class="tl-label" style="color:{ev["color"]};background:{ev["bg"]};">{ev["label"]}</span>
                        <span class="tl-date">{ev["date"]}</span>
                    </div>
                    {desc_html}
                </div>
            </div>'''
        timeline_html = f'''
        <div class="card fade-in" style="animation-delay:.2s;">
            <div class="card-head">
                <div>
                    <p class="card-title">Trazabilidad</p>
                    <p class="card-sub">Historial de movimientos del expediente</p>
                </div>
            </div>
            <div class="card-body" style="flex-direction:column;gap:0;">
                <div class="timeline">
                    {items}
                </div>
            </div>
        </div>'''

    # ── Error ──
    error_html = ""
    if error_msg:
        error_html = f'''
        <div class="alert-card alert-warn fade-in">
            <div class="alert-icon">{IC["alert"]}</div>
            <div>
                <strong>Trámite no encontrado</strong>
                <p>{error_msg}</p>
            </div>
        </div>'''

    # ── Empty state ──
    empty_html = ""
    if not d and not error_msg:
        empty_html = f'''
        <div class="empty-state">
            <div class="empty-icon">{IC["search"]}</div>
            <strong>Seguimiento de Trámite</strong>
            <p>Ingrese el código de expediente (ej: MP-2026-XXXXXX) para consultar el estado de su trámite.</p>
        </div>'''

    html = f'''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seguimiento de Trámite — IESPP "{inst_name}"</title>
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
.search-input{{width:100%;height:48px;padding:0 14px 0 42px;border-radius:12px;border:2px solid #e5e7eb;background:#fafafa;font-size:15px;font-weight:500;color:#1a1a2e;transition:all .2s;font-family:inherit;text-transform:uppercase}}
.search-input:focus{{outline:none;border-color:#6366f1;background:#fff;box-shadow:0 0 0 4px rgba(99,102,241,.1)}}
.search-input::placeholder{{color:#9ca3af;font-weight:400;text-transform:none}}
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

/* Card */
.card{{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.04);border:1px solid #e5e7eb;margin-top:16px}}
.card-head{{background:linear-gradient(135deg,#0f172a,#1e293b);padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px}}
.card-title{{color:#fff;font-size:18px;font-weight:800;letter-spacing:-.02em}}
.card-sub{{color:#94a3b8;font-size:12px;margin-top:3px}}
.card-body{{padding:24px;display:flex;gap:24px;flex-wrap:wrap}}

/* Fields grid */
.fields-grid{{flex:1;min-width:280px;display:grid;grid-template-columns:1fr 1fr;gap:0}}
.fd{{display:flex;align-items:flex-start;gap:10px;padding:12px 8px;border-bottom:1px solid #f1f5f9;transition:background .15s}}
.fd:hover{{background:#fafbff}}
.fd-icon{{width:28px;height:28px;border-radius:8px;background:#f0f0ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}}
.fd-icon svg{{width:14px;height:14px;color:#6366f1}}
.fd-txt{{min-width:0}}
.fd-lbl{{display:block;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em}}
.fd-val{{display:block;font-size:13px;font-weight:600;color:#1e293b;margin-top:1px;word-break:break-word}}

/* Timeline */
.timeline{{width:100%;position:relative;padding-left:20px}}
.tl-item{{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #f1f5f9;position:relative}}
.tl-item:last-child{{border-bottom:none}}
.tl-item::before{{content:'';position:absolute;left:-14px;top:0;bottom:0;width:2px;background:#e5e7eb}}
.tl-item:first-child::before{{top:22px}}
.tl-item:last-child::before{{bottom:50%}}
.tl-dot{{width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:5px;position:relative;z-index:1;margin-left:-19px;border:2px solid #fff;box-shadow:0 0 0 2px currentColor}}
.tl-content{{flex:1;min-width:0}}
.tl-head{{display:flex;align-items:center;gap:8px;flex-wrap:wrap}}
.tl-label{{font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px;white-space:nowrap}}
.tl-date{{font-size:11px;color:#94a3b8;font-weight:500}}
.tl-desc{{font-size:12px;color:#64748b;margin-top:4px;line-height:1.4}}

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
            <div class="hdr-logo">{IC["file"]}</div>
            <div>
                <h1>Seguimiento de Trámite</h1>
                <p>IESPP "{inst_name}" — Mesa de Partes Virtual</p>
            </div>
        </div>
        <div class="hdr-badge">{IC["check"]} Consulta pública</div>
    </div>
</div>

<div class="container">
    <div class="search-card fade-in">
        <div class="search-label">Buscar expediente por código</div>
        <form method="get" action="/public/procedures/track" class="search-form">
            <div class="search-input-wrap">
                {IC["search"]}
                <input type="text" name="code" value="{code}" placeholder="Ej: MP-2026-XXXXXX"
                       class="search-input" autocomplete="off">
            </div>
            <button type="submit" class="search-btn">{IC["search"]} Buscar</button>
        </form>
    </div>

    {found_html}
    {detail_html}
    {timeline_html}
    {error_html}
    {empty_html}

    <div class="footer">
        <p>IESPP "{inst_name}" &mdash; Mesa de Partes Virtual<br>
        <a href="https://academico.iesppallende.edu.pe">Volver al portal principal</a></p>
    </div>
</div>

</body>
</html>'''

    return HR(html, content_type="text/html; charset=utf-8")


# ════════════════════════════════════════════════════════════════════
#   REPORTES
# ════════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def procedures_summary(request):
    qs           = Procedure.objects.all()
    q            = request.query_params
    d_from       = parse_date(q.get("from") or "")
    d_to         = parse_date(q.get("to") or "")
    status_param = q.get("status")

    if d_from:        qs = qs.filter(created_at__date__gte=d_from)
    if d_to:          qs = qs.filter(created_at__date__lte=d_to)
    if status_param:  qs = qs.filter(status=status_param)

    total = qs.count()
    if total > 0:
        rows     = list(qs.values_list("created_at", "updated_at"))
        avg_days = round(sum((u - c).total_seconds() for c, u in rows) / total / 86400, 2)
    else:
        avg_days = None

    now          = timezone.now()
    overdue      = qs.filter(deadline_at__isnull=False, deadline_at__lt=F("updated_at")).exclude(status="COMPLETED").count()
    in_review    = qs.filter(status="IN_REVIEW").count()
    open_count   = qs.exclude(status__in=["COMPLETED", "REJECTED"]).count()
    sla_breached = qs.filter(deadline_at__isnull=False, deadline_at__lt=now).exclude(status__in=["COMPLETED", "REJECTED"]).count()

    # Desglose por estado
    by_status = [
        {"name": r["status"], "value": r["count"]}
        for r in qs.values("status").annotate(count=Count("id")).order_by("-count")
    ]
    # Desglose por tipo de trámite
    by_type = [
        {"name": r["procedure_type__name"] or "Sin tipo", "value": r["count"]}
        for r in qs.values("procedure_type__name").annotate(count=Count("id")).order_by("-count")[:10]
    ]
    # Desglose por canal de ingreso
    by_canal = [
        {"name": r["canal_ingreso"] or "—", "value": r["count"]}
        for r in qs.values("canal_ingreso").annotate(count=Count("id")).order_by("-count")
    ] if hasattr(Procedure, "canal_ingreso") else []

    since = now.date() - dt.timedelta(days=29)
    trend = [
        {"date": str(r["d"]), "value": r["count"]}
        for r in qs.filter(created_at__date__gte=since)
            .annotate(d=TruncDate("created_at"))
            .values("d").annotate(count=Count("id")).order_by("d")
    ]

    return Response({
        "summary":   {
            "total": total, "avg_days": avg_days, "overdue": overdue,
            "in_review": in_review, "open": open_count, "sla_breached": sla_breached,
        },
        "dashboard": {
            "total": total, "open": open_count, "sla_breached": sla_breached,
            "by_status": by_status, "by_type": by_type, "by_canal": by_canal, "trend": trend,
        },
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def procedures_report_sla(request):
    """Exporta datos SLA en CSV real."""
    buf = io.StringIO()
    w   = csv.writer(buf)
    w.writerow(["procedure_id", "tracking_code", "tipo", "estado", "fecha_registro",
                "fecha_actualizacion", "dias_transcurridos", "plazo", "vencido"])
    now = timezone.now()
    for p in Procedure.objects.select_related("procedure_type").all()[:2000]:
        dias = round((p.updated_at - p.created_at).total_seconds() / 86400, 1)
        vencido = "Sí" if (p.deadline_at and p.deadline_at < now
                           and p.status not in ["COMPLETED", "REJECTED"]) else "No"
        w.writerow([
            p.id, p.tracking_code,
            getattr(p.procedure_type, "name", "—") if p.procedure_type else "—",
            p.status, p.created_at.strftime("%d/%m/%Y %H:%M") if p.created_at else "—",
            p.updated_at.strftime("%d/%m/%Y %H:%M") if p.updated_at else "—",
            dias,
            p.deadline_at.strftime("%d/%m/%Y") if p.deadline_at else "—",
            vencido,
        ])
    out = buf.getvalue().encode("utf-8-sig")   # UTF-8 con BOM para Excel
    res = HttpResponse(out, content_type="text/csv; charset=utf-8-sig")
    res["Content-Disposition"] = 'attachment; filename="sla.csv"'
    return res


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def procedures_report_volume(request):
    """Exporta volumen diario en CSV real."""
    buf = io.StringIO()
    w   = csv.writer(buf)
    w.writerow(["fecha", "tipo_tramite", "canal_ingreso", "cantidad"])
    rows = (
        Procedure.objects
        .select_related("procedure_type")
        .annotate(d=TruncDate("created_at"))
        .values("d", "procedure_type__name", "canal_ingreso")
        .annotate(count=Count("id"))
        .order_by("-d")[:2000]
    )
    for r in rows:
        w.writerow([
            str(r["d"]) if r["d"] else "—",
            r["procedure_type__name"] or "Sin tipo",
            r["canal_ingreso"] or "—",
            r["count"],
        ])
    out = buf.getvalue().encode("utf-8-sig")
    res = HttpResponse(out, content_type="text/csv; charset=utf-8-sig")
    res["Content-Disposition"] = 'attachment; filename="volumen.csv"'
    return res


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_procedures(request):
    qs = Procedure.objects.select_related("procedure_type").order_by("-created_at")
    if hasattr(Procedure, "created_by"):
        qs = qs.filter(created_by=request.user)
    else:
        qs = qs.filter(applicant_email=request.user.email)
    return Response([{
        "type":    str(p.procedure_type) if p.procedure_type else "Trámite",
        "code":    p.tracking_code or str(p.id),
        "status":  p.status or "",
        "date":    str(p.created_at.date()) if p.created_at else "",
        "subject": getattr(p, "subject", getattr(p, "applicant_name", "")),
    } for p in qs[:10]])