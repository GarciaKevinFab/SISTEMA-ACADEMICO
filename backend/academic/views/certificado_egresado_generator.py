"""
certificado_egresado_generator.py
═══════════════════════════════════════════════════════════════
Certificado de Egresado (SIA) — IESPP "Gustavo Allende Llavería"

Diseño FIEL al PDF original:
  • Formato A4 HORIZONTAL (landscape)
  • Columna izquierda (~40%):
      - Logo SIA + Logo MINEDU
      - Membrete institucional completo
      - "El Director General... otorga el presente:"
      - Foto del alumno
  • Columna derecha (~60%):
      - N° de certificado (arriba derecha)
      - "CERTIFICADO EGRESADO" (título grande)
      - "A APELLIDOS, NOMBRES"
      - Texto de créditos + carrera + promoción
      - Fecha
      - 3 firmas en fila (Director + Secretario + Jefe Unidad)

El sistema calcula AUTOMÁTICAMENTE:
  • Total de créditos aprobados → suma de PlanCourse.credits del plan
    (o suma de credits en AcademicGradeRecord aprobados)
  • Número de certificado → process.id con formato 006125
  • Carrera, nombres → del Student model

Solo requiere del usuario:
  promotion_year  : "2022"   ← año de promoción
  promotion_period: "II"     ← período (I o II)
  (ambos opcionales: si no se dan, se infieren del último term con notas)

Fuentes:
  Student → nombres, apellidos, plan → career, photo_url
  Plan / PlanCourse → créditos totales
  AcademicGradeRecord → verificación de créditos aprobados
  InstitutionSetting → director_name, secretary_name, academic_head_name,
                        logo_url, signature_url, secretary_signature_url,
                        academic_head_signature_url (si existe)
"""

import io
import logging
import os
import base64
import math
from datetime import datetime
from collections import defaultdict

logger = logging.getLogger("academic.processes")

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


# ═══════════════════════════════════════════════════════════════
# CÁLCULO AUTOMÁTICO DE CRÉDITOS
# ═══════════════════════════════════════════════════════════════

def _get_total_credits_from_plan(plan_id: int) -> int:
    """
    Obtiene el total de créditos del plan de estudios
    sumando PlanCourse.credits de todos los cursos obligatorios.
    """
    if not plan_id:
        return 0
    try:
        from academic.models import PlanCourse
        total = (
            PlanCourse.objects
            .filter(plan_id=plan_id)
            .exclude(type="ELECTIVE")   # excluir electivos si los hay
            .values_list("credits", flat=True)
        )
        return sum(c or 0 for c in total)
    except Exception as e:
        logger.warning(f"Error obteniendo créditos del plan {plan_id}: {e}")
        return 0


def _get_approved_credits(student_id: int) -> int:
    """
    Suma los créditos de los cursos aprobados (nota >= 11)
    desde AcademicGradeRecord, usando el crédito de plan_course.
    """
    if not student_id:
        return 0
    try:
        from academic.models import AcademicGradeRecord
        records = (
            AcademicGradeRecord.objects
            .filter(student_id=student_id, final_grade__gte=11)
            .select_related("plan_course")
        )
        total = 0
        for r in records:
            try:
                if hasattr(r, "plan_course") and r.plan_course:
                    total += int(r.plan_course.credits or 0)
                elif hasattr(r, "credits") and r.credits:
                    total += int(r.credits or 0)
            except Exception:
                pass
        return total
    except Exception as e:
        logger.warning(f"Error obteniendo créditos aprobados alumno {student_id}: {e}")
        return 0


def _get_promotion_from_terms(student_id: int) -> tuple:
    """
    Infiere año y período de promoción del último term con notas.
    Retorna (year_str, period_str) ej: ("2022", "II")
    """
    try:
        from academic.models import AcademicGradeRecord
        terms = (
            AcademicGradeRecord.objects
            .filter(student_id=student_id)
            .exclude(final_grade=None)
            .values_list("term", flat=True)
            .distinct()
        )
        terms_list = sorted([str(t) for t in terms if t], reverse=True)
        if terms_list:
            last = terms_list[0]          # ej: "2022-II"
            parts = last.split("-")
            year  = parts[0] if parts else str(datetime.now().year)
            period = parts[1] if len(parts) > 1 else "II"
            return year, period
    except Exception:
        pass
    return str(datetime.now().year), "II"


def _get_student_photo_b64(student) -> str:
    """Obtiene la foto del alumno en base64 si existe en el modelo."""
    try:
        from django.conf import settings
        photo_field = None
        for attr in ("photo", "foto", "photo_url", "avatar"):
            val = getattr(student, attr, None)
            if val:
                photo_field = str(val)
                break
        if not photo_field:
            return ""
        # Si es URL de media
        if "/media/" in photo_field:
            rel = photo_field.split("/media/")[-1]
            path = os.path.join(settings.MEDIA_ROOT, rel)
        elif os.path.exists(photo_field):
            path = photo_field
        else:
            path = os.path.join(settings.MEDIA_ROOT, photo_field.lstrip("/"))
        if os.path.exists(path):
            with open(path, "rb") as f:
                data = base64.b64encode(f.read()).decode()
            ext  = os.path.splitext(path)[1].lower().lstrip(".")
            mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png"}.get(ext, "jpeg")
            return f"data:image/{mime};base64,{data}"
    except Exception:
        pass
    return ""


# ═══════════════════════════════════════════════════════════════
# HELPERS DE IMAGEN
# ═══════════════════════════════════════════════════════════════

def _img_b64(url_or_path: str, media_root: str = "") -> str:
    p = str(url_or_path or "")
    if "/media/" in p:
        rel = p.split("/media/")[-1]
        p = os.path.join(media_root, rel)
    if not p or not os.path.exists(p):
        return ""
    try:
        with open(p, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        ext  = os.path.splitext(p)[1].lower().lstrip(".")
        mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "gif": "gif"}.get(ext, "png")
        return f"data:image/{mime};base64,{data}"
    except Exception:
        return ""


# ═══════════════════════════════════════════════════════════════
# DATOS COMPLETOS
# ═══════════════════════════════════════════════════════════════

def _calculate_certificado_data(student: dict, extra: dict) -> dict:
    """
    Reúne y calcula todos los datos necesarios para el certificado.
    """
    student_id = student.get("id")
    plan_id    = student.get("plan_id")

    # ── Créditos ──
    # Primero intentar del plan, luego de los aprobados, luego del extra
    credits_plan     = _get_total_credits_from_plan(plan_id)
    credits_approved = _get_approved_credits(student_id)

    # Usar el mayor que sea válido, con fallback a extra
    if credits_plan > 0:
        total_credits = credits_plan
    elif credits_approved > 0:
        total_credits = credits_approved
    else:
        total_credits = int(extra.get("credits", extra.get("creditos", 220)) or 220)

    # ── Promoción ──
    promo_y_extra = extra.get("promotion_year", "").strip()
    promo_p_extra = extra.get("promotion_period", "").strip()

    if promo_y_extra and promo_p_extra:
        promo_year   = promo_y_extra
        promo_period = promo_p_extra
    else:
        inferred_y, inferred_p = _get_promotion_from_terms(student_id)
        promo_year   = promo_y_extra or inferred_y
        promo_period = promo_p_extra or inferred_p

    promo_str = f"{promo_year}-{promo_period}" if promo_period else promo_year

    return {
        "total_credits": total_credits,
        "promo_year":    promo_year,
        "promo_period":  promo_period,
        "promo_str":     promo_str,
    }


# ═══════════════════════════════════════════════════════════════
# CONSTRUCCIÓN DEL HTML — FIEL AL PDF SIA
# ═══════════════════════════════════════════════════════════════

def _build_html(process, student: dict, cert: dict, inst: dict) -> str:
    now = datetime.now()

    # ── Datos alumno ──
    nombres   = student.get("nombres", "")
    apellidos = student.get("apellidos", "")
    # Formato del doc: "APELLIDOS, NOMBRES"
    if apellidos and nombres:
        nombre_doc = f"{apellidos.upper()}, {nombres}"
    else:
        nombre_doc = student.get("nombre_completo", "").upper()

    carrera = student.get("carrera", "").upper()

    # ── Datos institucionales ──
    i_nombre      = inst.get("institution_name", '"GUSTAVO ALLENDE LLAVERÍA"')
    city          = inst.get("city", "Tarma")
    region        = inst.get("region", "Junín")
    ds            = inst.get("ds_creation", "D.S. 059-1984-ED")
    rm            = inst.get("rm_revalidation", "Reinscripción D.S. 017-2002-ED")
    address       = inst.get("address", "Carretera Central Km. 4 S/N Pomachaca")
    email         = inst.get("email", "iespp.gal.tarma@gmail.com")
    short         = inst.get("short_name", "I.E.S.P.P.")
    director_name = inst.get("director_name", "")
    secretary_name= inst.get("secretary_name", "")
    acad_head_name= inst.get("academic_head_name", "")

    # ── Cargo del jefe de unidad (detectar por carrera) ──
    acad_head_cargo = inst.get("academic_head_cargo", "")
    if not acad_head_cargo:
        c = carrera.lower()
        if "primaria" in c:
            acad_head_cargo = "LIC. EDUCACIÓN PRIMARIA"
        elif "inicial" in c:
            acad_head_cargo = "LIC. EDUCACIÓN INICIAL"
        elif "física" in c or "fisica" in c:
            acad_head_cargo = "LIC. EDUCACIÓN FÍSICA"
        elif "computación" in c or "informática" in c:
            acad_head_cargo = "LIC. COMPUTACIÓN E INFORMÁTICA"
        else:
            acad_head_cargo = "LIC. EDUCACIÓN"

    # ── Media ──
    try:
        from django.conf import settings
        media_root = settings.MEDIA_ROOT
    except Exception:
        media_root = ""

    logo_src     = _img_b64(inst.get("logo_url", ""), media_root)
    dir_sig_src  = _img_b64(inst.get("signature_url", ""), media_root)
    sec_sig_src  = _img_b64(inst.get("secretary_signature_url", ""), media_root)
    head_sig_src = _img_b64(inst.get("academic_head_signature_url", ""), media_root)

    # Logo institucional HTML
    logo_html = (
        f'<img src="{logo_src}" class="logo-inst" alt="Logo">'
        if logo_src else
        f'<div class="logo-placeholder">{short}</div>'
    )

    # Foto del alumno HTML (intentar desde Student model)
    try:
        from students.models import Student as StudentModel
        st_obj = StudentModel.objects.get(id=student.get("id"))
        photo_b64 = _get_student_photo_b64(st_obj)
    except Exception:
        photo_b64 = ""

    photo_html = (
        f'<img src="{photo_b64}" class="student-photo" alt="Foto alumno">'
        if photo_b64 else
        '<div class="student-photo-placeholder">Foto<br>Alumno</div>'
    )

    # ── Datos del certificado ──
    num_cert     = f"{process.id:06d}"
    total_credits= cert["total_credits"]
    promo_str    = cert["promo_str"]
    fecha_doc    = f"Dado en {city.upper()}, {now.day} de {MESES_ES[now.month]} del {now.year}"
    anio_lema    = str(now.year)

    # ── Firmas HTML ──
    def _firma_col(sig_src, name, cargo1, cargo2="", sello=True):
        img  = f'<img src="{sig_src}" class="sig-img" alt="Firma">' if sig_src else '<div class="sig-space"></div>'
        sello_html = '<div class="sello-circle"></div>' if sello else ""
        name_html  = f'<div class="sig-name">{name}</div>' if name else ""
        cargo1_html= f'<div class="sig-cargo">{cargo1}</div>' if cargo1 else ""
        cargo2_html= f'<div class="sig-cargo2">{cargo2}</div>' if cargo2 else ""
        return f"""
        <div class="firma-col">
          <div class="firma-top">
            {sello_html}
            {img}
          </div>
          <div class="sig-line"></div>
          {name_html}
          {cargo1_html}
          {cargo2_html}
          <div class="sig-inst">{short} {i_nombre}</div>
        </div>"""

    firma_director  = _firma_col(dir_sig_src,  director_name,  "DIRECTOR(A) GENERAL",    "", True)
    firma_secretary = _firma_col(sec_sig_src,  secretary_name, "SECRETARIO ACADÉMICO",   "", True)
    firma_head      = _firma_col(head_sig_src, acad_head_name, "JEFE DE LA UNIDAD ACADÉMICA", acad_head_cargo, True)

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>

/* ══════════════════════════════════════════════
   CERTIFICADO DE EGRESADO — SIA
   A4 Horizontal, 2 columnas
   Fiel al documento original del IESPP
   ══════════════════════════════════════════════ */

@page {{
  size: A4 landscape;
  margin: 1.2cm 1.5cm 1.2cm 1.5cm;
}}

* {{ box-sizing: border-box; margin: 0; padding: 0; }}

body {{
  font-family: Arial, Helvetica, sans-serif;
  font-size: 9pt;
  color: #000;
  height: 100%;
}}

/* ── Layout principal: 2 columnas ── */
.page-wrapper {{
  display: flex;
  flex-direction: row;
  width: 100%;
  min-height: 17cm;
  border: 1px solid #bbb;
}}

/* ══ COLUMNA IZQUIERDA ══ */
.col-left {{
  width: 38%;
  border-right: 2px solid #1a237e;
  padding: 14px 14px 10px 14px;
  display: flex;
  flex-direction: column;
  background: #fafbff;
}}

/* Logos arriba */
.logos-row {{
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}}

.logo-sia {{
  font-size: 20pt;
  font-weight: 900;
  font-style: italic;
  color: #1a237e;
  letter-spacing: -1px;
}}

.logo-inst {{
  height: 40px;
  width: auto;
  object-fit: contain;
}}

.logo-placeholder {{
  width: 40px;
  height: 40px;
  border: 1px solid #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 6pt;
  text-align: center;
  color: #666;
}}

.logo-minedu {{
  font-size: 6.5pt;
  color: #555;
  line-height: 1.3;
  text-align: center;
}}

/* Nombre institución */
.inst-block {{
  text-align: center;
  margin-bottom: 10px;
  border-bottom: 1px solid #ccc;
  padding-bottom: 8px;
}}

.inst-ministerio {{
  font-size: 9.5pt;
  font-weight: bold;
  color: #1a237e;
  text-transform: uppercase;
  line-height: 1.4;
}}

.inst-tipo {{
  font-size: 9pt;
  font-weight: bold;
  text-transform: uppercase;
  line-height: 1.4;
  margin-top: 2px;
}}

.inst-nombre {{
  font-size: 10pt;
  font-weight: bold;
  text-transform: uppercase;
  line-height: 1.4;
}}

.inst-ciudad {{
  font-size: 9pt;
  font-weight: bold;
  color: #333;
  margin-top: 2px;
}}

.inst-meta {{
  font-size: 6.5pt;
  color: #555;
  margin-top: 4px;
  line-height: 1.4;
}}

/* Texto del director */
.director-text {{
  font-size: 8.5pt;
  text-align: justify;
  color: #222;
  line-height: 1.5;
  margin-top: 8px;
  margin-bottom: 12px;
}}

/* Foto alumno */
.student-photo {{
  width: 90px;
  height: 110px;
  object-fit: cover;
  border: 1px solid #888;
  display: block;
  margin: 0 auto;
}}

.student-photo-placeholder {{
  width: 90px;
  height: 110px;
  border: 1px solid #888;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 8pt;
  color: #aaa;
  margin: 0 auto;
  background: #f5f5f5;
}}

/* ══ COLUMNA DERECHA ══ */
.col-right {{
  width: 62%;
  padding: 14px 16px 10px 20px;
  display: flex;
  flex-direction: column;
}}

/* Número de certificado */
.cert-number {{
  text-align: right;
  font-size: 11pt;
  font-weight: bold;
  margin-bottom: 16px;
  color: #000;
}}

/* Título del certificado */
.cert-title {{
  text-align: center;
  font-size: 28pt;
  font-weight: 900;
  font-style: italic;
  letter-spacing: 2px;
  color: #000;
  text-transform: uppercase;
  margin-bottom: 20px;
  line-height: 1.1;
  border-bottom: 3px solid #1a237e;
  padding-bottom: 12px;
}}

/* Nombre del alumno */
.alumno-nombre {{
  text-align: center;
  font-size: 14pt;
  font-weight: bold;
  letter-spacing: 0.5px;
  margin-bottom: 18px;
  color: #000;
  line-height: 1.3;
}}

/* Texto cuerpo */
.cert-body {{
  font-size: 10pt;
  text-align: justify;
  line-height: 1.7;
  margin-bottom: 16px;
  flex-grow: 1;
}}

/* Fecha */
.cert-fecha {{
  font-size: 10.5pt;
  font-weight: bold;
  margin-bottom: 20px;
  color: #000;
}}

/* ══ FIRMAS ══ */
.firmas-row {{
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: flex-end;
  margin-top: auto;
  gap: 8px;
}}

.firma-col {{
  flex: 1;
  text-align: center;
  position: relative;
}}

/* Contenedor firma + sello superpuestos */
.firma-top {{
  position: relative;
  height: 65px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}}

.sello-circle {{
  width: 58px;
  height: 58px;
  border-radius: 50%;
  border: 1.5px solid #999;
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  background: transparent;
  opacity: 0.35;
}}

.sig-img {{
  height: 42px;
  width: auto;
  display: block;
  margin: 0 auto;
  position: relative;
  z-index: 2;
}}

.sig-space {{
  height: 42px;
}}

.sig-line {{
  border-top: 1px solid #000;
  margin: 4px 8px 3px 8px;
}}

.sig-name {{
  font-size: 8pt;
  font-weight: bold;
  line-height: 1.3;
}}

.sig-cargo {{
  font-size: 7.5pt;
  font-weight: bold;
  text-transform: uppercase;
  color: #333;
  line-height: 1.3;
}}

.sig-cargo2 {{
  font-size: 7pt;
  color: #333;
  line-height: 1.3;
}}

.sig-inst {{
  font-size: 6.5pt;
  color: #555;
  line-height: 1.3;
  margin-top: 2px;
}}

/* Footer del sistema */
.doc-footer {{
  margin-top: 4px;
  text-align: center;
  font-size: 5.5pt;
  color: #bbb;
}}

</style>
</head>
<body>

<div class="page-wrapper">

  <!-- ══════════════════════════════
       COLUMNA IZQUIERDA
       ══════════════════════════════ -->
  <div class="col-left">

    <!-- Logos -->
    <div class="logos-row">
      <div class="logo-sia">SIA</div>
      {logo_html}
      <div class="logo-minedu">
        Ministerio<br>de Educación
      </div>
    </div>

    <!-- Nombre de la institución -->
    <div class="inst-block">
      <div class="inst-ministerio">MINISTERIO DE EDUCACIÓN</div>
      <div class="inst-tipo">INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO</div>
      <div class="inst-nombre">PÚBLICO {i_nombre}</div>
      <div class="inst-ciudad">{city.upper()} - {region.upper()} - PERÚ</div>
      <div class="inst-meta">
        {address}<br>
        {ds} · {rm}<br>
        EMAIL: {email}
      </div>
    </div>

    <!-- Texto del director -->
    <div class="director-text">
      El Director General del Instituto de Educación Superior Pedagógico
      Público {i_nombre} de {city.upper()} que al final suscribe,
      otorga el presente:
    </div>

    <!-- Foto del alumno -->
    {photo_html}

  </div>

  <!-- ══════════════════════════════
       COLUMNA DERECHA
       ══════════════════════════════ -->
  <div class="col-right">

    <!-- Número de certificado -->
    <div class="cert-number">N° {num_cert}</div>

    <!-- Título -->
    <div class="cert-title">Certificado Egresado</div>

    <!-- Nombre alumno -->
    <div class="alumno-nombre">A {nombre_doc}</div>

    <!-- Cuerpo -->
    <div class="cert-body">
      Por haber concluido y aprobado <strong>{total_credits}</strong> créditos
      del Plan de Estudios de su Formación Inicial Docente, en la carrera de:
      <strong>{carrera}</strong>,
      Promoción <strong>{promo_str}</strong>.
    </div>

    <!-- Fecha -->
    <div class="cert-fecha">{fecha_doc}</div>

    <!-- Firmas -->
    <div class="firmas-row">
      {firma_director}
      {firma_secretary}
      {firma_head}
    </div>

    <!-- Footer sistema -->
    <div class="doc-footer">
      Sistema Académico IESPP · Proceso #{process.id:05d} · {now.strftime("%d/%m/%Y %H:%M")}
    </div>

  </div>
</div>

</body>
</html>"""


# ═══════════════════════════════════════════════════════════════
# FUNCIÓN PRINCIPAL
# ═══════════════════════════════════════════════════════════════

def generate_certificado_egresado_weasyprint(
    process,
    student: dict,
    extra: dict,
    inst: dict,
) -> tuple:
    """
    Genera el Certificado de Egresado en PDF.

    Layout fiel al PDF SIA original:
      • A4 horizontal (landscape)
      • Columna izquierda: membrete + foto alumno
      • Columna derecha: N°, título, nombre, créditos, fecha, 3 firmas

    Calcula automáticamente:
      • Total de créditos del plan de estudios
      • Año y período de promoción (del último term con notas)
      • Cargo del jefe de unidad (según carrera)

    Args:
        process: AcademicProcess instance
        student: dict de _get_student()
        extra:   dict de _get_extra_data()
                 Campos opcionales:
                   promotion_year:   "2022"
                   promotion_period: "II"
                   credits:          220   (override si el plan no tiene datos)
        inst:    dict de _get_institution()

    Returns (BytesIO, filename).
    """
    if not HAS_WEASYPRINT:
        raise ImportError(
            "WeasyPrint no está instalado.\n"
            "Instala con: pip install weasyprint"
        )

    # 1. Calcular datos
    cert = _calculate_certificado_data(student, extra)

    logger.info(
        f"Proceso {process.id}: CERTIFICADO_EGRESADO — "
        f"alumno {student.get('id')} "
        f"créditos={cert['total_credits']} "
        f"promoción={cert['promo_str']}"
    )

    # 2. Construir HTML
    html_content = _build_html(process, student, cert, inst)

    # 3. Generar PDF
    pdf_bytes = WeasyHTML(string=html_content).write_pdf()

    now      = datetime.now()
    filename = f"CERTIFICADO-EGRESADO_{process.id:05d}_{now.strftime('%Y%m%d')}.pdf"

    buf = io.BytesIO(pdf_bytes)
    buf.seek(0)
    return buf, filename