"""
orden_merito_generator.py
═══════════════════════════════════════════════════════════════
Constancia de Orden de Mérito — IESPP "Gustavo Allende Llavería"

El sistema calcula AUTOMÁTICAMENTE:
  • Promedio Ponderado por semestre del alumno
    PP = Σ(nota_final × créditos_curso) / Σ(créditos_curso)
  • Promedio Ponderado general (toda la carrera)
  • Ranking del alumno entre todos sus compañeros de la misma
    carrera/plan que tengan notas en los mismos períodos

DOS VARIANTES (según extra_data["merit_type"]):
  "CARRERA" → tabla I al X con todos los promedios por semestre
  "SEMESTRE" → un único semestre (el más reciente o el del período dado)

Fuentes de datos:
  AcademicGradeRecord → final_grade, term, credits (o vía PlanCourse)
  Student → plan → career
"""

import io
import logging
import os
import base64
from datetime import datetime
from collections import defaultdict, OrderedDict

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

ORDINALS = {
    1: "PRIMER",  2: "SEGUNDO", 3: "TERCER",  4: "CUARTO",
    5: "QUINTO",  6: "SEXTO",   7: "SÉPTIMO", 8: "OCTAVO",
    9: "NOVENO", 10: "DÉCIMO",
}

ROMAN = {
    1: "I", 2: "II", 3: "III", 4: "IV", 5: "V",
    6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X",
}


# ═══════════════════════════════════════════════════════════════
# CÁLCULO DE PROMEDIOS PONDERADOS
# ═══════════════════════════════════════════════════════════════

def _get_weighted_average_by_term(student_id: int) -> OrderedDict:
    """
    Calcula el promedio ponderado por term/semestre del alumno.

    Lógica:
      - Busca AcademicGradeRecord del alumno
      - Agrupa por term
      - Si el record tiene 'credits' → usa PP = Σ(nota×cred)/Σ(cred)
      - Si no tiene credits → promedio simple

    Retorna OrderedDict { term_str: promedio_float } ordenado por term.
    """
    result = OrderedDict()

    try:
        from academic.models import AcademicGradeRecord
    except ImportError:
        logger.warning("AcademicGradeRecord no disponible")
        return result

    try:
        records = list(
            AcademicGradeRecord.objects
            .filter(student_id=student_id)
            .select_related("plan_course", "plan_course__course")
            .order_by("term")
        )

        # Agrupar por term
        by_term = defaultdict(list)
        for r in records:
            if r.final_grade is not None:
                by_term[str(r.term or "")].append(r)

        for term in sorted(by_term.keys()):
            recs = by_term[term]
            total_weighted = 0.0
            total_credits  = 0.0
            use_weighted   = False

            for r in recs:
                grade = float(r.final_grade or 0)
                # Intentar obtener créditos (plan_course → credits)
                credits = 0
                try:
                    if hasattr(r, "plan_course") and r.plan_course:
                        credits = float(r.plan_course.credits or 0)
                    elif hasattr(r, "credits") and r.credits:
                        credits = float(r.credits or 0)
                except Exception:
                    pass

                if credits > 0:
                    total_weighted += grade * credits
                    total_credits  += credits
                    use_weighted    = True
                else:
                    total_weighted += grade
                    total_credits  += 1

            if total_credits > 0:
                prom = round(total_weighted / total_credits, 2)
                result[term] = prom

    except Exception as e:
        logger.warning(f"Error calculando promedios alumno {student_id}: {e}")

    return result


def _get_career_ranking(student_id: int, career_id: int = None, plan_id: int = None,
                        terms: list = None) -> dict:
    """
    Calcula el ranking del alumno entre todos los alumnos de su carrera.

    Parámetros:
      student_id : alumno objetivo
      career_id  : filtra por carrera (plan → career)
      plan_id    : filtra por plan específico
      terms      : lista de terms a considerar para el promedio general
                   Si None → usa todos los terms disponibles

    Retorna dict:
      {
        "rank":             1,          ← puesto del alumno (1 = primero)
        "total_students":  25,          ← total alumnos en el ranking
        "student_average": 16.93,       ← promedio general del alumno
        "all_students":    [            ← lista ordenada de todos
          {"student_id": X, "average": Y}, ...
        ]
      }
    """
    try:
        from students.models import Student
        from academic.models import AcademicGradeRecord
    except ImportError:
        return {"rank": 1, "total_students": 1, "student_average": 0.0, "all_students": []}

    try:
        # 1. Obtener todos los alumnos de la misma carrera/plan
        qs = Student.objects.all()
        if plan_id:
            qs = qs.filter(plan_id=plan_id)
        elif career_id:
            qs = qs.filter(plan__career_id=career_id)

        student_ids = list(qs.values_list("id", flat=True))

        if not student_ids:
            return {"rank": 1, "total_students": 1, "student_average": 0.0, "all_students": []}

        # 2. Obtener todos los registros de calificaciones de esos alumnos
        qs_grades = AcademicGradeRecord.objects.filter(
            student_id__in=student_ids,
        ).select_related("plan_course")

        if terms:
            qs_grades = qs_grades.filter(term__in=terms)

        # 3. Calcular promedio ponderado general por alumno
        averages = {}
        by_student = defaultdict(list)
        for r in qs_grades:
            if r.final_grade is not None:
                by_student[r.student_id].append(r)

        for sid, recs in by_student.items():
            tw = 0.0
            tc = 0.0
            for r in recs:
                grade = float(r.final_grade or 0)
                credits = 0
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
                    tc += 1

            if tc > 0:
                averages[sid] = round(tw / tc, 2)

        # 4. Ordenar de mayor a menor
        sorted_students = sorted(averages.items(), key=lambda x: x[1], reverse=True)

        # 5. Encontrar el puesto del alumno objetivo
        rank = 1
        student_avg = averages.get(student_id, 0.0)
        for i, (sid, avg) in enumerate(sorted_students, 1):
            if sid == student_id:
                rank = i
                break

        return {
            "rank":            rank,
            "total_students":  len(sorted_students),
            "student_average": student_avg,
            "all_students": [
                {"student_id": sid, "average": avg}
                for sid, avg in sorted_students
            ],
        }

    except Exception as e:
        logger.warning(f"Error calculando ranking: {e}")
        return {"rank": 1, "total_students": 1, "student_average": 0.0, "all_students": []}


def _calculate_merit_data(student: dict, extra: dict) -> dict:
    """
    Función principal de cálculo. Retorna todo lo necesario para el documento.

    extra puede contener:
      merit_type: "CARRERA" | "SEMESTRE"  (default: "CARRERA")
      target_term: "2025-I" (solo para SEMESTRE)
      promotion_year: "2023" (para mostrar en el doc)
    """
    student_id = student.get("id")
    career_id  = student.get("carrera_id")
    plan_id    = student.get("plan_id")
    merit_type = extra.get("merit_type", "CARRERA").upper()

    # ── Promedios por semestre del alumno ──
    averages_by_term = _get_weighted_average_by_term(student_id)

    if merit_type == "SEMESTRE":
        # Tomar solo el term objetivo (o el más reciente)
        target_term = extra.get("target_term", "")
        if target_term and target_term in averages_by_term:
            terms_to_use = [target_term]
        elif averages_by_term:
            terms_to_use = [list(averages_by_term.keys())[-1]]  # el más reciente
        else:
            terms_to_use = []

        filtered = OrderedDict()
        for t in terms_to_use:
            if t in averages_by_term:
                filtered[t] = averages_by_term[t]
        averages_by_term = filtered
    else:
        terms_to_use = list(averages_by_term.keys())

    # ── Ranking ──
    ranking = _get_career_ranking(
        student_id=student_id,
        career_id=career_id,
        plan_id=plan_id,
        terms=terms_to_use if merit_type == "SEMESTRE" else None,
    )

    # ── Rango de semestres ──
    terms_list = list(averages_by_term.keys())
    if terms_list:
        semester_range = f"I al {ROMAN.get(len(terms_list), str(len(terms_list)))}"
    else:
        semester_range = extra.get("semester_range", "I al X")

    # ── Promedio general ──
    if averages_by_term:
        gen_avg = round(sum(averages_by_term.values()) / len(averages_by_term), 2)
    else:
        gen_avg = ranking.get("student_average", 0.0)

    # ── Año de actas (primer y último year de los terms) ──
    years = []
    for t in terms_list:
        parts = str(t).split("-")
        if parts[0].isdigit():
            years.append(parts[0])
    if years:
        actas_years = f"{min(years)} al {max(years)}" if min(years) != max(years) else min(years)
    else:
        actas_years = extra.get("academic_year", "")

    promotion_year = extra.get("promotion_year", max(years) if years else "")

    return {
        "merit_type":      merit_type,
        "averages":        averages_by_term,       # OrderedDict {term: avg}
        "rank":            ranking["rank"],
        "rank_ordinal":    ORDINALS.get(ranking["rank"], f"{ranking['rank']}°"),
        "total_students":  ranking["total_students"],
        "general_average": gen_avg,
        "semester_range":  semester_range,
        "actas_years":     actas_years,
        "promotion_year":  promotion_year,
        "terms_list":      terms_list,
        "target_term":     terms_list[-1] if terms_list else "",
    }


# ═══════════════════════════════════════════════════════════════
# CONSTRUCCIÓN DEL HTML
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


def _build_html_carrera(process, student, merit, inst) -> str:
    """
    Variante 1: tabla completa I al X
    Fiel a la primera página del doc original.
    """
    now    = datetime.now()
    nombres   = student.get("nombres", "")
    apellidos = student.get("apellidos", "")
    nombre_doc = f"{apellidos.upper()}, {nombres}" if apellidos else student.get("nombre_completo", "")
    dni    = student.get("dni", "")
    carrera = student.get("carrera", "").upper()

    i_nombre = inst.get("institution_name", '"GUSTAVO ALLENDE LLAVERÍA"')
    city     = inst.get("city", "Tarma")
    ds       = inst.get("ds_creation", "D.S. 059-1984-ED")
    address  = inst.get("address", "")
    email    = inst.get("email", "")
    secretary_name = inst.get("secretary_name", "")
    short    = inst.get("short_name", "I.E.S.P.P.")

    try:
        from django.conf import settings
        media_root = settings.MEDIA_ROOT
    except Exception:
        media_root = ""

    logo_src = _logo_b64(inst.get("logo_url", ""), media_root)
    logo_html = f'<img src="{logo_src}" class="logo" alt="Logo">' if logo_src else f'<span class="logo-txt">{short}</span>'

    sec_sig_src = _logo_b64(inst.get("secretary_signature_url", ""), media_root)
    sig_html = f'<img src="{sec_sig_src}" class="firma-img" alt="Firma">' if sec_sig_src else ""

    # ── Tabla de promedios: 2 columnas lado a lado ──
    averages = merit["averages"]
    items    = list(averages.items())
    mid      = (len(items) + 1) // 2
    left     = items[:mid]
    right    = items[mid:]

    table_rows = ""
    for i in range(max(len(left), len(right))):
        l_t = left[i][0]  if i < len(left)  else ""
        l_v = f"{left[i][1]:.2f}"  if i < len(left)  else ""
        r_t = right[i][0] if i < len(right) else ""
        r_v = f"{right[i][1]:.2f}" if i < len(right) else ""
        table_rows += f"""
        <tr>
          <td class="sem-col">{l_t}</td>
          <td class="avg-col">{l_v}</td>
          <td class="gap-col"></td>
          <td class="sem-col">{r_t}</td>
          <td class="avg-col">{r_v}</td>
        </tr>"""

    actas   = merit["actas_years"]
    sem_range = merit["semester_range"]
    rank_ord  = merit["rank_ordinal"]
    fecha_doc = f"{city}, {now.day} de {MESES_ES[now.month]} del {now.year}"
    anio_lema = str(now.year)

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
  line-height: 1.5;
  color: #000;
}}

/* ── Lema ── */
.lema {{
  text-align: center;
  font-size: 9pt;
  font-style: italic;
  border: 1px solid #888;
  padding: 5px 10px;
  margin-bottom: 18px;
  color: #222;
}}

/* ── Header institucional ── */
.header-table {{
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
}}
.logo {{ height: 55px; width: auto; }}
.logo-txt {{ font-weight: bold; font-size: 9pt; }}
.inst-name {{ font-size: 11pt; font-weight: bold; text-align: center; line-height: 1.4; color: #1a237e; }}
.inst-sub  {{ font-size: 8pt; text-align: center; color: #444; }}

/* ── Línea divisora ── */
.hrule {{
  border: none;
  border-top: 2px solid #1565c0;
  margin: 8px 0 14px 0;
}}

/* ── Título documento ── */
.doc-title {{
  text-align: center;
  font-size: 16pt;
  font-weight: bold;
  letter-spacing: 1px;
  margin: 10px 0 18px 0;
  text-transform: uppercase;
}}

/* ── Cuerpo ── */
.body-text {{
  text-align: justify;
  margin-bottom: 12px;
  font-size: 11pt;
}}
.center-bold {{
  text-align: center;
  font-weight: bold;
  font-size: 12pt;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}}

/* ── Tabla de promedios ── */
.avg-table {{
  margin: 0 auto 14px auto;
  border-collapse: collapse;
  font-size: 10.5pt;
}}
.avg-table thead th {{
  background: #dce8f5;
  font-weight: bold;
  text-align: center;
  padding: 4px 16px;
  border: 1px solid #999;
}}
.avg-table td {{
  padding: 3px 16px;
  border: 1px solid #bbb;
  text-align: center;
}}
.avg-table .gap-col {{
  border: none;
  width: 20px;
  background: white;
}}
.sem-col {{ min-width: 80px; }}
.avg-col {{ min-width: 90px; }}

/* ── Fecha ── */
.fecha {{ text-align: right; margin: 14px 0; font-size: 11pt; }}

/* ── Firma ── */
.firma-block {{
  margin-top: 40px;
  text-align: center;
}}
.firma-img  {{ height: 50px; width: auto; display: block; margin: 0 auto 4px auto; }}
.firma-line {{ border-top: 1px solid #000; width: 240px; margin: 4px auto; }}
.firma-name {{ font-weight: bold; font-size: 10pt; }}
.firma-cargo {{ font-size: 10pt; text-transform: uppercase; }}
.firma-inst  {{ font-size: 9pt; }}

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

<!-- HEADER -->
<table class="header-table">
  <tr>
    <td style="width:70px; text-align:center; vertical-align:middle;">
      {logo_html}
    </td>
    <td style="vertical-align:middle;">
      <div class="inst-name">INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO</div>
      <div class="inst-name">{i_nombre}</div>
      <div class="inst-sub">{city} - {inst.get("region","Junín")} - PERÚ &nbsp;|&nbsp; {ds}</div>
      {f'<div class="inst-sub">{address}</div>' if address else ""}
    </td>
  </tr>
</table>
<hr class="hrule">

<div class="doc-title">Constancia &nbsp; de &nbsp; Orden de Mérito</div>

<p class="body-text">
  QUIEN SUSCRIBE LA SECRETARIA ACADÉMICA DEL INSTITUTO DE EDUCACIÓN SUPERIOR
  PEDAGÓGICO PÚBLICO {i_nombre} de {city}:
</p>

<p class="center-bold">HACE &nbsp; CONSTAR</p>

<p class="body-text">
  Que, <strong>{nombre_doc}</strong> identificada(o) con D.N.I N° <strong>{dni}</strong>,
  ha ocupado el <strong>{rank_ord} LUGAR</strong> en el orden de mérito de la especialidad de
  <strong>{carrera}</strong> durante sus estudios de Educación Superior del
  <strong>{sem_range}</strong> Semestre Académico obteniendo los siguientes Promedios Ponderado:
</p>

<!-- TABLA PROMEDIOS -->
<table class="avg-table">
  <thead>
    <tr>
      <th>Semestre</th>
      <th>Prom. Pond.</th>
      <th class="gap-col"></th>
      <th>Semestre</th>
      <th>Prom. Pond.</th>
    </tr>
  </thead>
  <tbody>
    {table_rows}
  </tbody>
</table>

<p class="body-text">
  Según consta en las Actas Consolidadas de Evaluación{f" del año {actas}" if actas else ""} de esta Institución,
  a los que me remito en caso de ser necesario.
</p>

<p class="body-text">
  Se expide la presente a solicitud de la interesada(o), para los fines que estime conveniente.
</p>

<p class="fecha">{fecha_doc}</p>

<div class="firma-block">
  {sig_html}
  <div class="firma-line"></div>
  {f'<div class="firma-name">{secretary_name}</div>' if secretary_name else ""}
  <div class="firma-cargo">Secretaria(o) Académica(o)</div>
  <div class="firma-inst">{short} {i_nombre}</div>
</div>

<div class="doc-footer">
  Sistema Académico IESPP · Proceso #{process.id:05d} ·
  Generado el {now.strftime("%d/%m/%Y %H:%M")} ·
  Puesto {merit["rank"]}° de {merit["total_students"]} estudiantes
</div>

</body>
</html>"""


def _build_html_semestre(process, student, merit, inst) -> str:
    """
    Variante 2: un único semestre (ej: X Semestre — promoción 2023)
    Fiel a la segunda página del doc original.
    """
    now     = datetime.now()
    nombres   = student.get("nombres", "")
    apellidos = student.get("apellidos", "")
    nombre_doc = f"{apellidos.upper()}, {nombres}" if apellidos else student.get("nombre_completo", "")
    codigo  = student.get("codigo", "") or student.get("dni", "")
    carrera = student.get("carrera", "").upper()

    i_nombre = inst.get("institution_name", '"GUSTAVO ALLENDE LLAVERÍA"')
    city     = inst.get("city", "Tarma")
    ds       = inst.get("ds_creation", "D.S. 059-1984-ED")
    address  = inst.get("address", "")
    secretary_name = inst.get("secretary_name", "")
    short    = inst.get("short_name", "I.E.S.P.P.")

    try:
        from django.conf import settings
        media_root = settings.MEDIA_ROOT
    except Exception:
        media_root = ""

    logo_src    = _logo_b64(inst.get("logo_url", ""), media_root)
    logo_html   = f'<img src="{logo_src}" class="logo" alt="Logo">' if logo_src else f'<span class="logo-txt">{short}</span>'
    sec_sig_src = _logo_b64(inst.get("secretary_signature_url", ""), media_root)
    sig_html    = f'<img src="{sec_sig_src}" class="firma-img" alt="Firma">' if sec_sig_src else ""

    # Semestre y promedio del período objetivo
    items      = list(merit["averages"].items())
    sem_num    = len(merit["terms_list"]) if merit["terms_list"] else 10
    sem_roman  = ROMAN.get(sem_num, str(sem_num))
    prom_sem   = f"{items[-1][1]:.2f}" if items else "—"
    promo_year = merit["promotion_year"]
    rank_ord   = merit["rank_ordinal"]
    fecha_doc  = f"{city}, {now.day} de {MESES_ES[now.month]} del {now.year}"
    anio_lema  = str(now.year)

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
  line-height: 1.5;
  color: #000;
}}
.lema {{
  text-align: center;
  font-size: 9pt;
  font-style: italic;
  border: 1px solid #888;
  padding: 5px 10px;
  margin-bottom: 18px;
}}
.header-table {{ width: 100%; border-collapse: collapse; margin-bottom: 10px; }}
.logo {{ height: 55px; width: auto; }}
.logo-txt {{ font-weight: bold; font-size: 9pt; }}
.inst-name {{ font-size: 11pt; font-weight: bold; text-align: center; color: #1a237e; line-height: 1.4; }}
.inst-sub  {{ font-size: 8pt; text-align: center; color: #444; }}
.hrule {{ border: none; border-top: 2px solid #1565c0; margin: 8px 0 14px 0; }}
.doc-title {{ text-align: center; font-size: 16pt; font-weight: bold; margin: 10px 0 20px 0; text-transform: uppercase; }}
.alumno-nombre {{
  text-align: center;
  font-size: 14pt;
  font-weight: bold;
  border-bottom: 1px solid #000;
  padding-bottom: 2px;
  margin: 20px auto 20px auto;
  display: block;
}}
.body-text {{ text-align: justify; margin-bottom: 14px; font-size: 11pt; }}
.fecha {{ text-align: right; margin: 14px 0; }}
.firma-block {{ margin-top: 40px; text-align: center; }}
.firma-img  {{ height: 50px; width: auto; display: block; margin: 0 auto 4px auto; }}
.firma-line {{ border-top: 1px solid #000; width: 240px; margin: 4px auto; }}
.firma-name  {{ font-weight: bold; font-size: 10pt; }}
.firma-cargo {{ font-size: 10pt; text-transform: uppercase; }}
.firma-inst  {{ font-size: 9pt; }}
.doc-footer  {{ margin-top: 20px; text-align: center; font-size: 7pt; color: #aaa; border-top: 1px solid #eee; padding-top: 4px; }}
</style>
</head>
<body>

<div class="lema">
  "{inst.get("year_motto", f"AÑO {anio_lema}")}"
</div>

<table class="header-table">
  <tr>
    <td style="width:70px; text-align:center; vertical-align:middle;">
      {logo_html}
    </td>
    <td style="vertical-align:middle;">
      <div class="inst-name">INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO</div>
      <div class="inst-name">{i_nombre}</div>
      <div class="inst-sub">{city} - {inst.get("region","Junín")} - PERÚ &nbsp;|&nbsp; {ds}</div>
      {f'<div class="inst-sub">{address}</div>' if address else ""}
    </td>
  </tr>
</table>
<hr class="hrule">

<div class="doc-title">Constancia &nbsp; de &nbsp; Orden de Mérito</div>

<p class="body-text">
  QUIEN SUSCRIBE EL SECRETARIO ACADÉMICO DEL INSTITUTO DE EDUCACIÓN SUPERIOR
  PEDAGÓGICO PÚBLICO {i_nombre} - {city.upper()} HACE CONSTAR QUE:
</p>

<div class="alumno-nombre">{nombre_doc}</div>

<p class="body-text">
  Identificada(o) con código de matrícula N° <strong>{codigo}</strong> del Programa de Estudios de
  <strong>{carrera}</strong>, quien ha ocupado el <strong>{rank_ord} LUGAR</strong> en el
  <strong>{sem_roman} Semestre Académico</strong> obteniendo un Promedio Ponderado semestral de
  <strong>{prom_sem}</strong>{f" en la promoción {promo_year}" if promo_year else ""}.
</p>

<p class="body-text">
  Se expide la presente a solicitud de la interesada(o), para los fines que estime conveniente.
</p>

<p class="fecha">{fecha_doc}</p>

<div class="firma-block">
  {sig_html}
  <div class="firma-line"></div>
  {f'<div class="firma-name">{secretary_name}</div>' if secretary_name else ""}
  <div class="firma-cargo">Secretario(a) Académico(a)</div>
  <div class="firma-inst">{short} {i_nombre}</div>
</div>

<div class="doc-footer">
  Sistema Académico IESPP · Proceso #{process.id:05d} ·
  Generado el {now.strftime("%d/%m/%Y %H:%M")} ·
  Puesto {merit["rank"]}° de {merit["total_students"]} estudiantes
</div>

</body>
</html>"""


# ═══════════════════════════════════════════════════════════════
# FUNCIÓN PRINCIPAL
# ═══════════════════════════════════════════════════════════════

def generate_orden_merito_weasyprint(
    process,
    student: dict,
    extra: dict,
    inst: dict,
) -> tuple:
    """
    Genera la Constancia de Orden de Mérito en PDF.

    Calcula automáticamente:
      • Promedio Ponderado por semestre (PP = Σ(nota×cred)/Σ(cred))
      • Promedio general de la carrera
      • Puesto del alumno entre todos los de su carrera/plan

    Variantes según extra["merit_type"]:
      "CARRERA"  → tabla con todos los semestres (I al X)
      "SEMESTRE" → un único semestre puntual

    Returns (BytesIO, filename).
    """
    if not HAS_WEASYPRINT:
        raise ImportError(
            "WeasyPrint no está instalado.\n"
            "Instala con: pip install weasyprint"
        )

    # 1. Calcular todos los datos
    merit = _calculate_merit_data(student, extra)

    logger.info(
        f"Proceso {process.id}: ORDEN_MERITO — alumno {student.get('id')} "
        f"puesto {merit['rank']}/{merit['total_students']} "
        f"prom.general={merit['general_average']} tipo={merit['merit_type']}"
    )

    # 2. Construir HTML según variante
    if merit["merit_type"] == "SEMESTRE":
        html_content = _build_html_semestre(process, student, merit, inst)
    else:
        html_content = _build_html_carrera(process, student, merit, inst)

    # 3. Generar PDF
    pdf_bytes = WeasyHTML(string=html_content).write_pdf()

    now      = datetime.now()
    filename = f"ORDEN-MERITO_{process.id:05d}_{now.strftime('%Y%m%d')}.pdf"

    buf = io.BytesIO(pdf_bytes)
    buf.seek(0)
    return buf, filename