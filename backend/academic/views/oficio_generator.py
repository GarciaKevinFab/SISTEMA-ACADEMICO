"""
academic/views/oficio_generator.py
═══════════════════════════════════════════════════════════════
Genera oficios institucionales con diseño de hoja membretada:
  - Cabecera con logo + nombre institución + D.S. de creación
  - Cinta lateral azul con texto vertical "GUSTAVO ALLENDE LLAVERÍA"
  - Marca de agua (logo en el centro, atenuado)
  - Contenido dinámico (oficio número, destinatario, asunto, cuerpo)
  - Firma del director (imagen) + nombre y cargo
  - Pie con iniciales

Datos institucionales se leen de:
  - InstitutionSettings (academic): name, address, ruc
  - InstitutionSetting (catalogs).data: dre, ugel, codigo_modular, director_name,
    rvm, ds_creacion, etc.
  - MediaAsset / logo_url, signature_url
"""

import io
import os
import logging
from datetime import datetime, date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph,
    Spacer, Image, Table, TableStyle, KeepTogether,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image as PILImage

logger = logging.getLogger("academic.oficio")


MESES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
}

# Colores institucionales (azul oscuro como en el oficio original)
INST_BLUE = colors.HexColor("#0B5394")
INST_BLUE_DARK = colors.HexColor("#073763")
INST_BLUE_SOFT = colors.HexColor("#3D85C6")

# Márgenes (la cinta lateral toma 18mm a la izquierda, el contenido empieza
# después)
PAGE_LEFT_MARGIN = 35 * mm   # Para dejar espacio a la cinta lateral azul
PAGE_RIGHT_MARGIN = 20 * mm
PAGE_TOP_MARGIN = 60 * mm    # Para el header con logo y nombre institución
PAGE_BOTTOM_MARGIN = 28 * mm  # Para iniciales al pie


def _safe_image_path(path):
    """Verifica que un archivo de imagen exista y sea legible por PIL."""
    if not path or not os.path.isfile(str(path)):
        return None
    try:
        with PILImage.open(str(path)) as im:
            im.verify()
        return str(path)
    except Exception:
        return None


def _draw_letterhead(c, doc, inst_data, logo_path, watermark_logo_path):
    """Dibuja el membrete (cabecera + cinta lateral + marca de agua + pie de
    iniciales). Se llama en cada página."""
    page_w, page_h = A4

    # ──────────────────────────────────────────────────────
    # 1) MARCA DE AGUA (logo grande, centrado, transparente)
    # ──────────────────────────────────────────────────────
    if watermark_logo_path:
        try:
            c.saveState()
            c.setFillAlpha(0.08)  # Muy transparente
            wm_size = 90 * mm
            c.drawImage(
                watermark_logo_path,
                (page_w - wm_size) / 2,
                (page_h - wm_size) / 2,
                width=wm_size, height=wm_size,
                mask="auto", preserveAspectRatio=True,
            )
            c.restoreState()
        except Exception as exc:
            logger.warning("No se pudo dibujar watermark: %s", exc)

    # ──────────────────────────────────────────────────────
    # 2) CABECERA con logo + nombre institución
    # ──────────────────────────────────────────────────────
    header_top = page_h - 8 * mm
    if logo_path:
        try:
            logo_h = 32 * mm
            logo_w = 32 * mm
            c.drawImage(
                logo_path,
                14 * mm, header_top - logo_h,
                width=logo_w, height=logo_h,
                mask="auto", preserveAspectRatio=True,
            )
        except Exception:
            pass

    # Texto del header (a la derecha del logo)
    text_x = 50 * mm
    c.setFillColor(INST_BLUE)
    c.setFont("Helvetica", 11)
    c.drawString(text_x, header_top - 6 * mm,
                 "Instituto de Educación Superior Pedagógico Público")
    c.setFont("Helvetica-Bold", 18)
    inst_name_quoted = f'"{inst_data.get("name", "GUSTAVO ALLENDE LLAVERIA").upper()}"'
    c.drawString(text_x, header_top - 14 * mm, inst_name_quoted)
    c.setFont("Helvetica-Bold", 11)
    addr_line = (inst_data.get("address") or "POMACHACA - TARMA").upper()
    c.drawString(text_x, header_top - 19 * mm, addr_line)
    c.setFont("Helvetica", 9)
    ds_line = inst_data.get("ds_creacion") or "D.S. N° 0023-2010-ED"
    c.drawString(text_x, header_top - 24 * mm, ds_line)

    # Línea divisoria azul bajo el header
    c.setStrokeColor(INST_BLUE)
    c.setLineWidth(1.5)
    line_y = header_top - 30 * mm
    c.line(35 * mm, line_y, page_w - 14 * mm, line_y)

    # ──────────────────────────────────────────────────────
    # 3) CINTA LATERAL IZQUIERDA con texto vertical
    # ──────────────────────────────────────────────────────
    ribbon_w = 18 * mm
    ribbon_x = 8 * mm
    ribbon_y_bottom = 12 * mm
    ribbon_y_top = page_h - 8 * mm
    ribbon_h = ribbon_y_top - ribbon_y_bottom

    # Rectángulo azul redondeado
    c.setFillColor(INST_BLUE)
    c.setStrokeColor(INST_BLUE_DARK)
    c.setLineWidth(0.5)
    c.roundRect(
        ribbon_x, ribbon_y_bottom,
        ribbon_w, ribbon_h,
        radius=8,
        stroke=1, fill=1,
    )

    # Texto vertical blanco
    c.saveState()
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 14)
    text_str = f'"{inst_data.get("name", "GUSTAVO ALLENDE LLAVERIA").upper()}"'
    # Rotar texto 90° y centrarlo en la cinta
    cx = ribbon_x + ribbon_w / 2 + 4
    cy = ribbon_y_bottom + ribbon_h / 2
    c.translate(cx, cy)
    c.rotate(90)
    c.drawCentredString(0, 0, text_str)
    c.restoreState()

    # ──────────────────────────────────────────────────────
    # 4) PIE de iniciales
    # ──────────────────────────────────────────────────────
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 8)
    initials_x = 35 * mm
    initials_y = 22 * mm
    initials = inst_data.get("oficio_initials") or [
        'IESPP/"GALL"', "DG/MEGP", "SA/NMCM", "CC/Archivo",
    ]
    if isinstance(initials, str):
        initials = [s.strip() for s in initials.split("\n") if s.strip()]
    for i, line in enumerate(initials):
        c.drawString(initials_x, initials_y - i * 10, line)


def generate_oficio_pdf(payload: dict, inst_data: dict,
                        logo_path: str = None,
                        signature_path: str = None) -> bytes:
    """Genera el PDF del oficio.

    payload claves esperadas:
      - oficio_number       : "258"
      - oficio_year         : "2026"
      - lema                : "AÑO DE LA RECUPERACIÓN Y CONSOLIDACIÓN..."
      - city_date           : "Tarma, 30 de Abril del 2026" (autocalculada si no viene)
      - recipient_treatment : "Señor:" o "Señora:"
      - recipient_name      : "Mg. MANUEL ARMAS REAÑO"
      - recipient_position  : "DIRECTOR DE LA DIRECCIÓN DE FORMACIÓN..."
                              (puede ser multi-línea con \n)
      - recipient_city      : "LIMA"
      - asunto              : "REPORTE DE ESTUDIANTES MATRICULADOS 2026-I"
      - atencion_name       : "JHON SUAREZ ROJAS"
      - atencion_position   : "INGENIERO ENCARGADO DEL SISTEMA SIA"
      - body_paragraphs     : list[str]  (HTML básico permitido para <b>)
      - period              : "2026-I" (usado para el cuerpo por defecto)
    """
    page_w, page_h = A4

    buf = io.BytesIO()
    doc = BaseDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=PAGE_LEFT_MARGIN,
        rightMargin=PAGE_RIGHT_MARGIN,
        topMargin=PAGE_TOP_MARGIN,
        bottomMargin=PAGE_BOTTOM_MARGIN,
        title="Oficio",
    )

    frame = Frame(
        PAGE_LEFT_MARGIN, PAGE_BOTTOM_MARGIN,
        page_w - PAGE_LEFT_MARGIN - PAGE_RIGHT_MARGIN,
        page_h - PAGE_TOP_MARGIN - PAGE_BOTTOM_MARGIN,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        showBoundary=0,
    )

    safe_logo = _safe_image_path(logo_path)
    safe_sig = _safe_image_path(signature_path)

    def _on_page(c, d):
        _draw_letterhead(c, d, inst_data, safe_logo, safe_logo)

    template = PageTemplate(id="oficio", frames=[frame], onPage=_on_page)
    doc.addPageTemplates([template])

    # ── Estilos de párrafo ────────────────────────────────────
    styles = getSampleStyleSheet()
    sty_lema = ParagraphStyle(
        "lema", parent=styles["Normal"], fontName="Helvetica-Oblique",
        fontSize=10, alignment=TA_CENTER, textColor=colors.black,
        spaceAfter=10,
    )
    sty_date = ParagraphStyle(
        "date", parent=styles["Normal"], fontName="Helvetica",
        fontSize=11, alignment=TA_RIGHT, spaceAfter=14,
    )
    sty_oficio_num = ParagraphStyle(
        "oficio_num", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=11, alignment=TA_LEFT, spaceAfter=12,
        underlineWidth=0.7,
    )
    sty_recipient_label = ParagraphStyle(
        "rec_label", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=11, alignment=TA_LEFT, spaceAfter=2,
    )
    sty_recipient = ParagraphStyle(
        "rec", parent=styles["Normal"], fontName="Helvetica",
        fontSize=11, alignment=TA_LEFT, spaceAfter=2, leading=14,
    )
    sty_recipient_city = ParagraphStyle(
        "rec_city", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=11, alignment=TA_LEFT, spaceAfter=14,
    )
    sty_body = ParagraphStyle(
        "body", parent=styles["Normal"], fontName="Helvetica",
        fontSize=11, alignment=TA_JUSTIFY, leading=16,
        firstLineIndent=18, spaceAfter=10,
    )
    sty_atte = ParagraphStyle(
        "atte", parent=styles["Normal"], fontName="Helvetica",
        fontSize=11, alignment=TA_CENTER, spaceBefore=18, spaceAfter=4,
    )
    sty_signer = ParagraphStyle(
        "signer", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=10, alignment=TA_CENTER, spaceAfter=2,
    )
    sty_signer_role = ParagraphStyle(
        "signer_role", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=9, alignment=TA_CENTER, spaceAfter=2,
        textColor=colors.HexColor("#222222"),
    )

    # ── Construir contenido ───────────────────────────────────
    flow = []

    # Lema del año (centrado, itálico)
    lema = payload.get("lema") or (
        '"AÑO DE LA RECUPERACIÓN Y CONSOLIDACIÓN DE LA ECONOMIA PERUANA"'
    )
    flow.append(Paragraph(lema, sty_lema))

    # Fecha (alineada a la derecha)
    city_date = payload.get("city_date")
    if not city_date:
        today = date.today()
        city_date = (
            f"{inst_data.get('provincia', 'Tarma')}, "
            f"{today.day} de {MESES_ES.get(today.month, '')} del {today.year}"
        )
    flow.append(Paragraph(city_date, sty_date))

    # Of. N° (con subrayado simulado vía HTML)
    oficio_num = payload.get("oficio_number") or "—"
    oficio_year = payload.get("oficio_year") or str(date.today().year)
    oficio_str = (
        f'<u>Of. N° <b>{oficio_num}</b>-{oficio_year}-DG-IESPP"GALL"-T.</u>'
    )
    flow.append(Paragraph(oficio_str, sty_oficio_num))

    # Destinatario
    flow.append(Paragraph(payload.get("recipient_treatment") or "Señor:",
                          sty_recipient_label))
    flow.append(Paragraph(payload.get("recipient_name") or "—", sty_recipient))
    rec_pos = payload.get("recipient_position") or ""
    for ln in str(rec_pos).split("\n"):
        ln = ln.strip()
        if ln:
            flow.append(Paragraph(ln, sty_recipient))

    rec_city = payload.get("recipient_city") or "LIMA"
    flow.append(Paragraph(f"<u>{rec_city}.-</u>", sty_recipient_city))

    # Bloque ASUNTO / ATENCIÓN como tabla
    asunto = payload.get("asunto") or "REPORTE DE ESTUDIANTES MATRICULADOS"
    aten_name = payload.get("atencion_name") or ""
    aten_pos = payload.get("atencion_position") or ""

    asunto_tbl = Table(
        [
            ["ASUNTO", ":", asunto],
            ["ATENCIÓN", ":", aten_name],
            ["", "", aten_pos],
        ],
        colWidths=[28 * mm, 6 * mm, None],
    )
    asunto_tbl.setStyle(TableStyle([
        ("FONT", (0, 0), (1, -1), "Helvetica-Bold", 11),
        ("FONT", (2, 0), (2, 0), "Helvetica", 11),
        ("FONT", (2, 1), (2, -1), "Helvetica", 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, colors.grey),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    flow.append(asunto_tbl)
    flow.append(Spacer(1, 14))

    # Cuerpo (lista de párrafos)
    body_paragraphs = payload.get("body_paragraphs") or []
    if not body_paragraphs:
        period = payload.get("period") or "—"
        body_paragraphs = [
            (f"Tengo el agrado de dirigirme a usted, para saludarle "
             f"cordialmente a nombre del Instituto de Educación Superior "
             f"Pedagógico Público \"{inst_data.get('name','GUSTAVO ALLENDE LLAVERÍA')}\" "
             f"de {inst_data.get('provincia', 'Tarma')}, e informarle que ya "
             f"habiendo culminado con el proceso de matrícula se le hace "
             f"llegar el <b>REPORTE DE ESTUDIANTES MATRICULADOS</b> del "
             f"periodo académico {period} con los datos solicitados por su "
             f"dependencia. (Adjunto cuadro)"),
            ("Agradezco su atención al presente, aprovecho la oportunidad "
             "para expresarle a Usted, la seguridad de mi distinguida "
             "consideración y estima personal."),
        ]
    for p in body_paragraphs:
        flow.append(Paragraph(p, sty_body))

    # Atentamente
    flow.append(Paragraph("Atentamente,", sty_atte))

    # Firma (imagen centrada)
    if safe_sig:
        try:
            sig_img = Image(safe_sig, width=55 * mm, height=22 * mm)
            sig_img.hAlign = "CENTER"
            flow.append(sig_img)
        except Exception:
            flow.append(Spacer(1, 22 * mm))
    else:
        flow.append(Spacer(1, 22 * mm))

    # Director name + role
    director_name = inst_data.get("director_name") or "—"
    flow.append(Paragraph(director_name, sty_signer))
    flow.append(Paragraph("DIRECTOR(A) GENERAL", sty_signer_role))
    flow.append(Paragraph(
        f'I.E.S.P.P. "{inst_data.get("name", "GUSTAVO ALLENDE LLAVERIA")}"',
        sty_signer_role,
    ))

    doc.build(flow)
    return buf.getvalue()
