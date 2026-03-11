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
    Formato fiel al XLS institucional (orientación portrait).
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
    resolucion = extra.get("resolucion", "Resolución Viceministerial Nº 147-2020-MINEDU")

    # ── Institución ──
    short_name  = inst.get("short_name", "I.E.S.P.P.")
    inst_nombre = inst.get("institution_name", '"GUSTAVO ALLENDE LLAVERÍA"')
    cod_modular = inst.get("modular_code", "0609370")
    gestion     = inst.get("management", "Pública")
    ds_creation = inst.get("ds_creation", "D.S. 059-1984-ED")
    address     = inst.get("address", "Carretera Central Km. 4 S/N Pomachaca")
    province    = inst.get("province", "Tarma")
    district    = inst.get("district", province)
    region      = inst.get("region", "Junín")

    # ── Celdas individuales del código modular ──
    cod_digits = list(cod_modular.ljust(7))
    cod_cells = "".join(f'<td class="cod-cell">{d}</td>' for d in cod_digits)

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
        if logo_src else ""
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
                <td class="course-name">{nombre}</td>
                <td class="center">{horas}</td>
                <td class="center">{creditos}</td>
            </tr>"""
    else:
        for i in range(1, 8):
            course_rows += f"""
            <tr>
                <td class="center">{i}</td>
                <td></td><td></td><td></td>
            </tr>"""

    # ── Fila de subsanación ──
    subsanacion_courses = extra.get("subsanacion_courses", [])
    sub_rows = ""
    if subsanacion_courses:
        for i, c in enumerate(subsanacion_courses, 1):
            sub_rows += f"""
            <tr>
                <td class="center">{i}</td>
                <td class="course-name">{c.get("nombre", "")}</td>
                <td class="center">{c.get("horas", "")}</td>
                <td class="center">{c.get("creditos", "")}</td>
            </tr>"""
    else:
        sub_rows = """
        <tr>
            <td class="center">1</td>
            <td></td><td></td><td></td>
        </tr>"""

    # ── HTML completo ──
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page {{
    size: A4 portrait;
    margin: 1.5cm 1.2cm 1.5cm 1.2cm;
  }}

  * {{ box-sizing: border-box; margin: 0; padding: 0; }}

  body {{
    font-family: Arial, sans-serif;
    font-size: 9pt;
    color: #000;
    line-height: 1.3;
  }}

  /* ── Header: logo + título ── */
  .header {{
    display: flex;
    align-items: center;
    margin-bottom: 8px;
  }}
  .header .logo {{
    width: 70px;
    height: auto;
    object-fit: contain;
  }}
  .header .titulo {{
    flex: 1;
    text-align: center;
    font-size: 16pt;
    font-weight: bold;
    letter-spacing: 3px;
  }}

  /* ── Tablas ── */
  table {{
    width: 100%;
    border-collapse: collapse;
  }}
  td, th {{
    border: 1px solid #000;
    padding: 3px 5px;
    vertical-align: middle;
    font-size: 8.5pt;
  }}

  .lbl {{
    font-weight: bold;
    font-size: 7.5pt;
    background-color: #f5f5f5;
    white-space: nowrap;
  }}

  .val {{
    font-size: 8.5pt;
  }}

  .val-bold {{
    font-size: 8.5pt;
    font-weight: bold;
  }}

  /* Celdas individuales del código modular */
  .cod-cell {{
    text-align: center;
    font-weight: bold;
    font-size: 9pt;
    width: 20px;
    padding: 2px 4px;
  }}

  .center {{ text-align: center; }}

  .course-name {{
    text-align: left;
    padding-left: 6px;
  }}

  /* ── Encabezados de tabla de cursos ── */
  .thead-cursos th {{
    font-weight: bold;
    font-size: 8.5pt;
    text-align: center;
    padding: 5px 4px;
  }}

  .row-total td {{
    font-weight: bold;
    padding: 4px 5px;
  }}

  /* ── Separador ── */
  .sep {{
    height: 6px;
    border: none;
  }}
  .sep td {{ border: none; }}

  /* ── Firmas ── */
  .firmas {{
    width: 100%;
    margin-top: 40px;
    border: none;
  }}
  .firmas td {{
    border: none;
    text-align: center;
    vertical-align: bottom;
    padding: 0 10px;
    font-size: 8pt;
  }}
  .firma-linea {{
    border-top: 1px solid #000;
    padding-top: 4px;
    font-weight: bold;
    font-size: 8pt;
  }}
  .firma-sub {{
    font-size: 7pt;
    font-style: italic;
    color: #333;
  }}

  /* ── Footer ── */
  .footer {{
    text-align: center;
    font-size: 6pt;
    color: #bbb;
    margin-top: 10px;
  }}
</style>
</head>
<body>

<!-- ═══ HEADER: Logo + Título ═══ -->
<div class="header">
  {f'<div>{logo_html}</div>' if logo_html else ''}
  <div class="titulo">FICHA DE MATRICULA</div>
</div>

<!-- ═══ BLOQUE 1: INSTITUCIÓN ═══ -->
<table>
  <tr>
    <td class="lbl" style="width:18%">Nombre de la Institución</td>
    <td class="val-bold" colspan="10">{inst_nombre}</td>
    <td class="lbl" style="width:5%">DREJ</td>
    <td class="val center" style="width:8%">{region}</td>
  </tr>
  <tr>
    <td class="lbl" rowspan="2">Código Modular</td>
    <td class="lbl" rowspan="2">Denominación</td>
    <td class="lbl" rowspan="2">Gestión</td>
    <td class="lbl" colspan="2" style="text-align:center; font-size:7pt">D.S./R.M. de Creación Y RD de Revalidación</td>
    <td class="lbl" rowspan="2" colspan="5">Dirección</td>
    <td class="lbl" colspan="3" style="text-align:center">
      {address}
    </td>
  </tr>
  <tr>
    <td class="lbl" colspan="2" style="text-align:center; font-size:7pt">&nbsp;</td>
    <td class="lbl">UGEL</td>
    <td class="val center" colspan="2">&nbsp;</td>
  </tr>
  <tr>
    {cod_cells}
    <td class="val center">{short_name}</td>
    <td class="val center">{gestion}</td>
    <td class="val center" colspan="2">{ds_creation}</td>
    <td class="lbl center">Provincia</td>
    <td class="val center">{province}</td>
    <td class="lbl center">Distrito</td>
    <td class="val center">{district}</td>
  </tr>
</table>

<!-- ═══ BLOQUE 2: PROGRAMA, RESOLUCIÓN, ALUMNO ═══ -->
<table style="margin-top:4px;">
  <tr>
    <td class="lbl" style="width:22%">Programa de Estudios</td>
    <td class="val-bold" style="width:32%">{carrera.upper() if carrera else ""}</td>
    <td class="lbl center" style="width:18%">Periodo Académico</td>
    <td class="val-bold center" style="width:28%">{period}</td>
  </tr>
  <tr>
    <td class="lbl">Resolución de Autorización</td>
    <td class="val">{resolucion}</td>
    <td class="lbl center">Ciclo - Sección</td>
    <td class="val-bold center">{ciclo_seccion}</td>
  </tr>
  <tr>
    <td class="lbl">Nombres y Apellidos</td>
    <td class="val-bold">{nombre_ficha}</td>
    <td class="lbl center">CODIGO</td>
    <td class="val-bold center">{codigo}</td>
  </tr>
</table>

<!-- ═══ BLOQUE 3: TABLA DE CURSOS ═══ -->
<table style="margin-top:6px;">
  <colgroup>
    <col style="width:5%">
    <col style="width:67%">
    <col style="width:14%">
    <col style="width:14%">
  </colgroup>
  <tr class="thead-cursos">
    <th>N°</th>
    <th style="text-align:center">APELLIDOS Y NOMBRES</th>
    <th>HORAS</th>
    <th>CRÉDITOS</th>
  </tr>
  {course_rows}
  <tr class="row-total">
    <td></td>
    <td class="center">TOTAL</td>
    <td class="center">{total_horas if courses else ""}</td>
    <td class="center">{total_creditos if courses else ""}</td>
  </tr>
</table>

<!-- ═══ BLOQUE 4: SUBSANACIÓN ═══ -->
<table style="margin-top:6px;">
  <colgroup>
    <col style="width:5%">
    <col style="width:67%">
    <col style="width:14%">
    <col style="width:14%">
  </colgroup>
  <tr>
    <th style="font-weight:bold; font-size:8.5pt; text-align:center; padding:5px 4px;">N°</th>
    <th style="font-weight:bold; font-size:8.5pt; text-align:center; padding:5px 4px;">CURSOS DE SUBSANACIÓN</th>
    <th style="font-weight:bold; font-size:8.5pt; text-align:center; padding:5px 4px;">HORAS</th>
    <th style="font-weight:bold; font-size:8.5pt; text-align:center; padding:5px 4px;">CRÉDITOS</th>
  </tr>
  {sub_rows}
</table>

<!-- ═══ BLOQUE 5: FIRMAS ═══ -->
<table class="firmas">
  <tr style="height:60px;">
    <td></td><td></td><td></td>
  </tr>
  <tr>
    <td>
      <div class="firma-linea">DIRECTOR(A) GENERAL</div>
      <div class="firma-sub">Firma, Post Firma y Sello</div>
    </td>
    <td>
      <div class="firma-linea">SECRETARIO(A) &nbsp;ACADÉMICO</div>
      <div class="firma-sub">Firma, Post Firma y Sello</div>
    </td>
    <td>
      <div class="firma-linea">ESTUDIANTE</div>
    </td>
  </tr>
</table>

<div class="footer">
  Documento generado por el Sistema Académico | Proceso #{process.id:05d} | {now.strftime("%d/%m/%Y %H:%M")}
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