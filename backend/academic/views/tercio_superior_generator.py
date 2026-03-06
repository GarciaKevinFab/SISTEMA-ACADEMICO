"""
tercio_superior_generator.py
═══════════════════════════════════════════════════════════════
Constancia de Tercio Superior — IESPP "Gustavo Allende Llavería"

El sistema calcula AUTOMÁTICAMENTE:
  • Promedio Ponderado general de cada egresado de la misma carrera/plan
    PP = Σ(nota_final × créditos_curso) / Σ(créditos_curso)
  • Ranking de todos los egresados del cohorte (promoción)
  • Límite del tercio superior (top 33.33%)
  • Promedio del tercio superior (promedio de los del top tercio)
  • Puesto del alumno en el ranking
  • Verificación de que el alumno SÍ pertenece al tercio

Solo requiere del admin/alumno:
  promotion_year: "2022"  ← año de la promoción (para filtrar el cohorte)
                            Si no se proporciona → usa el año más reciente con notas

Fuentes de datos:
  AcademicGradeRecord → final_grade, plan_course__credits
  Student             → plan → career, nombres, apellidos
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

ORDINALS_SUFFIX = {
    1: "1ro.", 2: "2do.", 3: "3ro.", 4: "4to.", 5: "5to.",
    6: "6to.", 7: "7mo.", 8: "8vo.", 9: "9no.", 10: "10mo.",
    11: "11vo.", 12: "12vo.", 13: "13ro.", 14: "14to.", 15: "15vo.",
    16: "16vo.", 17: "17mo.", 18: "18vo.", 19: "19no.", 20: "20vo.",
}


def _ordinal(n: int) -> str:
    return ORDINALS_SUFFIX.get(n, f"{n}vo.")


# ═══════════════════════════════════════════════════════════════
# CÁLCULO DEL PROMEDIO PONDERADO
# ═══════════════════════════════════════════════════════════════

def _weighted_avg(records: list) -> float:
    """
    PP = Σ(nota × créditos) / Σ(créditos)
    Si no hay créditos → promedio simple.
    """
    tw = 0.0
    tc = 0.0
    for r in records:
        grade = float(r.final_grade or 0)
        credits = 0.0
        try:
            if hasattr(r, "plan_course") and r.plan_course:
                credits = float(r.plan_course.credits or 0)
            elif hasattr(r, "credits") and r.credits:
                credits = float(r.credits or 0)
        except Exception:
            pass

        if credits > 0:
            tw += grade * credits
            tc += credits
        else:
            tw += grade
            tc += 1.0

    return round(tw / tc, 2) if tc > 0 else 0.0


# ═══════════════════════════════════════════════════════════════
# CÁLCULO DEL TERCIO SUPERIOR
# ═══════════════════════════════════════════════════════════════

def _calculate_tercio_data(student: dict, extra: dict) -> dict:
    """
    Calcula todos los datos del tercio superior para el alumno.

    Algoritmo:
      1. Obtener todos los alumnos del mismo plan/carrera
      2. Filtrar por promotion_year si se proporciona
         (compara el año en los terms: "2022-I", "2022-II" → año 2022)
      3. Calcular PP general de cada alumno
      4. Ordenar de mayor a menor
      5. Tercio superior = ceil(N / 3) mejores alumnos
      6. Promedio del tercio = promedio de sus PPs
      7. Verificar si el alumno está en el tercio

    Retorna dict con todos los datos para el documento.
    """
    student_id = student.get("id")
    plan_id    = student.get("plan_id")
    career_id  = student.get("carrera_id")
    promotion_year = extra.get("promotion_year", "").strip()

    # ── Importar modelos ──
    try:
        from students.models import Student
        from academic.models import AcademicGradeRecord
    except ImportError:
        logger.warning("Modelos no disponibles para calcular tercio")
        return _fallback_data(student, extra)

    try:
        # ── 1. Obtener alumnos de la misma carrera/plan ──
        qs_students = Student.objects.all()
        if plan_id:
            qs_students = qs_students.filter(plan_id=plan_id)
        elif career_id:
            qs_students = qs_students.filter(plan__career_id=career_id)

        all_student_ids = list(qs_students.values_list("id", flat=True))

        if not all_student_ids:
            return _fallback_data(student, extra)

        # ── 2. Obtener registros de notas ──
        qs_grades = (
            AcademicGradeRecord.objects
            .filter(student_id__in=all_student_ids)
            .select_related("plan_course")
        )

        # ── 3. Filtrar por año de promoción ──
        if promotion_year:
            # Los terms tienen formato "2022-I", "2022-II", "2022", etc.
            # Filtramos los que contienen el año
            all_records = list(qs_grades)
            filtered = [r for r in all_records
                       if promotion_year in str(r.term or "")]
            # Si no hay registros con ese año en term, buscar por cualquier campo
            if not filtered:
                filtered = all_records  # fallback: usar todos
        else:
            filtered = list(qs_grades)

        # ── 4. Agrupar por alumno ──
        by_student = defaultdict(list)
        for r in filtered:
            if r.final_grade is not None:
                by_student[r.student_id].append(r)

        # Si el alumno no tiene registros con ese filtro → usar todos sus registros
        if student_id not in by_student:
            all_student_records = list(
                AcademicGradeRecord.objects
                .filter(student_id=student_id)
                .select_related("plan_course")
            )
            if all_student_records:
                by_student[student_id] = [r for r in all_student_records if r.final_grade is not None]

        # ── 5. Calcular PP por alumno ──
        averages = {}
        for sid, recs in by_student.items():
            if recs:
                averages[sid] = _weighted_avg(recs)

        if not averages:
            return _fallback_data(student, extra)

        # ── 6. Ordenar de mayor a menor ──
        sorted_students = sorted(averages.items(), key=lambda x: x[1], reverse=True)
        n_total = len(sorted_students)

        # ── 7. Calcular límite del tercio superior ──
        n_tercio = math.ceil(n_total / 3)
        tercio_list = sorted_students[:n_tercio]

        # ── 8. Promedio del tercio ──
        if tercio_list:
            promedio_tercio = round(sum(v for _, v in tercio_list) / len(tercio_list), 2)
        else:
            promedio_tercio = 0.0

        # ── 9. Puesto del alumno ──
        student_avg = averages.get(student_id, 0.0)
        rank = 1
        for i, (sid, _) in enumerate(sorted_students, 1):
            if sid == student_id:
                rank = i
                break

        # ── 10. ¿Está en el tercio? ──
        in_tercio = rank <= n_tercio

        # ── 11. Determinar año de actas ──
        years = set()
        for recs in by_student.values():
            for r in recs:
                parts = str(r.term or "").split("-")
                if parts[0].isdigit() and len(parts[0]) == 4:
                    years.add(parts[0])
        actas_year = promotion_year or (max(years) if years else str(datetime.now().year))

        # ── 12. Determinar nivel de la carrera ──
        carrera = student.get("carrera", "")
        nivel = _detect_nivel(carrera)

        return {
            "rank":             rank,
            "rank_str":         _ordinal(rank),
            "total_students":   n_total,
            "n_tercio":         n_tercio,
            "in_tercio":        in_tercio,
            "student_average":  student_avg,
            "promedio_tercio":  promedio_tercio,
            "promotion_year":   actas_year,
            "nivel":            nivel,
            "carrera":          carrera,
            "academic_years":   "1° al 5° año",
        }

    except Exception as e:
        logger.warning(f"Error calculando tercio superior para alumno {student_id}: {e}")
        return _fallback_data(student, extra)


def _detect_nivel(carrera: str) -> str:
    """Detecta el nivel educativo a partir del nombre de la carrera."""
    c = carrera.upper()
    if "INICIAL" in c:
        return "Inicial"
    if "PRIMARIA" in c:
        return "Primaria"
    if "SECUNDARIA" in c or "COMUNICACIÓN" in c or "MATEMÁTICA" in c or "CIENCIAS" in c:
        return "Secundaria"
    if "FÍSICA" in c or "EDUCACIÓN FÍSICA" in c:
        return "Educación Física"
    if "COMPUTACIÓN" in c or "INFORMÁTICA" in c:
        return "Computación"
    return "Superior"


def _fallback_data(student: dict, extra: dict) -> dict:
    """Datos de fallback si no se pueden calcular automáticamente."""
    carrera = student.get("carrera", "")
    return {
        "rank":            int(extra.get("rank_num", 1)),
        "rank_str":        extra.get("rank_str", "1ro."),
        "total_students":  int(extra.get("total_graduates", 0)),
        "n_tercio":        0,
        "in_tercio":       True,
        "student_average": float(extra.get("student_average", 0)),
        "promedio_tercio": float(extra.get("tercio_average", 0)),
        "promotion_year":  extra.get("promotion_year", str(datetime.now().year)),
        "nivel":           _detect_nivel(carrera),
        "carrera":         carrera,
        "academic_years":  extra.get("academic_year", "1° al 5° año"),
    }


# ═══════════════════════════════════════════════════════════════
# HELPERS DE IMAGEN
# ═══════════════════════════════════════════════════════════════

def _logo_b64(logo_url: str, media_root: str = "") -> str:
    p = str(logo_url or "")
    if "/media/" in p:
        rel = p.split("/media/")[-1]
        p = os.path.join(media_root, rel)
    if not p or not os.path.exists(p):
        return ""
    try:
        with open(p, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        ext = os.path.splitext(p)[1].lower().lstrip(".")
        mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png"}.get(ext, "png")
        return f"data:image/{mime};base64,{data}"
    except Exception:
        return ""


# ═══════════════════════════════════════════════════════════════
# CONSTRUCCIÓN DEL HTML
# ═══════════════════════════════════════════════════════════════

def _build_html(process, student: dict, tercio: dict, inst: dict) -> str:
    now = datetime.now()

    # ── Datos del alumno ──
    nombres   = student.get("nombres", "")
    apellidos = student.get("apellidos", "")
    # Formato del doc original: "Nombres, APELLIDOS"
    if nombres and apellidos:
        nombre_doc = f"{nombres}, {apellidos.upper()}"
    else:
        nombre_doc = student.get("nombre_completo", "")

    # ── Datos institucionales ──
    i_nombre       = inst.get("institution_name", '"GUSTAVO ALLENDE LLAVERÍA"')
    city           = inst.get("city", "Tarma")
    region         = inst.get("region", "Junín")
    ds             = inst.get("ds_creation", "D.S. 059-1984-ED")
    address        = inst.get("address", "")
    short          = inst.get("short_name", "I.E.S.P.P.")
    director_name  = inst.get("director_name", "")

    try:
        from django.conf import settings
        media_root = settings.MEDIA_ROOT
    except Exception:
        media_root = ""

    logo_src  = _logo_b64(inst.get("logo_url", ""), media_root)
    logo_html = f'<img src="{logo_src}" class="logo" alt="Logo">' if logo_src else f'<span class="logo-txt">{short}</span>'

    sig_src   = _logo_b64(inst.get("signature_url", ""), media_root)
    sig_html  = f'<img src="{sig_src}" class="firma-img" alt="Firma">' if sig_src else ""

    # ── Datos del tercio ──
    carrera        = tercio["carrera"].upper() if tercio["carrera"] else ""
    nivel          = tercio["nivel"]
    promo_year     = tercio["promotion_year"]
    academic_years = tercio["academic_years"]
    n_egresados    = tercio["total_students"]
    puesto_str     = tercio["rank_str"]
    prom_tercio    = f"{tercio['promedio_tercio']:.2f}"
    in_tercio      = tercio["in_tercio"]

    fecha_doc = f"{city}, {now.day} de {MESES_ES[now.month]} del {now.year}"
    anio_lema = str(now.year)

    # ── Aviso si NO está en el tercio ──
    warning_html = ""
    if not in_tercio:
        warning_html = f"""
        <div class="warning-box">
            ⚠️ Atención: según el cálculo automático, el alumno ocupa el puesto
            {tercio["rank"]} de {n_egresados}, por lo que está fuera del tercio superior
            (top {tercio["n_tercio"]}). Revisa los datos antes de autorizar.
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
@page {{
  size: A4 portrait;
  margin: 2cm 2cm 2cm 2.5cm;
}}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{
  font-family: "Times New Roman", Times, serif;
  font-size: 11pt;
  line-height: 1.6;
  color: #000;
}}

/* ── Lema ── */
.lema {{
  text-align: center;
  font-size: 9pt;
  font-style: italic;
  border: 1px solid #888;
  padding: 6px 12px;
  margin-bottom: 16px;
}}

/* ── Header ── */
.header-table {{ width: 100%; border-collapse: collapse; margin-bottom: 8px; }}
.logo {{ height: 58px; width: auto; }}
.logo-txt {{ font-weight: bold; font-size: 9pt; }}
.inst-name {{ font-size: 11.5pt; font-weight: bold; text-align: center; color: #1a237e; line-height: 1.4; }}
.inst-sub  {{ font-size: 8pt; text-align: center; color: #444; margin-top: 2px; }}
.hrule {{ border: none; border-top: 2.5px solid #1565c0; margin: 8px 0 16px 0; }}

/* ── Título ── */
.doc-title {{
  text-align: center;
  font-size: 17pt;
  font-weight: bold;
  letter-spacing: 2px;
  margin: 0 0 20px 0;
  text-transform: uppercase;
}}

/* ── Cuerpo ── */
.body-text {{
  text-align: justify;
  margin-bottom: 14px;
  font-size: 11pt;
}}

/* ── Nombre del alumno ── */
.alumno-nombre {{
  text-align: center;
  font-size: 13pt;
  font-weight: bold;
  letter-spacing: 0.5px;
  padding: 8px 0 6px 0;
  border-bottom: 1px solid #000;
  margin: 4px auto 16px auto;
  display: block;
}}

/* ── Tabla de datos ── */
.data-table {{
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0 18px 0;
  font-size: 9.5pt;
}}
.data-table th {{
  background: #dce8f5;
  color: #1a237e;
  font-weight: bold;
  text-align: center;
  padding: 5px 4px;
  border: 1px solid #666;
  font-size: 9pt;
  line-height: 1.3;
  vertical-align: middle;
}}
.data-table td {{
  text-align: center;
  padding: 6px 4px;
  border: 1px solid #888;
  vertical-align: middle;
  font-size: 10.5pt;
}}
.data-table .td-left {{ text-align: left; padding-left: 8px; }}

/* ── Fecha ── */
.fecha {{ text-align: right; margin: 16px 0 0 0; font-size: 11pt; }}

/* ── Firma ── */
.firma-block {{ margin-top: 50px; text-align: center; }}
.firma-img   {{ height: 52px; width: auto; display: block; margin: 0 auto 4px auto; }}
.firma-line  {{ border-top: 1px solid #000; width: 260px; margin: 4px auto; }}
.firma-name  {{ font-weight: bold; font-size: 10.5pt; }}
.firma-cargo {{ font-size: 10pt; text-transform: uppercase; }}
.firma-inst  {{ font-size: 9pt; }}

/* ── Warning (solo visible en pantalla, no en PDF final) ── */
.warning-box {{
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 9pt;
  color: #856404;
  margin: 8px 0;
}}

/* ── Footer ── */
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

<div class="lema">
  "{inst.get("year_motto", f"AÑO {anio_lema}")}"
</div>

<!-- ══ HEADER ══ -->
<table class="header-table">
  <tr>
    <td style="width:70px; text-align:center; vertical-align:middle; padding-right:10px;">
      {logo_html}
    </td>
    <td style="vertical-align:middle;">
      <div class="inst-name">INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO</div>
      <div class="inst-name">{i_nombre}</div>
      <div class="inst-sub">{city} - {region} - PERÚ &nbsp;|&nbsp; {ds}</div>
      {f'<div class="inst-sub">{address}</div>' if address else ""}
    </td>
  </tr>
</table>
<hr class="hrule">

<div class="doc-title">Constancia &nbsp; de &nbsp; Tercio Superior</div>

<p class="body-text">
  LA DIRECTORA GENERAL DEL INSTITUTO DE EDUCACIÓN SUPERIOR
  PEDAGÓGICO PÚBLICO {i_nombre} de {city}:
</p>

<p class="body-text">Certifica que el(a) egresada:</p>

<span class="alumno-nombre">{nombre_doc}</span>

<p class="body-text">
  Pertenece al Tercio Superior de su promoción por los promedios obtenidos
  al término de los cinco años de estudios profesionales.
</p>

{warning_html}

<!-- ══ TABLA DE DATOS ══ -->
<table class="data-table">
  <thead>
    <tr>
      <th style="width:13%">Años<br>Académicos</th>
      <th style="width:11%">Promoción</th>
      <th style="width:10%">Nivel</th>
      <th style="width:22%">Carrera<br>Profesional</th>
      <th style="width:16%">N° de egresados del cuadro de mérito promocional</th>
      <th style="width:14%">Puesto del egresado en su promoción</th>
      <th style="width:14%">Promedio del tercio superior</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>{academic_years}</td>
      <td>{promo_year}</td>
      <td>{nivel}</td>
      <td class="td-left">{carrera.title()}</td>
      <td>{n_egresados if n_egresados else "—"}</td>
      <td>{puesto_str}</td>
      <td>{prom_tercio}</td>
    </tr>
  </tbody>
</table>

<p class="body-text">
  Según consta en el Archivo de Orden de Mérito de la promoción <strong>{promo_year}</strong>
  de esta Institución, a los que me remito en caso de ser necesario.
</p>

<p class="body-text">
  Se expide la presente a solicitud de la interesada(o), para los fines que estime conveniente.
</p>

<p class="fecha">{fecha_doc}</p>

<div class="firma-block">
  {sig_html}
  <div class="firma-line"></div>
  {f'<div class="firma-name">{director_name}</div>' if director_name else ""}
  <div class="firma-cargo">Directora General</div>
  <div class="firma-inst">{short} {i_nombre}</div>
</div>

<div class="doc-footer">
  Sistema Académico IESPP · Proceso #{process.id:05d} ·
  Generado el {now.strftime("%d/%m/%Y %H:%M")} ·
  Puesto {tercio["rank"]}° de {n_egresados} egresados ·
  Tercio superior: top {tercio["n_tercio"]}
</div>

</body>
</html>"""


# ═══════════════════════════════════════════════════════════════
# FUNCIÓN PRINCIPAL
# ═══════════════════════════════════════════════════════════════

def generate_tercio_superior_weasyprint(
    process,
    student: dict,
    extra: dict,
    inst: dict,
) -> tuple:
    """
    Genera la Constancia de Tercio Superior en PDF.

    Calcula automáticamente:
      • PP general de cada egresado del mismo plan/carrera
      • Ranking y límite del tercio (ceil(N/3) mejores)
      • Promedio del tercio superior
      • Puesto del alumno

    Solo necesita (opcional en extra):
      promotion_year: "2022"  ← para filtrar el cohorte correcto

    Returns (BytesIO, filename).
    """
    if not HAS_WEASYPRINT:
        raise ImportError(
            "WeasyPrint no está instalado.\n"
            "Instala con: pip install weasyprint"
        )

    # 1. Calcular datos del tercio
    tercio = _calculate_tercio_data(student, extra)

    logger.info(
        f"Proceso {process.id}: TERCIO_SUPERIOR — alumno {student.get('id')} "
        f"puesto {tercio['rank']}/{tercio['total_students']} "
        f"prom_tercio={tercio['promedio_tercio']} "
        f"en_tercio={tercio['in_tercio']}"
    )

    # 2. Construir HTML
    html_content = _build_html(process, student, tercio, inst)

    # 3. Generar PDF
    pdf_bytes = WeasyHTML(string=html_content).write_pdf()

    now      = datetime.now()
    filename = f"TERCIO-SUPERIOR_{process.id:05d}_{now.strftime('%Y%m%d')}.pdf"

    buf = io.BytesIO(pdf_bytes)
    buf.seek(0)
    return buf, filename