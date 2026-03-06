"""
Helpers para generación de Kardex y Boletas
Separado por claridad y reutilización
"""
import os
import re
import unicodedata
from io import BytesIO
from django.conf import settings
from django.db.models import Q
from openpyxl import load_workbook
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

from students.models import Student as StudentProfile
from academic.models import (
    Plan, PlanCourse, Course,
    AcademicGradeRecord
)
from catalogs.models import Career
from catalogs.models import InstitutionSetting as CatalogInstitutionSetting

from .utils import (
    _norm_text, _norm_txt, _norm_term, _norm_key, _term_sort_key,
    _safe_float, _fmt_grade,
    _file_to_data_uri, _template_kardex_image_to_data_uri,
    _media_url_to_abs_path,
    SEM_LABELS, KARDEX_POS
)


# ══════════════════════════════════════════════════════════════
# FUNCIONES DE RESOLUCIÓN Y BÚSQUEDA
# ══════════════════════════════════════════════════════════════

def _student_lookup(student_id: str):
    """Busca estudiante por DNI o ID"""
    doc = str(student_id).strip()
    if doc.isdigit():
        return (
            StudentProfile.objects.filter(num_documento=doc).first()
            or StudentProfile.objects.filter(id=int(doc)).first()
        )
    return StudentProfile.objects.filter(num_documento=doc).first()


def _resolve_plan_for_student(student: StudentProfile):
    """Asigna un plan al estudiante si no tiene uno"""
    # ya tiene plan
    if getattr(student, "plan_id", None):
        return student.plan_id

    career_name = (getattr(student, "programa_carrera", "") or "").strip()
    if not career_name:
        return None

    # match de carrera robusto
    cn = _norm_txt(career_name)

    car = (
        Career.objects.filter(name__iexact=career_name).first()
        or Career.objects.filter(name__icontains=career_name).first()
    )

    # fallback por normalización (cuando hay tildes/espacios raros)
    if not car:
        for c in Career.objects.all().only("id", "name"):
            if _norm_txt(c.name) == cn:
                car = c
                break

    if not car:
        return None

    # ✅ elegir el plan "más real": más cursos + más reciente + no eliminado
    from django.db.models import Count
    plan = (
        Plan.objects
        .filter(career=car, is_deleted=False)
        .annotate(n_courses=Count("plan_courses"))
        .order_by("-n_courses", "-start_year", "-end_year", "-id")
        .first()
    )

    if not plan:
        return None

    student.plan_id = plan.id
    student.save(update_fields=["plan_id"])
    return plan.id


def _list_student_terms(student: StudentProfile):
    """Lista todos los períodos académicos del estudiante"""
    terms = (
        AcademicGradeRecord.objects
        .filter(student=student)
        .exclude(term__isnull=True)
        .exclude(term__exact="")
        .values_list("term", flat=True)
        .distinct()
    )
    cleaned = {_norm_term(x) for x in terms if str(x).strip()}
    return sorted(cleaned, key=_term_sort_key)


def _build_pc_name_cache(plan_id):
    """
    Construye cache de PlanCourse indexado por nombre normalizado.
    También indexa por display_name para mayor cobertura.
    Retorna dict: {nombre_normalizado: PlanCourse}
    """
    cache = {}
    if not plan_id:
        return cache
    for pc in PlanCourse.objects.select_related("course").filter(plan_id=plan_id):
        # indexar por display_name
        dn = _norm_text(getattr(pc, "display_name", "") or "")
        if dn and dn not in cache:
            cache[dn] = pc
        # indexar por course.name
        cn = _norm_text(getattr(pc.course, "name", "") or "")
        if cn and cn not in cache:
            cache[cn] = pc
    return cache


def _credits_for_student_course(student, course, _pc_name_cache=None):
    """
    Devuelve créditos en este orden de prioridad:
    1. PlanCourse de la malla del estudiante (por course_id)
    2. Fallback por display_code/course.code (normalizado)
    3. Fallback por nombre de curso normalizado
    4. Créditos globales del curso (último recurso)
    """
    course_id = getattr(course, "id", course)
    code_norm = (getattr(course, "code", "") or "").strip().upper()
    course_name = (getattr(course, "name", "") or "").strip()
    fallback_credits = int(getattr(course, "credits", 0) or 0)

    if not code_norm or fallback_credits == 0 or not course_name:
        try:
            row = Course.objects.filter(id=course_id).values_list("code", "credits", "name").first()
            if row:
                code_norm = code_norm or (row[0] or "").strip().upper()
                fallback_credits = fallback_credits or int(row[1] or 0)
                course_name = course_name or (row[2] or "").strip()
        except Exception:
            pass

    if not getattr(student, "plan_id", None):
        return max(0, fallback_credits)

    # PRIORIDAD 1: por course_id exacto
    try:
        pc = PlanCourse.objects.filter(plan_id=student.plan_id, course_id=course_id).first()
        if pc and int(pc.credits or 0) > 0:
            return int(pc.credits or 0)
    except Exception:
        pass

    # PRIORIDAD 2: por código
    if code_norm:
        try:
            pc = (
                PlanCourse.objects
                .select_related("course")
                .filter(plan_id=student.plan_id)
                .filter(Q(display_code__iexact=code_norm) | Q(course__code__iexact=code_norm))
                .first()
            )
            if pc and int(pc.credits or 0) > 0:
                return int(pc.credits or 0)
        except Exception:
            pass

    # PRIORIDAD 3: por nombre normalizado del curso
    if course_name:
        name_norm = _norm_text(course_name)
        if name_norm:
            # Usar cache si se proporcionó (evita N queries)
            if _pc_name_cache is not None:
                pc = _pc_name_cache.get(name_norm)
                if pc:
                    cr = int(pc.credits or 0)
                    if cr > 0:
                        return cr
            else:
                # Sin cache: buscar directamente (usado por boletas/reportes)
                try:
                    for pc in PlanCourse.objects.select_related("course").filter(plan_id=student.plan_id):
                        pc_name = _norm_text(
                            getattr(pc, "display_name", "") or
                            getattr(pc.course, "name", "") or ""
                        )
                        if pc_name and pc_name == name_norm:
                            cr = int(pc.credits or 0)
                            if cr > 0:
                                return cr
                except Exception:
                    pass

    return max(0, fallback_credits)


def _status_text_from_record(rec):
    """Obtiene el estado de un registro académico"""
    for k in ("status", "state", "estado", "observacion", "observation"):
        if hasattr(rec, k):
            v = (getattr(rec, k) or "").strip().upper()
            if v in ("LOGRADO", "EN PROCESO"):
                return v

    g = _safe_float(getattr(rec, "final_grade", None))
    if g is None:
        return "EN PROCESO"
    return "LOGRADO" if g >= 11 else "EN PROCESO"


# ══════════════════════════════════════════════════════════════
# FUNCIONES DE OBTENCIÓN DE LOGOS Y MEDIA
# ══════════════════════════════════════════════════════════════

def _get_institution_media_datauris(request=None):
    """
    Obtiene logos y firma desde catalogs.InstitutionSetting
    Retorna: (logo_data_uri, second_logo_data_uri, secretary_signature_data_uri)
    """
    inst = CatalogInstitutionSetting.objects.filter(pk=1).first()
    if not inst:
        return (
            _template_kardex_image_to_data_uri("logo.png"),
            _template_kardex_image_to_data_uri("logo_SIST.png"),
            _template_kardex_image_to_data_uri("firma_secretaria.png"),
        )

    data = inst.data or {}

    logo_url = (data.get("logo_url") or "").strip()
    second_logo_url = (data.get("second_logo_url") or "").strip()
    secretary_sig_url = (data.get("secretary_signature_url") or "").strip()

    logo_path = _media_url_to_abs_path(logo_url)
    second_logo_path = _media_url_to_abs_path(second_logo_url)
    secretary_sig_path = _media_url_to_abs_path(secretary_sig_url)

    logo_data = _file_to_data_uri(logo_path) or _template_kardex_image_to_data_uri("logo.png")
    second_logo_data = _file_to_data_uri(second_logo_path) or _template_kardex_image_to_data_uri("logo_SIST.png")
    secretary_sig_data = _file_to_data_uri(secretary_sig_path) or _template_kardex_image_to_data_uri("firma_secretaria.png")

    return (logo_data or "", second_logo_data or "", secretary_sig_data or "")


# ══════════════════════════════════════════════════════════════
# CONSTRUCCIÓN DE CONTEXTOS PARA REPORTES
# ══════════════════════════════════════════════════════════════

def _build_reporte_periodo_ctx(request, st: StudentProfile, pq: str) -> tuple[dict, str]:
    """
    Construye contexto para reporte de calificaciones de un período específico
    """
    from academic.models import InstitutionSettings
    pq = _norm_term(pq)

    # Traer registros del período
    recs_qs = (
        AcademicGradeRecord.objects
        .select_related("course")
        .filter(student=st)
    )

    recs = list(recs_qs.filter(term__iexact=pq))
    if not recs:
        recs = [r for r in recs_qs if _norm_term(getattr(r, "term", "") or "") == pq]

    if not recs:
        return {}, "No hay registros para el periodo"

    # Elegir mejor registro por curso
    best_by_course = {}
    for r in recs:
        cid = r.course_id
        try:
            g = None if r.final_grade is None else float(r.final_grade)
        except Exception:
            g = None

        prev = best_by_course.get(cid)
        prev_g = None
        if prev is not None:
            try:
                prev_g = None if prev.final_grade is None else float(prev.final_grade)
            except Exception:
                prev_g = None

        if prev is None or ((g is not None) and (prev_g is None or g > prev_g)):
            best_by_course[cid] = r

    recs = list(best_by_course.values())
    recs.sort(key=lambda r: (getattr(r.course, "code", "") or "", getattr(r.course, "name", "") or ""))

    # Cache de PlanCourse por nombre para resolver créditos
    pc_name_cache = _build_pc_name_cache(getattr(st, "plan_id", None))

    # Construir filas
    rows = []
    sum_points = 0.0
    sum_credits = 0
    simple_sum = 0.0
    simple_count = 0
    total_credits = 0
    total_points = 0.0

    for i, r in enumerate(recs, start=1):
        course = r.course
        course_name = getattr(course, "name", "") or ""
        grade = _safe_float(getattr(r, "final_grade", None))
        credits = _credits_for_student_course(st, course, _pc_name_cache=pc_name_cache)
        status_text = _status_text_from_record(r)
        points_num = (grade * credits) if (grade is not None and credits > 0) else 0.0

        rows.append({
            "n": i,
            "course_name": course_name,
            "status_text": status_text,
            "grade": _fmt_grade(grade),
            "credits": credits,
            "points": _fmt_grade(points_num),
            "points_num": points_num,
        })

        if grade is not None:
            simple_sum += float(grade)
            simple_count += 1

        if grade is not None and credits > 0:
            sum_points += float(points_num)
            sum_credits += credits

        total_credits += int(credits or 0)
        total_points += float(points_num or 0.0)

    if sum_credits > 0:
        weighted_avg = round(sum_points / sum_credits, 2)
    else:
        weighted_avg = round(simple_sum / simple_count, 2) if simple_count > 0 else ""

    logo_data, second_logo_data, secretary_sig_data = _get_institution_media_datauris(request)

    if not second_logo_data:
        second_logo_data = _template_kardex_image_to_data_uri("logo_SIST.png")

    institution_name = 'I.E.S.P.P "GUSTAVO ALLENDE LLAVERIA"'
    try:
        inst = InstitutionSettings.objects.get(id=1)
        if (inst.name or "").strip():
            institution_name = inst.name.strip()
    except Exception:
        pass

    ctx = {
        "institution_name": institution_name,
        "academic_period": pq.upper(),
        "program_name": (st.programa_carrera or "EDUCACIÓN INICIAL (RVM N° 163-2019-MINEDU)"),
        "cycle_section": getattr(st, "ciclo_seccion", "") or 'I - "A"',
        "student_name": f"{st.apellido_paterno} {st.apellido_materno} {st.nombres}".strip(),
        "shift": (getattr(st, "turno", "") or "MAÑANA").upper(),
        "enrollment_code": (getattr(st, "codigo_matricula", "") or st.num_documento or "N/A"),
        "modality": (getattr(st, "modalidad", "") or "PRESENCIAL").upper(),
        "rows": rows,
        "weighted_avg": f"{weighted_avg:.2f}" if weighted_avg != "" else "",
        "total_credits": total_credits,
        "total_points": f"{total_points:.2f}".rstrip("0").rstrip("."),
        "logo_url": logo_data,
        "second_logo_url": second_logo_data,
        "secretary_signature_url": secretary_sig_data,
    }
    return ctx, ""


def _build_record_notas_ctx(request, st: StudentProfile):
    """
    Construye contexto para record de notas completo del estudiante
    """
    from academic.models import InstitutionSettings
    
    qs = (
        AcademicGradeRecord.objects
        .select_related("course")
        .filter(student=st)
    )

    if not qs.exists():
        return {}, "No hay registros"

    # Mejor registro por (term, course)
    best = {}
    for r in qs:
        term = _norm_term(getattr(r, "term", "") or "")
        cid = r.course_id
        key = (term, cid)

        try:
            g = None if r.final_grade is None else float(r.final_grade)
        except Exception:
            g = None

        prev = best.get(key)
        prev_g = None
        if prev is not None:
            try:
                prev_g = None if prev.final_grade is None else float(prev.final_grade)
            except Exception:
                prev_g = None

        if prev is None or ((g is not None) and (prev_g is None or g > prev_g)):
            best[key] = r

    recs = list(best.values())

    # Agrupar por periodo
    by_term = {}
    for r in recs:
        term = _norm_term(getattr(r, "term", "") or "")
        if not term:
            term = "SIN-PERIODO"
        by_term.setdefault(term, []).append(r)

    terms = sorted(by_term.keys(), key=_term_sort_key)

    # Cache de PlanCourse por nombre
    pc_name_cache = _build_pc_name_cache(getattr(st, "plan_id", None))

    periods_out = []
    for t in terms:
        term_recs = by_term[t]
        term_recs.sort(key=lambda r: (getattr(r.course, "code", "") or "", getattr(r.course, "name", "") or ""))

        rows = []
        grades = []

        for i, r in enumerate(term_recs, start=1):
            course = r.course
            grade = _safe_float(getattr(r, "final_grade", None))
            credits = _credits_for_student_course(st, course, _pc_name_cache=pc_name_cache)
            points = (grade * credits) if (grade is not None and credits > 0) else 0.0

            rows.append({
                "n": i,
                "course_name": getattr(course, "name", "") or "",
                "status_text": _status_text_from_record(r),
                "grade": _fmt_grade(grade),
                "credits": credits,
                "points": _fmt_grade(points),
            })

            if grade is not None:
                grades.append(float(grade))

        avg = round(sum(grades) / len(grades), 2) if grades else ""

        periods_out.append({
            "term": t,
            "rows": rows,
            "avg": f"{avg:.2f}" if avg != "" else "",
        })

    logo_data, second_logo_data, secretary_sig_data = _get_institution_media_datauris(request)

    institution_name = 'I.E.S.P.P "GUSTAVO ALLENDE LLAVERIA"'
    try:
        inst = InstitutionSettings.objects.get(id=1)
        if (inst.name or "").strip():
            institution_name = inst.name.strip()
    except Exception:
        pass

    ctx = {
        "institution_name": institution_name,
        "student_name": f"{st.apellido_paterno} {st.apellido_materno} {st.nombres}".strip(),
        "enrollment_code": (getattr(st, "codigo_matricula", "") or st.num_documento or "N/A"),
        "program_name": (st.programa_carrera or ""),
        "cycle_section": getattr(st, "ciclo_seccion", "") or "",
        "shift": (getattr(st, "turno", "") or "").upper(),
        "modality": (getattr(st, "modalidad", "") or "").upper(),
        "periods": periods_out,
        "logo_url": logo_data,
        "second_logo_url": second_logo_data,
        "secretary_signature_url": secretary_sig_data,
    }

    return ctx, ""


# ══════════════════════════════════════════════════════════════
# CONSTRUCCIÓN DE BOLETAS (FULL Y PERÍODO)
# ══════════════════════════════════════════════════════════════

def _plan_pc_map_by_name(plan_id: int):
    """Mapa de PlanCourse por nombre normalizado"""
    pc_by_name = {}
    qs = PlanCourse.objects.select_related("course").filter(plan_id=plan_id)
    for pc in qs:
        # indexar por display_name
        dn = _norm_text(getattr(pc, "display_name", "") or "")
        if dn and dn not in pc_by_name:
            pc_by_name[dn] = pc
        # indexar por course.name
        key = _norm_text(getattr(pc.course, "name", "") or "")
        if key and key not in pc_by_name:
            pc_by_name[key] = pc
    return pc_by_name


def _boleta_group_from_plan_courses(pcs):
    """Agrupa plan courses por semestre para boleta"""
    by_sem = {}
    for pc in pcs:
        sem = int(getattr(pc, "semester", 0) or 0)
        if sem <= 0:
            continue
        by_sem.setdefault(sem, []).append(pc)
    
    grouped = []
    for sem in sorted(by_sem.keys()):
        pcs_sem = sorted(
            by_sem[sem],
            key=lambda x: (x.display_code or x.course.code, x.display_name or x.course.name, x.id)
        )
        rows = []
        total_credits = 0
        for idx, pc in enumerate(pcs_sem, start=1):
            cr = int(getattr(pc, "credits", 0) or 0)
            hrs = int(getattr(pc, "weekly_hours", 0) or 0)
            total_credits += cr
            rows.append({
                "n": idx,
                "course_name": pc.display_name or pc.course.name or "",
                "hours": hrs if hrs else "",
                "credits": cr if cr else "",
                "grade": "",
            })
        grouped.append({
            "semester": sem,
            "label": SEM_LABELS.get(sem, f"SEM {sem}"),
            "rows": rows,
            "rowspan": max(1, len(rows)),
            "total_credits": total_credits,
        })
    return grouped


def _apply_grades_to_grouped(grouped, grade_by_normname: dict):
    """Aplica notas al agrupamiento de boleta"""
    for sem in grouped:
        for row in sem["rows"]:
            key = _norm_text(row["course_name"])
            g = grade_by_normname.get(key)
            row["grade"] = "" if g is None else (int(g) if float(g).is_integer() else round(float(g), 2))


def _grades_map_for_student(student: StudentProfile, period_q: str = ""):
    """Obtiene mapa de notas del estudiante"""
    pq = _norm_term(period_q) if period_q else ""
    recs = list(AcademicGradeRecord.objects.select_related("course").filter(student=student))
    if pq:
        recs = [r for r in recs if _norm_term(getattr(r, "term", "") or "") == pq]
    
    grade_by_name = {}
    for r in recs:
        name = _norm_text(getattr(r.course, "name", "") or "")
        try:
            g = None if r.final_grade is None else float(r.final_grade)
        except Exception:
            g = None
        if not name:
            continue
        prev = grade_by_name.get(name)
        if prev is None or (g is not None and (prev is None or g > prev)):
            grade_by_name[name] = g
    return grade_by_name


def build_boleta_full(student: StudentProfile):
    """Construye boleta completa del estudiante (todos los períodos)"""
    plan_id = _resolve_plan_for_student(student)
    if not plan_id:
        return []
    
    pcs = list(PlanCourse.objects.select_related("course").filter(plan_id=plan_id).order_by("semester", "id"))
    grouped = _boleta_group_from_plan_courses(pcs)
    _apply_grades_to_grouped(grouped, _grades_map_for_student(student, period_q=""))
    return grouped


def build_boleta_for_period(student: StudentProfile, period_q: str):
    """Construye boleta para un período específico"""
    pq = _norm_term(period_q)
    if not pq:
        return []
    
    plan_id = _resolve_plan_for_student(student)
    if not plan_id:
        return []
    
    recs = list(AcademicGradeRecord.objects.select_related("course").filter(student=student))
    recs = [r for r in recs if _norm_term(getattr(r, "term", "") or "") == pq]
    if not recs:
        return []
    
    course_ids = list({r.course_id for r in recs})
    pcs = list(PlanCourse.objects.select_related("course").filter(plan_id=plan_id, course_id__in=course_ids))
    
    # Fallback por nombre
    pc_by_name = _plan_pc_map_by_name(plan_id)
    found = set(_norm_text(pc.course.name) for pc in pcs if pc.course and pc.course.name)
    for r in recs:
        k = _norm_text(getattr(r.course, "name", "") or "")
        if k and k not in found and k in pc_by_name:
            pcs.append(pc_by_name[k])
            found.add(k)
    
    # Fallback extremo
    if not pcs:
        pc_name_cache = _build_pc_name_cache(plan_id)
        grouped = [{
            "semester": 0,
            "label": f"PERIODO {pq}",
            "rows": [],
            "rowspan": 1,
            "total_credits": "",
        }]
        for idx, r in enumerate(recs, start=1):
            name = getattr(r.course, "name", "") or ""
            try:
                g = None if r.final_grade is None else float(r.final_grade)
            except Exception:
                g = None
            credits = _credits_for_student_course(student, r.course, _pc_name_cache=pc_name_cache)

            grouped[0]["rows"].append({
                "n": idx,
                "course_name": name,
                "hours": "",
                "credits": credits if credits else "",
                "grade": "" if g is None else (int(g) if float(g).is_integer() else round(float(g), 2)),
            })

        grouped[0]["rowspan"] = max(1, len(grouped[0]["rows"]))
        return grouped
    
    grouped = _boleta_group_from_plan_courses(pcs)
    _apply_grades_to_grouped(grouped, _grades_map_for_student(student, period_q=period_q))
    return grouped


# ══════════════════════════════════════════════════════════════
# PDF HELPERS
# ══════════════════════════════════════════════════════════════

def _pick_kardex_template(career_name: str) -> str:
    """Selecciona template de PDF según carrera"""
    c = _norm_key(career_name)
    if "inicial" in c:
        return "inicial.pdf"
    if "primaria" in c:
        return "primaria.pdf"
    if "comunic" in c:
        return "comunicacion.pdf"
    if "fisic" in c:
        return "educacion_fisica.pdf"
    return "inicial.pdf"


def _draw_text(c, x, y, text, size=10, bold=False):
    """Dibuja texto en canvas PDF"""
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x, y, "" if text is None else str(text))


def _make_overlay_pdf(num_pages: int, draw_fn):
    """Crea PDF overlay para fusionar con template"""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    for page_i in range(num_pages):
        draw_fn(c, page_i)
        c.showPage()
    c.save()
    buf.seek(0)
    return PdfReader(buf)


def _merge_overlay(template_pdf_path: str, overlay_reader: PdfReader) -> bytes:
    """Fusiona overlay con template PDF"""
    tpl = PdfReader(template_pdf_path)
    out = PdfWriter()
    n = min(len(tpl.pages), len(overlay_reader.pages))
    for i in range(n):
        base = tpl.pages[i]
        base.merge_page(overlay_reader.pages[i])
        out.add_page(base)
    for i in range(n, len(tpl.pages)):
        out.add_page(tpl.pages[i])
    bio = BytesIO()
    out.write(bio)
    bio.seek(0)
    return bio.getvalue()