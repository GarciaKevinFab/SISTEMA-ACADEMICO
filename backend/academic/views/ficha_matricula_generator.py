"""
ficha_matricula_generator.py
═══════════════════════════════════════════════════════════════
Genera la Ficha de Matrícula en PDF usando HTML + WeasyPrint.

Diseño fiel al XLS original (PRIMARIA_-_FICHA_DE_MATRICULA_2025-II.xls):
  ┌─────────────────────────────────────────────────────┐
  │              FICHA DE MATRÍCULA                     │
  ├─────────────┬───────────────────────────────────────┤
  │ Institución │ GUSTAVO ALLENDE LLAVERÍA  │ DREJ Junín│
  │ Cód.Modular │ 0609370   │ Gestión  │ D.S. │ Dir.    │
  ├─────────────┴───────────────────────────────────────┤
  │ Programa: PRIMARIA │ Período: 2025-II               │
  │ Resolución: ... │ Ciclo-Sección: I                  │
  ├─────────────────────────────────────────────────────┤
  │ Nombres y Apellidos: ___________    CÓDIGO: _____   │
  ├────┬─────────────────────────────────┬──────┬───────┤
  │ N° │ ASIGNATURA                      │HORAS │CRÉD.  │
  │  1 │ Lectura y Escritura...          │   4  │   3   │
  │ .. │ ...                             │  ..  │  ..   │
  │    │ TOTAL                           │  30  │  24   │
  ├────┼─────────────────────────────────┼──────┼───────┤
  │ N° │ CURSOS DE SUBSANACIÓN           │HORAS │CRÉD.  │
  │  1 │                                 │      │       │
  └────┴─────────────────────────────────┴──────┴───────┘

INTEGRACIÓN en document_generators.py:
  Agregar en generate_process_document():
    if doc_type == "FICHA_MATRICULA":
        from .ficha_matricula_generator import generate_ficha_matricula_weasyprint
        inst    = _get_institution()
        student = _get_student(process.student_id)
        extra   = _get_extra_data(process)
        courses = _get_enrolled_courses(student.get("plan_id"), _ciclo_int(student))
        return generate_ficha_matricula_weasyprint(process, student, extra, inst, courses)
"""

import io
import logging
import os
import base64
from datetime import datetime

logger = logging.getLogger("academic.processes")

# ── WeasyPrint ──
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
    """Convierte imagen a base64 para incrustar en HTML."""
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
    """Resuelve la ruta del logo desde URL o path relativo."""
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


def _build_html(
    process,
    student: dict,
    extra: dict,
    inst: dict,
    courses: list,
) -> str:
    """
    Construye el HTML completo de la ficha de matrícula.
    """
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
    resolucion = extra.get("resolucion", "Resolución Viceministerial Nº 204-2019-MINEDU")

    # ── Institución ──
    short_name  = inst.get("short_name", "I.E.S.P.P.")
    inst_nombre = inst.get("institution_name", '"GUSTAVO ALLENDE LLAVERÍA"')
    cod_modular = inst.get("modular_code", "0609370")
    gestion     = inst.get("management", "Pública")
    ds_creation = inst.get("ds_creation", "D.S. 059-1984-ED")
    address     = inst.get("address", "Carretera Central Km. 4 S/N Pomachaca")
    province    = inst.get("province", "Tarma")
    district    = inst.get("province", "Tarma")
    region      = inst.get("region", "Junín")

    # ── Logo ──
    try:
        from django.conf import settings
        media_root = settings.MEDIA_ROOT
    except Exception:
        media_root = ""

    logo_path = _resolve_logo_path(inst.get("logo_url", ""), media_root)
    logo_src  = _logo_base64(logo_path)
    logo_html = (
        f'<img src="{logo_src}" alt="Logo" class="logo">'
        if logo_src else
        f'<div class="logo-placeholder">{short_name}</div>'
    )

    # ── Tabla de cursos ──
    total_horas   = sum(c.get("horas", 0) or 0 for c in courses)
    total_creditos = sum(c.get("creditos", 0) or 0 for c in courses)

    course_rows = ""
    if courses:
        for i, c in enumerate(courses, 1):
            nombre   = c.get("nombre", "—")
            horas    = c.get("horas", "")
            creditos = c.get("creditos", "")
            course_rows += f"""
            <tr>
                <td class="center">{i}</td>
                <td class="left">{nombre}</td>
                <td class="center">{horas}</td>
                <td class="center">{creditos}</td>
            </tr>"""
    else:
        # Filas vacías si no hay cursos
        for i in range(1, 8):
            course_rows += f"""
            <tr class="empty-row">
                <td class="center">{i}</td>
                <td></td>
                <td class="center"></td>
                <td class="center"></td>
            </tr>"""

    # ── Fila de subsanación ──
    subsanacion_courses = extra.get("subsanacion_courses", [])
    sub_rows = ""
    if subsanacion_courses:
        for i, c in enumerate(subsanacion_courses, 1):
            sub_rows += f"""
            <tr>
                <td class="center">{i}</td>
                <td class="left">{c.get("nombre", "")}</td>
                <td class="center">{c.get("horas", "")}</td>
                <td class="center">{c.get("creditos", "")}</td>
            </tr>"""
    else:
        sub_rows = """
        <tr class="empty-row">
            <td class="center">1</td>
            <td></td>
            <td class="center"></td>
            <td class="center"></td>
        </tr>"""

    # ── HTML completo ──
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  /* ══════════════════════════════════════════
     ESTILOS FICHA DE MATRÍCULA
     Fiel al diseño del XLS institucional
     ══════════════════════════════════════════ */

  @page {{
    size: A4 landscape;
    margin: 1cm 1.2cm 1cm 1.2cm;
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}

  body {{
    font-family: Arial, sans-serif;
    font-size: 8.5pt;
    color: #000;
    line-height: 1.3;
  }}

  /* ── Título ── */
  .titulo {{
    text-align: center;
    font-size: 13pt;
    font-weight: bold;
    letter-spacing: 2px;
    padding: 4px 0 6px 0;
    border-bottom: 2px solid #1a237e;
    margin-bottom: 6px;
    color: #1a237e;
  }}

  /* ── Tabla principal ── */
  table.main {{
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 5px;
  }}

  table.main td, table.main th {{
    border: 1px solid #555;
    padding: 3px 5px;
    vertical-align: middle;
  }}

  /* ── Bloque institución (fila 1) ── */
  .inst-header {{
    display: flex;
    align-items: center;
    gap: 8px;
  }}

  .logo {{
    height: 48px;
    width: auto;
    object-fit: contain;
  }}

  .logo-placeholder {{
    width: 48px;
    height: 48px;
    border: 1px solid #ccc;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 6pt;
    text-align: center;
    color: #666;
  }}

  .inst-name {{
    font-size: 9pt;
    font-weight: bold;
    line-height: 1.4;
  }}

  .inst-sub {{
    font-size: 7.5pt;
    color: #333;
  }}

  /* ── Labels de celda ── */
  .label {{
    font-weight: bold;
    color: #1a237e;
    font-size: 7.5pt;
    white-space: nowrap;
  }}

  .val {{
    font-size: 8pt;
  }}

  /* ── Colores de encabezados de tabla ── */
  .thead-cursos {{
    background-color: #1565c0;
    color: white;
    font-weight: bold;
    font-size: 8pt;
    text-align: center;
  }}

  .thead-sub {{
    background-color: #e65100;
    color: white;
    font-weight: bold;
    font-size: 8pt;
    text-align: center;
  }}

  .thead-inst {{
    background-color: #e8eaf6;
    font-weight: bold;
    color: #1a237e;
    font-size: 8pt;
  }}

  /* ── Fila de totales ── */
  .row-total {{
    background-color: #e3f2fd;
    font-weight: bold;
  }}

  /* ── Alumno ── */
  .alumno-nombre {{
    font-size: 10pt;
    font-weight: bold;
    border-bottom: 1px solid #000;
    display: inline-block;
    min-width: 200px;
    padding-bottom: 1px;
  }}

  .alumno-codigo {{
    font-size: 10pt;
    font-weight: bold;
    border-bottom: 1px solid #000;
    display: inline-block;
    min-width: 100px;
    padding-bottom: 1px;
  }}

  .center {{ text-align: center; }}
  .left   {{ text-align: left; }}
  .right  {{ text-align: right; }}
  .bold   {{ font-weight: bold; }}

  .empty-row td {{ height: 16px; }}

  /* ── Separador entre tablas ── */
  .sep {{ height: 4px; }}

  /* ── Footer de generación ── */
  .footer {{
    text-align: center;
    font-size: 6pt;
    color: #aaa;
    margin-top: 4px;
    border-top: 1px solid #eee;
    padding-top: 2px;
  }}
</style>
</head>
<body>

<!-- ══════════════════════════════════════════
     TÍTULO
     ══════════════════════════════════════════ -->
<div class="titulo">FICHA DE MATRÍCULA</div>

<!-- ══════════════════════════════════════════
     BLOQUE 1: INSTITUCIÓN
     ══════════════════════════════════════════ -->
<table class="main">
  <colgroup>
    <col style="width:4%">
    <col style="width:11%">
    <col style="width:18%">
    <col style="width:5%">
    <col style="width:8%">
    <col style="width:5%">
    <col style="width:8%">
    <col style="width:10%">
    <col style="width:10%">
    <col style="width:5%">
    <col style="width:8%">
    <col style="width:8%">
  </colgroup>
  <tr>
    <!-- Logo + nombre institución -->
    <td rowspan="2" colspan="2" style="text-align:center; padding:4px;">
      {logo_html}
    </td>
    <td colspan="8" style="text-align:center; padding:4px;">
      <div class="inst-name">INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO</div>
      <div class="inst-name">{inst_nombre}</div>
      <div class="inst-sub">{inst.get("city", "Tarma")} - {region} - PERÚ &nbsp;|&nbsp; {ds_creation}</div>
    </td>
    <td class="thead-inst center bold">DREJ</td>
    <td class="val center">{region}</td>
  </tr>
  <tr>
    <td colspan="8" style="text-align:center; font-size:7.5pt; color:#555; padding:2px;">
      {address}
    </td>
    <td class="thead-inst center bold">UGEL</td>
    <td class="val center">{province}</td>
  </tr>
  <tr>
    <td colspan="2" class="thead-inst bold center">Código Modular</td>
    <td class="val center bold">{cod_modular}</td>
    <td colspan="2" class="thead-inst bold center">Denominación</td>
    <td colspan="2" class="val center">{short_name}</td>
    <td class="thead-inst bold center">Gestión</td>
    <td class="val center">{gestion}</td>
    <td class="thead-inst bold center">Provincia</td>
    <td class="val center">{province}</td>
  </tr>
</table>

<!-- ══════════════════════════════════════════
     BLOQUE 2: PROGRAMA Y ALUMNO
     ══════════════════════════════════════════ -->
<table class="main">
  <colgroup>
    <col style="width:15%">
    <col style="width:35%">
    <col style="width:15%">
    <col style="width:35%">
  </colgroup>
  <tr>
    <td class="thead-inst bold">Programa de Estudios</td>
    <td class="val bold">{carrera.upper() if carrera else ""}</td>
    <td class="thead-inst bold center">Período Académico</td>
    <td class="val bold center">{period}</td>
  </tr>
  <tr>
    <td class="thead-inst bold">Resolución de Autorización</td>
    <td class="val">{resolucion}</td>
    <td class="thead-inst bold center">Ciclo - Sección</td>
    <td class="val bold center">{ciclo_seccion}</td>
  </tr>
  <tr>
    <td class="thead-inst bold">Nombres y Apellidos</td>
    <td class="val bold">{nombre_ficha}</td>
    <td class="thead-inst bold center">CÓDIGO</td>
    <td class="val bold center">{codigo}</td>
  </tr>
</table>

<!-- ══════════════════════════════════════════
     BLOQUE 3: TABLA DE CURSOS
     ══════════════════════════════════════════ -->
<table class="main">
  <colgroup>
    <col style="width:4%">
    <col style="width:72%">
    <col style="width:12%">
    <col style="width:12%">
  </colgroup>
  <tr>
    <th class="thead-cursos" style="width:4%">N°</th>
    <th class="thead-cursos" style="text-align:left; padding-left:6px;">ASIGNATURA</th>
    <th class="thead-cursos">HORAS</th>
    <th class="thead-cursos">CRÉDITOS</th>
  </tr>
  {course_rows}
  <tr class="row-total">
    <td class="center"></td>
    <td class="bold" style="padding-left:6px;">TOTAL</td>
    <td class="center bold">{total_horas if courses else ""}</td>
    <td class="center bold">{total_creditos if courses else ""}</td>
  </tr>
</table>

<!-- ══════════════════════════════════════════
     BLOQUE 4: SUBSANACIÓN
     ══════════════════════════════════════════ -->
<table class="main">
  <colgroup>
    <col style="width:4%">
    <col style="width:72%">
    <col style="width:12%">
    <col style="width:12%">
  </colgroup>
  <tr>
    <th class="thead-sub" style="width:4%">N°</th>
    <th class="thead-sub" style="text-align:left; padding-left:6px;">CURSOS DE SUBSANACIÓN</th>
    <th class="thead-sub">HORAS</th>
    <th class="thead-sub">CRÉDITOS</th>
  </tr>
  {sub_rows}
</table>

<div class="footer">
  Sistema Académico IESPP "Gustavo Allende Llavería" &nbsp;·&nbsp;
  Proceso #{process.id:05d} &nbsp;·&nbsp;
  Generado el {now.strftime("%d/%m/%Y %H:%M")}
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

    Args:
        process:  AcademicProcess instance
        student:  dict de _get_student()
        extra:    dict de _get_extra_data()
        inst:     dict de _get_institution()
        courses:  list de _get_enrolled_courses(plan_id, ciclo)

    Returns:
        (BytesIO del PDF, filename)

    Raises:
        ImportError: si WeasyPrint no está instalado
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
    filename = f"FICHA-MATRICULA_{process.id:05d}_{now.strftime('%Y%m%d')}.pdf"

    buf = io.BytesIO(pdf_bytes)
    buf.seek(0)
    return buf, filename


# ═══════════════════════════════════════════════════════════════
# SNIPPET DE INTEGRACIÓN EN document_generators.py
# ═══════════════════════════════════════════════════════════════
#
# En generate_process_document(), ANTES del bloque de ReportLab:
#
# ─────────────────────────────────────────────────────────────
# from .ficha_matricula_generator import (
#     generate_ficha_matricula_weasyprint, HAS_WEASYPRINT, _ciclo_int
# )
#
# def generate_process_document(process, document_type=None):
#     doc_type = (document_type or process.kind or "").upper().strip()
#
#     # ── CONSTANCIA_ESTUDIOS → plantilla .docx + LibreOffice ──
#     if doc_type == "CONSTANCIA_ESTUDIOS":
#         ...  # (código existente)
#
#     # ── FICHA_MATRICULA → HTML + WeasyPrint ──
#     if doc_type == "FICHA_MATRICULA":
#         if HAS_WEASYPRINT:
#             inst    = _get_institution()
#             student = _get_student(process.student_id)
#             extra   = _get_extra_data(process)
#             courses = _get_enrolled_courses(student.get("plan_id"), _ciclo_int(student))
#             return generate_ficha_matricula_weasyprint(
#                 process, student, extra, inst, courses
#             )
#         else:
#             logger.warning("WeasyPrint no instalado → usando ReportLab para FICHA_MATRICULA")
#
#     # ── Resto → ReportLab ──
#     ...
# ─────────────────────────────────────────────────────────────