"""
admission_certificates_generator.py
═══════════════════════════════════════════════════════════════
Genera con WeasyPrint HTML:

  1. cert_inscripcion_html()  → Constancia de Inscripción (A4 landscape)
     Fiel al PDF escaneado original:
       • Columna izq: logo institucional + membrete vertical
       • Título grande "PROCESO DE ADMISIÓN 2025-I"
       • "CONSTANCIA DE INSCRIPCIÓN" subrayado
       • Foto del postulante (con borde azul)
       • Tabla de datos: Condición, Apellidos, Nombres, Especialidad,
         DNI, Sexo, Discapacidad, Domicilio, Teléfono, Correo, Nac.
       • Indicaciones numeradas
       • Aviso destacado (ÚNICO DOCUMENTO)
       • Firma postulante (izq) + Fecha + Firma Director + Sello (der)
       • Footer "Área de Innovación e Investigación"

  2. cert_vacante_html()  → Constancia de Vacante (A4 portrait)
     Fiel al DOCX original:
       • Lema del año
       • Logo institucional
       • "CONSTANCIA DE VACANTE" subrayado
       • Texto "LA DIRECTORA GENERAL..."
       • Cuerpo: vacante, carrera, ciclo, período, nombre alumno
       • Lista de requisitos con viñetas
       • Nota sobre folder manila
       • Fecha centrada + firma director + sello
"""

import io
import os
import base64
import logging
from datetime import datetime

logger = logging.getLogger("admission.certificates")

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

REQUISITOS_TRASLADO = [
    "Fotocopia del DNI del estudiante",
    "Partida de Nacimiento original",
    "Certificado de estudios secundarios",
    "Certificado de estudios superiores originales visado por la DRE.",
    "Resolución Directoral que autorice el Traslado Externo",
    "Resolución de autorización del programa de estudios de procedencia.",
    "Pago por derecho de traslado",
    "01 foto tamaño pasaporte con terno azul y blusa blanca.",
]


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

def _img_b64(path_or_url: str, media_root: str = "") -> str:
    """Convierte imagen a data URI base64 para incrustar en HTML."""
    p = str(path_or_url or "")
    if not p:
        return ""
    if "/media/" in p:
        rel = p.split("/media/")[-1]
        p = os.path.join(media_root, rel)
    if not os.path.isabs(p):
        p = os.path.join(media_root, p.lstrip("/"))
    if not os.path.exists(p):
        return ""
    try:
        with open(p, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        ext  = os.path.splitext(p)[1].lower().lstrip(".")
        mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "gif": "gif"}.get(ext, "png")
        return f"data:image/{mime};base64,{data}"
    except Exception as e:
        logger.warning(f"Error cargando imagen {p}: {e}")
        return ""


def _get_media_root() -> str:
    try:
        from django.conf import settings
        return settings.MEDIA_ROOT
    except Exception:
        return ""


def _field_row(label: str, value: str) -> str:
    """Genera una fila de datos para la tabla de inscripción."""
    val = value.strip() if value else ""
    return f"""
    <tr>
      <td class="lbl">{label}</td>
      <td class="sep">:</td>
      <td class="val">{val}</td>
    </tr>"""


# ═══════════════════════════════════════════════════════════════
# 1. CONSTANCIA DE INSCRIPCIÓN  (A4 landscape)
# ═══════════════════════════════════════════════════════════════

def cert_inscripcion_html(app_data: dict, inst: dict) -> str:
    """
    Construye el HTML de la Constancia de Inscripción.

    app_data keys esperados (todos opcionales con fallback):
      ap_paterno, ap_materno, nombres, especialidad, dni,
      sexo, discapacidad, domicilio, telefono, email,
      fecha_nacimiento, modalidad_admision, call_name,
      photo_path  ← ruta absoluta a la foto del postulante
      firma_postulante_path  ← si existe firma digitalizada

    inst keys:
      institution_name, city, logo_path, firma_director_path,
      sello_path, director_name, director_title, lema_anio,
      year_motto, rvm  (resolución)
    """
    now = datetime.now()
    mr  = _get_media_root()

    # ── Datos del postulante ──
    ap_paterno  = (app_data.get("ap_paterno", "") or "").upper()
    ap_materno  = (app_data.get("ap_materno", "") or "").upper()
    nombres     = (app_data.get("nombres", "") or "").upper()
    full_name   = f"{nombres} {ap_paterno} {ap_materno}".strip()
    especialidad= (app_data.get("especialidad", "") or "").upper()
    dni         = app_data.get("dni", "") or ""
    sexo        = (app_data.get("sexo", "") or "").upper()
    discapacidad= app_data.get("discapacidad", "") or ""
    domicilio   = (app_data.get("domicilio", "") or "").upper()
    telefono    = app_data.get("telefono", "") or ""
    email       = (app_data.get("email", "") or "").lower()
    fecha_nac   = app_data.get("fecha_nacimiento", "") or ""
    modalidad   = (app_data.get("modalidad_admision", "ORDINARIO") or "ORDINARIO").upper()
    call_name   = (app_data.get("call_name", "") or "").upper()

    # ── Institución ──
    inst_nombre   = (inst.get("institution_name", "") or "GUSTAVO ALLENDE LLAVERÍA").strip('"').strip("'")
    city          = inst.get("city", "Tarma")
    director_name = inst.get("director_name", "")
    director_title= (inst.get("director_title", "DIRECTOR GENERAL") or "").upper()
    rvm           = inst.get("rvm", "")

    # ── Imágenes ──
    logo_b64   = _img_b64(inst.get("logo_path", ""), mr)
    firma_b64  = _img_b64(inst.get("firma_director_path", ""), mr)
    sello_b64  = _img_b64(inst.get("sello_path", ""), mr)
    photo_b64  = _img_b64(app_data.get("photo_path", ""), mr)
    firma_post = _img_b64(app_data.get("firma_postulante_path", ""), mr)

    logo_html  = f'<img src="{logo_b64}" class="logo" alt="Logo">'  if logo_b64  else '<div class="logo-ph"></div>'
    photo_html = f'<img src="{photo_b64}" class="photo" alt="Foto">' if photo_b64 else '<div class="photo-ph">Foto<br>carné</div>'
    firma_dir_html = f'<img src="{firma_b64}" class="firma-img" alt="Firma">' if firma_b64 else '<div class="firma-space"></div>'
    sello_html = f'<img src="{sello_b64}" class="sello-img" alt="Sello">' if sello_b64 else ''
    firma_post_html = f'<img src="{firma_post}" class="firma-post-img" alt="Firma">' if firma_post else '<div class="firma-space"></div>'

    fecha_doc = f"{city}, {now.day} de {MESES_ES[now.month]} de {now.year}"

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
/* ══════════════════════════════════════════════
   CONSTANCIA DE INSCRIPCIÓN  — A4 Landscape
   Fiel al documento original del IESPP
   ══════════════════════════════════════════════ */

@page {{
  size: A4 landscape;
  margin: 0.8cm 1cm 0.8cm 1cm;
}}

* {{ box-sizing: border-box; margin: 0; padding: 0; }}

body {{
  font-family: Arial, Helvetica, sans-serif;
  font-size: 8pt;
  color: #000;
  background: #fff;
}}

/* ── Layout ── */
.wrapper {{
  display: flex;
  flex-direction: row;
  width: 100%;
  min-height: 18.5cm;
  gap: 0;
}}

/* ══ COLUMNA IZQUIERDA ══ */
.col-left {{
  width: 30%;
  padding-right: 10px;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}}

.logo {{
  width: 60px;
  height: 60px;
  object-fit: contain;
  margin-bottom: 4px;
}}
.logo-ph {{
  width: 60px;
  height: 60px;
  border: 1px solid #ccc;
  background: #f0f0f0;
}}

.inst-top {{
  text-align: center;
  font-size: 7pt;
  font-weight: bold;
  line-height: 1.4;
  color: #1a237e;
  text-transform: uppercase;
}}

.inst-nombre {{
  text-align: center;
  font-size: 9pt;
  font-weight: 900;
  line-height: 1.3;
  color: #000;
  text-transform: uppercase;
  margin: 2px 0;
}}

/* Título grande rotado — "PROCESO DE ADMISIÓN 2025-I" */
.titulo-proceso-wrapper {{
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}}

.titulo-proceso {{
  font-size: 23pt;
  font-weight: 900;
  color: #000;
  letter-spacing: 1px;
  text-transform: uppercase;
  text-align: center;
  line-height: 1.1;
  transform: rotate(-90deg);
  white-space: nowrap;
  transform-origin: center center;
}}

/* ══ COLUMNA DERECHA ══ */
.col-right {{
  width: 70%;
  padding-left: 12px;
  display: flex;
  flex-direction: column;
}}

/* Foto + datos en fila */
.top-row {{
  display: flex;
  flex-direction: row;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 8px;
}}

/* Foto */
.photo-block {{
  flex-shrink: 0;
}}

.photo {{
  width: 75px;
  height: 95px;
  object-fit: cover;
  border: 3px solid #1565c0;
  display: block;
}}

.photo-ph {{
  width: 75px;
  height: 95px;
  border: 3px solid #1565c0;
  background: #e8eaf6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 7pt;
  color: #666;
  text-align: center;
}}

/* Título de la constancia */
.titulo-constancia {{
  text-align: center;
  font-size: 12pt;
  font-weight: 900;
  letter-spacing: 1px;
  text-decoration: underline;
  text-underline-offset: 3px;
  margin-bottom: 8px;
  text-transform: uppercase;
}}

/* Tabla de datos */
.data-table {{
  width: 100%;
  border-collapse: collapse;
  font-size: 8pt;
  flex: 1;
}}

.data-table td {{
  padding: 2.5px 3px;
  vertical-align: middle;
  border: none;
}}

.data-table .lbl {{
  font-weight: bold;
  width: 38%;
  text-transform: uppercase;
  white-space: nowrap;
  color: #000;
}}

.data-table .sep {{
  width: 8px;
  text-align: center;
  font-weight: bold;
  padding: 0 2px;
}}

.data-table .val {{
  font-weight: bold;
  text-transform: uppercase;
  color: #000;
}}

/* Indicaciones */
.indicaciones {{
  margin-top: 8px;
  font-size: 7.5pt;
}}

.indicaciones .ind-title {{
  font-weight: bold;
  margin-bottom: 3px;
}}

.indicaciones ol {{
  padding-left: 0;
  list-style: none;
  margin: 0;
}}

.indicaciones li {{
  margin-bottom: 2px;
  padding-left: 16px;
  position: relative;
}}

.indicaciones .ind-num {{
  position: absolute;
  left: 0;
  font-weight: bold;
}}

/* Aviso ÚNICO DOCUMENTO */
.aviso {{
  margin-top: 6px;
  font-size: 6.5pt;
  font-weight: bold;
  text-transform: uppercase;
  line-height: 1.4;
  color: #000;
}}

/* ── Zona de firmas (pie) ── */
.firmas-row {{
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: auto;
  padding-top: 8px;
}}

.firma-postulante {{
  text-align: center;
  min-width: 140px;
}}

.firma-director-block {{
  text-align: center;
  min-width: 160px;
  position: relative;
}}

.firma-img {{
  height: 40px;
  width: auto;
  display: block;
  margin: 0 auto;
}}

.firma-post-img {{
  height: 35px;
  width: auto;
  display: block;
  margin: 0 auto;
}}

.firma-space {{ height: 35px; }}

.firma-line {{
  border-top: 1px solid #000;
  margin: 3px 10px 2px 10px;
}}

.firma-label  {{ font-size: 7pt; color: #444; margin-bottom: 1px; }}
.firma-name   {{ font-size: 7.5pt; font-weight: bold; }}
.firma-cargo  {{ font-size: 7pt; text-transform: uppercase; }}
.firma-dni    {{ font-size: 7pt; color: #444; }}

.sello-img {{
  width: 50px;
  height: 50px;
  object-fit: contain;
  opacity: 0.7;
  position: absolute;
  right: -10px;
  bottom: 10px;
}}

/* Fecha */
.fecha-doc {{
  font-size: 8pt;
  text-align: center;
  margin-bottom: 4px;
}}

/* Footer */
.doc-footer {{
  text-align: right;
  font-size: 6pt;
  color: #888;
  margin-top: 4px;
  border-top: 1px solid #eee;
  padding-top: 2px;
}}

.rvm-text {{
  font-size: 6.5pt;
  color: #555;
  text-align: center;
  margin-top: 2px;
}}
</style>
</head>
<body>

<div class="wrapper">

  <!-- ══ COLUMNA IZQUIERDA ══ -->
  <div class="col-left">

    {logo_html}

    <div class="inst-top">
      MINISTERIO DE EDUCACIÓN<br>
      INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO
    </div>

    <div class="inst-nombre">"{inst_nombre}"</div>

    {f'<div class="rvm-text">{rvm}</div>' if rvm else ""}

    <div class="titulo-proceso-wrapper">
      <div class="titulo-proceso">{call_name}</div>
    </div>

  </div>

  <!-- ══ COLUMNA DERECHA ══ -->
  <div class="col-right">

    <div class="titulo-constancia">CONSTANCIA DE INSCRIPCIÓN</div>

    <!-- foto + tabla -->
    <div class="top-row">

      <!-- Foto -->
      <div class="photo-block">
        {photo_html}
      </div>

      <!-- Datos -->
      <div style="flex:1;">
        <table class="data-table">
          <tbody>
            {_field_row("CONDICIÓN DEL POSTULANTE", modalidad)}
            {_field_row("APELLIDOS PATERNO", ap_paterno)}
            {_field_row("APELLIDOS MATERNO", ap_materno)}
            {_field_row("NOMBRES", nombres)}
            {_field_row("ESPECIALIDAD", especialidad)}
            {_field_row("DNI", dni)}
            {_field_row("SEXO", sexo)}
            {_field_row("DISCAPACIDAD", discapacidad)}
            {_field_row("DOMICILIO", domicilio)}
            {_field_row("TELÉFONO", telefono)}
            {_field_row("CORREO ELECTRÓNICO", email)}
            {_field_row("FECHA Y LUGAR DE NACIMIENTO", fecha_nac)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Indicaciones -->
    <div class="indicaciones">
      <div class="ind-title">Indicaciones:</div>
      <ol>
        <li>
          <span class="ind-num">109.</span>
          Presentarse en la sede de aplicación, con 1 hora de anticipación a la hora establecida.
        </li>
        <li>
          <span class="ind-num">110.</span>
          Portar su documento de identidad (DNI) al ingresar al local.
        </li>
        <li>
          <span class="ind-num">111.</span>
          Presentar esta constancia (con foto, sello institucional y firmas del postulante y director de la institución de Educación Superior.
        </li>
      </ol>
    </div>

    <!-- Aviso -->
    <div class="aviso">
      ESTE ES EL ÚNICO DOCUMENTO QUE LO ACREDITA COMO POSTULANTE CORRECTAMENTE REGISTRADO EN SISTEMA DE INFORMACIÓN
      DEL INSTITUTO Y PERMITE SU ACCESO AL LOCAL PARA RENDIR LAS PRUEBAS.
    </div>

    <!-- Firmas -->
    <div class="firmas-row">

      <!-- Firma postulante -->
      <div class="firma-postulante">
        {firma_post_html}
        <div class="firma-line"></div>
        <div class="firma-label">Firma del postulante</div>
        <div class="firma-name">{full_name}</div>
        <div class="firma-dni">{dni}</div>
      </div>

      <!-- Fecha + Firma Director -->
      <div class="firma-director-block">
        <div class="fecha-doc">{fecha_doc}</div>
        {firma_dir_html}
        <div class="firma-line"></div>
        <div class="firma-name">{director_name}</div>
        <div class="firma-cargo">{director_title}</div>
        {sello_html}
      </div>

    </div>

    <div class="doc-footer">Área de Innovación e Investigación - Informática</div>

  </div>
</div>

</body>
</html>"""


# ═══════════════════════════════════════════════════════════════
# 2. CONSTANCIA DE VACANTE  (A4 portrait)
# ═══════════════════════════════════════════════════════════════

def cert_vacante_html(app_data: dict, inst: dict) -> str:
    """
    Construye el HTML de la Constancia de Vacante (portrait).

    Fiel al DOCX original:
      Lema, logo, título subrayado, texto vacante + requisitos, firma.

    app_data keys:
      full_name         ← "APELLIDOS, Nombres" del solicitante
      especialidad      ← carrera profesional
      ciclo             ← "V Semestre" (opcional)
      periodo           ← "2023-II"
      institucion_origen← "I.E.S.P.P Innova Teaching School - Lima" (opcional)
    """
    now = datetime.now()
    mr  = _get_media_root()

    full_name      = (app_data.get("full_name", "") or "").upper()
    especialidad   = (app_data.get("especialidad", "") or "").upper()
    ciclo          = app_data.get("ciclo", "") or ""
    periodo        = app_data.get("periodo", "") or app_data.get("call_period", "")
    inst_origen    = app_data.get("institucion_origen", "") or ""

    inst_nombre    = (inst.get("institution_name", "") or "GUSTAVO ALLENDE LLAVERÍA").strip('"').strip("'")
    city           = inst.get("city", "Tarma")
    director_name  = inst.get("director_name", "")
    director_title = (inst.get("director_title", "DIRECTORA GENERAL") or "").upper()
    year_motto     = inst.get("year_motto", "") or inst.get("lema_anio", "")
    anio_lema      = year_motto or f"AÑO {now.year}"

    logo_b64  = _img_b64(inst.get("logo_path", ""), mr)
    firma_b64 = _img_b64(inst.get("firma_director_path", ""), mr)
    sello_b64 = _img_b64(inst.get("sello_path", ""), mr)

    logo_html  = f'<img src="{logo_b64}" class="logo" alt="Logo">'  if logo_b64  else ''
    firma_html = f'<img src="{firma_b64}" class="firma-img" alt="Firma">' if firma_b64 else '<div class="firma-space"></div>'
    sello_html = f'<img src="{sello_b64}" class="sello-img" alt="Sello">' if sello_b64 else ''

    fecha_doc = f"{city}, {now.day} de {MESES_ES[now.month]} del {now.year}"

    # Construir texto del ciclo/período
    where_parts = []
    if ciclo:
        where_parts.append(f"correspondiente al <strong>{ciclo}</strong>")
    if periodo:
        where_parts.append(f"en el periodo académico <strong>{periodo}</strong>")
    where_text = ", ".join(where_parts) + ("," if where_parts else "")

    # Texto de quién solicita
    if inst_origen:
        solicitante_text = f"""que puede ser ocupado por la estudiante <strong>{full_name}</strong>
        {f"del {inst_origen}" if inst_origen else ""}.
        """
    else:
        solicitante_text = f"que puede ser ocupado por la(el) estudiante <strong>{full_name}</strong>."

    requisitos_html = "\n".join(
        f'<li>{req}</li>' for req in REQUISITOS_TRASLADO
    )

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
/* ══════════════════════════════════════════════
   CONSTANCIA DE VACANTE — A4 Portrait
   Fiel al DOCX original del IESPP
   ══════════════════════════════════════════════ */

@page {{
  size: A4 portrait;
  margin: 2cm 2.5cm 2cm 2.5cm;
}}

* {{ box-sizing: border-box; margin: 0; padding: 0; }}

body {{
  font-family: "Times New Roman", Times, serif;
  font-size: 11pt;
  color: #000;
  line-height: 1.5;
}}

/* ── Lema ── */
.lema {{
  text-align: center;
  font-style: italic;
  font-weight: bold;
  font-size: 10pt;
  margin-bottom: 16px;
  color: #222;
}}

/* ── Logo centrado ── */
.logo {{
  height: 55px;
  width: auto;
  display: block;
  margin: 0 auto 12px auto;
}}

/* ── Título ── */
.titulo {{
  text-align: center;
  font-size: 14pt;
  font-weight: bold;
  text-decoration: underline;
  text-underline-offset: 4px;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 18px;
}}

/* ── Cuerpo ── */
.header-bold {{
  font-weight: bold;
  font-size: 11pt;
  margin-bottom: 6px;
}}

.body-text {{
  text-align: justify;
  margin-bottom: 12px;
  font-size: 11pt;
}}

/* ── Requisitos ── */
.req-title {{
  font-weight: bold;
  font-size: 11pt;
  margin: 14px 0 8px 0;
}}

.req-list {{
  margin: 0 0 8px 20px;
  padding: 0;
  font-size: 10.5pt;
}}

.req-list li {{
  margin-bottom: 4px;
  list-style-type: disc;
}}

.folder-nota {{
  font-size: 10pt;
  margin-top: 6px;
  margin-bottom: 16px;
}}

/* ── Fecha ── */
.fecha {{
  text-align: center;
  font-size: 11pt;
  margin: 18px 0 30px 0;
}}

/* ── Firma ── */
.firma-block {{
  text-align: center;
  position: relative;
  display: inline-block;
  width: 100%;
}}

.firma-img {{
  height: 50px;
  width: auto;
  display: block;
  margin: 0 auto;
}}

.firma-space {{ height: 45px; }}

.firma-line {{
  border-top: 1px solid #000;
  width: 260px;
  margin: 4px auto;
}}

.firma-name  {{ font-weight: bold; font-size: 10pt; text-align: center; }}
.firma-cargo {{ font-size: 10pt; text-transform: uppercase; text-align: center; }}
.firma-inst  {{ font-size: 9pt; text-align: center; color: #333; }}

.sello-img {{
  width: 55px;
  height: 55px;
  object-fit: contain;
  opacity: 0.65;
  position: absolute;
  right: 40px;
  bottom: 0;
}}

.doc-footer {{
  margin-top: 20px;
  text-align: center;
  font-size: 7pt;
  color: #aaa;
  border-top: 1px solid #eee;
  padding-top: 4px;
}}
</style>
</head>
<body>

<div class="lema">"{anio_lema}"</div>

{logo_html}

<div class="titulo">CONSTANCIA DE VACANTE</div>

<div class="header-bold">
  LA {director_title} DEL INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO
  {inst_nombre} de {city}, a través de Secretaría Académica hace constar:
</div>

<div class="body-text">
  Que, en el INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO {inst_nombre}
  de la ciudad de {city}, existe una plaza <strong>VACANTE DE ESTUDIOS</strong>
  en el programa de estudios de <strong>{especialidad}</strong>
  {where_text}
  {solicitante_text}
</div>

<div class="body-text">
  Se expide la presente a solicitud de la interesada para los fines que estime
  por conveniente.
</div>

<div class="req-title">REQUISITOS:</div>
<ul class="req-list">
  {requisitos_html}
</ul>

<p class="folder-nota">
  Presentar la documentación en un folder manila tamaño A4 por mesa de partes de la Institución.
</p>

<div class="fecha">{fecha_doc}</div>

<div class="firma-block">
  {firma_html}
  <div class="firma-line"></div>
  <div class="firma-name">{director_name}</div>
  <div class="firma-cargo">{director_title}</div>
  <div class="firma-inst">I.E.S.P.P. {inst_nombre}</div>
  {sello_html}
</div>

</body>
</html>"""


# ═══════════════════════════════════════════════════════════════
# FUNCIONES PÚBLICAS — generan BytesIO
# ═══════════════════════════════════════════════════════════════

def generate_inscripcion_pdf(app_data: dict, inst: dict) -> bytes:
    """
    Genera el PDF de Constancia de Inscripción.
    Retorna bytes del PDF.
    """
    if not HAS_WEASYPRINT:
        raise ImportError("WeasyPrint no instalado. Ejecuta: pip install weasyprint")
    html = cert_inscripcion_html(app_data, inst)
    return WeasyHTML(string=html).write_pdf()


def generate_vacante_pdf(app_data: dict, inst: dict) -> bytes:
    """
    Genera el PDF de Constancia de Vacante.
    Retorna bytes del PDF.
    """
    if not HAS_WEASYPRINT:
        raise ImportError("WeasyPrint no instalado. Ejecuta: pip install weasyprint")
    html = cert_vacante_html(app_data, inst)
    return WeasyHTML(string=html).write_pdf()