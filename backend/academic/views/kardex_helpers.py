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
    """Calificación cualitativa en escala oficial MINEDU (RVM N° 123-2022):
        01-05 → PREVIO AL INICIO
        06-10 → INICIO
        11-14 → EN PROCESO
        15-19 → LOGRADO
        20    → DESTACADO
    """
    _VALID = ("LOGRADO", "EN PROCESO", "INICIO", "PREVIO AL INICIO", "DESTACADO")
    for k in ("status", "state", "estado", "observacion", "observation"):
        if hasattr(rec, k):
            v = (getattr(rec, k) or "").strip().upper()
            if v in _VALID:
                return v

    g = _safe_float(getattr(rec, "final_grade", None))
    if g is None:
        return "EN PROCESO"
    if g >= 20:
        return "DESTACADO"
    if g >= 15:
        return "LOGRADO"
    if g >= 11:
        return "EN PROCESO"
    if g >= 6:
        return "INICIO"
    return "PREVIO AL INICIO"


# ══════════════════════════════════════════════════════════════
# FUNCIONES DE OBTENCIÓN DE LOGOS Y MEDIA
# ══════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════
# PROGRAMAS DE ESTUDIO + RVM (formato oficial MINEDU)
# ══════════════════════════════════════════════════════════════

def _format_program_with_rvm(career_name: str) -> str:
    """Devuelve el nombre del programa en MAYÚSCULAS con su R.V.M. entre paréntesis.

    Ejemplos:
        "EDUCACION INICIAL"  → "EDUCACIÓN INICIAL (R.V.M N° 163 - 2019 - MINEDU)"
        "EDUCACION PRIMARIA" → "EDUCACIÓN PRIMARIA (R.V.M N° 204 - 2019 - MINEDU)"
        "EDUCACION FISICA"   → "EDUCACIÓN FÍSICA (R.V.M N° 147 - 2020 - MINEDU)"
        "COMUNICACION"       → "COMUNICACIÓN (R.V.M N° 143 - 2020 - MINEDU)"
    """
    if not career_name:
        return ""
    norm = unicodedata.normalize("NFKD", str(career_name)).encode(
        "ascii", "ignore"
    ).decode("ascii").upper().strip()

    is_eib = (
        "INTERCULTURAL" in norm
        or "BILINGUE" in norm
        or " EIB" in norm
        or norm.endswith(" EIB")
    )

    # Detección por orden de especificidad (EIB primero)
    if "INICIAL" in norm and is_eib:
        return "INICIAL EIB / INTERCULTURAL BILINGÜE (R.V.M N° 252 - 2019 - MINEDU)"
    if "PRIMARIA" in norm and is_eib:
        return "PRIMARIA EIB / INTERCULTURAL BILINGÜE (R.V.M N° 252 - 2019 - MINEDU)"
    if "INICIAL" in norm:
        return "EDUCACIÓN INICIAL (R.V.M N° 163 - 2019 - MINEDU)"
    if "PRIMARIA" in norm:
        return "EDUCACIÓN PRIMARIA (R.V.M N° 204 - 2019 - MINEDU)"
    if "FISICA" in norm:
        return "EDUCACIÓN FÍSICA (R.V.M N° 147 - 2020 - MINEDU)"
    if "COMUNICACION" in norm:
        return "COMUNICACIÓN (R.V.M N° 143 - 2020 - MINEDU)"
    if "COMPUTACION" in norm or "INFORMATICA" in norm:
        return "COMPUTACIÓN E INFORMÁTICA (R.D. N° 0223 - 2012 - ED)"

    # Fallback: devolver el nombre tal cual en mayúsculas
    return (career_name or "").upper().strip()


def _read_institution_name(
    default: str = 'INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO "GUSTAVO ALLENDE LLAVERÍA" - TARMA',
) -> str:
    """Lee el nombre institucional completo desde el catálogo (Parámetros de institución).

    Usa el valor de `name` tal como está guardado (ya viene formateado por el UI:
    `INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO ...`). Si está disponible,
    le agrega " - <PROVINCIA>" al final si no lo tiene ya.
    """
    name_val = ""
    province = ""
    try:
        cat = CatalogInstitutionSetting.objects.filter(pk=1).first()
        if cat and isinstance(cat.data, dict):
            name_val = (cat.data.get("name") or "").strip()
            province = (cat.data.get("provincia") or cat.data.get("city") or "").strip()
    except Exception:
        pass

    # Fallback al academic model
    if not name_val:
        try:
            from academic.models import InstitutionSettings
            inst = InstitutionSettings.objects.filter(id=1).first()
            if inst and (inst.name or "").strip():
                name_val = inst.name.strip()
        except Exception:
            pass

    if not name_val:
        return default

    name_val = name_val.upper().strip()

    # Agregar " - <PROVINCIA>" al final si la provincia no aparece ya
    if province:
        prov_up = province.upper().strip()
        if prov_up and prov_up not in name_val:
            name_val = f"{name_val} - {prov_up}"

    return name_val


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

    institution_name = _read_institution_name()

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
        .select_related("course", "plan_course")
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

    # Mapa numérico → romano (1..10)
    _ROMAN_BY_SEM = {
        1: "I", 2: "II", 3: "III", 4: "IV", 5: "V",
        6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X",
    }

    plan_id = getattr(st, "plan_id", None)

    def _resolve_sem(rec) -> int:
        """Busca el ciclo del curso con la misma estrategia de fallback
        que `_credits_for_student_course`:
            1. plan_course.semester (FK directa, si está)
            2. PlanCourse por course_id en la malla del alumno
            3. PlanCourse por código del curso
            4. PlanCourse por nombre normalizado (usando pc_name_cache)
        Devuelve 0 si no se pudo determinar.
        """
        # 1) FK directa
        pc = getattr(rec, "plan_course", None)
        if pc and getattr(pc, "semester", None):
            try:
                return int(pc.semester)
            except (TypeError, ValueError):
                pass

        course = rec.course
        course_id = getattr(course, "id", None)

        # 2) Por course_id en la malla del alumno (solo si tiene plan)
        if plan_id:
            try:
                pc2 = (
                    PlanCourse.objects
                    .filter(plan_id=plan_id, course_id=course_id)
                    .values_list("semester", flat=True)
                    .first()
                )
                if pc2:
                    return int(pc2)
            except Exception:
                pass

        # 3) Por código (display_code o course.code) en la malla del alumno
        code_norm = (getattr(course, "code", "") or "").strip().upper()
        if plan_id and code_norm:
            try:
                pc3 = (
                    PlanCourse.objects
                    .filter(plan_id=plan_id)
                    .filter(Q(display_code__iexact=code_norm) | Q(course__code__iexact=code_norm))
                    .values_list("semester", flat=True)
                    .first()
                )
                if pc3:
                    return int(pc3)
            except Exception:
                pass

        # 4) Por nombre normalizado usando el cache (solo si tiene plan)
        course_name = (getattr(course, "name", "") or "").strip()
        if course_name and pc_name_cache:
            name_norm = _norm_text(course_name)
            pc4 = pc_name_cache.get(name_norm)
            if pc4 and getattr(pc4, "semester", None):
                try:
                    return int(pc4.semester)
                except (TypeError, ValueError):
                    pass

        # 5) Último fallback (alumnos sin plan, traslados, etc.):
        #    buscar CUALQUIER PlanCourse con el mismo course_id y tomar el
        #    semester más común. Es la última opción cuando el alumno no tiene
        #    plan asignado pero el curso sí existe en algún plan del sistema.
        try:
            sems = list(
                PlanCourse.objects
                .filter(course_id=course_id)
                .values_list("semester", flat=True)
            )
            if sems:
                # mode: el semester que más se repite
                from collections import Counter
                most = Counter(int(s) for s in sems if s).most_common(1)
                if most:
                    return most[0][0]
        except Exception:
            pass

        return 0

    def _course_ciclo_roman(rec) -> str:
        sem = _resolve_sem(rec)
        if sem <= 0:
            return ""
        return _ROMAN_BY_SEM.get(sem, str(sem))

    def _resolve_course_name(rec) -> str:
        """Devuelve el nombre del curso prefiriendo el display_name del PlanCourse
        (el que se edita en Mallas). Fallback al name global del Course."""
        # 1) FK directa: usar display_name si está presente
        pc = getattr(rec, "plan_course", None)
        if pc:
            dn = (getattr(pc, "display_name", "") or "").strip()
            if dn:
                return dn

        # 2) Si el alumno tiene plan, buscar PlanCourse por course_id
        course_id = getattr(rec.course, "id", None)
        if plan_id and course_id:
            try:
                dn = (
                    PlanCourse.objects
                    .filter(plan_id=plan_id, course_id=course_id)
                    .values_list("display_name", flat=True)
                    .first()
                )
                if dn and dn.strip():
                    return dn.strip()
            except Exception:
                pass

        # 3) Fallback al nombre del Course
        return (getattr(rec.course, "name", "") or "").strip()

    def _period_ciclo_roman(records: list) -> str:
        """Ciclo dominante del periodo (mode entre los ciclos resueltos)."""
        from collections import Counter
        sems = []
        for rec in records:
            s = _resolve_sem(rec)
            if s > 0:
                sems.append(s)
        if not sems:
            return ""
        # mode con desempate al menor número
        counter = Counter(sems)
        max_count = max(counter.values())
        candidates = [s for s, c in counter.items() if c == max_count]
        return _ROMAN_BY_SEM.get(min(candidates), str(min(candidates)))

    periods_out = []
    for t in terms:
        term_recs = by_term[t]
        term_recs.sort(key=lambda r: (
            int(getattr(getattr(r, "plan_course", None), "semester", 0) or 0),
            getattr(r.course, "code", "") or "",
            getattr(r.course, "name", "") or "",
        ))

        rows = []
        grades = []
        sum_points = 0.0
        sum_credits = 0

        for i, r in enumerate(term_recs, start=1):
            course = r.course
            grade = _safe_float(getattr(r, "final_grade", None))
            credits = _credits_for_student_course(st, course, _pc_name_cache=pc_name_cache)
            points = (grade * credits) if (grade is not None and credits > 0) else 0.0

            rows.append({
                "n": i,
                "course_name": _resolve_course_name(r),
                "status_text": _status_text_from_record(r),
                "grade": _fmt_grade(grade),
                "credits": credits,
                "points": _fmt_grade(points),
            })

            if grade is not None:
                grades.append(float(grade))
                if credits > 0:
                    sum_points += float(grade) * credits
                    sum_credits += credits

        # ── Promedio PONDERADO por créditos (correcto académicamente) ──
        # Si todos los cursos tienen créditos, usar weighted avg.
        # Si no hay créditos válidos, caer a promedio simple como respaldo.
        if sum_credits > 0:
            avg = round(sum_points / sum_credits, 2)
        elif grades:
            avg = round(sum(grades) / len(grades), 2)
        else:
            avg = ""

        periods_out.append({
            "term": t,
            "ciclo_roman": _period_ciclo_roman(term_recs),
            "rows": rows,
            "avg": f"{avg:.2f}" if avg != "" else "",
        })

    logo_data, second_logo_data, secretary_sig_data = _get_institution_media_datauris(request)

    institution_name = _read_institution_name()

    # ── Firma del director y nombres desde el catálogo ──
    director_name = ""
    secretary_name = ""
    director_sig_data = ""
    try:
        cat_inst = CatalogInstitutionSetting.objects.filter(pk=1).first()
        cat_data = cat_inst.data if (cat_inst and isinstance(cat_inst.data, dict)) else {}
        director_name = (cat_data.get("director_name") or "").strip()
        secretary_name = (cat_data.get("secretary_name") or "").strip()
        dir_sig_url = (cat_data.get("signature_url") or "").strip()
        if dir_sig_url:
            dir_path = _media_url_to_abs_path(dir_sig_url)
            director_sig_data = _file_to_data_uri(dir_path) or ""
    except Exception:
        pass

    # ── Programa de estudios con RVM oficial ──
    program_label = _format_program_with_rvm(st.programa_carrera or "")

    # ── Fecha de emisión legible ──
    from datetime import date as _date
    issue_date = _date.today().strftime("%d/%m/%Y")

    # ── Foto del estudiante (data URI si está cargada) ──
    student_photo_data = ""
    photo_path_resolved = None
    try:
        for attr in ("photo", "photo_url", "foto", "foto_url", "avatar", "avatar_url"):
            val = getattr(st, attr, None)
            if not val:
                continue
            # 1) FieldFile → .path directo
            p = getattr(val, "path", None)
            if p and os.path.isfile(p):
                photo_path_resolved = p
                break
            # 2) String URL con /media/
            s = str(val).strip()
            if not s:
                continue
            if "/media/" in s:
                rel = s.split("/media/", 1)[1]
                cand = os.path.join(str(settings.MEDIA_ROOT), rel)
                if os.path.isfile(cand):
                    photo_path_resolved = cand
                    break
            # 3) Path relativo
            if not s.startswith(("http", "/")):
                cand = os.path.join(str(settings.MEDIA_ROOT), s.lstrip("/"))
                if os.path.isfile(cand):
                    photo_path_resolved = cand
                    break
            # 4) Path absoluto que existe
            if os.path.isabs(s) and os.path.isfile(s):
                photo_path_resolved = s
                break
        if photo_path_resolved:
            student_photo_data = _file_to_data_uri(photo_path_resolved) or ""
    except Exception:
        student_photo_data = ""

    ctx = {
        "document_title": "FICHA DE RENDIMIENTO ACADÉMICO",
        "institution_name": institution_name,
        "student_name": f"{st.apellido_paterno} {st.apellido_materno} {st.nombres}".strip().upper(),
        "num_documento": st.num_documento or "",
        "enrollment_code": (getattr(st, "codigo_matricula", "") or st.num_documento or "N/A"),
        "program_name": program_label,
        "cycle_section": getattr(st, "ciclo_seccion", "") or "",
        # Modalidad fija: PRESENCIAL (no se imprime Turno)
        "modality": "PRESENCIAL",
        "issue_date": issue_date,
        "periods": periods_out,
        "logo_url": logo_data,
        "second_logo_url": second_logo_data,
        "secretary_signature_url": secretary_sig_data,
        "director_signature_url": director_sig_data,
        "director_name": director_name,
        "secretary_name": secretary_name,
        "student_photo_url": student_photo_data,
    }

    return ctx, ""


# ══════════════════════════════════════════════════════════════
# FICHA DE RENDIMIENTO ACADÉMICO (formato oficial)
# ══════════════════════════════════════════════════════════════

# Mapas auxiliares para el formato oficial
_SEM_ROMAN_LABELS = {
    1: "PRIMERO", 2: "SEGUNDO", 3: "TERCERO", 4: "CUARTO", 5: "QUINTO",
    6: "SEXTO", 7: "SÉPTIMO", 8: "OCTAVO", 9: "NOVENO", 10: "DÉCIMO",
}

_MESES_ES = {
    1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
    5: "mayo", 6: "junio", 7: "julio", 8: "agosto",
    9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre",
}


def _calif_cual_from_grade(grade) -> str:
    """CALIF. CUAL. abreviado para la ficha de rendimiento, alineado
    con la escala MINEDU RVM N° 123-2022:
        20    → D    (Destacado)
        15-19 → L    (Logrado)
        11-14 → E.P  (En proceso)
        06-10 → I    (Inicio)
        01-05 → P.I  (Previo al inicio)
    """
    g = _safe_float(grade)
    if g is None:
        return ""
    if g >= 20:
        return "D"
    if g >= 15:
        return "L"
    if g >= 11:
        return "E.P"
    if g >= 6:
        return "I"
    return "P.I"


def _calif_cual_from_components(components: dict) -> str:
    """Si las componentes traen ESTADO o niveles cualitativos, usarlas."""
    if not isinstance(components, dict) or not components:
        return ""
    estado = str(components.get("ESTADO") or "").strip().upper()
    if estado:
        if "LOGR" in estado:
            return "L"
        if "PROC" in estado:
            return "E.P"
        if "INIC" in estado:
            return "I"
    # ESCALA_0_5: 4=Logrado, 3=En Proceso, 2=En Inicio
    try:
        escala = int(float(components.get("ESCALA_0_5") or 0))
        return {4: "L", 3: "E.P", 2: "I", 1: "I"}.get(escala, "")
    except Exception:
        return ""


def _term_year(term: str) -> int:
    """Extrae el año de un período como '2024-I' → 2024."""
    if not term:
        return 0
    try:
        return int(str(term).split("-")[0])
    except Exception:
        return 0


def _build_ficha_rendimiento_ctx(request, st: StudentProfile) -> tuple[dict, str]:
    """Construye el contexto para la FICHA DE RENDIMIENTO ACADÉMICO oficial.

    Agrupa los registros por el ciclo del plan (PRIMERO, SEGUNDO, …) y
    calcula totales por semestre. Toma datos institucionales del catálogo.
    """
    from datetime import date
    from catalogs.models import InstitutionSetting as CIS

    qs = (
        AcademicGradeRecord.objects
        .select_related("course", "plan_course")
        .filter(student=st)
        .order_by("plan_course__semester", "plan_course__display_code",
                  "course__code", "course__name")
    )

    if not qs.exists():
        return {}, "No hay registros académicos para este estudiante"

    # Cache de PlanCourse para resolver créditos
    pc_name_cache = _build_pc_name_cache(getattr(st, "plan_id", None))

    # ── Resolución del ciclo (semester) por course_id, en cascada ──
    # 1) Plan al que se ACOGE el estudiante (st.plan)  ← prioridad
    # 2) Cualquier plan de la MISMA carrera del estudiante
    # 3) Cualquier plan (último recurso)
    # 4) Sin ciclo  → grupo "SIN CICLO ASIGNADO" al final
    student_plan_id = getattr(st, "plan_id", None)
    student_career_id = None
    try:
        if getattr(st, "plan", None) and getattr(st.plan, "career_id", None):
            student_career_id = st.plan.career_id
    except Exception:
        pass

    # Recolectamos los course_id presentes para hacer una sola query por nivel
    all_course_ids = {r.course_id for r in qs if r.course_id}

    sem_by_course_student_plan: dict[int, int] = {}
    sem_by_course_career: dict[int, int] = {}
    sem_by_course_any: dict[int, int] = {}

    if all_course_ids:
        try:
            from academic.models import PlanCourse as _PC

            def _fill(cache: dict, qry):
                rows = (
                    qry.exclude(semester__isnull=True)
                       .exclude(semester=0)
                       .order_by("course_id", "semester")
                       .values_list("course_id", "semester")
                )
                for cid, sem in rows:
                    if cid and sem and cid not in cache:
                        cache[cid] = int(sem)

            base = _PC.objects.filter(course_id__in=all_course_ids)
            if student_plan_id:
                _fill(sem_by_course_student_plan,
                      base.filter(plan_id=student_plan_id))
            if student_career_id:
                _fill(sem_by_course_career,
                      base.filter(plan__career_id=student_career_id))
            _fill(sem_by_course_any, base)
        except Exception:
            pass

    # ── Agrupar por ciclo (nunca perder un registro) ──
    SEM_UNASSIGNED = 99
    by_sem: dict[int, list] = {}
    for r in qs:
        sem = 0
        # (1) plan_course ya vinculado al guardar
        if r.plan_course and r.plan_course.semester:
            sem = int(r.plan_course.semester)
        # (2) plan del estudiante  ← lo nuevo
        if not sem and r.course_id in sem_by_course_student_plan:
            sem = sem_by_course_student_plan[r.course_id]
        # (3) misma carrera
        if not sem and r.course_id in sem_by_course_career:
            sem = sem_by_course_career[r.course_id]
        # (4) Course.semester si el modelo lo tiene
        if not sem:
            sem = int(getattr(r.course, "semester", 0) or 0)
        # (5) cualquier plan
        if not sem and r.course_id in sem_by_course_any:
            sem = sem_by_course_any[r.course_id]
        # (6) sin ciclo asignado
        if not sem:
            sem = SEM_UNASSIGNED
        by_sem.setdefault(sem, []).append(r)

    # ── Construir filas por grupo ──
    semester_groups = []
    for sem in sorted(by_sem.keys()):
        recs = by_sem[sem]

        rows = []
        sum_points = 0.0
        sum_credits = 0
        latest_year = 0

        for idx, r in enumerate(recs, start=1):
            grade = _safe_float(getattr(r, "final_grade", None))
            credits = _credits_for_student_course(st, r.course, _pc_name_cache=pc_name_cache)
            points = (grade * credits) if (grade is not None and credits > 0) else 0.0
            sum_points += points
            sum_credits += credits
            y = _term_year(getattr(r, "term", "") or "")
            if y > latest_year:
                latest_year = y

            # CALIF. CUAL. — preferir componentes, fallback a la nota
            cual = _calif_cual_from_components(r.components) or _calif_cual_from_grade(grade)

            # Observación: si hay nota baja (< 11) o segundo registro del curso
            obs = ""
            if grade is not None and grade < 11:
                obs = "A.C.R.D. (Pendiente)"

            rows.append({
                "n": idx,
                "course_name": (getattr(r.course, "name", "") or "").strip(),
                "calif_cual": cual,
                "nota": _fmt_grade(grade) if grade is not None else "",
                "credits": credits,
                "points": _fmt_grade(points) if points else "",
                "term": getattr(r, "term", "") or "",
                "observation": obs,
            })

        avg = (sum_points / sum_credits) if sum_credits > 0 else 0.0
        # Fecha del semestre: 31/12 del año más alto encontrado
        date_display = f"31/12/{latest_year}" if latest_year else ""

        # Etiqueta del semestre — 99 es el grupo de huérfanos
        if sem == SEM_UNASSIGNED:
            sem_label = "SIN CICLO ASIGNADO"
        else:
            sem_label = _SEM_ROMAN_LABELS.get(sem, f"CICLO {sem}")

        semester_groups.append({
            "sem_label": sem_label,
            "sem_index": sem,
            "rows": rows,
            "rowspan": len(rows),
            "date_display": date_display,
            "total_points": f"{sum_points:.0f}" if sum_points else "",
            "total_credits": sum_credits or "",
            "avg_display": f"{avg:.2f}" if avg else "",
        })

    # ── Datos institucionales ──
    cat = CIS.objects.filter(pk=1).first()
    cat_data = cat.data if (cat and isinstance(cat.data, dict)) else {}

    full_name = (cat_data.get("name") or "").strip()
    short_name = (
        cat_data.get("institution_name")
        or cat_data.get("short_name")
        or "GUSTAVO ALLENDE LLAVERÍA"
    ).strip()
    city = (
        cat_data.get("city")
        or cat_data.get("provincia")
        or "Tarma"
    ).strip()

    director_name = (cat_data.get("director_name") or "").strip()
    secretary_name = (cat_data.get("secretary_name") or "").strip()

    # ── Media: logo, firma director, firma secretaría, foto estudiante ──
    logo_data, _second_logo, secretary_sig_data = _get_institution_media_datauris(request)

    director_sig_path = _media_url_to_abs_path((cat_data.get("signature_url") or "").strip())
    director_sig_data = _file_to_data_uri(director_sig_path) if director_sig_path else ""

    # Foto del estudiante
    student_photo_data = ""
    photo_url = ""
    for attr in ("photo_url", "photo", "foto_url", "avatar_url"):
        photo_url = getattr(st, attr, "") or ""
        if photo_url:
            break
    if photo_url:
        if photo_url.startswith("/media/"):
            photo_path = os.path.join(settings.MEDIA_ROOT, photo_url.split("/media/", 1)[1])
        elif "/media/" in photo_url:
            photo_path = os.path.join(settings.MEDIA_ROOT, photo_url.split("/media/", 1)[1])
        else:
            photo_path = photo_url
        student_photo_data = _file_to_data_uri(photo_path) or ""

    # RVM por carrera (si nominas.py lo mapea)
    rvm = ""
    try:
        from academic.views.nominas import _rvm_for_career
        rvm = _rvm_for_career((st.programa_carrera or "")) or ""
    except Exception:
        pass

    today = date.today()

    ctx = {
        "institution_name": full_name or short_name,
        "institution_short_name": short_name,
        "city": city,
        "rvm": rvm,
        "student_name": f"{st.apellido_paterno or ''} {st.apellido_materno or ''}, {st.nombres or ''}".strip(", ").strip(),
        "num_documento": st.num_documento or "",
        "enrollment_code": (getattr(st, "codigo_matricula", "") or st.num_documento or ""),
        "program_name": (st.programa_carrera or "").strip(),
        "semester_groups": semester_groups,
        "logo_url": logo_data,
        "director_signature_url": director_sig_data,
        "secretary_signature_url": secretary_sig_data,
        "director_name": director_name,
        "secretary_name": secretary_name,
        "student_photo_url": student_photo_data,
        "closing_city": (cat_data.get("distrito") or city or "Pomachaca").strip(),
        "closing_day": str(today.day),
        "closing_month": _MESES_ES.get(today.month, ""),
        "closing_year": str(today.year),
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