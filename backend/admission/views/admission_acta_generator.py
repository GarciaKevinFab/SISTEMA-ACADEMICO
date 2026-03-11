"""
admission_acta_generator.py
═══════════════════════════════════════════════════════════════
Genera con WeasyPrint HTML el Acta de Resultados del Proceso de Admisión.

  acta_resultados_html()  → Acta de Resultados (A4 portrait)
    • Membrete institucional (logo + nombre)
    • Título: "ACTA DE RESULTADOS DEL PROCESO DE ADMISIÓN"
    • Datos: convocatoria, carrera, período, fecha
    • Tabla de resultados: N°, Postulante, DNI, Fase 1, Fase 2, Total, Estado
    • Resumen: total postulantes, ingresantes, no admitidos
    • Firma del director + sello
"""

import io
import logging
from datetime import datetime

logger = logging.getLogger("admission.acta")

try:
    from weasyprint import HTML as WeasyHTML
    HAS_WEASYPRINT = True
except ImportError:
    HAS_WEASYPRINT = False

MESES_ES = {
    1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
    5: "mayo",  6: "junio",   7: "julio", 8: "agosto",
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


def acta_resultados_html(results: list, call_data: dict, inst: dict) -> str:
    """
    Construye el HTML del Acta de Resultados.

    results: lista de dicts con keys:
      applicant_name, dni, phase1_total, phase2_total, final_score, status

    call_data: dict con keys:
      call_name, career_name, academic_year, academic_period, exam_date

    inst: dict con keys:
      institution_name, city, director_name, director_title,
      logo_b64, firma_b64, sello_b64, rvm, year_motto
    """
    now = datetime.now()

    # Datos de convocatoria
    call_name = (call_data.get("call_name", "") or "").upper()
    career_name = (call_data.get("career_name", "") or "TODAS LAS CARRERAS").upper()
    academic_year = call_data.get("academic_year", "") or ""
    academic_period = call_data.get("academic_period", "") or ""
    period_text = f"{academic_year}-{academic_period}" if academic_year and academic_period else (academic_year or "")

    # Datos institucionales
    inst_name = (inst.get("institution_name", "") or "GUSTAVO ALLENDE LLAVERÍA").strip('"').strip("'")
    city = inst.get("city", "Tarma")
    director_name = inst.get("director_name", "")
    director_title = (inst.get("director_title", "DIRECTOR GENERAL") or "").upper()
    rvm = inst.get("rvm", "")
    year_motto = inst.get("year_motto", "") or inst.get("lema_anio", "")

    # Imágenes base64 (ya procesadas)
    logo_b64 = inst.get("logo_b64", "")
    firma_b64 = inst.get("firma_b64", "")
    sello_b64 = inst.get("sello_b64", "")

    logo_html = f'<img src="{logo_b64}" class="logo" alt="Logo">' if logo_b64 else ''
    firma_html = f'<img src="{firma_b64}" class="firma-img" alt="Firma">' if firma_b64 else '<div class="firma-space"></div>'
    sello_html = f'<img src="{sello_b64}" class="sello-img" alt="Sello">' if sello_b64 else ''

    fecha_doc = f"{city}, {now.day} de {MESES_ES[now.month]} del {now.year}"

    # Tabla de resultados
    rows_html = ""
    for i, r in enumerate(results, 1):
        name = (r.get("applicant_name", "") or "—")
        dni = r.get("dni", "") or "—"
        p1 = r.get("phase1_total", 0) or 0
        p2 = r.get("phase2_total", 0) or 0
        total = r.get("final_score", 0) or 0
        status = r.get("status", "")
        status_label = STATUS_LABELS.get(status, status)

        # Estilos según estado
        status_cls = ""
        if status in ("ADMITTED", "INGRESANTE"):
            status_cls = "st-admitted"
        elif status == "NOT_ADMITTED":
            status_cls = "st-not-admitted"
        elif status == "WAITING_LIST":
            status_cls = "st-waiting"

        row_cls = "row-even" if i % 2 == 0 else ""

        rows_html += f"""
        <tr class="{row_cls}">
          <td class="tc">{i}</td>
          <td class="name-cell">{name}</td>
          <td class="tc">{dni}</td>
          <td class="tc num">{p1:.2f}</td>
          <td class="tc num">{p2:.2f}</td>
          <td class="tc num total-cell">{total:.2f}</td>
          <td class="tc {status_cls}">{status_label}</td>
        </tr>"""

    # Resumen
    total_count = len(results)
    admitted = sum(1 for r in results if r.get("status") in ("ADMITTED", "INGRESANTE"))
    not_admitted = sum(1 for r in results if r.get("status") == "NOT_ADMITTED")
    waiting = sum(1 for r in results if r.get("status") == "WAITING_LIST")

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
@page {{
  size: A4 portrait;
  margin: 1.5cm 1.8cm 1.5cm 1.8cm;
}}

* {{ box-sizing: border-box; margin: 0; padding: 0; }}

body {{
  font-family: Arial, Helvetica, sans-serif;
  font-size: 9pt;
  color: #000;
  line-height: 1.4;
}}

/* ── Header institucional ── */
.header {{
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 2px solid #1a237e;
  padding-bottom: 8px;
  margin-bottom: 12px;
}}

.logo {{
  width: 50px;
  height: 50px;
  object-fit: contain;
}}

.header-text {{
  flex: 1;
}}

.header-min {{ font-size: 7pt; color: #333; }}
.header-inst {{ font-size: 11pt; font-weight: bold; color: #1a237e; text-transform: uppercase; }}
.header-rvm {{ font-size: 6.5pt; color: #666; }}

/* ── Título ── */
.titulo {{
  text-align: center;
  font-size: 13pt;
  font-weight: bold;
  text-decoration: underline;
  text-underline-offset: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 14px 0 10px 0;
}}

/* ── Info convocatoria ── */
.info-grid {{
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  margin-bottom: 12px;
  font-size: 8.5pt;
}}

.info-item {{
  display: flex;
  gap: 4px;
}}

.info-label {{
  font-weight: bold;
  color: #333;
}}

.info-value {{
  color: #000;
}}

/* ── Tabla ── */
.results-table {{
  width: 100%;
  border-collapse: collapse;
  font-size: 8pt;
  margin-bottom: 12px;
}}

.results-table th {{
  background: #1a237e;
  color: #fff;
  padding: 5px 4px;
  font-weight: bold;
  font-size: 7.5pt;
  text-transform: uppercase;
  text-align: center;
  border: 1px solid #1a237e;
}}

.results-table td {{
  padding: 4px;
  border: 1px solid #ccc;
  vertical-align: middle;
}}

.results-table .tc {{ text-align: center; }}
.results-table .num {{ font-family: 'Courier New', monospace; font-weight: bold; }}
.results-table .total-cell {{ font-weight: bold; font-size: 8.5pt; }}
.results-table .name-cell {{ text-transform: uppercase; font-size: 7.5pt; }}

.row-even {{ background: #f8f9ff; }}

.st-admitted {{ color: #1b5e20; font-weight: bold; background: #e8f5e9; }}
.st-not-admitted {{ color: #b71c1c; font-size: 7pt; }}
.st-waiting {{ color: #e65100; font-size: 7pt; }}

/* ── Resumen ── */
.resumen {{
  display: flex;
  gap: 16px;
  margin-bottom: 14px;
  font-size: 8.5pt;
}}

.resumen-item {{
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: bold;
}}

.res-total {{ background: #e3f2fd; color: #0d47a1; }}
.res-admitted {{ background: #e8f5e9; color: #1b5e20; }}
.res-not {{ background: #fce4ec; color: #b71c1c; }}
.res-waiting {{ background: #fff3e0; color: #e65100; }}

/* ── Fecha y firma ── */
.fecha {{
  text-align: center;
  font-size: 9pt;
  margin: 20px 0 24px 0;
}}

.firma-block {{
  text-align: center;
  position: relative;
  display: inline-block;
  width: 100%;
}}

.firma-img {{
  height: 45px;
  width: auto;
  display: block;
  margin: 0 auto;
}}

.firma-space {{ height: 40px; }}

.firma-line {{
  border-top: 1px solid #000;
  width: 240px;
  margin: 3px auto;
}}

.firma-name {{ font-weight: bold; font-size: 9pt; text-align: center; }}
.firma-cargo {{ font-size: 8pt; text-transform: uppercase; text-align: center; color: #333; }}
.firma-inst {{ font-size: 7.5pt; text-align: center; color: #555; }}

.sello-img {{
  width: 50px;
  height: 50px;
  object-fit: contain;
  opacity: 0.65;
  position: absolute;
  right: 60px;
  bottom: 0;
}}

/* ── Footer ── */
.doc-footer {{
  margin-top: 16px;
  text-align: center;
  font-size: 6pt;
  color: #aaa;
  border-top: 1px solid #eee;
  padding-top: 4px;
}}
</style>
</head>
<body>

<!-- Header institucional -->
<div class="header">
  {logo_html}
  <div class="header-text">
    <div class="header-min">MINISTERIO DE EDUCACIÓN</div>
    <div class="header-min">INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO</div>
    <div class="header-inst">"{inst_name}"</div>
    {"<div class='header-rvm'>" + rvm + "</div>" if rvm else ""}
  </div>
</div>

<!-- Título -->
<div class="titulo">Acta de Resultados del Proceso de Admisión</div>

<!-- Info convocatoria -->
<div class="info-grid">
  <div class="info-item">
    <span class="info-label">Convocatoria:</span>
    <span class="info-value">{call_name}</span>
  </div>
  <div class="info-item">
    <span class="info-label">Programa de Estudios:</span>
    <span class="info-value">{career_name}</span>
  </div>
  {"<div class='info-item'><span class='info-label'>Período:</span><span class='info-value'>" + period_text + "</span></div>" if period_text else ""}
  <div class="info-item">
    <span class="info-label">Fecha:</span>
    <span class="info-value">{fecha_doc}</span>
  </div>
</div>

<!-- Tabla de resultados -->
<table class="results-table">
  <thead>
    <tr>
      <th style="width:30px">N°</th>
      <th>Postulante</th>
      <th style="width:70px">DNI</th>
      <th style="width:55px">Fase I</th>
      <th style="width:55px">Fase II</th>
      <th style="width:55px">Total</th>
      <th style="width:85px">Resultado</th>
    </tr>
  </thead>
  <tbody>
    {rows_html}
    {"<tr><td colspan='7' style='text-align:center;padding:12px;color:#999;font-style:italic'>Sin postulantes registrados</td></tr>" if not results else ""}
  </tbody>
</table>

<!-- Resumen -->
<div class="resumen">
  <div class="resumen-item res-total">Total postulantes: {total_count}</div>
  <div class="resumen-item res-admitted">Ingresantes: {admitted}</div>
  {f'<div class="resumen-item res-not">No admitidos: {not_admitted}</div>' if not_admitted else ''}
  {f'<div class="resumen-item res-waiting">Lista de espera: {waiting}</div>' if waiting else ''}
</div>

<!-- Fecha -->
<div class="fecha">{fecha_doc}</div>

<!-- Firma Director -->
<div class="firma-block">
  {firma_html}
  <div class="firma-line"></div>
  <div class="firma-name">{director_name}</div>
  <div class="firma-cargo">{director_title}</div>
  <div class="firma-inst">I.E.S.P.P. "{inst_name}"</div>
  {sello_html}
</div>

<div class="doc-footer">
  Documento generado automáticamente — Área de Innovación e Investigación - Informática
</div>

</body>
</html>"""


def generate_acta_pdf(results: list, call_data: dict, inst: dict) -> bytes:
    """
    Genera el PDF del Acta de Resultados.
    Retorna bytes del PDF.
    """
    if not HAS_WEASYPRINT:
        raise ImportError("WeasyPrint no instalado")
    html = acta_resultados_html(results, call_data, inst)
    return WeasyHTML(string=html).write_pdf()
