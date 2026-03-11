"""
admission_acta_reportlab.py
═══════════════════════════════════════════════════════════════
Genera el Acta de Resultados del Proceso de Admisión usando ReportLab.

Fallback cuando WeasyPrint no está disponible.
"""

import io
import os
import logging
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image,
)
from reportlab.platypus.flowables import HRFlowable

logger = logging.getLogger("admission.acta")

MESES_ES = {
    1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
    5: "mayo", 6: "junio", 7: "julio", 8: "agosto",
    9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre",
}

STATUS_LABELS = {
    "ADMITTED": "INGRESANTE",
    "INGRESANTE": "INGRESANTE",
    "NOT_ADMITTED": "NO ADMITIDO",
    "WAITING_LIST": "LISTA DE ESPERA",
    "REGISTERED": "REGISTRADO",
    "EVALUATED": "EVALUADO",
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


def generate_acta_pdf_reportlab(results: list, call_data: dict, inst: dict) -> bytes:
    """
    Genera el PDF del Acta de Resultados usando ReportLab.
    Retorna bytes del PDF.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # ── Colores institucionales ──
    BLUE_DARK = colors.HexColor("#1a237e")
    GREEN_DARK = colors.HexColor("#1b5e20")
    RED_DARK = colors.HexColor("#b71c1c")
    ORANGE_DARK = colors.HexColor("#e65100")
    GRAY = colors.HexColor("#666666")

    # ── Estilos personalizados ──
    style_ministry = ParagraphStyle(
        "Ministry", parent=styles["Normal"],
        fontSize=7, textColor=colors.HexColor("#333333"),
    )
    style_inst = ParagraphStyle(
        "Institution", parent=styles["Normal"],
        fontSize=11, fontName="Helvetica-Bold", textColor=BLUE_DARK,
    )
    style_rvm = ParagraphStyle(
        "RVM", parent=styles["Normal"],
        fontSize=6.5, textColor=GRAY,
    )
    style_title = ParagraphStyle(
        "ActaTitle", parent=styles["Normal"],
        fontSize=13, fontName="Helvetica-Bold", alignment=TA_CENTER,
        textColor=colors.black, spaceAfter=6,
    )
    style_info_label = ParagraphStyle(
        "InfoLabel", parent=styles["Normal"],
        fontSize=8.5, fontName="Helvetica-Bold", textColor=colors.HexColor("#333333"),
    )
    style_info_value = ParagraphStyle(
        "InfoValue", parent=styles["Normal"],
        fontSize=8.5,
    )
    style_fecha = ParagraphStyle(
        "Fecha", parent=styles["Normal"],
        fontSize=9, alignment=TA_CENTER, spaceBefore=14, spaceAfter=10,
    )
    style_firma_name = ParagraphStyle(
        "FirmaName", parent=styles["Normal"],
        fontSize=9, fontName="Helvetica-Bold", alignment=TA_CENTER,
    )
    style_firma_cargo = ParagraphStyle(
        "FirmaCargo", parent=styles["Normal"],
        fontSize=8, alignment=TA_CENTER, textColor=colors.HexColor("#333333"),
    )
    style_firma_inst = ParagraphStyle(
        "FirmaInst", parent=styles["Normal"],
        fontSize=7.5, alignment=TA_CENTER, textColor=colors.HexColor("#555555"),
    )
    style_footer = ParagraphStyle(
        "DocFooter", parent=styles["Normal"],
        fontSize=6, alignment=TA_CENTER, textColor=colors.HexColor("#aaaaaa"),
    )
    style_resumen = ParagraphStyle(
        "Resumen", parent=styles["Normal"],
        fontSize=8.5, fontName="Helvetica-Bold",
    )

    now = datetime.now()

    # ── Datos ──
    inst_name = (inst.get("institution_name", "") or "GUSTAVO ALLENDE LLAVERÍA").strip('"').strip("'")
    city = inst.get("city", "Tarma")
    director_name = inst.get("director_name", "")
    director_title = (inst.get("director_title", "DIRECTOR GENERAL") or "").upper()
    rvm = inst.get("rvm", "")

    call_name = (call_data.get("call_name", "") or "").upper()
    career_name = (call_data.get("career_name", "") or "TODAS LAS CARRERAS").upper()
    academic_year = call_data.get("academic_year", "") or ""
    academic_period = call_data.get("academic_period", "") or ""
    period_text = f"{academic_year}-{academic_period}" if academic_year and academic_period else (academic_year or "")

    fecha_doc = f"{city}, {now.day} de {MESES_ES[now.month]} del {now.year}"

    # ══════════════════════════════════════════════════════
    # HEADER INSTITUCIONAL
    # ══════════════════════════════════════════════════════
    logo_path = _get_logo_path(inst)

    header_texts = []
    header_texts.append(Paragraph("MINISTERIO DE EDUCACIÓN", style_ministry))
    header_texts.append(Paragraph("INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO", style_ministry))
    header_texts.append(Paragraph(f'"{inst_name}"', style_inst))
    if rvm:
        header_texts.append(Paragraph(rvm, style_rvm))

    if logo_path:
        try:
            logo_img = Image(logo_path, width=45, height=45)
            header_table_data = [[logo_img, header_texts]]
        except Exception:
            header_table_data = [["", header_texts]]
    else:
        header_table_data = [["", header_texts]]

    header_table = Table(header_table_data, colWidths=[55, None])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 8),
    ]))

    elements.append(header_table)
    elements.append(Spacer(1, 2 * mm))
    elements.append(HRFlowable(width="100%", thickness=2, color=BLUE_DARK))
    elements.append(Spacer(1, 8 * mm))

    # ══════════════════════════════════════════════════════
    # TÍTULO
    # ══════════════════════════════════════════════════════
    elements.append(Paragraph(
        '<u>ACTA DE RESULTADOS DEL PROCESO DE ADMISIÓN</u>',
        style_title,
    ))
    elements.append(Spacer(1, 6 * mm))

    # ══════════════════════════════════════════════════════
    # INFO CONVOCATORIA
    # ══════════════════════════════════════════════════════
    info_data = []
    info_row = []
    info_row.append(Paragraph(f'<b>Convocatoria:</b> {call_name}', style_info_value))
    info_row.append(Paragraph(f'<b>Programa de Estudios:</b> {career_name}', style_info_value))
    info_data.append(info_row)

    info_row2 = []
    if period_text:
        info_row2.append(Paragraph(f'<b>Período:</b> {period_text}', style_info_value))
    else:
        info_row2.append(Paragraph("", style_info_value))
    info_row2.append(Paragraph(f'<b>Fecha:</b> {fecha_doc}', style_info_value))
    info_data.append(info_row2)

    info_table = Table(info_data, colWidths=[doc.width * 0.5, doc.width * 0.5])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 6 * mm))

    # ══════════════════════════════════════════════════════
    # TABLA DE RESULTADOS
    # ══════════════════════════════════════════════════════
    # Header
    table_header = ["N°", "POSTULANTE", "DNI", "FASE I", "FASE II", "TOTAL", "RESULTADO"]

    style_th = ParagraphStyle(
        "TH", parent=styles["Normal"],
        fontSize=7.5, fontName="Helvetica-Bold", textColor=colors.white,
        alignment=TA_CENTER,
    )
    style_td = ParagraphStyle(
        "TD", parent=styles["Normal"],
        fontSize=7.5, alignment=TA_CENTER,
    )
    style_td_name = ParagraphStyle(
        "TDName", parent=styles["Normal"],
        fontSize=7.5, alignment=TA_LEFT,
    )
    style_td_num = ParagraphStyle(
        "TDNum", parent=styles["Normal"],
        fontSize=7.5, fontName="Courier-Bold", alignment=TA_CENTER,
    )

    table_data = [[Paragraph(h, style_th) for h in table_header]]

    for i, r in enumerate(results, 1):
        name = (r.get("applicant_name", "") or "—").upper()
        dni = r.get("dni", "") or "—"
        p1 = r.get("phase1_total", 0) or 0
        p2 = r.get("phase2_total", 0) or 0
        total = r.get("final_score", 0) or 0
        status = r.get("status", "")
        status_label = STATUS_LABELS.get(status, status)

        # Color del estado
        if status in ("ADMITTED", "INGRESANTE"):
            status_style = ParagraphStyle("st", parent=style_td, textColor=GREEN_DARK, fontName="Helvetica-Bold")
        elif status == "NOT_ADMITTED":
            status_style = ParagraphStyle("st", parent=style_td, textColor=RED_DARK, fontSize=7)
        elif status == "WAITING_LIST":
            status_style = ParagraphStyle("st", parent=style_td, textColor=ORANGE_DARK, fontSize=7)
        else:
            status_style = style_td

        total_style = ParagraphStyle("tot", parent=style_td_num, fontName="Courier-Bold", fontSize=8)

        table_data.append([
            Paragraph(str(i), style_td),
            Paragraph(name, style_td_name),
            Paragraph(str(dni), style_td),
            Paragraph(f"{p1:.2f}", style_td_num),
            Paragraph(f"{p2:.2f}", style_td_num),
            Paragraph(f"{total:.2f}", total_style),
            Paragraph(status_label, status_style),
        ])

    if not results:
        table_data.append([
            Paragraph(
                '<i>Sin postulantes registrados</i>',
                ParagraphStyle("empty", parent=style_td, textColor=colors.HexColor("#999999"), fontSize=8),
            ),
            "", "", "", "", "", "",
        ])

    col_widths = [25, None, 55, 42, 42, 42, 65]
    # Calculate the "None" column (name) width
    fixed = sum(w for w in col_widths if w is not None)
    name_width = doc.width - fixed
    col_widths[1] = name_width

    result_table = Table(table_data, colWidths=col_widths, repeatRows=1)

    # Styles for the table
    table_styles = [
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), BLUE_DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7.5),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        # All cells
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]

    # Alternate row colors
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            table_styles.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f8f9ff")))

    # Green background for admitted
    for i, r in enumerate(results, 1):
        if r.get("status") in ("ADMITTED", "INGRESANTE"):
            table_styles.append(("BACKGROUND", (-1, i), (-1, i), colors.HexColor("#e8f5e9")))

    result_table.setStyle(TableStyle(table_styles))
    elements.append(result_table)
    elements.append(Spacer(1, 6 * mm))

    # ══════════════════════════════════════════════════════
    # RESUMEN
    # ══════════════════════════════════════════════════════
    total_count = len(results)
    admitted = sum(1 for r in results if r.get("status") in ("ADMITTED", "INGRESANTE"))
    not_admitted = sum(1 for r in results if r.get("status") == "NOT_ADMITTED")
    waiting = sum(1 for r in results if r.get("status") == "WAITING_LIST")

    resumen_parts = [f"Total postulantes: {total_count}"]
    resumen_parts.append(f"Ingresantes: {admitted}")
    if not_admitted:
        resumen_parts.append(f"No admitidos: {not_admitted}")
    if waiting:
        resumen_parts.append(f"Lista de espera: {waiting}")

    resumen_text = "     |     ".join(resumen_parts)
    elements.append(Paragraph(resumen_text, style_resumen))
    elements.append(Spacer(1, 10 * mm))

    # ══════════════════════════════════════════════════════
    # FECHA
    # ══════════════════════════════════════════════════════
    elements.append(Paragraph(fecha_doc, style_fecha))
    elements.append(Spacer(1, 12 * mm))

    # ══════════════════════════════════════════════════════
    # FIRMA
    # ══════════════════════════════════════════════════════
    # Firma image
    firma_path = inst.get("firma_director_path", "")
    if firma_path:
        from django.conf import settings as dj_settings
        media_root = getattr(dj_settings, "MEDIA_ROOT", "")
        firma_full = os.path.join(media_root, firma_path) if media_root else firma_path
        if os.path.isfile(firma_full):
            try:
                firma_img = Image(firma_full, width=80, height=35)
                firma_img.hAlign = "CENTER"
                elements.append(firma_img)
            except Exception:
                elements.append(Spacer(1, 15 * mm))
        else:
            elements.append(Spacer(1, 15 * mm))
    else:
        elements.append(Spacer(1, 15 * mm))

    # Line
    elements.append(HRFlowable(width=180, thickness=1, color=colors.black, hAlign="CENTER"))
    elements.append(Spacer(1, 1 * mm))

    if director_name:
        elements.append(Paragraph(director_name, style_firma_name))
    elements.append(Paragraph(director_title, style_firma_cargo))
    elements.append(Paragraph(f'I.E.S.P.P. "{inst_name}"', style_firma_inst))

    elements.append(Spacer(1, 10 * mm))

    # ══════════════════════════════════════════════════════
    # FOOTER
    # ══════════════════════════════════════════════════════
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#eeeeee")))
    elements.append(Spacer(1, 2 * mm))
    elements.append(Paragraph(
        "Documento generado automáticamente — Área de Innovación e Investigación - Informática",
        style_footer,
    ))

    # Build
    doc.build(elements)
    return buf.getvalue()
