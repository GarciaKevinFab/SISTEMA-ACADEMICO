"""
ficha_matricula_generator.py
Genera la Ficha de Matrícula en PDF usando HTML + WeasyPrint.
Diseño profesional institucional con paleta azul oscuro + dorado.
"""

import io
import logging
import os
import base64
from datetime import datetime

logger = logging.getLogger("academic.processes")

try:
    from weasyprint import HTML as WeasyHTML, CSS
    HAS_WEASYPRINT = True
except ImportError:
    HAS_WEASYPRINT = False

MESES = {
    1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
    5: "mayo", 6: "junio", 7: "julio", 8: "agosto",
    9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre",
}


def _to_roman(n) -> str:
    try:
        n = int(n)
    except (ValueError, TypeError):
        return str(n)
    vals = [
        (10, "X"), (9, "IX"), (8, "VIII"), (7, "VII"), (6, "VI"),
        (5, "V"), (4, "IV"), (3, "III"), (2, "II"), (1, "I"),
    ]
    result = ""
    for v, s in vals:
        while n >= v:
            result += s
            n -= v
    return result or str(n)


def _ciclo_int(student: dict):
    try:
        return int(student.get("ciclo", 0))
    except (ValueError, TypeError):
        return None


def _logo_base64(logo_path: str) -> str:
    if not logo_path or not os.path.exists(logo_path):
        return ""
    try:
        with open(logo_path, "rb") as f:
            data = base64.b64encode(f.read()).decode("utf-8")
        ext = os.path.splitext(logo_path)[1].lower().lstrip(".")
        mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "gif": "gif"}.get(ext, "png")
        return f"data:image/{mime};base64,{data}"
    except Exception as e:
        logger.warning(f"Error cargando logo para HTML: {e}")
        return ""


def _resolve_logo_path(logo_url_or_path: str, media_root: str = "") -> str:
    if not logo_url_or_path:
        return ""
    p = str(logo_url_or_path)
    if "/media/" in p:
        rel = p.split("/media/")[-1]
        full = os.path.join(media_root, rel)
        if os.path.exists(full):
            return full
    if p.startswith("/") and os.path.exists(p):
        return p
    full = os.path.join(media_root, p.lstrip("/"))
    if os.path.exists(full):
        return full
    return ""


def _resolve_signature(url_or_path: str, media_root: str = "") -> str:
    """Resolve a signature/sello image to base64 data URI."""
    path = _resolve_logo_path(url_or_path, media_root)
    return _logo_base64(path)


def _build_html(
    process,
    student: dict,
    extra: dict,
    inst: dict,
    courses: list,
) -> str:
    now     = datetime.now()
    period  = extra.get("period", student.get("periodo", f"{now.year}-I"))
    ciclo   = student.get("ciclo", "") or extra.get("cycle", "I")
    seccion = student.get("seccion", "") or extra.get("section", "A")
    ciclo_romano = _to_roman(ciclo) if str(ciclo).isdigit() else str(ciclo)
    ciclo_seccion = f'{ciclo_romano} - "{seccion}"'

    carrera    = student.get("carrera", "") or extra.get("career", "")
    nombres    = student.get("nombres", "")
    apellidos  = student.get("apellidos", "")
    nombre_ficha = f"{apellidos.upper()} {nombres}".strip() if apellidos else student.get("nombre_completo", "")
    codigo     = student.get("codigo", "") or student.get("dni", "")
    resolucion = extra.get("resolucion", "")

    # ── Institución ──
    short_name  = inst.get("short_name", "I.E.S.P.P.")
    inst_nombre = inst.get("institution_name", '"GUSTAVO ALLENDE LLAVERÍA"')
    cod_modular = inst.get("modular_code", "0609370")
    gestion     = inst.get("management", "Pública")
    ds_creation = inst.get("ds_creation", "D.S. 059-1984-ED")
    address     = inst.get("address", "")
    province    = inst.get("province", "Tarma")
    district    = inst.get("district", province)
    region      = inst.get("region", "Junín")
    director_name  = inst.get("director_name", "")
    secretary_name = inst.get("secretary_name", "")

    if not resolucion:
        resolucion = inst.get("resolution", "")

    # ── Celdas individuales del código modular ──
    cod_digits = list(cod_modular.ljust(7))
    cod_cells = "".join(f'<td class="cod-cell">{d}</td>' for d in cod_digits)

    # ── Logo y firmas ──
    try:
        from django.conf import settings
        media_root = settings.MEDIA_ROOT
    except Exception:
        media_root = ""

    logo_path = _resolve_logo_path(inst.get("logo_url", ""), media_root)
    logo_src  = _logo_base64(logo_path)
    logo_html = (
        f'<img src="{logo_src}" alt="Logo" class="logo">'
        if logo_src else ""
    )

    # Firmas del director y secretario
    dir_sig_src = _resolve_signature(inst.get("signature_url", ""), media_root)
    sec_sig_src = _resolve_signature(inst.get("secretary_signature_url", ""), media_root)

    dir_sig_html = f'<img src="{dir_sig_src}" class="firma-img">' if dir_sig_src else ""
    sec_sig_html = f'<img src="{sec_sig_src}" class="firma-img">' if sec_sig_src else ""

    dir_name_html = f'<div class="firma-nombre">{director_name}</div>' if director_name else ""
    sec_name_html = f'<div class="firma-nombre">{secretary_name}</div>' if secretary_name else ""

    # ── Tabla de cursos ──
    total_horas    = sum(c.get("horas", 0) or 0 for c in courses)
    total_creditos = sum(c.get("creditos", 0) or 0 for c in courses)

    course_rows = ""
    if courses:
        for i, c in enumerate(courses, 1):
            nombre   = c.get("nombre", "—")
            horas    = c.get("horas", "")
            creditos = c.get("creditos", "")
            zebra = ' class="zebra"' if i % 2 == 0 else ""
            course_rows += f"""
            <tr{zebra}>
                <td class="c-num">{i}</td>
                <td class="c-name">{nombre}</td>
                <td class="c-val">{horas}</td>
                <td class="c-val">{creditos}</td>
            </tr>"""
    else:
        for i in range(1, 8):
            zebra = ' class="zebra"' if i % 2 == 0 else ""
            course_rows += f"""
            <tr{zebra}>
                <td class="c-num">{i}</td>
                <td class="c-name"></td><td class="c-val"></td><td class="c-val"></td>
            </tr>"""

    # ── Subsanación ──
    subsanacion_courses = extra.get("subsanacion_courses", [])
    sub_rows = ""
    if subsanacion_courses:
        for i, c in enumerate(subsanacion_courses, 1):
            sub_rows += f"""
            <tr>
                <td class="c-num">{i}</td>
                <td class="c-name">{c.get("nombre", "")}</td>
                <td class="c-val">{c.get("horas", "")}</td>
                <td class="c-val">{c.get("creditos", "")}</td>
            </tr>"""
    else:
        sub_rows = """
        <tr>
            <td class="c-num">1</td>
            <td class="c-name"></td><td class="c-val"></td><td class="c-val"></td>
        </tr>"""

    process_id = getattr(process, "id", 0) or 0

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page {{
    size: A4 portrait;
    margin: 1.2cm 1.5cm 1.2cm 1.5cm;
  }}

  * {{ box-sizing: border-box; margin: 0; padding: 0; }}

  body {{
    font-family: "Segoe UI", Calibri, Arial, sans-serif;
    font-size: 9pt;
    color: #1a1a1a;
    line-height: 1.35;
  }}

  /* ══ HEADER — Franja azul oscuro con línea dorada ══ */
  .header {{
    background: #0d1b3e;
    margin: -1.2cm -1.5cm 0 -1.5cm;
    padding: 14px 1.5cm 12px 1.5cm;
    display: flex;
    align-items: center;
    position: relative;
  }}
  .header::after {{
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: #c5a44e;
  }}
  .header .logo {{
    width: 52px;
    height: 52px;
    object-fit: contain;
    margin-right: 12px;
    border-radius: 4px;
  }}
  .header-text {{
    flex: 1;
  }}
  .header-ministry {{
    font-size: 6.5pt;
    color: rgba(255,255,255,0.6);
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }}
  .header-inst {{
    font-size: 8pt;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.3px;
  }}
  .header-inst-name {{
    font-size: 7.5pt;
    color: rgba(255,255,255,0.75);
    margin-top: 1px;
  }}
  .header-right {{
    text-align: right;
  }}
  .header-right-label {{
    font-size: 6pt;
    color: #c5a44e;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    font-weight: 700;
  }}
  .header-right-period {{
    font-size: 10pt;
    font-weight: 800;
    color: #ffffff;
    margin-top: 1px;
  }}
  .header-right-code {{
    font-size: 7pt;
    color: rgba(255,255,255,0.6);
    margin-top: 1px;
  }}

  /* ══ TÍTULO ══ */
  .title-section {{
    text-align: center;
    margin: 14px 0 10px;
  }}
  .title-text {{
    font-size: 16pt;
    font-weight: 800;
    letter-spacing: 3px;
    color: #0d1b3e;
    text-transform: uppercase;
    display: inline-block;
    position: relative;
    padding-bottom: 6px;
  }}
  .title-text::after {{
    content: '';
    position: absolute;
    bottom: 0;
    left: 10%;
    right: 10%;
    height: 2.5px;
    background: #c5a44e;
    border-radius: 2px;
  }}
  .title-sub {{
    font-size: 7pt;
    color: #888;
    margin-top: 4px;
    letter-spacing: 0.5px;
  }}

  /* ══ TABLAS GENERALES ══ */
  table {{
    width: 100%;
    border-collapse: collapse;
  }}

  /* ══ BLOQUE INSTITUCIONAL ══ */
  .inst-table {{
    margin-top: 2px;
  }}
  .inst-table td {{
    border: 1px solid #c5ccd6;
    padding: 3px 6px;
    vertical-align: middle;
    font-size: 7.5pt;
  }}
  .inst-table .lbl {{
    font-weight: 700;
    font-size: 6.5pt;
    background: #eef1f6;
    color: #3a4a5c;
    white-space: nowrap;
  }}
  .inst-table .val {{
    font-size: 8pt;
    color: #1a1a1a;
  }}
  .inst-table .val-bold {{
    font-size: 8pt;
    font-weight: 700;
    color: #0d1b3e;
  }}
  .cod-cell {{
    text-align: center;
    font-weight: 700;
    font-size: 8.5pt;
    width: 20px;
    padding: 2px 3px;
    background: #fff;
    border: 1px solid #c5ccd6;
    color: #0d1b3e;
  }}

  /* ══ BLOQUE ALUMNO ══ */
  .student-table {{
    margin-top: 4px;
  }}
  .student-table td {{
    border: 1px solid #c5ccd6;
    padding: 4px 8px;
    vertical-align: middle;
    font-size: 8pt;
  }}
  .student-table .lbl {{
    font-weight: 700;
    font-size: 7pt;
    background: #eef1f6;
    color: #3a4a5c;
  }}
  .student-table .val {{
    font-size: 8.5pt;
    color: #1a1a1a;
  }}
  .student-table .val-bold {{
    font-size: 8.5pt;
    font-weight: 700;
    color: #0d1b3e;
  }}

  /* ══ SECCIÓN HEADER ══ */
  .section-header {{
    background: #0d1b3e;
    color: #ffffff;
    font-weight: 700;
    font-size: 8pt;
    text-align: center;
    padding: 5px 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
    border: none;
  }}

  /* ══ TABLA DE CURSOS ══ */
  .courses-table {{
    margin-top: 8px;
  }}
  .courses-table th {{
    background: #0d1b3e;
    color: #fff;
    font-weight: 700;
    font-size: 7.5pt;
    text-align: center;
    padding: 5px 4px;
    border: 1px solid #0d1b3e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}
  .courses-table td {{
    border: 1px solid #d0d5dd;
    padding: 4px 6px;
    font-size: 8pt;
  }}
  .c-num {{
    text-align: center;
    width: 5%;
    color: #64748b;
    font-weight: 600;
  }}
  .c-name {{
    text-align: left;
    padding-left: 10px !important;
    color: #1a1a1a;
  }}
  .c-val {{
    text-align: center;
    width: 12%;
    font-weight: 600;
    color: #0d1b3e;
  }}
  .zebra td {{
    background: #f0f4f8;
  }}
  .row-total td {{
    font-weight: 700;
    font-size: 8.5pt;
    background: #e8edf4 !important;
    border-top: 2px solid #0d1b3e;
    padding: 5px;
    color: #0d1b3e;
  }}

  /* ══ SUBSANACIÓN ══ */
  .sub-table {{
    margin-top: 8px;
  }}
  .sub-table th {{
    background: #8b6914;
    color: #fff;
    font-weight: 700;
    font-size: 7.5pt;
    text-align: center;
    padding: 5px 4px;
    border: 1px solid #8b6914;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}
  .sub-table td {{
    border: 1px solid #d0d5dd;
    padding: 4px 6px;
    font-size: 8pt;
  }}

  /* ══ FIRMAS ══ */
  .firmas {{
    width: 100%;
    margin-top: 35px;
    border: none;
  }}
  .firmas td {{
    border: none;
    text-align: center;
    vertical-align: bottom;
    padding: 0 8px;
    width: 33.3%;
  }}
  .firma-img {{
    max-width: 90px;
    max-height: 45px;
    object-fit: contain;
    margin-bottom: 2px;
  }}
  .firma-nombre {{
    font-size: 7.5pt;
    font-weight: 700;
    color: #0d1b3e;
    margin-bottom: 0;
  }}
  .firma-linea {{
    border-top: 1.5px solid #0d1b3e;
    padding-top: 4px;
    font-weight: 700;
    font-size: 7.5pt;
    color: #0d1b3e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}
  .firma-sub {{
    font-size: 6.5pt;
    color: #888;
    margin-top: 1px;
  }}

  /* ══ FOOTER ══ */
  .footer {{
    text-align: center;
    font-size: 6pt;
    color: #aaa;
    margin-top: 12px;
    padding-top: 6px;
    border-top: 1.5px solid #c5a44e;
  }}
  .footer-inst {{
    font-size: 5.5pt;
    color: #bbb;
    margin-top: 2px;
  }}
</style>
</head>
<body>

<!-- ═══ HEADER — Franja azul oscuro ═══ -->
<div class="header">
  {f'<img src="{logo_src}" alt="Logo" class="logo">' if logo_src else ''}
  <div class="header-text">
    <div class="header-ministry">MINISTERIO DE EDUCACI&Oacute;N</div>
    <div class="header-inst">INSTITUTO DE EDUCACI&Oacute;N SUPERIOR PEDAG&Oacute;GICO P&Uacute;BLICO</div>
    <div class="header-inst-name">{inst_nombre}</div>
  </div>
  <div class="header-right">
    <div class="header-right-label">Per&iacute;odo Acad&eacute;mico</div>
    <div class="header-right-period">{period}</div>
    <div class="header-right-code">C&oacute;d. Modular: {cod_modular}</div>
  </div>
</div>

<!-- ═══ TÍTULO ═══ -->
<div class="title-section">
  <div class="title-text">Ficha de Matr&iacute;cula</div>
  <div class="title-sub">Proceso #{process_id:05d}</div>
</div>

<!-- ═══ BLOQUE 1: INSTITUCIÓN ═══ -->
<table class="inst-table">
  <tr>
    <td class="lbl" style="width:16%">Nombre de la Instituci&oacute;n</td>
    <td class="val-bold" colspan="10">{inst_nombre}</td>
    <td class="lbl" style="width:5%">DREJ / UGEL</td>
    <td class="val" style="width:8%; text-align:center">{region}</td>
  </tr>
  <tr>
    <td class="lbl">C&oacute;digo Modular</td>
    <td class="lbl" style="text-align:center">Denominaci&oacute;n</td>
    <td class="lbl" style="text-align:center">Gesti&oacute;n</td>
    <td class="lbl" colspan="2" style="text-align:center; font-size:6pt">D.S. Creaci&oacute;n</td>
    <td class="lbl" colspan="5" style="text-align:center">Direcci&oacute;n</td>
    <td class="lbl" colspan="3" style="text-align:center">Provincia / Distrito</td>
  </tr>
  <tr>
    {cod_cells}
    <td class="val" style="text-align:center">{short_name}</td>
    <td class="val" style="text-align:center">{gestion}</td>
    <td class="val" style="text-align:center" colspan="2">{ds_creation}</td>
    <td class="val" colspan="3" style="font-size:7pt">{address}</td>
    <td class="val" colspan="2" style="text-align:center; font-size:7.5pt">{province} / {district}</td>
  </tr>
</table>

<!-- ═══ BLOQUE 2: PROGRAMA, RESOLUCIÓN, ALUMNO ═══ -->
<table class="student-table">
  <tr>
    <td class="lbl" style="width:22%">Programa de Estudios</td>
    <td class="val-bold" style="width:32%">{carrera.upper() if carrera else ""}</td>
    <td class="lbl" style="width:18%; text-align:center">Per&iacute;odo Acad&eacute;mico</td>
    <td class="val-bold" style="width:28%; text-align:center">{period}</td>
  </tr>
  <tr>
    <td class="lbl">Resoluci&oacute;n de Autorizaci&oacute;n</td>
    <td class="val">{resolucion}</td>
    <td class="lbl" style="text-align:center">Ciclo - Secci&oacute;n</td>
    <td class="val-bold" style="text-align:center">{ciclo_seccion}</td>
  </tr>
  <tr>
    <td class="lbl">Nombres y Apellidos</td>
    <td class="val-bold">{nombre_ficha}</td>
    <td class="lbl" style="text-align:center">C&Oacute;DIGO</td>
    <td class="val-bold" style="text-align:center">{codigo}</td>
  </tr>
</table>

<!-- ═══ BLOQUE 3: TABLA DE CURSOS ═══ -->
<table class="courses-table">
  <colgroup>
    <col style="width:5%">
    <col style="width:67%">
    <col style="width:14%">
    <col style="width:14%">
  </colgroup>
  <tr>
    <th>N&deg;</th>
    <th>Asignatura</th>
    <th>Horas</th>
    <th>Cr&eacute;ditos</th>
  </tr>
  {course_rows}
  <tr class="row-total">
    <td></td>
    <td style="text-align:center">TOTAL</td>
    <td style="text-align:center">{total_horas if courses else ""}</td>
    <td style="text-align:center">{total_creditos if courses else ""}</td>
  </tr>
</table>

<!-- ═══ BLOQUE 4: SUBSANACIÓN ═══ -->
<table class="sub-table">
  <colgroup>
    <col style="width:5%">
    <col style="width:67%">
    <col style="width:14%">
    <col style="width:14%">
  </colgroup>
  <tr>
    <th>N&deg;</th>
    <th>Cursos de Subsanaci&oacute;n</th>
    <th>Horas</th>
    <th>Cr&eacute;ditos</th>
  </tr>
  {sub_rows}
</table>

<!-- ═══ BLOQUE 5: FIRMAS ═══ -->
<table class="firmas">
  <tr style="height:45px;">
    <td>{dir_sig_html}</td>
    <td>{sec_sig_html}</td>
    <td></td>
  </tr>
  <tr>
    <td>
      {dir_name_html}
      <div class="firma-linea">Director(a) General</div>
      <div class="firma-sub">Firma, Post Firma y Sello</div>
    </td>
    <td>
      {sec_name_html}
      <div class="firma-linea">Secretario(a) Acad&eacute;mico</div>
      <div class="firma-sub">Firma, Post Firma y Sello</div>
    </td>
    <td>
      <div class="firma-linea">Estudiante</div>
    </td>
  </tr>
</table>

<div class="footer">
  Documento generado por el Sistema Acad&eacute;mico | Proceso #{process_id:05d} | {now.strftime("%d/%m/%Y %H:%M")}
  <div class="footer-inst">{short_name} {inst_nombre} &mdash; {province}, {region}</div>
</div>

</body>
</html>"""
    return html


# ═══════════════════════════════════════════════════════════════
# FUNCIÓN PRINCIPAL
# ═══════════════════════════════════════════════════════════════

def generate_ficha_matricula_weasyprint(
    process,
    student: dict,
    extra: dict,
    inst: dict,
    courses: list,
) -> tuple:
    """
    Genera la Ficha de Matrícula en PDF usando HTML + WeasyPrint.

    Returns:
        (BytesIO del PDF, filename)
    """
    if not HAS_WEASYPRINT:
        raise ImportError(
            "WeasyPrint no está instalado.\n"
            "Instala con: pip install weasyprint\n"
            "En Ubuntu también puede necesitar: sudo apt install libpango-1.0-0 libpangoft2-1.0-0"
        )

    html_content = _build_html(process, student, extra, inst, courses)

    pdf_bytes = WeasyHTML(string=html_content).write_pdf()

    now = datetime.now()
    process_id = getattr(process, "id", 0) or 0
    filename = f"FICHA-MATRICULA_{process_id:05d}_{now.strftime('%Y%m%d')}.pdf"

    buf = io.BytesIO(pdf_bytes)
    buf.seek(0)
    return buf, filename


# ═══════════════════════════════════════════════════════════════
# FALLBACK: ReportLab Canvas (cuando WeasyPrint no está disponible)
# Diseño profesional: header azul oscuro + dorado, QR, firmas
# ═══════════════════════════════════════════════════════════════

def generate_ficha_matricula_reportlab(
    process,
    student: dict,
    extra: dict,
    inst: dict,
    courses: list,
) -> io.BytesIO:
    """
    Genera la Ficha de Matrícula en PDF usando ReportLab canvas directo.
    Diseño profesional coherente con constancias de admisión.

    Returns:
        BytesIO del PDF
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm, mm
    from reportlab.lib.colors import HexColor, white, black
    from reportlab.pdfgen import canvas as cv_mod

    try:
        from reportlab.graphics.barcode import qr as qr_module
        from reportlab.graphics.shapes import Drawing
        HAS_RL_QR = True
    except ImportError:
        HAS_RL_QR = False

    buf = io.BytesIO()
    pw, ph = A4  # 595.27 × 841.89 pts

    # ── Paleta ──
    AZUL_OSCURO = HexColor("#0d1b3e")
    AZUL        = HexColor("#1a3a5c")
    AZUL_MED    = HexColor("#1565c0")
    AZUL_CLARO  = HexColor("#e8f0fe")
    ORO         = HexColor("#c5a44e")
    GRIS        = HexColor("#555555")
    GRIS_CLARO  = HexColor("#f7f8fa")
    GRIS_BORDE  = HexColor("#c5ccd6")
    BORDE_TABLA = HexColor("#d0d5dd")
    LABEL_BG    = HexColor("#eef1f6")
    LABEL_CLR   = HexColor("#3a4a5c")
    SUB_HEADER  = HexColor("#8b6914")
    TOTAL_BG    = HexColor("#e8edf4")

    margin = 1.5 * cm
    content_w = pw - 2 * margin

    now = datetime.now()
    process_id = getattr(process, "id", 0) or 0

    # ── Datos ──
    period  = extra.get("period", student.get("periodo", f"{now.year}-I"))
    ciclo   = student.get("ciclo", "") or extra.get("cycle", "I")
    seccion = student.get("seccion", "") or extra.get("section", "A")
    ciclo_romano = _to_roman(ciclo) if str(ciclo).isdigit() else str(ciclo)
    ciclo_seccion = f'{ciclo_romano} - "{seccion}"'

    carrera    = (student.get("carrera", "") or extra.get("career", "")).upper()
    nombres    = student.get("nombres", "")
    apellidos  = student.get("apellidos", "")
    nombre_ficha = f"{apellidos.upper()} {nombres}".strip() if apellidos else student.get("nombre_completo", "")
    codigo     = student.get("codigo", "") or student.get("dni", "")
    resolucion = extra.get("resolucion", "") or inst.get("resolution", "")

    short_name  = inst.get("short_name", "I.E.S.P.P.")
    inst_nombre = inst.get("institution_name", '"GUSTAVO ALLENDE LLAVERÍA"')
    cod_modular = inst.get("modular_code", "0609370")
    gestion     = inst.get("management", "Pública")
    ds_creation = inst.get("ds_creation", "D.S. 059-1984-ED")
    address     = inst.get("address", "")
    province    = inst.get("province", "Tarma")
    district    = inst.get("district", province)
    region      = inst.get("region", "Junín")
    director_name  = inst.get("director_name", "")
    secretary_name = inst.get("secretary_name", "")

    try:
        from django.conf import settings as dj_settings
        media_root = str(dj_settings.MEDIA_ROOT)
    except Exception:
        media_root = ""

    def _resolve_img(path_str):
        p = str(path_str or "")
        if not p:
            return None
        if "/media/" in p:
            p = os.path.join(media_root, p.split("/media/")[-1])
        elif not os.path.isabs(p):
            p = os.path.join(media_root, p.lstrip("/"))
        return p if os.path.exists(p) else None

    c = cv_mod.Canvas(buf, pagesize=A4)

    # ═══════════════════════════════════════════════════════════
    # HEADER — franja azul oscuro con línea dorada
    # ═══════════════════════════════════════════════════════════
    header_h = 2.2 * cm
    header_y = ph - header_h

    c.setFillColor(AZUL_OSCURO)
    c.rect(0, header_y, pw, header_h, fill=True, stroke=False)
    c.setFillColor(ORO)
    c.rect(0, header_y, pw, 2.5, fill=True, stroke=False)

    # Logo
    logo_path = _resolve_img(inst.get("logo_url", ""))
    lw, lh = 1.5 * cm, 1.5 * cm
    lx = margin
    ly = header_y + (header_h - lh) / 2
    if logo_path:
        try:
            c.drawImage(logo_path, lx, ly, width=lw, height=lh,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    # Texto izquierdo
    tx = lx + lw + 0.5 * cm
    c.setFillColor(HexColor("#ffffff99"))
    c.setFont("Helvetica", 6.5)
    c.drawString(tx, header_y + header_h - 0.55 * cm, "MINISTERIO DE EDUCACIÓN")
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(tx, header_y + header_h - 0.95 * cm,
                 "INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO")
    c.setFont("Helvetica", 7)
    c.drawString(tx, header_y + header_h - 1.35 * cm, f'{inst_nombre}')

    # Derecha: período y código
    c.setFillColor(ORO)
    c.setFont("Helvetica", 5.5)
    c.drawRightString(pw - margin, header_y + header_h - 0.55 * cm, "PERÍODO ACADÉMICO")
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(pw - margin, header_y + header_h - 1.0 * cm, period)
    c.setFont("Helvetica", 6)
    c.setFillColor(HexColor("#ffffff99"))
    c.drawRightString(pw - margin, header_y + header_h - 1.35 * cm, f"Cód. Modular: {cod_modular}")

    # ═══════════════════════════════════════════════════════════
    # TÍTULO
    # ═══════════════════════════════════════════════════════════
    y = header_y - 1.0 * cm
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 15)
    title = "FICHA DE MATRÍCULA"
    tw = c.stringWidth(title, "Helvetica-Bold", 15)
    title_x = (pw - tw) / 2
    c.drawString(title_x, y, title)

    # Doble línea dorada
    c.setStrokeColor(ORO)
    c.setLineWidth(2)
    c.line(title_x, y - 3, title_x + tw, y - 3)
    c.setLineWidth(0.5)
    c.line(title_x + tw * 0.15, y - 7, title_x + tw * 0.85, y - 7)

    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7)
    c.drawCentredString(pw / 2, y - 16, f"Proceso #{process_id:05d}")

    # ═══════════════════════════════════════════════════════════
    # BLOQUE INSTITUCIONAL  (tabla compacta)
    # ═══════════════════════════════════════════════════════════
    y_inst = y - 1.3 * cm
    row_h = 0.42 * cm
    col1 = 3.8 * cm   # label width
    col2 = content_w * 0.42  # value width
    col3 = 3.2 * cm  # label 2
    col4 = content_w - col1 - col2 - col3  # value 2

    inst_rows = [
        ("Nombre de la Institución", inst_nombre, "DREJ / UGEL", region),
        ("Código Modular", cod_modular, "Gestión", gestion),
        ("Denominación", short_name, "D.S. Creación", ds_creation),
        ("Dirección", address, "Provincia / Distrito", f"{province} / {district}"),
    ]

    def _draw_inst_row(ry, lbl1, val1, lbl2, val2, is_even):
        # Fondo alternado
        bg = AZUL_CLARO if is_even else white
        c.setFillColor(bg)
        c.rect(margin, ry - row_h, content_w, row_h, fill=True, stroke=False)

        # Labels con fondo
        c.setFillColor(LABEL_BG)
        c.rect(margin, ry - row_h, col1, row_h, fill=True, stroke=False)
        c.rect(margin + col1 + col2, ry - row_h, col3, row_h, fill=True, stroke=False)

        # Bordes
        c.setStrokeColor(GRIS_BORDE)
        c.setLineWidth(0.3)
        c.rect(margin, ry - row_h, content_w, row_h, fill=False)
        c.line(margin + col1, ry, margin + col1, ry - row_h)
        c.line(margin + col1 + col2, ry, margin + col1 + col2, ry - row_h)
        c.line(margin + col1 + col2 + col3, ry, margin + col1 + col2 + col3, ry - row_h)

        # Labels
        c.setFillColor(LABEL_CLR)
        c.setFont("Helvetica-Bold", 6.5)
        c.drawString(margin + 4, ry - row_h + 3.5, lbl1)
        c.drawString(margin + col1 + col2 + 4, ry - row_h + 3.5, lbl2)

        # Values
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 7.5)
        # Truncar si es muy largo
        v1 = str(val1)
        max_w1 = col2 - 10
        while c.stringWidth(v1, "Helvetica-Bold", 7.5) > max_w1 and len(v1) > 5:
            v1 = v1[:-1]
        c.drawString(margin + col1 + 5, ry - row_h + 3.5, v1)

        v2 = str(val2)
        max_w2 = col4 - 10
        while c.stringWidth(v2, "Helvetica-Bold", 7.5) > max_w2 and len(v2) > 5:
            v2 = v2[:-1]
        c.drawString(margin + col1 + col2 + col3 + 5, ry - row_h + 3.5, v2)

    for i, (l1, v1, l2, v2) in enumerate(inst_rows):
        _draw_inst_row(y_inst - i * row_h, l1, v1, l2, v2, i % 2 == 0)

    # ═══════════════════════════════════════════════════════════
    # BLOQUE ALUMNO (programa, ciclo, nombre, código)
    # ═══════════════════════════════════════════════════════════
    y_stu = y_inst - len(inst_rows) * row_h - 0.2 * cm
    stu_rows = [
        ("Programa de Estudios", carrera, "Período Académico", period),
        ("Resolución de Autorización", resolucion, "Ciclo - Sección", ciclo_seccion),
        ("Nombres y Apellidos", nombre_ficha, "CÓDIGO", codigo),
    ]

    for i, (l1, v1, l2, v2) in enumerate(stu_rows):
        _draw_inst_row(y_stu - i * row_h, l1, v1, l2, v2, i % 2 == 0)

    # ═══════════════════════════════════════════════════════════
    # TABLA DE CURSOS
    # ═══════════════════════════════════════════════════════════
    y_courses = y_stu - len(stu_rows) * row_h - 0.4 * cm

    # Header de tabla
    th_h = 0.45 * cm
    c.setFillColor(AZUL_OSCURO)
    c.rect(margin, y_courses - th_h, content_w, th_h, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 7)

    # Columnas: N° | Asignatura | Horas | Créditos
    c_n_w  = content_w * 0.06
    c_nm_w = content_w * 0.62
    c_h_w  = content_w * 0.16
    c_cr_w = content_w * 0.16

    c.drawCentredString(margin + c_n_w / 2, y_courses - th_h + 4, "N°")
    c.drawCentredString(margin + c_n_w + c_nm_w / 2, y_courses - th_h + 4, "ASIGNATURA")
    c.drawCentredString(margin + c_n_w + c_nm_w + c_h_w / 2, y_courses - th_h + 4, "HORAS")
    c.drawCentredString(margin + c_n_w + c_nm_w + c_h_w + c_cr_w / 2, y_courses - th_h + 4, "CRÉDITOS")

    # Filas de cursos
    cr_h = 0.40 * cm
    y_cr = y_courses - th_h

    total_horas    = 0
    total_creditos = 0

    if not courses:
        courses_display = [{"nombre": "", "horas": "", "creditos": ""}] * 6
    else:
        courses_display = courses

    for i, cr in enumerate(courses_display):
        ry = y_cr - i * cr_h
        # Zebra
        bg = AZUL_CLARO if i % 2 == 0 else white
        c.setFillColor(bg)
        c.rect(margin, ry - cr_h, content_w, cr_h, fill=True, stroke=False)

        # Bordes
        c.setStrokeColor(BORDE_TABLA)
        c.setLineWidth(0.3)
        c.rect(margin, ry - cr_h, content_w, cr_h, fill=False)
        c.line(margin + c_n_w, ry, margin + c_n_w, ry - cr_h)
        c.line(margin + c_n_w + c_nm_w, ry, margin + c_n_w + c_nm_w, ry - cr_h)
        c.line(margin + c_n_w + c_nm_w + c_h_w, ry, margin + c_n_w + c_nm_w + c_h_w, ry - cr_h)

        # N°
        c.setFillColor(GRIS)
        c.setFont("Helvetica", 7)
        c.drawCentredString(margin + c_n_w / 2, ry - cr_h + 3.5, str(i + 1))

        # Nombre
        nombre = cr.get("nombre", "") or ""
        c.setFillColor(black)
        c.setFont("Helvetica", 7.5)
        # Truncar
        max_nm_w = c_nm_w - 12
        while c.stringWidth(nombre, "Helvetica", 7.5) > max_nm_w and len(nombre) > 5:
            nombre = nombre[:-1]
        c.drawString(margin + c_n_w + 5, ry - cr_h + 3.5, nombre)

        # Horas
        horas = cr.get("horas", "") or ""
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawCentredString(margin + c_n_w + c_nm_w + c_h_w / 2, ry - cr_h + 3.5, str(horas))

        # Créditos
        creditos = cr.get("creditos", "") or ""
        c.drawCentredString(margin + c_n_w + c_nm_w + c_h_w + c_cr_w / 2, ry - cr_h + 3.5, str(creditos))

        if horas:
            try: total_horas += int(horas)
            except (ValueError, TypeError): pass
        if creditos:
            try: total_creditos += int(creditos)
            except (ValueError, TypeError): pass

    # Fila TOTAL
    y_total = y_cr - len(courses_display) * cr_h
    c.setFillColor(TOTAL_BG)
    c.rect(margin, y_total - cr_h, content_w, cr_h, fill=True, stroke=False)
    c.setStrokeColor(AZUL_OSCURO)
    c.setLineWidth(1.5)
    c.line(margin, y_total, margin + content_w, y_total)
    c.setStrokeColor(BORDE_TABLA)
    c.setLineWidth(0.3)
    c.rect(margin, y_total - cr_h, content_w, cr_h, fill=False)
    c.line(margin + c_n_w, y_total, margin + c_n_w, y_total - cr_h)
    c.line(margin + c_n_w + c_nm_w, y_total, margin + c_n_w + c_nm_w, y_total - cr_h)
    c.line(margin + c_n_w + c_nm_w + c_h_w, y_total, margin + c_n_w + c_nm_w + c_h_w, y_total - cr_h)

    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(margin + c_n_w + c_nm_w / 2, y_total - cr_h + 3.5, "TOTAL")
    if courses:
        c.drawCentredString(margin + c_n_w + c_nm_w + c_h_w / 2, y_total - cr_h + 3.5, str(total_horas))
        c.drawCentredString(margin + c_n_w + c_nm_w + c_h_w + c_cr_w / 2, y_total - cr_h + 3.5, str(total_creditos))

    # ═══════════════════════════════════════════════════════════
    # SUBSANACIÓN
    # ═══════════════════════════════════════════════════════════
    y_sub = y_total - cr_h - 0.3 * cm
    sub_courses = extra.get("subsanacion_courses", [])

    # Header subsanación
    c.setFillColor(SUB_HEADER)
    c.rect(margin, y_sub - th_h, content_w, th_h, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(margin + c_n_w / 2, y_sub - th_h + 4, "N°")
    c.drawCentredString(margin + c_n_w + c_nm_w / 2, y_sub - th_h + 4, "CURSOS DE SUBSANACIÓN")
    c.drawCentredString(margin + c_n_w + c_nm_w + c_h_w / 2, y_sub - th_h + 4, "HORAS")
    c.drawCentredString(margin + c_n_w + c_nm_w + c_h_w + c_cr_w / 2, y_sub - th_h + 4, "CRÉDITOS")

    sub_display = sub_courses if sub_courses else [{"nombre": "", "horas": "", "creditos": ""}]
    y_sr = y_sub - th_h
    for i, sc in enumerate(sub_display):
        ry = y_sr - i * cr_h
        c.setFillColor(white)
        c.rect(margin, ry - cr_h, content_w, cr_h, fill=True, stroke=False)
        c.setStrokeColor(BORDE_TABLA)
        c.setLineWidth(0.3)
        c.rect(margin, ry - cr_h, content_w, cr_h, fill=False)
        c.line(margin + c_n_w, ry, margin + c_n_w, ry - cr_h)
        c.line(margin + c_n_w + c_nm_w, ry, margin + c_n_w + c_nm_w, ry - cr_h)
        c.line(margin + c_n_w + c_nm_w + c_h_w, ry, margin + c_n_w + c_nm_w + c_h_w, ry - cr_h)

        c.setFillColor(GRIS)
        c.setFont("Helvetica", 7)
        c.drawCentredString(margin + c_n_w / 2, ry - cr_h + 3.5, str(i + 1))
        c.setFillColor(black)
        c.setFont("Helvetica", 7.5)
        c.drawString(margin + c_n_w + 5, ry - cr_h + 3.5, sc.get("nombre", ""))
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawCentredString(margin + c_n_w + c_nm_w + c_h_w / 2, ry - cr_h + 3.5, str(sc.get("horas", "")))
        c.drawCentredString(margin + c_n_w + c_nm_w + c_h_w + c_cr_w / 2, ry - cr_h + 3.5, str(sc.get("creditos", "")))

    # ═══════════════════════════════════════════════════════════
    # QR DE VERIFICACIÓN  (antes de las firmas)
    # ═══════════════════════════════════════════════════════════
    y_qr_section = y_sr - len(sub_display) * cr_h - 1.2 * cm
    qr_block_h = 0  # altura consumida por el bloque QR

    if HAS_RL_QR:
        try:
            from django.conf import settings as _s
            base_url = getattr(_s, "SITE_URL", "https://sis.iesppallende.edu.pe")
        except Exception:
            base_url = "https://sis.iesppallende.edu.pe"

        dni_val = student.get("dni", "") or codigo
        verify_url = f"{base_url}/public/academic/enrollment?dni={dni_val}&period={period}"

        qr_size = 2.0 * cm
        box_h = qr_size + 0.4 * cm

        # Caja de fondo
        c.setFillColor(GRIS_CLARO)
        c.roundRect(margin, y_qr_section - box_h + 0.2 * cm, content_w, box_h, 3, fill=True, stroke=False)
        c.setStrokeColor(GRIS_BORDE)
        c.setLineWidth(0.5)
        c.roundRect(margin, y_qr_section - box_h + 0.2 * cm, content_w, box_h, 3, fill=False)

        # QR
        qr_x = margin + 0.3 * cm
        qr_y = y_qr_section - qr_size + 0.05 * cm
        try:
            qr_widget = qr_module.QrCodeWidget(verify_url)
            qr_widget.barWidth  = qr_size
            qr_widget.barHeight = qr_size
            d = Drawing(qr_size, qr_size)
            d.add(qr_widget)
            d.drawOn(c, qr_x, qr_y)
        except Exception:
            pass

        # Texto junto al QR
        txt_x = qr_x + qr_size + 0.5 * cm
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(txt_x, y_qr_section - 0.1 * cm, "Verificación del Documento")
        c.setFillColor(GRIS)
        c.setFont("Helvetica", 6)
        c.drawString(txt_x, y_qr_section - 0.4 * cm, "Escanee el código QR para verificar la autenticidad")
        c.drawString(txt_x, y_qr_section - 0.65 * cm, "de esta ficha de matrícula en el sistema académico.")
        c.setFillColor(AZUL_MED)
        c.setFont("Helvetica", 5)
        url_short = verify_url[:80] + ("…" if len(verify_url) > 80 else "")
        c.drawString(txt_x, y_qr_section - 0.95 * cm, url_short)

        qr_block_h = box_h + 0.3 * cm

    # ═══════════════════════════════════════════════════════════
    # FIRMAS  (con imagen de firma/sello si existe)
    # ═══════════════════════════════════════════════════════════
    y_firma = y_qr_section - qr_block_h - 1.6 * cm
    firma_w = content_w / 3
    sig_w, sig_h = 2.5 * cm, 1.2 * cm

    # Director
    dir_sig = _resolve_img(inst.get("signature_url", ""))
    if dir_sig:
        try:
            c.drawImage(dir_sig, margin + (firma_w - sig_w) / 2, y_firma + 0.1 * cm,
                        width=sig_w, height=sig_h,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    c.setStrokeColor(AZUL_OSCURO)
    c.setLineWidth(1)
    c.line(margin + 0.5 * cm, y_firma, margin + firma_w - 0.5 * cm, y_firma)
    if director_name:
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 6.5)
        c.drawCentredString(margin + firma_w / 2, y_firma - 0.3 * cm, director_name)
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(margin + firma_w / 2, y_firma - 0.6 * cm, "DIRECTOR(A) GENERAL")
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 5.5)
    c.drawCentredString(margin + firma_w / 2, y_firma - 0.85 * cm, "Firma, Post Firma y Sello")

    # Secretario
    sec_sig = _resolve_img(inst.get("secretary_signature_url", ""))
    sec_x = margin + firma_w
    if sec_sig:
        try:
            c.drawImage(sec_sig, sec_x + (firma_w - sig_w) / 2, y_firma + 0.1 * cm,
                        width=sig_w, height=sig_h,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    c.setStrokeColor(AZUL_OSCURO)
    c.setLineWidth(1)
    c.line(sec_x + 0.5 * cm, y_firma, sec_x + firma_w - 0.5 * cm, y_firma)
    if secretary_name:
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 6.5)
        c.drawCentredString(sec_x + firma_w / 2, y_firma - 0.3 * cm, secretary_name)
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(sec_x + firma_w / 2, y_firma - 0.6 * cm, "SECRETARIO(A) ACADÉMICO")
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 5.5)
    c.drawCentredString(sec_x + firma_w / 2, y_firma - 0.85 * cm, "Firma, Post Firma y Sello")

    # Estudiante
    est_x = margin + 2 * firma_w
    c.setStrokeColor(AZUL_OSCURO)
    c.setLineWidth(1)
    c.line(est_x + 0.5 * cm, y_firma, est_x + firma_w - 0.5 * cm, y_firma)
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(est_x + firma_w / 2, y_firma - 0.6 * cm, "ESTUDIANTE")

    # ═══════════════════════════════════════════════════════════
    # FOOTER — línea dorada + texto institucional
    # ═══════════════════════════════════════════════════════════
    footer_y = 1.2 * cm
    c.setStrokeColor(ORO)
    c.setLineWidth(1.5)
    c.line(margin, footer_y + 0.25 * cm, pw - margin, footer_y + 0.25 * cm)

    c.setFillColor(GRIS)
    c.setFont("Helvetica", 5.5)
    c.drawCentredString(pw / 2, footer_y - 0.1 * cm,
                        f"Documento generado por el Sistema Académico | Proceso #{process_id:05d} | "
                        f"{now.strftime('%d/%m/%Y %H:%M')}")
    c.setFont("Helvetica", 5)
    c.drawCentredString(pw / 2, footer_y - 0.35 * cm,
                        f"{short_name} {inst_nombre} — {province}, {region}")

    c.save()
    buf.seek(0)
    return buf
