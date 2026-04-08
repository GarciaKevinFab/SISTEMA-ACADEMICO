"""
aulas_evaluacion_generator.py
═══════════════════════════════════════════════════════════════
Genera el PDF de "Aulas de Evaluación" para el Proceso de Admisión.

Agrupa postulantes en aulas de 25 y genera una tabla por aula con:
N°, Especialidad, DNI, Nombres, Ap. Paterno, Ap. Materno,
Foto, Aula, Modalidad Admisión, Huella, Firma
"""

import io
import os
import math
import logging
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image,
    PageBreak, KeepTogether,
)
from reportlab.platypus.flowables import HRFlowable

logger = logging.getLogger("admission.aulas")

PER_AULA = 25  # postulantes por aula

MESES_ES = {
    1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
    5: "mayo", 6: "junio", 7: "julio", 8: "agosto",
    9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre",
}


def _get_logo_path(inst):
    """Intenta obtener la ruta real del logo."""
    logo_path = inst.get("logo_path", "")
    if not logo_path:
        return None
    from django.conf import settings
    media_root = getattr(settings, "MEDIA_ROOT", "")
    full = os.path.join(media_root, logo_path) if media_root else logo_path
    if os.path.isfile(full):
        return full
    if os.path.isfile(logo_path):
        return logo_path
    return None


# Registrar pillow-heif para que Pillow reconozca HEIC/HEIF
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass  # pillow-heif no instalado, HEIC no se soportará


def _safe_image(path, width, height):
    """Retorna un Image de reportlab o '' si no existe.
    Pre-valida con Pillow para evitar crash en doc.build() con HEIC u otros
    formatos no soportados. Convierte a JPEG en memoria si es necesario.
    """
    if not path or not os.path.isfile(str(path)):
        return ""
    try:
        from PIL import Image as PILImage
        pil_img = PILImage.open(str(path))
        # Siempre convertir a JPEG en memoria para que ReportLab no falle
        buf = io.BytesIO()
        rgb = pil_img.convert("RGB")
        # Redimensionar si es muy grande (max 300px lado mayor para miniatura)
        rgb.thumbnail((300, 300), PILImage.LANCZOS)
        rgb.save(buf, format="JPEG", quality=85)
        buf.seek(0)
        return Image(buf, width=width, height=height)
    except Exception as exc:
        logger.warning("No se pudo cargar imagen %s: %s", path, exc)
        return ""


def generate_aulas_pdf(applicants: list, call_data: dict, inst: dict) -> bytes:
    """
    Genera el PDF de Aulas de Evaluación.

    applicants: lista de dicts con claves:
        numero, especialidad, dni, nombres, apellido_paterno, apellido_materno,
        foto_path, modalidad_admision, aula
    call_data: dict con call_name, period, exam_date
    inst: dict con institution_name, rvm, logo_path, city, etc.

    Retorna bytes del PDF.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=1.2 * cm,
        rightMargin=1.2 * cm,
        topMargin=1.0 * cm,
        bottomMargin=1.0 * cm,
    )

    styles = getSampleStyleSheet()

    # ── Colores ──
    BLUE_DARK = colors.HexColor("#1a237e")
    HEADER_BG = colors.HexColor("#1a237e")
    HEADER_FG = colors.white
    ROW_ALT = colors.HexColor("#f0f4ff")
    GRAY = colors.HexColor("#666666")

    # ── Estilos ──
    style_ministry = ParagraphStyle(
        "AulasMinistry", parent=styles["Normal"],
        fontSize=7, textColor=colors.HexColor("#333333"),
    )
    style_title = ParagraphStyle(
        "AulasTitle", parent=styles["Normal"],
        fontSize=14, fontName="Helvetica-Bold", alignment=TA_CENTER,
        textColor=colors.black, spaceAfter=2,
    )
    style_subtitle = ParagraphStyle(
        "AulasSubtitle", parent=styles["Normal"],
        fontSize=10, fontName="Helvetica-Bold", alignment=TA_CENTER,
        textColor=BLUE_DARK, spaceAfter=4,
    )
    style_aula_title = ParagraphStyle(
        "AulaTitle", parent=styles["Normal"],
        fontSize=12, fontName="Helvetica-Bold", alignment=TA_LEFT,
        textColor=BLUE_DARK, spaceBefore=6, spaceAfter=4,
    )
    style_cell = ParagraphStyle(
        "Cell", parent=styles["Normal"],
        fontSize=7, leading=9, alignment=TA_LEFT,
    )
    style_cell_center = ParagraphStyle(
        "CellCenter", parent=styles["Normal"],
        fontSize=7, leading=9, alignment=TA_CENTER,
    )
    style_header_cell = ParagraphStyle(
        "HeaderCell", parent=styles["Normal"],
        fontSize=7, fontName="Helvetica-Bold", textColor=HEADER_FG,
        leading=9, alignment=TA_CENTER,
    )
    style_info = ParagraphStyle(
        "Info", parent=styles["Normal"],
        fontSize=8.5, textColor=colors.HexColor("#333333"),
    )
    style_footer = ParagraphStyle(
        "DocFooter", parent=styles["Normal"],
        fontSize=6, alignment=TA_CENTER, textColor=colors.HexColor("#aaaaaa"),
    )

    now = datetime.now()
    inst_name = (inst.get("institution_name", "") or "GUSTAVO ALLENDE LLAVERÍA").strip('"').strip("'")
    rvm = inst.get("rvm", "")
    city = inst.get("city", "Tarma")
    call_name = (call_data.get("call_name", "") or "").upper()
    period_text = call_data.get("period", "") or ""
    exam_date_str = call_data.get("exam_date", "") or ""

    # Número total de aulas
    total_apps = len(applicants)
    n_aulas = math.ceil(total_apps / PER_AULA) if total_apps > 0 else 0

    elements = []

    def _build_header():
        """Construye el header institucional."""
        logo_path = _get_logo_path(inst)
        parts = []

        # Header con logo - texto en un solo Paragraph con <br/>
        inst_html = (
            'MINISTERIO DE EDUCACION<br/>'
            '<font size="11"><b>IESPP {}</b></font>'.format(inst_name)
        )
        if rvm:
            inst_html += '<br/><font size="6.5" color="#666666">{}</font>'.format(rvm)
        header_para = Paragraph(inst_html, style_ministry)

        if logo_path:
            logo_img = _safe_image(logo_path, 1.4 * cm, 1.4 * cm)
            if logo_img:
                header_tbl = Table(
                    [[logo_img, header_para]],
                    colWidths=[2 * cm, None],
                )
                header_tbl.setStyle(TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]))
                parts.append(header_tbl)
            else:
                parts.append(header_para)
        else:
            parts.append(header_para)

        parts.append(Spacer(1, 4 * mm))
        parts.append(HRFlowable(
            width="100%", thickness=1.5, color=BLUE_DARK, spaceAfter=4,
        ))
        parts.append(Paragraph("AULAS DE EVALUACION", style_title))
        if call_name:
            parts.append(Paragraph(call_name, style_subtitle))

        # Info row: convocatoria, fecha, total
        info_parts = []
        if period_text:
            info_parts.append("Periodo: {}".format(period_text))
        if exam_date_str:
            info_parts.append("Fecha de examen: {}".format(exam_date_str))
        info_parts.append("Total postulantes: {}".format(total_apps))
        info_parts.append("Total aulas: {}".format(n_aulas))

        info_text = "  |  ".join(info_parts)
        parts.append(Paragraph(info_text, style_info))
        parts.append(Spacer(1, 3 * mm))

        return parts

    # ── Columnas de la tabla ──
    # N°, Especialidad, DNI, Nombres, Ap.Paterno, Ap.Materno, Foto, Aula, Modalidad, Huella, Firma
    col_widths = [
        0.8 * cm,   # N°
        3.5 * cm,   # Especialidad
        2.0 * cm,   # DNI
        3.2 * cm,   # Nombres
        2.5 * cm,   # Ap. Paterno
        2.5 * cm,   # Ap. Materno
        1.8 * cm,   # Foto
        1.2 * cm,   # Aula
        3.0 * cm,   # Modalidad Admisión
        2.5 * cm,   # Huella
        2.5 * cm,   # Firma
    ]

    headers = ["N", "Especialidad", "DNI", "Nombres", "Ap. Paterno",
               "Ap. Materno", "Foto", "Aula", "Modalidad\nAdmision", "Huella", "Firma"]

    header_row = [Paragraph(h.replace("\n", "<br/>"), style_header_cell) for h in headers]

    # ── Generar aulas ──
    for aula_idx in range(n_aulas):
        start = aula_idx * PER_AULA
        end = min(start + PER_AULA, total_apps)
        aula_apps = applicants[start:end]
        aula_num = aula_idx + 1

        # Header en cada página
        if aula_idx > 0:
            elements.append(PageBreak())

        elements.extend(_build_header())
        elements.append(Paragraph(
            f"AULA {aula_num}  -  Postulantes {start + 1} al {end}",
            style_aula_title,
        ))

        # Data rows
        table_data = [header_row]

        for i, app in enumerate(aula_apps):
            row_num = start + i + 1

            # Foto como imagen miniatura
            foto_path = app.get("foto_path", "")
            foto_cell = _safe_image(foto_path, 1.4 * cm, 1.7 * cm) if foto_path else ""

            row = [
                Paragraph(str(row_num), style_cell_center),
                Paragraph(str(app.get("especialidad", "")), style_cell),
                Paragraph(str(app.get("dni", "")), style_cell_center),
                Paragraph(str(app.get("nombres", "")), style_cell),
                Paragraph(str(app.get("apellido_paterno", "")), style_cell),
                Paragraph(str(app.get("apellido_materno", "")), style_cell),
                foto_cell,
                Paragraph(str(aula_num), style_cell_center),
                Paragraph(str(app.get("modalidad_admision", "")), style_cell),
                "",  # Huella (vacío para llenar)
                "",  # Firma (vacío para llenar)
            ]
            table_data.append(row)

        # Alturas de filas: header=auto, datos=2cm para foto
        row_heights = [None] + [2.0 * cm] * (len(table_data) - 1)

        tbl = Table(table_data, colWidths=col_widths, rowHeights=row_heights, repeatRows=1)

        # Estilos de la tabla
        tbl_style = [
            # Header
            ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), HEADER_FG),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 7),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),

            # Grid
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
            ("BOX", (0, 0), (-1, -1), 1, BLUE_DARK),
            ("BOX", (0, 0), (-1, 0), 1, BLUE_DARK),

            # Padding
            ("TOPPADDING", (0, 1), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),

            # Header padding
            ("TOPPADDING", (0, 0), (-1, 0), 5),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
        ]

        # Filas alternadas
        for row_idx in range(1, len(table_data)):
            if row_idx % 2 == 0:
                tbl_style.append(("BACKGROUND", (0, row_idx), (-1, row_idx), ROW_ALT))

        tbl.setStyle(TableStyle(tbl_style))
        elements.append(tbl)

        # Footer de aula
        elements.append(Spacer(1, 3 * mm))
        elements.append(Paragraph(
            "Aula {} - {} postulante{}".format(aula_num, len(aula_apps), "s" if len(aula_apps) != 1 else ""),
            ParagraphStyle("AulaFooter_{}" .format(aula_num), parent=styles["Normal"],
                           fontSize=7, textColor=GRAY, alignment=TA_LEFT),
        ))

    # ── Footer general ──
    elements.append(Spacer(1, 5 * mm))
    elements.append(HRFlowable(
        width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceAfter=3,
    ))
    elements.append(Paragraph(
        "Generado el {} - IESPP {}".format(now.strftime('%d/%m/%Y %H:%M'), inst_name),
        style_footer,
    ))

    doc.build(elements)
    return buf.getvalue()
