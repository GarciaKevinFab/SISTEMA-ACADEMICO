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

try:
    import qrcode as _qrcode_lib
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False

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


def _qr_b64(url: str, box_size: int = 6) -> str:
    """Genera un QR como data URI base64 PNG para incrustar en HTML."""
    if not HAS_QRCODE or not url:
        return ""
    try:
        qr = _qrcode_lib.QRCode(version=1, box_size=box_size, border=2,
                                 error_correction=_qrcode_lib.constants.ERROR_CORRECT_M)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        data = base64.b64encode(buf.getvalue()).decode()
        return f"data:image/png;base64,{data}"
    except Exception as e:
        logger.warning(f"Error generando QR: {e}")
        return ""


# ═══════════════════════════════════════════════════════════════
# 1. CONSTANCIA DE INSCRIPCIÓN  (A4 portrait)
# ═══════════════════════════════════════════════════════════════

def cert_inscripcion_html(app_data: dict, inst: dict) -> str:
    """
    Construye el HTML de la Constancia de Inscripción (A4 portrait con QR).

    app_data keys esperados (todos opcionales con fallback):
      ap_paterno, ap_materno, nombres, especialidad, dni,
      sexo, discapacidad, domicilio, telefono, email,
      fecha_nacimiento, modalidad_admision, call_name,
      photo_path, verify_url, application_number

    inst keys:
      institution_name, city, logo_path, firma_director_path,
      sello_path, director_name, director_title, rvm
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
    verify_url  = app_data.get("verify_url", "") or ""
    app_number  = app_data.get("application_number", "") or ""

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

    logo_html  = f'<img src="{logo_b64}" class="logo" alt="Logo">'  if logo_b64  else '<div class="logo-ph"></div>'
    photo_html = f'<img src="{photo_b64}" class="photo" alt="Foto">' if photo_b64 else '<div class="photo-ph">Foto<br>carné</div>'
    firma_dir_html = f'<img src="{firma_b64}" class="firma-img" alt="Firma">' if firma_b64 else '<div class="firma-space"></div>'
    sello_html = f'<img src="{sello_b64}" class="sello-img" alt="Sello">' if sello_b64 else ''

    # ── QR ──
    qr_b64_data = _qr_b64(verify_url) if verify_url else ""
    qr_html = f'<img src="{qr_b64_data}" class="qr-img" alt="QR">' if qr_b64_data else ""

    fecha_doc = f"{city}, {now.day} de {MESES_ES[now.month]} de {now.year}"

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
/* ══════════════════════════════════════════════
   CONSTANCIA DE INSCRIPCIÓN  — A4 Portrait + QR
   ══════════════════════════════════════════════ */

@page {{
  size: A4 portrait;
  margin: 1.2cm 1.5cm 1cm 1.5cm;
}}

* {{ box-sizing: border-box; margin: 0; padding: 0; }}

body {{
  font-family: Arial, Helvetica, sans-serif;
  font-size: 9pt;
  color: #000;
  background: #fff;
}}

/* ── Header institucional ── */
.header {{
  display: flex;
  align-items: center;
  background: #1a237e;
  color: #fff;
  padding: 10px 16px;
  border-radius: 4px;
  margin-bottom: 14px;
}}

.header .logo {{
  width: 55px;
  height: 55px;
  object-fit: contain;
  margin-right: 14px;
  flex-shrink: 0;
}}

.header .logo-ph {{
  width: 55px;
  height: 55px;
  border: 1px solid rgba(255,255,255,0.3);
  margin-right: 14px;
  flex-shrink: 0;
}}

.header-text {{
  flex: 1;
}}

.header-inst {{
  font-size: 8pt;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1.4;
}}

.header-nombre {{
  font-size: 9pt;
  font-weight: 900;
  text-transform: uppercase;
  line-height: 1.3;
  margin-top: 2px;
}}

.header-right {{
  text-align: right;
  flex-shrink: 0;
  margin-left: 10px;
}}

.header-right .proc-label {{
  font-size: 7pt;
  text-transform: uppercase;
  opacity: 0.8;
}}

.header-right .proc-name {{
  font-size: 10pt;
  font-weight: 900;
  text-transform: uppercase;
}}

/* ── Título ── */
.titulo {{
  text-align: center;
  font-size: 15pt;
  font-weight: 900;
  text-decoration: underline;
  text-underline-offset: 4px;
  text-transform: uppercase;
  margin: 10px 0 16px 0;
  letter-spacing: 1px;
}}

/* ── Foto + datos ── */
.content-row {{
  display: flex;
  gap: 16px;
  margin-bottom: 14px;
}}

.photo-block {{ flex-shrink: 0; }}

.photo {{
  width: 85px;
  height: 105px;
  object-fit: cover;
  border: 3px solid #1565c0;
  display: block;
}}

.photo-ph {{
  width: 85px;
  height: 105px;
  border: 3px solid #1565c0;
  background: #e8eaf6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8pt;
  color: #666;
  text-align: center;
}}

/* ── Tabla de datos ── */
.data-table {{
  width: 100%;
  border-collapse: collapse;
  font-size: 9pt;
}}

.data-table td {{
  padding: 4px 5px;
  vertical-align: middle;
  border-bottom: 1px solid #e0e0e0;
}}

.data-table .lbl {{
  font-weight: bold;
  width: 35%;
  text-transform: uppercase;
  color: #222;
}}

.data-table .sep {{
  width: 10px;
  text-align: center;
  font-weight: bold;
  padding: 0 3px;
}}

.data-table .val {{
  font-weight: bold;
  text-transform: uppercase;
  color: #000;
}}

/* ── Indicaciones ── */
.indicaciones {{
  margin: 14px 0 8px 0;
  font-size: 8.5pt;
  line-height: 1.5;
}}

.indicaciones .ind-title {{
  font-weight: bold;
  margin-bottom: 4px;
}}

.indicaciones ol {{
  padding-left: 20px;
  margin: 0;
}}

.indicaciones li {{
  margin-bottom: 3px;
}}

/* ── Aviso ── */
.aviso {{
  margin: 10px 0;
  padding: 8px 12px;
  font-size: 8pt;
  font-weight: bold;
  text-transform: uppercase;
  line-height: 1.5;
  color: #b71c1c;
  border: 1.5px solid #b71c1c;
  border-radius: 3px;
  text-align: center;
}}

/* ── QR + Verificación ── */
.verify-section {{
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 14px 0;
  padding: 10px 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fafafa;
}}

.qr-img {{
  width: 90px;
  height: 90px;
}}

.verify-text {{
  font-size: 8pt;
  line-height: 1.5;
  color: #333;
}}

.verify-text .verify-label {{
  font-weight: bold;
  font-size: 8.5pt;
  color: #1a237e;
  margin-bottom: 3px;
}}

.verify-url {{
  color: #1565c0;
  text-decoration: underline;
  word-break: break-all;
  font-size: 7.5pt;
}}

.verify-code {{
  font-weight: bold;
  font-size: 9pt;
  margin-top: 3px;
}}

/* ── Firmas ── */
.firmas-row {{
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 30px;
  padding-top: 10px;
}}

.firma-col {{
  text-align: center;
  min-width: 180px;
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
  margin: 3px 10px 3px 10px;
}}

.firma-label {{ font-size: 7.5pt; color: #555; margin-bottom: 1px; }}
.firma-name  {{ font-size: 8.5pt; font-weight: bold; }}
.firma-cargo {{ font-size: 7.5pt; text-transform: uppercase; color: #444; }}
.firma-dni   {{ font-size: 7.5pt; color: #555; }}

.sello-img {{
  width: 55px;
  height: 55px;
  object-fit: contain;
  opacity: 0.7;
  position: absolute;
  right: -15px;
  bottom: 10px;
}}

.firma-director-block {{
  position: relative;
  text-align: center;
  min-width: 180px;
}}

.fecha-doc {{
  font-size: 8.5pt;
  text-align: center;
  margin-bottom: 4px;
}}

/* ── Footer ── */
.doc-footer {{
  text-align: center;
  font-size: 6.5pt;
  color: #999;
  margin-top: 12px;
  border-top: 1px solid #eee;
  padding-top: 4px;
}}
</style>
</head>
<body>

<!-- ══ HEADER INSTITUCIONAL ══ -->
<div class="header">
  {logo_html}
  <div class="header-text">
    <div class="header-inst">INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO</div>
    <div class="header-nombre">"Instituto Superior Pedagógico {inst_nombre}"</div>
  </div>
  <div class="header-right">
    <div class="proc-label">PROCESO DE ADMISIÓN</div>
    <div class="proc-name">{call_name}</div>
  </div>
</div>

<!-- ══ TÍTULO ══ -->
<div class="titulo">CONSTANCIA DE INSCRIPCIÓN</div>

<!-- ══ FOTO + DATOS ══ -->
<div class="content-row">
  <div class="photo-block">
    {photo_html}
  </div>
  <div style="flex:1;">
    <table class="data-table">
      <tbody>
        {_field_row("CONDICIÓN DEL POSTULANTE", modalidad)}
        {_field_row("APELLIDO PATERNO", ap_paterno)}
        {_field_row("APELLIDO MATERNO", ap_materno)}
        {_field_row("NOMBRES", nombres)}
        {_field_row("ESPECIALIDAD", especialidad)}
        {_field_row("DNI", dni)}
        {_field_row("SEXO", sexo)}
        {_field_row("DISCAPACIDAD", discapacidad)}
        {_field_row("DOMICILIO", domicilio)}
        {_field_row("TELÉFONO", telefono)}
        {_field_row("CORREO ELECTRÓNICO", email)}
        {_field_row("FECHA DE NACIMIENTO", fecha_nac)}
      </tbody>
    </table>
  </div>
</div>

<!-- ══ INDICACIONES ══ -->
<div class="indicaciones">
  <div class="ind-title">Indicaciones:</div>
  <ol>
    <li>Presentarse en la sede de aplicación con 1 hora de anticipación a la hora establecida.</li>
    <li>Portar su Documento de Identidad (DNI) al ingresar al local.</li>
    <li>Presentar esta constancia (con foto, sello institucional y firmas).</li>
  </ol>
</div>

<!-- ══ AVISO ══ -->
<div class="aviso">
  ESTE ES EL ÚNICO DOCUMENTO QUE LO ACREDITA COMO POSTULANTE CORRECTAMENTE
  REGISTRADO EN EL SISTEMA Y PERMITE SU ACCESO AL LOCAL PARA RENDIR LAS PRUEBAS.
</div>

<!-- ══ QR DE VERIFICACIÓN ══ -->
{"" if not qr_html else f'''
<div class="verify-section">
  {qr_html}
  <div class="verify-text">
    <div class="verify-label">Verificación Digital</div>
    Escanee el código QR o ingrese al siguiente enlace:<br>
    <span class="verify-url">{verify_url}</span>
    {f'<div class="verify-code">N° Postulación: {app_number}</div>' if app_number else ''}
  </div>
</div>
'''}

<!-- ══ FIRMAS ══ -->
<div class="firmas-row">

  <div class="firma-col">
    <div class="firma-space"></div>
    <div class="firma-line"></div>
    <div class="firma-label">Firma del Postulante</div>
    <div class="firma-name">{full_name}</div>
    <div class="firma-dni">DNI: {dni}</div>
  </div>

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