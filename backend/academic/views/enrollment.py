"""
Vistas para manejo de Matrículas y Procesos de Inscripción
═══════════════════════════════════════════════════════════
FEATURES:
  ✅ Ventana ORDINARIA  → status 'OPEN'
  ✅ Ventana EXTEMPORÁNEA → status 'EXTEMPORARY' + surcharge
  ✅ Sin ventana configurada → status 'FREE' (sin bloqueo)
  ✅ Fuera de todo → status 'CLOSED' (bloquea validar/commit)
  ✅ AcademicPeriodEnrollmentWindowView  GET + PUT
  ✅ AcademicPeriodsListView             GET (lista períodos)
  ✅ EnrollmentAvailableView devuelve window.status completo
  ✅ Acepta course_ids Y plan_course_ids
  ✅ Resolución por nombre (malla 2020)
  ✅ Créditos máximos dinámicos por plan (no tope fijo de 22)
  ✅ StudentsOverviewView — vista admin de alumnos matriculados/pendientes
  ✅ StudentsOverviewView retorna enrolled_count y pending_count globales
"""
from io import BytesIO
from django.db import transaction
from django.db.models import Q, Subquery, OuterRef, Count, Sum, IntegerField, Max
from django.db.models.functions import Coalesce
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework_simplejwt.authentication import JWTAuthentication
from .enrollment_payment import check_enrollment_payment

from students.models import Student as StudentProfile
from academic.models import (
    AcademicPeriod, Enrollment, EnrollmentItem,
    PlanCourse, Section, SectionScheduleSlot,
    InstitutionSettings, AcademicGradeRecord,
    CoursePrereq,
)
from .utils import (
    ok, PASSING_GRADE, DAY_TO_INT, INT_TO_DAY,
    _get_full_name, _can_admin_enroll, _norm_term, _norm_text,
)
from .kardex_helpers import _resolve_plan_for_student, _build_pc_name_cache

import logging

# `logger` se usaba en cuatro `except` de este módulo sin estar definido: al
# fallar la generación de la ficha, el manejador reventaba con NameError y
# escondía el error de verdad.
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════
#  HELPERS DE PERÍODO
# ══════════════════════════════════════════════════════════════

def _period_obj(code: str, auto_create: bool = False):
    p = AcademicPeriod.objects.filter(code=code).first()
    if p or not auto_create:
        return p

    import re
    from datetime import date
    m = re.match(r'^(\d{4})-(I{1,2}|III?)$', (code or '').strip().upper())
    if not m:
        return None

    year = int(m.group(1))
    term = m.group(2)

    # CANDADO GLOBAL: solo se auto-crean el período del calendario y el
    # inmediato siguiente. Antes bastaba que cualquier request pidiera
    # "2027-II" para crear un período fantasma que, por ser el código más
    # alto, se volvía el default de pagos, padrón y matrícula de TODO el
    # sistema. Un período más lejano se crea a mano en Períodos Académicos.
    hoy = date.today()
    sem_actual = (hoy.year, 1 if hoy.month < 8 else 2)
    sem_pedido = (year, 1 if term == 'I' else (2 if term == 'II' else 1))
    sem_sig = ((sem_actual[0] + 1, 1) if sem_actual[1] == 2
               else (sem_actual[0], 2))
    if sem_pedido > sem_sig:
        return None

    if term == 'I':
        start_d = date(year, 3, 1)
        end_d   = date(year, 7, 31)
    elif term == 'II':
        start_d = date(year, 8, 1)
        end_d   = date(year, 12, 31)
    else:
        start_d = date(year, 1, 1)
        end_d   = date(year, 2, 28)

    p, _ = AcademicPeriod.objects.get_or_create(
        code=code.strip().upper(),
        defaults=dict(start=start_d, end=end_d),
    )
    return p


def _guess_default_period_code() -> str:
    """Período por defecto cuando el cliente no manda `academic_period`.

    Antes: primer período "abierto" (los FREE, sin fechas, cuentan como
    abiertos) o el de MAYOR código. Como `_period_obj(auto_create=True)`
    crea un AcademicPeriod con cualquier código que llegue por querystring,
    bastó que alguien pidiera "2027-II" para que ese fantasma fuera el
    default de todo el sistema: pagos NOT_STARTED, padrón vacío, etc.

    Ahora: 1) un período con ventana CONFIGURADA y abierta (OPEN/EXTEMPORARY
    — intencional de Secretaría); 2) el período del calendario si existe;
    3) el más reciente NO futuro. Los fantasmas futuros ya no ganan.
    """
    from datetime import date as _date
    hoy = _date.today()
    estimado = f"{hoy.year}-{'I' if hoy.month < 8 else 'II'}"
    try:
        for p in AcademicPeriod.objects.all():
            try:
                if p.enrollment_status() in ("OPEN", "EXTEMPORARY"):
                    return p.code
            except Exception:
                continue
    except Exception:
        pass
    try:
        codes = [c.strip() for c in
                 AcademicPeriod.objects.values_list("code", flat=True)
                 if c and c.strip()]
        if estimado in codes:
            return estimado
        pasados = sorted(c for c in codes if c <= estimado)
        if pasados:
            return pasados[-1]
    except Exception:
        pass
    return estimado


def _window_info_for_period(per: AcademicPeriod) -> dict:
    status    = per.enrollment_status()
    surcharge = float(per.extemporary_surcharge or 0)
    ahora     = timezone.now()

    # `enrollment_status()` devuelve CLOSED tanto si la ventana ya pasó como si
    # TODAVÍA NO EMPIEZA, y el bloqueo es correcto en los dos casos. Pero para
    # la pantalla no es lo mismo: decir "matrícula cerrada" cuando en realidad
    # está programada para dentro de unos días hace pensar que se configuró mal.
    proxima = None
    if status == "CLOSED":
        candidatas = [d for d in (per.enrollment_start, per.extemporary_start)
                      if d and d > ahora]
        proxima = min(candidatas) if candidatas else None

    return {
        "status":                status,
        "is_open":               status != "CLOSED",
        "not_yet_open":          bool(proxima),
        "opens_at":              proxima.isoformat() if proxima else None,
        "start":                 per.enrollment_start.isoformat()    if per.enrollment_start    else None,
        "end":                   per.enrollment_end.isoformat()      if per.enrollment_end      else None,
        "extemporary_start":     per.extemporary_start.isoformat()   if per.extemporary_start   else None,
        "extemporary_end":       per.extemporary_end.isoformat()     if per.extemporary_end     else None,
        "extemporary_surcharge": surcharge,
        "subsanacion_start":     per.subsanacion_start.isoformat()   if per.subsanacion_start   else None,
        "subsanacion_end":       per.subsanacion_end.isoformat()     if per.subsanacion_end     else None,
        "subsanacion_open":      per.subsanacion_window_open(),
    }


# ══════════════════════════════════════════════════════════════
#  RESOLUCIÓN DE ESTUDIANTE
# ══════════════════════════════════════════════════════════════

def _resolve_student_from_request(request, dni=None, student_id=None):
    if dni:
        if not _can_admin_enroll(request.user):
            return None, Response({"detail": "No autorizado."}, status=403)
        st = StudentProfile.objects.filter(num_documento=str(dni).strip()).first()
        if not st:
            return None, Response({"detail": "Estudiante no encontrado por DNI."}, status=404)
        return st, None

    if student_id:
        if not _can_admin_enroll(request.user):
            st = StudentProfile.objects.filter(id=int(student_id), user=request.user).first()
            if not st:
                return None, Response({"detail": "No autorizado para este estudiante."}, status=403)
            return st, None
        else:
            st = StudentProfile.objects.filter(id=int(student_id)).first()
            if not st:
                return None, Response({"detail": "Estudiante no encontrado por ID."}, status=404)
            return st, None

    st = getattr(request.user, "student_profile", None)
    if not st:
        return None, Response({"detail": "Tu usuario no tiene estudiante vinculado."}, status=404)
    return st, None


# ══════════════════════════════════════════════════════════════
#  HELPERS DE VALIDACIÓN
# ══════════════════════════════════════════════════════════════

def _detect_restart_term(student: StudentProfile, base_qs):
    """Detecta el término en el que el alumno REINICIÓ su carrera.

    Señal: si el alumno tiene una nota APROBADA de un curso en término T1, y
    luego volvió a tomar ese mismo curso en un término T2 > T1, eso solo se
    explica por reinicio (cambio de plan con reseteo, repechaje, etc.).
    En ese caso, el restart_term es el T2 más temprano detectado.

    Retorna el término de reinicio (str) o None si no hay restart.
    """
    from .kardex import _period_to_num

    # Pares (course_id, term, grade) ordenados por término
    recs = list(
        base_qs.values_list("course_id", "term", "final_grade")
    )
    if not recs:
        return None

    # Por cada curso, encontrar el primer término donde fue aprobado
    earliest_approved_num = {}  # course_id → (term_num, term_str)
    for cid, term, fg in recs:
        try:
            g = float(fg) if fg is not None else None
        except Exception:
            g = None
        if g is None or g < PASSING_GRADE:
            continue
        tnum = _period_to_num(term)
        if tnum is None:
            continue
        prev = earliest_approved_num.get(cid)
        if prev is None or tnum < prev[0]:
            earliest_approved_num[cid] = (tnum, term)

    if not earliest_approved_num:
        return None

    # Buscar el T2 más temprano donde se retomó un curso ya aprobado antes
    restart_num = None
    restart_term = None
    for cid, term, fg in recs:
        approved_at = earliest_approved_num.get(cid)
        if approved_at is None:
            continue
        approved_num = approved_at[0]
        tnum = _period_to_num(term)
        if tnum is None:
            continue
        if tnum > approved_num:
            if restart_num is None or tnum < restart_num:
                restart_num = tnum
                restart_term = term

    return restart_term


def _approved_info(student: StudentProfile):
    """Retorna (approved_ids, approved_names) considerando:
      1) SOLO el stint activo (reingreso). Si abandonó y reingresó, lo viejo
         no cuenta.
      2) SOLO notas cuyo plan_course pertenece al plan actual del estudiante.
         Esto evita que cursos aprobados en un plan anterior (e.g., 2015)
         cuenten como aprobados en el plan nuevo (e.g., 2020) cuando el
         alumno cambió de plan. Notas con plan_course=NULL se incluyen
         (datos legacy sin vínculo a plan).
      3) Si se detecta un REINICIO (alumno retoma curso ya aprobado en
         término posterior), las notas anteriores al reinicio se descartan."""
    from .kardex import _detect_active_stint_periods, _period_to_num

    base_qs = AcademicGradeRecord.objects.filter(student=student)

    # (2) Filtrar por plan actual del estudiante (si tiene plan asignado)
    if getattr(student, "plan_id", None):
        base_qs = base_qs.filter(
            Q(plan_course__isnull=True) |
            Q(plan_course__plan_id=student.plan_id)
        )

    # (3) Detectar reinicio y filtrar notas previas
    restart_term = _detect_restart_term(student, base_qs)
    if restart_term:
        restart_num = _period_to_num(restart_term)
        if restart_num is not None:
            keep_terms = []
            for t in base_qs.values_list("term", flat=True).distinct():
                tnum = _period_to_num(t)
                if tnum is not None and tnum >= restart_num:
                    keep_terms.append(t)
            base_qs = base_qs.filter(term__in=keep_terms)

    all_terms = set(base_qs.values_list("term", flat=True).distinct())
    active_periods = _detect_active_stint_periods(all_terms) or all_terms

    recs = (
        base_qs
        .select_related("course")
        .filter(term__in=active_periods)
        .values_list("course_id", "final_grade", "course__name")
    )

    best = {}
    for cid, fg, cname in recs:
        try:
            g = None if fg is None else float(fg)
        except Exception:
            g = None
        name_norm = _norm_text(cname or "")
        prev = best.get(cid)
        if prev is None or (g is not None and (prev[0] is None or g > prev[0])):
            best[cid] = (g, name_norm)

    approved_ids   = set()
    approved_names = set()
    for cid, (g, name_norm) in best.items():
        if g is not None and g >= PASSING_GRADE:
            approved_ids.add(cid)
            if name_norm:
                approved_names.add(name_norm)

    return approved_ids, approved_names


def _approved_course_ids(student: StudentProfile) -> set:
    ids, _ = _approved_info(student)
    return ids


def _is_course_approved(pc: PlanCourse, approved_ids: set, approved_names: set) -> bool:
    if pc.course_id in approved_ids:
        return True
    pc_name = _norm_text(
        getattr(pc, "display_name", "") or
        getattr(pc.course, "name", "") or ""
    )
    return bool(pc_name and pc_name in approved_names)


def _attempts_for_course(student: StudentProfile, pc: PlanCourse) -> int:
    count = AcademicGradeRecord.objects.filter(student=student, course_id=pc.course_id).count()
    if count > 0:
        return count

    pc_name = _norm_text(
        getattr(pc, "display_name", "") or
        getattr(pc.course, "name", "") or ""
    )
    if not pc_name:
        return 0

    for rec in AcademicGradeRecord.objects.select_related("course").filter(student=student):
        if _norm_text(getattr(rec.course, "name", "") or "") == pc_name:
            count += 1
    return count


def _is_third_attempt(student: StudentProfile, pc: PlanCourse) -> bool:
    return _attempts_for_course(student, pc) >= 2


def _max_credits_from_plan(plan_id: int) -> int:
    from django.db.models import Sum

    if not plan_id:
        return 0

    result = (
        PlanCourse.objects
        .filter(plan_id=plan_id, semester__gt=0)
        .values("semester")
        .annotate(total_credits=Sum("credits"))
        .order_by("-total_credits")
        .first()
    )

    return int(result["total_credits"] or 0) if result else 0


def _prereqs_met(plan_course_id: int, approved_ids: set, approved_names: set = None) -> bool:
    prereq_pc_ids = list(
        CoursePrereq.objects.filter(plan_course_id=plan_course_id)
        .values_list("prerequisite_id", flat=True)
    )
    if not prereq_pc_ids:
        return True

    if approved_names is None:
        approved_names = set()

    for pc in PlanCourse.objects.select_related("course").filter(id__in=prereq_pc_ids):
        if pc.course_id in approved_ids:
            continue
        pc_name = _norm_text(
            getattr(pc, "display_name", "") or
            getattr(pc.course, "name", "") or ""
        )
        if pc_name and pc_name in approved_names:
            continue
        return False

    return True


def _current_semester(student: StudentProfile) -> int:
    ciclo_val = 0
    if getattr(student, "ciclo", None):
        try:
            ciclo_val = max(1, int(student.ciclo))
        except Exception:
            ciclo_val = 0

    if not student.plan_id:
        pid = _resolve_plan_for_student(student)
        if not pid:
            return max(1, ciclo_val)

    approved_ids, approved_names = _approved_info(student)
    if not approved_ids and not approved_names:
        return max(1, ciclo_val)

    max_sem = 0
    for pc in PlanCourse.objects.select_related("course").filter(plan_id=student.plan_id):
        sem = int(pc.semester or 0)
        if sem <= 0:
            continue
        if _is_course_approved(pc, approved_ids, approved_names):
            max_sem = max(max_sem, sem)

    computed = max(1, max_sem + 1)
    return max(computed, ciclo_val)


def _overlaps(a_start, a_end, b_start, b_end):
    return a_end > b_start and b_end > a_start


def _detect_schedule_conflicts(sections):
    events = []
    for sec in sections:
        for sl in sec.schedule_slots.all():
            events.append((int(sl.weekday), sl.start, sl.end, sec.id))

    conflicts = []
    by_day    = {}
    for wd, st, en, sid in events:
        by_day.setdefault(wd, []).append((st, en, sid))

    for wd, items in by_day.items():
        items.sort(key=lambda x: x[0])
        for i in range(len(items) - 1):
            st1, en1, s1 = items[i]
            st2, en2, s2 = items[i + 1]
            if s1 == s2:
                continue
            if _overlaps(st1, en1, st2, en2):
                conflicts.append({
                    "type":    "OVERLAP",
                    "weekday": wd,
                    "a":       s1,
                    "b":       s2,
                    "message": (
                        f"Choque de horario (día {INT_TO_DAY.get(wd, wd)}) "
                        f"entre secciones {s1} y {s2}"
                    ),
                })
    return conflicts


def _pick_sections_for_pcs(plan_course_ids, academic_period: str, sections_map: dict):
    if not isinstance(sections_map, dict):
        sections_map = {}

    sections = list(
        Section.objects
        .prefetch_related("schedule_slots")
        .filter(plan_course_id__in=plan_course_ids, period=academic_period)
        .order_by("plan_course_id", "label", "id")
    )

    secs_by_pc = {}
    for s in sections:
        secs_by_pc.setdefault(s.plan_course_id, []).append(s)

    chosen = {}
    for pcid in plan_course_ids:
        raw_sec_id = sections_map.get(str(pcid)) or sections_map.get(pcid)
        sec_id = None
        if raw_sec_id is not None and str(raw_sec_id).strip():
            try:
                sec_id = int(raw_sec_id)
            except Exception:
                sec_id = None

        picked = None
        if sec_id:
            picked = next((x for x in secs_by_pc.get(pcid, []) if x.id == sec_id), None)
        if not picked:
            arr = secs_by_pc.get(pcid, [])
            picked = arr[0] if arr else None
        if picked:
            chosen[pcid] = picked

    return chosen


def _assert_enrollment_window(period_code: str, st=None):
    p = _period_obj(period_code, auto_create=True)
    if not p:
        return False, "PERIODO_INVALIDO"
    # Alumno de SUBSANACIÓN (padrón): manda su propia ventana. Con fechas
    # configuradas puede matricularse aunque la regular esté cerrada; sin
    # configurar, se matricula en las ventanas regulares.
    if st is not None and (getattr(st, "estado_academico", "") or "") == "SUBSANACION":
        if p.subsanacion_window_open():
            return True, "SUBSANACION"
        return False, "MATRICULA_SUBSANACION_FUERA_DE_FECHA"
    status = p.enrollment_status()
    if status == "CLOSED":
        return False, "MATRICULA_FUERA_DE_FECHA"
    return True, status


def _validate_enrollment_payload(request, st, academic_period, plan_course_ids, sections_map):
    ok_win, win_code = _assert_enrollment_window(academic_period, st)
    if not ok_win:
        return Response(
            {"errors": [win_code], "warnings": [], "schedule_conflicts": []},
            status=409,
        )

    if not st.plan_id:
        pid = _resolve_plan_for_student(st)
        if not pid:
            return Response(
                {"errors": ["SIN_PLAN"], "warnings": [], "schedule_conflicts": []},
                status=409,
            )

    pcs = list(
        PlanCourse.objects.select_related("course")
        .filter(id__in=plan_course_ids, plan_id=st.plan_id)
    )
    found   = {pc.id for pc in pcs}
    missing = [x for x in plan_course_ids if x not in found]
    if missing:
        return Response(
            {"errors": [f"PLAN_COURSE_INVALIDO:{missing}"], "warnings": [], "schedule_conflicts": []},
            status=409,
        )

    approved_ids, approved_names = _approved_info(st)

    inst       = InstitutionSettings.objects.filter(id=1).first()
    max_normal = int(getattr(inst, "max_credits_normal",       22) or 22)
    min_normal = int(getattr(inst, "min_credits_normal",       12) or 12)
    max_third  = int(getattr(inst, "max_credits_third_attempt", 11) or 11)

    plan_max = _max_credits_from_plan(st.plan_id)
    if plan_max > max_normal:
        max_normal = plan_max

    total_credits = sum(int(pc.credits or 0) for pc in pcs)
    has_third     = any(_is_third_attempt(st, pc) for pc in pcs)
    max_credits   = max_third if has_third else max_normal

    errors, warnings = [], []

    if total_credits > max_credits:
        errors.append(f"EXCESO_CREDITOS:{total_credits}>{max_credits}")
    if total_credits < min_normal:
        warnings.append(f"MINIMO_CREDITOS:{total_credits}<{min_normal}")

    for pc in pcs:
        if _is_course_approved(pc, approved_ids, approved_names):
            errors.append(f"YA_APROBADO:{pc.display_code or pc.course.code}")
        if not _prereqs_met(pc.id, approved_ids, approved_names):
            errors.append(f"FALTA_PRERREQUISITOS:{pc.display_code or pc.course.code}")

    chosen      = _pick_sections_for_pcs(plan_course_ids, academic_period, sections_map)
    conflicts   = []

    if chosen:
        conflicts = _detect_schedule_conflicts(list(chosen.values()))
        if conflicts:
            errors.append("CHOQUE_HORARIO")

    if errors:
        return Response(
            {
                "errors":            errors,
                "warnings":          warnings,
                "schedule_conflicts": conflicts,
                "max_credits":       max_credits,
            },
            status=409,
        )
    return None


def _slots_for_section(section: Section):
    out = []
    for s in section.schedule_slots.all().order_by("weekday", "start"):
        out.append({
            "day":   INT_TO_DAY.get(int(s.weekday), str(s.weekday)),
            "start": str(s.start)[:5],
            "end":   str(s.end)[:5],
        })
    return out


def _dummy_pdf_response(filename="documento.pdf"):
    buf = BytesIO(b"%PDF-1.4\n% Dummy PDF\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n")
    return FileResponse(buf, as_attachment=True, filename=filename)


def _esc_html(v) -> str:
    """Escapa texto para incrustarlo en el HTML que se convierte a PDF."""
    from html import escape
    return escape(str(v if v is not None else ""))


def _constancia_shell(titulo: str, inst: dict, cuerpo: str) -> str:
    """Membrete institucional + cuerpo, listo para `html_to_pdf_bytes`."""
    nombre = _esc_html(inst.get("name") or "")
    sub = _esc_html(inst.get("institution_name") or "")
    cod = _esc_html(inst.get("modular_code") or "")
    dirn = _esc_html(inst.get("address") or "")
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page {{ size: A4; margin: 18mm 16mm; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: Arial, Helvetica, sans-serif; font-size: 11px;
          color: #111; margin: 0; }}
  .head {{ text-align: center; border-bottom: 2px solid #1F4E79;
           padding-bottom: 6px; margin-bottom: 14px; }}
  .head h1 {{ font-size: 13px; margin: 0; color: #1F4E79; }}
  .head h2 {{ font-size: 12px; margin: 1px 0 0; color: #1F4E79; }}
  .head p {{ margin: 2px 0 0; font-size: 9px; color: #444; }}
  .titulo {{ text-align: center; font-size: 15px; font-weight: bold;
             letter-spacing: 2px; margin: 16px 0 14px; }}
  .titulo2 {{ text-align: center; font-weight: bold; letter-spacing: 1px;
              margin: 12px 0; }}
  .parrafo {{ text-align: justify; line-height: 1.6; margin: 8px 0; }}
  table {{ border-collapse: collapse; width: 100%; margin: 12px 0; }}
  th, td {{ border: 1px solid #555; padding: 3px 5px; font-size: 10px; }}
  th {{ background: #1F4E79; color: #fff; }}
  .c {{ text-align: center; }}
  .fecha {{ text-align: right; margin-top: 22px; }}
  .firma {{ margin-top: 52px; text-align: center; }}
  .firma .linea {{ display: inline-block; border-top: 1px solid #111;
                   padding-top: 4px; min-width: 260px; font-weight: bold; }}
  .firma .chico {{ font-weight: normal; font-size: 9px; }}
</style></head><body>
<div class="head">
  <h1>{nombre}</h1>
  <h2>{sub}</h2>
  <p>{dirn}{' · Código Modular ' + cod if cod else ''}</p>
</div>
<div class="titulo">{_esc_html(titulo)}</div>
{cuerpo}
</body></html>"""


def _extract_ids_from_body(body: dict) -> list:
    raw = body.get("plan_course_ids") or body.get("course_ids") or []
    if not isinstance(raw, list) or not raw:
        return []
    try:
        return [int(x) for x in raw]
    except Exception:
        return []


def _extract_student_params(body: dict):
    dni        = (body.get("dni") or "").strip() or None
    student_id = None
    raw_sid    = body.get("student_id")
    if raw_sid is not None and str(raw_sid).strip():
        try:
            student_id = int(raw_sid)
        except (ValueError, TypeError):
            student_id = None
    return dni, student_id


# ══════════════════════════════════════════════════════════════
#  VISTA: STUDENTS OVERVIEW
#  GET /academic/enrollments/students-overview
# ══════════════════════════════════════════════════════════════

class StudentsOverviewView(APIView):
    """
    GET /academic/enrollments/students-overview

    Devuelve TODOS los estudiantes con su estado de matrícula
    en el período solicitado.

    Query params:
        academic_period  str  (requerido)   ej: "2026-I"
        search           str  (opcional)    filtra por nombre o DNI
        career_id        int  (opcional)    filtra por carrera (a través del plan)
        page             int  (opcional, default 1)
        page_size        int  (opcional, default 200, max 500)

    Response incluye:
        total           int  — total de alumnos (con filtros aplicados)
        enrolled_count  int  — alumnos con matrícula activa en el período
        pending_count   int  — alumnos sin matrícula en el período
        students        list — página de alumnos
    """
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request):
        if not _can_admin_enroll(request.user):
            return Response({"detail": "No autorizado."}, status=403)

        academic_period = (
            request.query_params.get("academic_period") or _guess_default_period_code()
        ).strip()

        search    = (request.query_params.get("search") or "").strip()
        career_id = request.query_params.get("career_id")

        try:
            page      = max(1, int(request.query_params.get("page", 1)))
            page_size = min(500, max(1, int(request.query_params.get("page_size", 200))))
        except (ValueError, TypeError):
            page, page_size = 1, 200

        # ── 1. Base queryset ──────────────────────────────────
        qs = StudentProfile.objects.select_related("plan", "plan__career")

        # Solo mostrar estudiantes con rol STUDENT (excluir admins, secretarias, etc.)
        qs = qs.filter(user__user_roles__role__name="STUDENT")

        if hasattr(StudentProfile, "is_active"):
            qs = qs.filter(is_active=True)

        if career_id:
            try:
                qs = qs.filter(plan__career_id=int(career_id))
            except (ValueError, TypeError):
                pass

        # Filtro por ciclo del alumno (1-10)
        ciclo = request.query_params.get("ciclo")
        if ciclo:
            try:
                qs = qs.filter(ciclo=int(ciclo))
            except (ValueError, TypeError):
                pass

        # Filtro por año académico (1°=ciclos 1-2, 2°=3-4, … 5°=9-10)
        anio = request.query_params.get("anio")
        if anio:
            try:
                n = int(anio)
                qs = qs.filter(ciclo__in=[2 * n - 1, 2 * n])
            except (ValueError, TypeError):
                pass

        if search:
            qs = qs.filter(
                Q(num_documento__icontains=search)
                | Q(apellido_paterno__icontains=search)
                | Q(apellido_materno__icontains=search)
                | Q(nombres__icontains=search)
            )

        # ── 2. Subqueries de matrícula en el período ──────────
        enrollment_id_subq = (
            Enrollment.objects
            .filter(
                student_id=OuterRef("pk"),
                period=academic_period,
            )
            .exclude(status=Enrollment.STATUS_CANCELLED)
            .values("id")[:1]
        )

        enrolled_courses_subq = (
            EnrollmentItem.objects
            .filter(
                enrollment__student_id=OuterRef("pk"),
                enrollment__period=academic_period,
            )
            .exclude(enrollment__status=Enrollment.STATUS_CANCELLED)
            .values("enrollment__student_id")
            .annotate(cnt=Count("id"))
            .values("cnt")[:1]
        )

        enrolled_credits_subq = (
            EnrollmentItem.objects
            .filter(
                enrollment__student_id=OuterRef("pk"),
                enrollment__period=academic_period,
            )
            .exclude(enrollment__status=Enrollment.STATUS_CANCELLED)
            .values("enrollment__student_id")
            .annotate(total=Coalesce(Sum("credits"), 0, output_field=IntegerField()))
            .values("total")[:1]
        )

        # Semestre máximo de los cursos matriculados en el período
        enrolled_semester_subq = (
            EnrollmentItem.objects
            .filter(
                enrollment__student_id=OuterRef("pk"),
                enrollment__period=academic_period,
            )
            .exclude(enrollment__status=Enrollment.STATUS_CANCELLED)
            .values("enrollment__student_id")
            .annotate(max_sem=Max("plan_course__semester"))
            .values("max_sem")[:1]
        )

        qs = qs.annotate(
            _enrollment_id=Subquery(enrollment_id_subq),
            _enrolled_courses=Coalesce(
                Subquery(enrolled_courses_subq, output_field=IntegerField()), 0
            ),
            _enrolled_credits=Coalesce(
                Subquery(enrolled_credits_subq, output_field=IntegerField()), 0
            ),
            _enrolled_semester=Subquery(enrolled_semester_subq, output_field=IntegerField()),
        )

        # ── 3. Totales antes de paginar ───────────────────────
        # Estos counts reflejan los filtros (search, career_id) pero NO la paginación,
        # por eso el frontend puede mostrar los totales correctos en todos los casos.
        total          = qs.count()
        enrolled_count = qs.filter(_enrollment_id__isnull=False).count()
        pending_count  = qs.filter(_enrollment_id__isnull=True).count()

        # ── 3b. Filtro de tab (enrolled=true/false) ───────────
        # Se aplica DESPUÉS de computar los totales para que las tarjetas
        # sigan mostrando el total real y no el subconjunto filtrado.
        enrolled_filter = request.query_params.get("enrolled")
        if enrolled_filter == "true":
            qs = qs.filter(_enrollment_id__isnull=False)
            total = enrolled_count  # para la paginación del tab
        elif enrolled_filter == "false":
            qs = qs.filter(_enrollment_id__isnull=True)
            total = pending_count

        # ── 4. Paginación ─────────────────────────────────────
        offset = (page - 1) * page_size
        students_page = qs.order_by(
            "apellido_paterno", "apellido_materno", "nombres"
        )[offset: offset + page_size]

        # ── 5. Pre-calcular egresados en batch ────────────────
        # Obtener todos los cursos aprobados de los alumnos de esta página
        student_ids = [st.id for st in students_page]
        plan_ids = set(st.plan_id for st in students_page if st.plan_id)

        # Cursos por plan
        plan_courses_map = {}  # plan_id → list of PlanCourse
        if plan_ids:
            for pc in PlanCourse.objects.select_related("course").filter(plan_id__in=plan_ids):
                plan_courses_map.setdefault(pc.plan_id, []).append(pc)

        # Mejores notas por alumno
        student_approved = {}  # student_id → (approved_ids set, approved_names set)
        if student_ids:
            grade_recs = (
                AcademicGradeRecord.objects
                .filter(student_id__in=student_ids)
                .values_list("student_id", "course_id", "final_grade", "course__name")
            )
            best_by_student = {}  # student_id → {course_id: (grade, name)}
            for sid, cid, fg, cname in grade_recs:
                try:
                    g = float(fg) if fg is not None else None
                except Exception:
                    g = None
                bst = best_by_student.setdefault(sid, {})
                prev = bst.get(cid)
                if prev is None or (g is not None and (prev[0] is None or g > prev[0])):
                    bst[cid] = (g, (cname or "").strip().upper())

            for sid, courses in best_by_student.items():
                a_ids = set()
                a_names = set()
                for cid, (g, nm) in courses.items():
                    if g is not None and g >= PASSING_GRADE:
                        a_ids.add(cid)
                        if nm:
                            a_names.add(nm)
                student_approved[sid] = (a_ids, a_names)

        def _is_egresado(st):
            if not st.plan_id:
                return False
            pcs = plan_courses_map.get(st.plan_id, [])
            if not pcs:
                return False
            a_ids, a_names = student_approved.get(st.id, (set(), set()))
            for pc in pcs:
                if pc.course_id in a_ids:
                    continue
                pc_name = (getattr(pc, "display_name", "") or getattr(pc.course, "name", "") or "").strip().upper()
                if pc_name and pc_name in a_names:
                    continue
                return False
            return True

        # ── 5b. Tipo de matrícula de la página (en batch) ─────
        # Guardado en la matrícula del período; si aún no se fijó (matrículas
        # previas a la migración), se deriva con las mismas reglas del modelo.
        tipo_map = dict(
            Enrollment.objects
            .filter(student_id__in=student_ids, period=academic_period)
            .exclude(status=Enrollment.STATUS_CANCELLED)
            .values_list("student_id", "tipo_matricula"))
        con_historia = set(
            Enrollment.objects
            .filter(student_id__in=student_ids, status=Enrollment.STATUS_CONFIRMED)
            .exclude(period=academic_period)
            .values_list("student_id", flat=True)
        ) | set(
            AcademicGradeRecord.objects
            .filter(student_id__in=student_ids)
            .exclude(term=academic_period)
            .values_list("student_id", flat=True))
        ESPECIALES = {Enrollment.TIPO_SUBSANACION, Enrollment.TIPO_TRASLADO,
                      Enrollment.TIPO_REINCORPORACION}

        def _tipo_de(st):
            if st._enrollment_id is None:
                return ""
            guardado = tipo_map.get(st.id) or ""
            if guardado:
                return guardado
            est = (getattr(st, "estado_academico", "") or "").upper()
            if est in ESPECIALES:
                return est
            return (Enrollment.TIPO_REGULAR if st.id in con_historia
                    else Enrollment.TIPO_INGRESANTE)

        # ── 6. Serializar ─────────────────────────────────────
        result = []
        for st in students_page:
            full_name = " ".join(filter(None, [
                getattr(st, "apellido_paterno", "") or "",
                getattr(st, "apellido_materno", "") or "",
                getattr(st, "nombres", "") or "",
            ])).strip()

            career_name   = ""
            career_id_val = None
            if st.plan_id and st.plan:
                try:
                    career_name   = st.plan.career.name if st.plan.career else ""
                    career_id_val = st.plan.career_id
                except Exception:
                    career_name = ""

            # Ciclo: si está matriculado en el período, usar el semestre máximo
            # de sus cursos matriculados; si no, usar st.ciclo como referencia.
            enrolled_sem = getattr(st, "_enrolled_semester", None)
            if enrolled_sem is not None:
                semester = int(enrolled_sem)
            else:
                try:
                    semester = max(1, int(st.ciclo or 1))
                except Exception:
                    semester = None

            egresado = _is_egresado(st)

            result.append({
                "id":                     st.id,
                "full_name":              full_name,
                "dni":                    st.num_documento or "",
                "num_documento":          st.num_documento or "",
                "career_name":            career_name,
                "career_id":              career_id_val,
                "plan_name":              st.plan.name if st.plan_id and st.plan else "",
                "plan_id":                st.plan_id,
                "semester":               semester,
                "is_enrolled":            st._enrollment_id is not None,
                "is_egresado":            egresado,
                "enrollment_id":          st._enrollment_id,
                "enrolled_courses_count": st._enrolled_courses,
                "enrolled_credits":       st._enrolled_credits,
                "estado_academico":       getattr(st, "estado_academico", "") or "",
                "estado_rd":              getattr(st, "estado_rd", "") or "",
                "tipo_matricula":         _tipo_de(st),
            })

        return ok(
            academic_period=academic_period,
            total=total,
            enrolled_count=enrolled_count,   # ← NUEVO: total matriculados con filtros
            pending_count=pending_count,     # ← NUEVO: total pendientes con filtros
            page=page,
            page_size=page_size,
            students=result,
        )


# ══════════════════════════════════════════════════════════════
#  VISTA: LISTA DE PERÍODOS ACADÉMICOS
# ══════════════════════════════════════════════════════════════

class AcademicPeriodsListView(APIView):
    """
    GET /academic/periods
    Lista todos los períodos académicos con su estado de ventana actual.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request):
        periods = AcademicPeriod.objects.all().order_by("-code")
        data = []
        for p in periods:
            data.append({
                "code":                  p.code,
                "start":                 str(p.start),
                "end":                   str(p.end),
                "enrollment_status":     p.enrollment_status(),
                "is_enrollment_open":    p.is_enrollment_open(),
                "enrollment_start":      p.enrollment_start.isoformat()    if p.enrollment_start    else None,
                "enrollment_end":        p.enrollment_end.isoformat()      if p.enrollment_end      else None,
                "extemporary_start":     p.extemporary_start.isoformat()   if p.extemporary_start   else None,
                "extemporary_end":       p.extemporary_end.isoformat()     if p.extemporary_end     else None,
                "extemporary_surcharge": float(p.extemporary_surcharge or 0),
            })
        return ok(periods=data)

    def post(self, request):
        if not _can_admin_enroll(request.user):
            return Response({"detail": "No autorizado."}, status=403)

        data = request.data or {}
        code  = (data.get("code") or "").strip().upper()
        start = data.get("start")
        end   = data.get("end")

        if not code:
            return Response({"detail": "El campo 'code' es requerido (ej: 2026-I)"}, status=400)
        if not start or not end:
            return Response({"detail": "Los campos 'start' y 'end' son requeridos"}, status=400)
        if AcademicPeriod.objects.filter(code=code).exists():
            return Response({"detail": f"Ya existe un período con código {code!r}"}, status=400)

        try:
            from datetime import date
            from django.utils.dateparse import parse_date
            start_date = parse_date(str(start))
            end_date   = parse_date(str(end))
            if not start_date or not end_date:
                raise ValueError("Fechas inválidas")
            if end_date < start_date:
                return Response({"detail": "La fecha de fin no puede ser anterior a la de inicio"}, status=400)
        except Exception as e:
            return Response({"detail": f"Fechas inválidas: {e}"}, status=400)

        p = AcademicPeriod.objects.create(code=code, start=start_date, end=end_date)
        return Response({
            "code":  p.code,
            "start": str(p.start),
            "end":   str(p.end),
            "enrollment_status": p.enrollment_status(),
        }, status=201)


# ══════════════════════════════════════════════════════════════
#  VISTA: VENTANA DE MATRÍCULA (GET + PUT)
# ══════════════════════════════════════════════════════════════

class AcademicPeriodEnrollmentWindowView(APIView):
    """
    GET  /academic/periods/{code}/enrollment-window
    PUT  /academic/periods/{code}/enrollment-window
    """
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request, code: str):
        p = _period_obj(code, auto_create=True)
        if not p:
            return Response({"detail": f"Código de período inválido: '{code}'"}, status=400)
        return ok(code=p.code, **_window_info_for_period(p))

    def put(self, request, code: str):
        if not _can_admin_enroll(request.user):
            return Response({"detail": "No autorizado."}, status=403)

        p = _period_obj(code, auto_create=True)
        if not p:
            return Response({"detail": f"Código de período inválido: '{code}'"}, status=400)

        data = request.data or {}

        def _parse_dt(key):
            val = data.get(key)
            if not val:
                return None
            dt = parse_datetime(str(val))
            if dt and timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            return dt

        dt_start     = _parse_dt("enrollment_start")
        dt_end       = _parse_dt("enrollment_end")
        dt_ext_start = _parse_dt("extemporary_start")
        dt_ext_end   = _parse_dt("extemporary_end")
        dt_sub_start = _parse_dt("subsanacion_start")
        dt_sub_end   = _parse_dt("subsanacion_end")

        if dt_start and dt_end and dt_end < dt_start:
            return Response({"detail": "enrollment_end no puede ser anterior a enrollment_start"}, status=400)
        if dt_ext_start and dt_ext_end and dt_ext_end < dt_ext_start:
            return Response({"detail": "extemporary_end no puede ser anterior a extemporary_start"}, status=400)
        if dt_start and dt_end and dt_ext_start and dt_ext_start < dt_end:
            return Response({"detail": "La ventana extemporánea debe iniciar después de que termine la ordinaria"}, status=400)
        if dt_sub_start and dt_sub_end and dt_sub_end < dt_sub_start:
            return Response({"detail": "subsanacion_end no puede ser anterior a subsanacion_start"}, status=400)
        if bool(dt_sub_start) != bool(dt_sub_end):
            return Response({"detail": "La ventana de subsanación necesita inicio y fin (o ninguno)"}, status=400)

        surcharge     = 0
        raw_surcharge = data.get("extemporary_surcharge")
        if raw_surcharge is not None:
            try:
                surcharge = float(raw_surcharge)
                if surcharge < 0:
                    return Response({"detail": "extemporary_surcharge no puede ser negativo"}, status=400)
            except (ValueError, TypeError):
                return Response({"detail": "extemporary_surcharge debe ser un número"}, status=400)

        p.enrollment_start        = dt_start
        p.enrollment_end          = dt_end
        p.extemporary_start       = dt_ext_start
        p.extemporary_end         = dt_ext_end
        p.extemporary_surcharge   = surcharge
        p.subsanacion_start       = dt_sub_start
        p.subsanacion_end         = dt_sub_end
        p.save()

        return ok(success=True, code=p.code, **_window_info_for_period(p))


# ══════════════════════════════════════════════════════════════
#  CURSOS DISPONIBLES
# ══════════════════════════════════════════════════════════════

class AvailableCoursesView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request):
        plan_id         = request.query_params.get("plan_id")
        semester        = request.query_params.get("semester")
        q               = (request.query_params.get("q") or "").strip()
        academic_period = (
            request.query_params.get("academic_period") or _guess_default_period_code()
        ).strip()

        qs = PlanCourse.objects.select_related("plan", "course").all()
        if plan_id:
            try:
                qs = qs.filter(plan_id=int(plan_id))
            except Exception:
                return ok(courses=[])
        if semester:
            try:
                qs = qs.filter(semester=int(semester))
            except Exception:
                return ok(courses=[])
        if q:
            qs = qs.filter(
                Q(display_code__icontains=q) | Q(display_name__icontains=q) |
                Q(course__code__icontains=q) | Q(course__name__icontains=q)
            )

        qs              = qs.order_by("course__code")
        plan_course_ids = list(qs.values_list("id", flat=True))

        sections = (
            Section.objects
            .select_related("plan_course__course")
            .prefetch_related("schedule_slots")
            .filter(plan_course_id__in=plan_course_ids, period=academic_period)
            .order_by("plan_course_id", "label", "id")
        )

        secs_by_pc = {}
        for s in sections:
            secs_by_pc.setdefault(s.plan_course_id, []).append(s)

        def slots_to_str(sec):
            parts = []
            for sl in sec.schedule_slots.all().order_by("weekday", "start"):
                day = INT_TO_DAY.get(int(sl.weekday), str(sl.weekday))
                parts.append(f"{day} {str(sl.start)[:5]}-{str(sl.end)[:5]}")
            return ", ".join(parts)

        courses = []
        for pc in qs:
            secs  = secs_by_pc.get(pc.id, [])
            parts = [f"{s.label}: {slots_to_str(s)}" for s in secs[:3] if slots_to_str(s)]
            courses.append({
                "id":       pc.id,
                "code":     pc.display_code or pc.course.code,
                "name":     pc.display_name or pc.course.name,
                "credits":  int(pc.credits or 0),
                "schedule": " | ".join(parts),
            })
        return ok(courses=courses)


# ══════════════════════════════════════════════════════════════
#  MATRÍCULA: AVAILABLE
# ══════════════════════════════════════════════════════════════

class EnrollmentAvailableView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request):
        academic_period = (
            request.query_params.get("academic_period") or _guess_default_period_code()
        ).strip()
        dni = (request.query_params.get("dni") or "").strip() or None

        st, err = _resolve_student_from_request(request, dni=dni)
        if err:
            return err

        if not st.plan_id:
            pid = _resolve_plan_for_student(st)
            if not pid:
                return Response({"detail": "El estudiante no tiene plan asignado."}, status=409)

        per = _period_obj(academic_period, auto_create=True)
        if not per:
            return Response({"detail": f"Código de período inválido: '{academic_period}'"}, status=400)

        approved_ids, approved_names = _approved_info(st)
        current_sem = _current_semester(st)

        pcs = list(
            PlanCourse.objects.select_related("course")
            .filter(plan_id=st.plan_id)
            .order_by("semester", "course__code")
        )
        pc_ids = [pc.id for pc in pcs]

        sections = list(
            Section.objects
            .select_related("plan_course__course", "teacher__user")
            .prefetch_related("schedule_slots")
            .filter(plan_course_id__in=pc_ids, period=academic_period)
            .order_by("plan_course_id", "label", "id")
        )
        secs_by_pc = {}
        for s in sections:
            secs_by_pc.setdefault(s.plan_course_id, []).append(s)

        existing = (
            Enrollment.objects
            .filter(student=st, period=academic_period)
            .exclude(status="CANCELLED")
            .first()
        )
        enrolled_pc_ids = (
            set(existing.items.values_list("plan_course_id", flat=True))
            if existing else set()
        )

        def slots(sec):
            return [
                {
                    "day":   INT_TO_DAY.get(int(sl.weekday), str(sl.weekday)),
                    "start": str(sl.start)[:5],
                    "end":   str(sl.end)[:5],
                }
                for sl in sec.schedule_slots.all().order_by("weekday", "start")
            ]

        # ── Ciclo registrado del alumno (campo student.ciclo) ──
        student_ciclo = 0
        try:
            student_ciclo = max(0, int(getattr(st, "ciclo", 0) or 0))
        except (ValueError, TypeError):
            student_ciclo = 0

        # ── Detectar egresado: si TODOS los cursos del plan están aprobados ──
        total_plan_courses = sum(1 for pc in pcs if int(pc.semester or 0) > 0)
        approved_plan_courses = sum(
            1 for pc in pcs
            if int(pc.semester or 0) > 0 and _is_course_approved(pc, approved_ids, approved_names)
        )
        is_egresado = (total_plan_courses > 0 and approved_plan_courses >= total_plan_courses)

        out_courses = []
        for pc in pcs:
            sem = int(pc.semester or 0)
            if sem <= 0:
                continue

            if _is_course_approved(pc, approved_ids, approved_names):
                continue

            if sem > current_sem:
                continue

            attempts  = _attempts_for_course(st, pc)
            is_failed = attempts > 0

            # ── Filtro: mostrar solo cursos del ciclo actual + jalados ──
            # Cursos de ciclos anteriores solo se muestran si fueron intentados (jalados)
            if student_ciclo > 0 and sem < student_ciclo and not is_failed:
                continue

            enabled = True
            reason  = ""

            if pc.id in enrolled_pc_ids:
                enabled, reason = False, "YA_MATRICULADO_EN_PERIODO"
            elif not _prereqs_met(pc.id, approved_ids, approved_names):
                enabled, reason = False, "FALTA_PRERREQUISITOS"

            out_courses.append({
                "id":             pc.id,
                "plan_course_id": pc.id,
                "course_id":      pc.course.id,
                "code":           pc.display_code or pc.course.code,
                "name":           pc.display_name or pc.course.name,
                "semester":       sem,
                "is_backlog":     sem < current_sem,
                "is_current":     sem == current_sem,
                "is_failed":      is_failed,
                "attempts":       attempts,
                "is_third_attempt": attempts >= 2,
                "credits":        int(pc.credits or 0),
                "weekly_hours":   int(pc.weekly_hours or 0),
                "enabled":        enabled,
                "blocked_reason": reason,
                "sections": [
                    {
                        "id":           s.id,
                        "label":        s.label,
                        "teacher_name": (
                            _get_full_name(getattr(s.teacher, "user", None))
                            if s.teacher else ""
                        ),
                        "capacity": s.capacity,
                        "slots":    slots(s),
                    }
                    for s in secs_by_pc.get(pc.id, [])
                ],
            })

        student_name = " ".join(filter(None, [
            getattr(st, "apellido_paterno", ""),
            getattr(st, "apellido_materno", ""),
            getattr(st, "nombres", ""),
        ])).strip()

        # ── Payment gate info ──
        _paid, _pay_info = check_enrollment_payment(st, academic_period)

        # ── Max credits ──
        inst       = InstitutionSettings.objects.filter(id=1).first()
        max_normal = int(getattr(inst, "max_credits_normal",       22) or 22)
        max_third  = int(getattr(inst, "max_credits_third_attempt", 11) or 11)
        plan_max   = _max_credits_from_plan(st.plan_id)
        if plan_max > max_normal:
            max_normal = plan_max
        has_third_in_selection = any(c.get("is_third_attempt") for c in out_courses)
        _max_credits = max_third if has_third_in_selection else max_normal

        return ok(
            student={
                "id":            st.id,
                "student_id":    st.id,
                "dni":           st.num_documento,
                "full_name":     student_name,
                "name":          student_name,
                "num_documento": st.num_documento,
                "plan_id":       st.plan_id,
                "plan_name":     st.plan.name if st.plan else "",
                "ciclo":         student_ciclo,
            },
            academic_period=academic_period,
            enrollment_window=_window_info_for_period(per),
            payment_status=_pay_info,
            current_semester=current_sem,
            is_egresado=is_egresado,
            is_enrolled=(existing is not None and existing.status == Enrollment.STATUS_CONFIRMED),
            enrollment_id=existing.id if existing else None,
            total_plan_courses=total_plan_courses,
            approved_plan_courses=approved_plan_courses,
            courses=out_courses,
            max_credits=_max_credits,
        )


# ══════════════════════════════════════════════════════════════
#  MATRÍCULA: VALIDATE
# ══════════════════════════════════════════════════════════════

class EnrollmentValidateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def post(self, request):
        body            = request.data or {}
        academic_period = (body.get("academic_period") or "").strip() or _guess_default_period_code()
        plan_course_ids = _extract_ids_from_body(body)
        if not plan_course_ids:
            return Response(
                {"detail": "Envía plan_course_ids o course_ids (lista no vacía)"},
                status=400,
            )

        dni, student_id = _extract_student_params(body)
        sections_map    = body.get("sections") or {}
        if not isinstance(sections_map, dict):
            sections_map = {}

        st, err = _resolve_student_from_request(request, dni=dni, student_id=student_id)
        if err:
            return err

        # ── Payment gate (solo estudiantes, admins bypass) ──
        if not _can_admin_enroll(request.user):
            _paid, _pay_info = check_enrollment_payment(st, academic_period)
            if not _paid:
                return Response(
                    {"detail": "PAGO_PENDIENTE", "payment_status": _pay_info},
                    status=409,
                )

        validate_resp = _validate_enrollment_payload(
            request=request,
            st=st,
            academic_period=academic_period,
            plan_course_ids=plan_course_ids,
            sections_map=sections_map,
        )
        if validate_resp is not None:
            return validate_resp

        pcs           = list(PlanCourse.objects.filter(id__in=plan_course_ids, plan_id=st.plan_id))
        total_credits = sum(int(pc.credits or 0) for pc in pcs)
        inst          = InstitutionSettings.objects.filter(id=1).first()
        max_normal    = int(getattr(inst, "max_credits_normal",       22) or 22)
        max_third     = int(getattr(inst, "max_credits_third_attempt", 11) or 11)

        plan_max = _max_credits_from_plan(st.plan_id)
        if plan_max > max_normal:
            max_normal = plan_max

        has_third   = any(_is_third_attempt(st, pc) for pc in pcs)
        max_credits = max_third if has_third else max_normal

        return ok(warnings=[], total_credits=total_credits, max_credits=max_credits)


# ══════════════════════════════════════════════════════════════
#  MATRÍCULA: SUGGESTIONS
# ══════════════════════════════════════════════════════════════

class EnrollmentSuggestionsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def post(self, request):
        body            = request.data or {}
        academic_period = (body.get("academic_period") or "").strip() or _guess_default_period_code()
        plan_course_ids = _extract_ids_from_body(body)
        if not plan_course_ids:
            return ok(suggestions=[])

        all_secs = list(
            Section.objects
            .select_related("plan_course__course", "teacher__user")
            .prefetch_related("schedule_slots")
            .filter(plan_course_id__in=plan_course_ids, period=academic_period)
            .order_by("plan_course_id", "label", "id")
        )

        chosen = {}
        by_pc  = {}
        for s in all_secs:
            by_pc.setdefault(s.plan_course_id, []).append(s)
            if s.plan_course_id not in chosen:
                chosen[s.plan_course_id] = s

        chosen_sections = list(chosen.values())
        base_conflicts  = _detect_schedule_conflicts(chosen_sections)
        if not base_conflicts:
            return ok(suggestions=[])

        conflict_pc_ids = set()
        for c in base_conflicts:
            a = next((s for s in chosen_sections if s.id == c["a"]), None)
            b = next((s for s in chosen_sections if s.id == c["b"]), None)
            if a:
                conflict_pc_ids.add(a.plan_course_id)
            if b:
                conflict_pc_ids.add(b.plan_course_id)

        suggestions = []
        for pc_id in conflict_pc_ids:
            current    = chosen.get(pc_id)
            candidates = [s for s in by_pc.get(pc_id, []) if (not current or s.id != current.id)]
            others     = [s for s in chosen_sections if s.plan_course_id != pc_id]

            for cand in candidates:
                if _detect_schedule_conflicts(others + [cand]):
                    continue
                pc           = cand.plan_course
                crs          = pc.course
                teacher_name = (
                    _get_full_name(getattr(cand.teacher, "user", None))
                    if cand.teacher else ""
                )
                suggestions.append({
                    "plan_course_id": pc.id,
                    "course_id":      pc.id,
                    "course_code":    pc.display_code or crs.code,
                    "course_name":    pc.display_name or crs.name,
                    "credits":        int(pc.credits or 0),
                    "section_id":     cand.id,
                    "section_code":   cand.label,
                    "teacher_name":   teacher_name,
                    "slots":          _slots_for_section(cand),
                    "capacity":       cand.capacity,
                    "available":      cand.capacity,
                })
                break

        return ok(suggestions=suggestions)


# ══════════════════════════════════════════════════════════════
#  MATRÍCULA: COMMIT
# ══════════════════════════════════════════════════════════════

class EnrollmentCommitView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def post(self, request):
        body            = request.data or {}
        academic_period = (body.get("academic_period") or "").strip() or _guess_default_period_code()
        plan_course_ids = _extract_ids_from_body(body)
        if not plan_course_ids:
            return Response(
                {"detail": "Envía plan_course_ids o course_ids (lista no vacía)"},
                status=400,
            )

        dni, student_id = _extract_student_params(body)
        sections_map    = body.get("sections") or {}
        if not isinstance(sections_map, dict):
            sections_map = {}

        st, err = _resolve_student_from_request(request, dni=dni, student_id=student_id)
        if err:
            return err

        # ── Payment gate (doble seguridad, admins bypass) ──
        if not _can_admin_enroll(request.user):
            _paid, _pay_info = check_enrollment_payment(st, academic_period)
            if not _paid:
                return Response(
                    {"detail": "PAGO_PENDIENTE", "payment_status": _pay_info},
                    status=409,
                )

        validate_resp = _validate_enrollment_payload(
            request=request,
            st=st,
            academic_period=academic_period,
            plan_course_ids=plan_course_ids,
            sections_map=sections_map,
        )
        if validate_resp is not None:
            return validate_resp

        pcs     = list(
            PlanCourse.objects.select_related("course")
            .filter(id__in=plan_course_ids, plan_id=st.plan_id)
        )
        chosen  = _pick_sections_for_pcs(plan_course_ids, academic_period, sections_map)

        if chosen:
            conflicts = _detect_schedule_conflicts(list(chosen.values()))
            if conflicts:
                return Response(
                    {"detail": "Choque de horario", "schedule_conflicts": conflicts},
                    status=409,
                )

        with transaction.atomic():
            enrollment, _ = Enrollment.objects.get_or_create(student=st, period=academic_period)
            if enrollment.status == Enrollment.STATUS_CONFIRMED:
                return Response(
                    {"detail": "Ya existe una matrícula confirmada en este período."},
                    status=409,
                )

            EnrollmentItem.objects.filter(enrollment=enrollment).delete()

            total_credits = 0
            for pc in pcs:
                cr = int(pc.credits or 0)
                total_credits += cr
                EnrollmentItem.objects.create(
                    enrollment=enrollment,
                    plan_course=pc,
                    section=chosen.get(pc.id),
                    credits=cr,
                )

            enrollment.confirm()
            enrollment.total_credits = total_credits
            enrollment.save(update_fields=["total_credits"])

            # ── Actualización AUTOMÁTICA del ciclo y período del alumno ──
            # El ciclo del estudiante se deriva de su matrícula (semestre más
            # alto de los cursos confirmados); no se edita a mano.
            semestres = [int(pc.semester) for pc in pcs if pc.semester]
            campos = []
            if semestres:
                nuevo_ciclo = max(semestres)
                if (st.ciclo or 0) != nuevo_ciclo:
                    st.ciclo = nuevo_ciclo
                    campos.append("ciclo")
            if (st.periodo or "") != academic_period:
                st.periodo = academic_period
                campos.append("periodo")
            if campos:
                st.save(update_fields=campos)

        return ok(
            success=True,
            enrollment_id=enrollment.id,
            academic_period=academic_period,
            total_credits=total_credits,
            ciclo_actualizado=st.ciclo,
        )


# ══════════════════════════════════════════════════════════════
#  CERTIFICADO / HORARIO (STUBS PDF)
# ══════════════════════════════════════════════════════════════

class EnrollmentCertificateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request, enrollment_id: int):
        return ok(
            success=True,
            downloadUrl=f"/api/academic/enrollments/{enrollment_id}/certificate/pdf",
            download_url=f"/api/academic/enrollments/{enrollment_id}/certificate/pdf",
        )

    def post(self, request, enrollment_id: int):
        return self.get(request, enrollment_id)


class EnrollmentCertificatePDFView(APIView):
    """
    GET /academic/enrollments/<id>/certificate/pdf
    Constancia de matrícula del período: certifica que el alumno está
    matriculado y detalla los cursos en los que se inscribió.

    Antes devolvía `_dummy_pdf_response`, es decir un PDF falso de cinco
    líneas: el botón "descargaba" un archivo que ningún lector podía abrir.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request, enrollment_id: int):
        from .process_document_gen import _get_institution, _fecha, _to_roman
        from ..pdf_render import html_to_pdf_bytes
        from students.name_utils import nombre_oficial

        enr = (Enrollment.objects
               .select_related("student", "student__plan", "student__plan__career")
               .filter(id=enrollment_id).first())
        if not enr:
            return Response({"detail": "La matrícula no existe."}, status=404)
        if (enr.status or "").upper() == "CANCELLED":
            return Response(
                {"detail": "La matrícula está anulada: no se puede emitir constancia."},
                status=409)
        if (enr.status or "").upper() != "CONFIRMED":
            return Response(
                {"detail": "La matrícula aún no está confirmada. "
                           "Confírmala antes de emitir la constancia."},
                status=409)

        st = enr.student
        inst = _get_institution()

        items = list(enr.items
                     .select_related("plan_course__course", "section")
                     .order_by("plan_course__semester",
                               "plan_course__display_code", "id"))

        filas, total_cred = [], 0
        for n, it in enumerate(items, 1):
            pc = it.plan_course
            course = getattr(pc, "course", None)
            cred = int(getattr(pc, "credits", 0) or 0)
            total_cred += cred
            nombre = (getattr(pc, "display_name", "")
                      or getattr(course, "name", "") or "—")
            codigo = (getattr(pc, "display_code", "")
                      or getattr(course, "code", "") or "")
            filas.append(
                f"<tr><td class='c'>{n}</td><td class='c'>{_esc_html(codigo)}</td>"
                f"<td>{_esc_html(nombre.upper())}</td>"
                f"<td class='c'>{cred or ''}</td>"
                f"<td class='c'>{_esc_html(getattr(it.section, 'label', '') or '')}</td></tr>")

        if not filas:
            filas.append("<tr><td colspan='5' class='c'>"
                         "(sin cursos registrados en esta matrícula)</td></tr>")

        ciclo = st.ciclo or 0
        carrera = (st.plan.career.name if st.plan and st.plan.career
                   else (st.programa_carrera or "—"))

        cuerpo = f"""
<p class="parrafo">
  El (La) que suscribe, Secretario(a) Académico(a) del
  <b>{_esc_html(inst.get('institution_name') or inst.get('name') or '')}</b>,
</p>
<p class="titulo2">HACE CONSTAR:</p>
<p class="parrafo">
  Que el (la) estudiante <b>{_esc_html(nombre_oficial(st))}</b>, identificado(a)
  con DNI N° <b>{_esc_html(st.num_documento or '—')}</b>, se encuentra
  <b>MATRICULADO(A)</b> en el Programa de Estudios de
  <b>{_esc_html((carrera or '').upper())}</b>, ciclo
  <b>{_esc_html(_to_roman(ciclo) if str(ciclo).isdigit() else str(ciclo))}</b>,
  sección <b>"{_esc_html(st.seccion or 'A')}"</b>, turno
  <b>{_esc_html((st.turno or 'MAÑANA').upper())}</b>, durante el período
  académico <b>{_esc_html(enr.period or '')}</b>, con un total de
  <b>{len(items)}</b> curso(s) y <b>{total_cred}</b> crédito(s), según el
  detalle siguiente:
</p>
<table>
  <tr><th>N°</th><th>Código</th><th>Curso o Módulo</th>
      <th>Créditos</th><th>Sección</th></tr>
  {''.join(filas)}
</table>
<p class="parrafo">
  Se expide la presente constancia a solicitud del (de la) interesado(a),
  para los fines que estime conveniente.
</p>
<p class="fecha">{_esc_html(_fecha(inst))}</p>
<div class="firma"><span class="linea">SECRETARIO(A) ACADÉMICO(A)<br>
  <span class="chico">Firma, Post Firma y Sello</span></span></div>
"""
        html = _constancia_shell("CONSTANCIA DE MATRÍCULA", inst, cuerpo)
        try:
            pdf = html_to_pdf_bytes(html)
        except Exception as exc:
            logger.error(f"Constancia de matrícula enrollment={enrollment_id}: {exc}",
                         exc_info=True)
            return Response(
                {"detail": f"No se pudo generar el PDF de la constancia: {exc}"},
                status=500)

        dni = st.num_documento or st.id
        return HttpResponse(
            pdf, content_type="application/pdf",
            headers={"Content-Disposition":
                     f'attachment; filename="constancia-matricula-{dni}-{enr.period}.pdf"'})


class EnrollmentFichaView(APIView):
    """
    GET /academic/enrollments/<enrollment_id>/ficha
    Retorna URL de descarga de la ficha de matrícula individual.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request, enrollment_id: int):
        return ok(
            success=True,
            downloadUrl=f"/api/academic/enrollments/{enrollment_id}/ficha/pdf",
            download_url=f"/api/academic/enrollments/{enrollment_id}/ficha/pdf",
        )

    def post(self, request, enrollment_id: int):
        return self.get(request, enrollment_id)


class EnrollmentFichaPDFView(APIView):
    """
    GET /academic/enrollments/<enrollment_id>/ficha/pdf
    Genera y descarga la Ficha de Matrícula en PDF para un alumno.
    Intenta WeasyPrint primero; si no está instalado o falla, usa ReportLab.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request, enrollment_id: int):
        try:
            return self._generate(request, enrollment_id)
        except Exception as exc:
            import traceback
            tb = traceback.format_exc()
            logger.error(f"Ficha PDF enrollment={enrollment_id}: {exc}\n{tb}")
            return HttpResponse(
                f"Error generando ficha de matrícula:\n\n{exc}\n\n{tb}",
                content_type="text/plain; charset=utf-8",
                status=500,
            )

    def _generate(self, request, enrollment_id: int):
        from .process_document_gen import (
            _get_institution, _get_student, _get_enrolled_courses,
        )

        enrollment = Enrollment.objects.select_related("student").get(id=enrollment_id)
        st = enrollment.student
        student_data = _get_student(st.id)
        student_data["periodo"] = enrollment.period

        ciclo = None
        try:
            ciclo = int(student_data.get("ciclo", 0) or 0)
        except (ValueError, TypeError):
            pass

        # ── Usar cursos realmente matriculados si hay items ──
        items = list(
            enrollment.items
            .select_related("plan_course__course")
            .order_by("plan_course__semester", "plan_course__display_code", "id")
        )
        if items:
            courses = []
            for it in items:
                pc = it.plan_course
                course = pc.course
                from .utils import romanos_mayusculas
                courses.append({
                    "nombre":   romanos_mayusculas(
                        pc.display_name or (course.name if course else "—")),
                    "codigo":   pc.display_code or (course.code if course else ""),
                    "horas":    pc.weekly_hours or 0,
                    "creditos": it.credits or pc.credits or (course.credits if course else 0),
                    "ciclo":    pc.semester or 0,
                    "tipo":     pc.type or "MANDATORY",
                })
        else:
            courses = _get_enrolled_courses(student_data.get("plan_id"), ciclo)

        inst = _get_institution()
        extra = {
            "period":  enrollment.period,
            "cycle":   student_data.get("ciclo", ""),
            "section": student_data.get("seccion", "A"),
            "enrolled_courses": courses,
        }

        class _FakeProcess:
            def __init__(self, eid, sid=None):
                self.id = eid
                self.student_id = sid

        fake_proc = _FakeProcess(enrollment.id, st.id)

        # ── Intentar WeasyPrint ──
        pdf_buf = None
        try:
            from .ficha_matricula_generator import (
                generate_ficha_matricula_weasyprint, HAS_WEASYPRINT,
            )
            if HAS_WEASYPRINT:
                pdf_buf, _ = generate_ficha_matricula_weasyprint(
                    fake_proc, student_data, extra, inst, courses,
                )
        except Exception as exc:
            logger.warning(f"Ficha {enrollment_id}: WeasyPrint falló: {exc}")
            pdf_buf = None

        # ── Fallback: ReportLab Canvas (diseño profesional) ──
        if pdf_buf is None:
            try:
                from .ficha_matricula_generator import generate_ficha_matricula_reportlab
                pdf_buf = generate_ficha_matricula_reportlab(
                    fake_proc, student_data, extra, inst, courses,
                )
            except Exception as exc2:
                logger.warning(f"Ficha {enrollment_id}: ReportLab canvas falló: {exc2}")
                pdf_buf = None

        # ── Último fallback: ReportLab Platypus (legacy) ──
        if pdf_buf is None:
            from .process_document_gen import _get_styles, DOCUMENT_GENERATORS
            import io as _io
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.units import cm
            from reportlab.platypus import SimpleDocTemplate

            gen = DOCUMENT_GENERATORS.get("FICHA_MATRICULA")
            if not gen:
                raise RuntimeError("No hay generador FICHA_MATRICULA registrado")

            styles = _get_styles()
            story = gen(fake_proc, student_data, extra, styles, inst)
            pdf_buf = _io.BytesIO()
            doc = SimpleDocTemplate(
                pdf_buf, pagesize=A4,
                leftMargin=2.5 * cm, rightMargin=2.5 * cm,
                topMargin=2 * cm, bottomMargin=2 * cm,
            )
            doc.build(story)
            pdf_buf.seek(0)

        # ── Nombre del archivo ──
        ap_pat  = getattr(st, "apellido_paterno", "") or ""
        ap_mat  = getattr(st, "apellido_materno", "") or ""
        nombres = getattr(st, "nombres", "") or ""
        dni     = getattr(st, "num_documento", "") or ""
        safe    = f"{ap_pat}_{ap_mat}_{nombres}".strip("_").replace(" ", "_") or dni
        filename = f"FICHA-MATRICULA_{safe}_{dni}.pdf"

        content = pdf_buf.getvalue() if hasattr(pdf_buf, 'getvalue') else pdf_buf.read()
        return HttpResponse(
            content,
            content_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


class ScheduleExportView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def post(self, request):
        data   = request.data or {}
        period = (data.get("academic_period") or _guess_default_period_code()).strip()

        params = f"academic_period={period}"
        if data.get("student_id"):
            params += f"&student_id={data['student_id']}"
        if data.get("dni"):
            params += f"&dni={data['dni']}"

        url = f"/api/academic/schedules/export/pdf?{params}"
        return ok(
            success=True,
            downloadUrl=url,
            download_url=url,
        )


class ScheduleExportPDFView(APIView):
    """
    GET /academic/schedules/export/pdf[?academic_period][&student_id][&dni]
    Horario del alumno en PDF con REJILLA SEMANAL (formato "vida académica"):
    columnas Lunes–Domingo con los bloques de cada día (curso, hora, aula,
    docente, color por asignatura) y cuadro resumen con créditos.
    Antes era una tabla plana de cursos (reportlab); ahora usa el membrete
    institucional común (_pdf_shell) como el resto de documentos.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    DIAS = {1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves",
            5: "Viernes", 6: "Sábado", 7: "Domingo"}
    COLORES = ["#2563EB", "#059669", "#7C3AED", "#D97706",
               "#E11D48", "#0284C7", "#0D9488", "#EA580C"]

    def get(self, request):
        from html import escape as esc
        from django.http import HttpResponse
        from academic.pdf_render import html_to_pdf_bytes
        from .evaluation_pdf import _pdf_shell
        from .utils import romanos_mayusculas

        period     = (request.query_params.get("academic_period") or _guess_default_period_code()).strip()
        dni        = (request.query_params.get("dni") or "").strip() or None
        student_id = request.query_params.get("student_id") or None

        st, err = _resolve_student_from_request(request, dni=dni, student_id=student_id)
        if err:
            return err

        student_name = " ".join(filter(None, [
            getattr(st, "apellido_paterno", "") or "",
            getattr(st, "apellido_materno", "") or "",
            getattr(st, "nombres", "") or "",
        ])).strip()
        student_doc = st.num_documento or ""
        plan_name   = st.plan.name if st.plan_id and st.plan else ""

        enrollment = (
            Enrollment.objects
            .prefetch_related("items__plan_course__course", "items__section__schedule_slots")
            .filter(student=st, period=period)
            .exclude(status=Enrollment.STATUS_CANCELLED)
            .first()
        )

        cursos, por_dia = [], {i: [] for i in range(1, 8)}
        if enrollment:
            for item in enrollment.items.select_related(
                "plan_course__course", "plan_course",
                "section__teacher__user", "section__classroom",
            ).prefetch_related("section__schedule_slots").all():
                pc  = item.plan_course
                sec = item.section
                # Matrículas sin sección en el item → resolver la del curso
                if sec is None and pc is not None:
                    sec = (
                        Section.objects
                        .select_related("teacher__user", "classroom")
                        .prefetch_related("schedule_slots")
                        .filter(plan_course=pc, period=period)
                        .order_by("label", "id")
                        .first()
                    )
                nombre = romanos_mayusculas(
                    (getattr(pc, "display_name", "") or getattr(pc.course, "name", "") or "")
                    if pc else "")
                codigo   = (getattr(pc, "display_code", "") or getattr(pc.course, "code", "") or "") if pc else ""
                creditos = int(getattr(pc, "credits", 0) or 0) if pc else 0
                semestre = int(getattr(pc, "semester", 0) or 0) if pc else 0
                docente  = (_get_full_name(getattr(sec.teacher, "user", None))
                            if sec and sec.teacher else "—")
                aula = "—"
                if sec and sec.classroom:
                    aula = sec.classroom.code or sec.classroom.name or "—"

                n_slots = 0
                if sec:
                    for sl in sec.schedule_slots.all():
                        try:
                            wd = int(sl.weekday)
                        except (TypeError, ValueError):
                            continue
                        if wd in por_dia:
                            por_dia[wd].append({
                                "start": str(sl.start)[:5], "end": str(sl.end)[:5],
                                "curso": nombre, "codigo": codigo,
                                "docente": docente, "aula": aula,
                            })
                            n_slots += 1
                cursos.append({
                    "curso": nombre, "codigo": codigo, "creditos": creditos,
                    "semestre": semestre, "seccion": sec.label if sec else "—",
                    "docente": docente, "aula": aula, "con_horario": n_slots > 0,
                })

        cursos.sort(key=lambda c: (c["semestre"] or 99, c["curso"]))
        for d in por_dia.values():
            d.sort(key=lambda b: b["start"])

        try:
            ciclo_val = str(max(c["semestre"] for c in cursos if c["semestre"])) if cursos else ""
        except ValueError:
            ciclo_val = ""

        # Color estable por asignatura (mismo criterio que la vista web)
        color_de = {}
        for i, nombre_c in enumerate(sorted({c["curso"] for c in cursos})):
            color_de[nombre_c] = self.COLORES[i % len(self.COLORES)]

        dias_idx = list(range(1, 7)) + ([7] if por_dia[7] else [])
        ths = "".join(f"<th>{self.DIAS[i]}</th>" for i in dias_idx)

        tds = []
        for i in dias_idx:
            piezas = []
            for b in por_dia[i]:
                col = color_de.get(b["curso"], self.COLORES[0])
                piezas.append(
                    f"<div class='blk' style='border-left:3px solid {col}'>"
                    f"<p class='cur'>{esc(b['curso'])}</p>"
                    + (f"<p class='cod'>{esc(b['codigo'])}</p>" if b["codigo"] else "")
                    + f"<p class='hor' style='color:{col}'>{b['start']} – {b['end']}</p>"
                    + (f"<p class='det'>Aula {esc(b['aula'])}</p>"
                       if b["aula"] and b["aula"] != "—" else "")
                    + (f"<p class='doc'>{esc(b['docente'])}</p>"
                       if b["docente"] and b["docente"] != "—" else "")
                    + "</div>")
            tds.append(f"<td>{''.join(piezas)}</td>")

        filas_resumen = "".join(
            f"<tr><td class='c'>{n}</td><td><b>{esc(c['curso'])}</b>"
            + (" <span style='color:#B45309;font-size:7.5px'>(sin horario registrado)</span>"
               if not c["con_horario"] else "")
            + f"</td><td class='c'>{esc(c['codigo'])}</td><td class='c'>{c['creditos']}</td>"
            + f"<td class='c'>{esc(c['seccion'])}</td><td>{esc(c['docente'])}</td>"
            + f"<td class='c'>{esc(c['aula'])}</td></tr>"
            for n, c in enumerate(cursos, 1))
        total_cr = sum(c["creditos"] for c in cursos)

        cuerpo = f"""
<style>
  th {{ background: #1F4E79; color: #fff; font-size: 8.5px; }}
  table.grid {{ table-layout: fixed; }}
  table.grid td {{ vertical-align: top; padding: 3px; background: #FAFBFD; }}
  .blk {{ background: #fff; border: 1px solid #E2E8F0; border-radius: 5px;
          padding: 4px 5px; margin-bottom: 4px; page-break-inside: avoid; }}
  .blk p {{ margin: 0; }}
  .cur {{ font-size: 7.8px; font-weight: bold; color: #0F172A; line-height: 1.25; }}
  .cod {{ font-size: 6.5px; color: #94A3B8; font-family: monospace; }}
  .hor {{ font-size: 7.5px; font-weight: bold; margin-top: 1px; }}
  .det {{ font-size: 6.8px; color: #475569; }}
  .doc {{ font-size: 6.8px; color: #64748B; font-style: italic; }}
  table.info td {{ font-size: 9px; }}
</style>
<h2 style="text-align:center">HORARIO DE CLASES — {esc(period)}</h2>
<table class="info" style="margin-top:4px">
  <tr><td style="width:14%"><b>Alumno</b></td><td>{esc(student_name)}</td>
      <td style="width:12%"><b>DNI</b></td><td class='c' style="width:16%">{esc(student_doc)}</td></tr>
  <tr><td><b>Programa</b></td><td>{esc(plan_name)}</td>
      <td><b>Ciclo · Estado</b></td>
      <td class='c'>{esc(ciclo_val)}° · {"Matriculado" if enrollment else "Sin matrícula"}</td></tr>
</table>
<table class="grid">
  <thead><tr>{ths}</tr></thead>
  <tbody><tr>{''.join(tds)}</tr></tbody>
</table>
<h2 style="text-align:left; font-size:10px; margin-top:12px">Cuadro resumen</h2>
<table>
  <thead><tr><th>N°</th><th>Asignatura</th><th>Código</th><th>Cr.</th>
             <th>Sec.</th><th>Docente</th><th>Aula</th></tr></thead>
  <tbody>{filas_resumen if filas_resumen else
          '<tr><td colspan="7" style="color:#777">Sin cursos matriculados en este período.</td></tr>'}</tbody>
</table>
<p style="font-size:9px; margin-top:6px">
  <b>Total de créditos matriculados: {total_cr}</b> · {len(cursos)} curso(s)
</p>
"""
        html = _pdf_shell(f"HORARIO DE CLASES — {esc(period)}", cuerpo, landscape=True)
        try:
            pdf = html_to_pdf_bytes(html)
        except Exception as exc:
            return Response({"detail": f"No se pudo generar el PDF: {exc}"}, status=500)
        return HttpResponse(
            pdf, content_type="application/pdf",
            headers={"Content-Disposition":
                     f'attachment; filename="horario-{student_doc or st.id}-{period}.pdf"'})


# ══════════════════════════════════════════════════════════════
#  FICHAS DE MATRÍCULA EN LOTE
# ══════════════════════════════════════════════════════════════

class EnrollmentBulkFichasView(APIView):
    """
    POST /academic/enrollments/generate-fichas
    Body: { "academic_period": "2026-I" }

    Genera fichas de matrícula PDF para TODOS los alumnos matriculados
    (CONFIRMED) en el período indicado.  Retorna un ZIP con todos los PDFs.

    Solo accesible por admin/secretaria.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def post(self, request):
        import zipfile
        from io import BytesIO as ZipBuf

        if not _can_admin_enroll(request.user):
            return Response({"detail": "No tiene permisos."}, status=403)

        body = request.data or {}
        academic_period = (
            body.get("academic_period") or ""
        ).strip() or _guess_default_period_code()

        if not academic_period:
            return Response({"detail": "academic_period requerido."}, status=400)

        enrollments = list(
            Enrollment.objects
            .select_related("student", "student__plan", "student__plan__career")
            .filter(period=academic_period, status=Enrollment.STATUS_CONFIRMED)
            .order_by("student__apellido_paterno", "student__apellido_materno", "student__nombres")
        )
        if not enrollments:
            return Response({"detail": "No hay matrículas confirmadas en este período."}, status=404)

        # ── Importar helpers de generación ──
        from .process_document_gen import (
            _get_institution, _get_student, _get_enrolled_courses,
            _get_styles, DOCUMENT_GENERATORS,
        )

        # Intentar WeasyPrint; si no está → ReportLab
        use_weasyprint = False
        try:
            from .ficha_matricula_generator import generate_ficha_matricula_weasyprint, HAS_WEASYPRINT
            use_weasyprint = HAS_WEASYPRINT
        except Exception:
            pass

        inst = _get_institution()

        # ── Objeto "fake process" para el footer del PDF ──
        class _FakeProcess:
            def __init__(self, enrollment_id, sid=None):
                self.id = enrollment_id
                self.student_id = sid

        # ── Generar PDFs y empaquetar en ZIP ──
        zip_buf = ZipBuf()
        generated = 0
        errors_list = []

        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for enr in enrollments:
                try:
                    st = enr.student
                    student_data = _get_student(st.id)
                    student_data["periodo"] = academic_period

                    ciclo = None
                    try:
                        ciclo = int(student_data.get("ciclo", 0) or 0)
                    except (ValueError, TypeError):
                        ciclo = None

                    courses = _get_enrolled_courses(student_data.get("plan_id"), ciclo)

                    extra = {
                        "period": academic_period,
                        "cycle":  student_data.get("ciclo", ""),
                        "section": student_data.get("seccion", "A"),
                    }

                    fake_process = _FakeProcess(enr.id, st.id)
                    pdf_buf = None

                    # Intentar WeasyPrint
                    if use_weasyprint:
                        try:
                            pdf_buf, _ = generate_ficha_matricula_weasyprint(
                                fake_process, student_data, extra, inst, courses
                            )
                        except Exception:
                            pdf_buf = None

                    # Fallback ReportLab Canvas (diseño profesional)
                    if pdf_buf is None:
                        try:
                            from .ficha_matricula_generator import generate_ficha_matricula_reportlab
                            pdf_buf = generate_ficha_matricula_reportlab(
                                fake_process, student_data, extra, inst, courses
                            )
                        except Exception:
                            pdf_buf = None

                    # Último fallback: ReportLab Platypus (legacy)
                    if pdf_buf is None:
                        import io as _io
                        from reportlab.lib.pagesizes import A4
                        from reportlab.lib.units import cm
                        from reportlab.platypus import SimpleDocTemplate

                        gen = DOCUMENT_GENERATORS.get("FICHA_MATRICULA")
                        if gen:
                            styles = _get_styles()
                            story = gen(fake_process, student_data, extra, styles, inst)
                            pdf_buf = _io.BytesIO()
                            doc = SimpleDocTemplate(
                                pdf_buf, pagesize=A4,
                                leftMargin=2.5 * cm, rightMargin=2.5 * cm,
                                topMargin=2 * cm, bottomMargin=2 * cm,
                            )
                            doc.build(story)
                            pdf_buf.seek(0)

                    if pdf_buf is None:
                        raise RuntimeError("No se pudo generar el PDF (ni WeasyPrint ni ReportLab)")

                    # Nombre descriptivo del PDF
                    ap_pat = getattr(st, "apellido_paterno", "") or ""
                    ap_mat = getattr(st, "apellido_materno", "") or ""
                    nombres = getattr(st, "nombres", "") or ""
                    dni = getattr(st, "num_documento", "") or ""
                    safe_name = f"{ap_pat}_{ap_mat}_{nombres}".strip("_").replace(" ", "_") or dni
                    pdf_content = pdf_buf.getvalue() if hasattr(pdf_buf, 'getvalue') else pdf_buf.read()
                    zf.writestr(f"FICHA_{safe_name}_{dni}.pdf", pdf_content)
                    generated += 1

                except Exception as e:
                    dni_err = getattr(enr.student, "num_documento", "?")
                    errors_list.append(f"{dni_err}: {str(e)}")

        zip_buf.seek(0)

        if generated == 0:
            return Response(
                {"detail": "No se pudo generar ninguna ficha.", "errors": errors_list},
                status=500,
            )

        response = HttpResponse(zip_buf.getvalue(), content_type="application/zip")
        response["Content-Disposition"] = (
            f'attachment; filename="fichas-matricula-{academic_period}.zip"'
        )
        return response


# ══════════════════════════════════════════════════════════════
#  REINICIO DE MATRÍCULA DE UN ESTUDIANTE
# ══════════════════════════════════════════════════════════════

class EnrollmentResetStudentView(APIView):
    """
    POST /academic/enrollments/reset-student
    Body: { "student_id": <int>, "period": "2026-I" }

    Devuelve al alumno al estado previo a matrícula:
      1. Elimina Enrollment + EnrollmentItems del período
      2. Elimina EnrollmentPayment + voucher del período
      3. Revierte registros financieros creados por la aprobación
         (IncomeEntry, CashMovement, StudentAccountPayment, StudentAccountCharge)

    Solo admins.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _can_admin_enroll(request.user):
            return Response({"detail": "Sin permisos."}, status=403)

        student_id = request.data.get("student_id")
        period = (request.data.get("period") or "").strip()

        if not student_id or not period:
            return Response(
                {"detail": "Se requiere student_id y period."},
                status=400,
            )

        try:
            student = StudentProfile.objects.get(pk=student_id)
        except StudentProfile.DoesNotExist:
            return Response({"detail": "Estudiante no encontrado."}, status=404)

        dni = getattr(student, "num_documento", "") or str(student.id)
        deleted = {"enrollment": False, "items": 0, "payment": False, "finance": 0}

        with transaction.atomic():
            # ── 1. Eliminar Enrollment + Items ──────────────────────
            enrollments = Enrollment.objects.filter(student=student, period=period)
            for enr in enrollments:
                items_count = enr.items.count()
                deleted["items"] += items_count
                enr.items.all().delete()
                enr.delete()
                deleted["enrollment"] = True

            # ── 2. Eliminar EnrollmentPayment + voucher ─────────────
            from academic.models import EnrollmentPayment
            payments = EnrollmentPayment.objects.filter(student=student, period=period)
            payment_ids = list(payments.values_list("id", flat=True))

            for pay in payments:
                # Borrar archivo voucher
                if pay.voucher:
                    try:
                        pay.voucher.delete(save=False)
                    except Exception:
                        pass
                pay.delete()
                deleted["payment"] = True

            # ── 3. Revertir registros financieros ───────────────────
            try:
                from finance.models import (
                    IncomeEntry, CashMovement,
                    StudentAccountPayment, StudentAccountCharge, Concept,
                )

                # IncomeEntry: subject_id=dni, concept_name contiene el período
                inc_del, _ = IncomeEntry.objects.filter(
                    subject_id=dni,
                    concept_name__icontains=period,
                ).delete()
                deleted["finance"] += inc_del

                # CashMovement: concept contiene período Y DNI
                cm_del, _ = CashMovement.objects.filter(
                    Q(concept__icontains=period) & Q(concept__icontains=dni),
                ).delete()
                deleted["finance"] += cm_del

                # StudentAccountPayment: subject_id=dni, ref contiene VOUCHER-<id>
                for pid in payment_ids:
                    sp_del, _ = StudentAccountPayment.objects.filter(
                        subject_id=dni,
                        ref__icontains=f"VOUCHER-{pid}",
                    ).delete()
                    deleted["finance"] += sp_del

                # StudentAccountCharge: desmarcar paid → False
                concept = Concept.objects.filter(type="MATRICULA").first()
                charges = StudentAccountCharge.objects.filter(
                    subject_id=dni,
                    subject_type="STUDENT",
                    paid=True,
                )
                if concept:
                    charges = charges.filter(
                        Q(concept=concept) | Q(concept_name__icontains="matrícula")
                    )
                else:
                    charges = charges.filter(concept_name__icontains="matrícula")

                # Solo revertir cargos del período si concept_name lo contiene,
                # sino el último pagado
                period_charges = charges.filter(concept_name__icontains=period)
                if period_charges.exists():
                    count = period_charges.update(paid=False)
                    deleted["finance"] += count
                else:
                    charge = charges.order_by("-created_at").first()
                    if charge:
                        charge.paid = False
                        charge.save(update_fields=["paid"])
                        deleted["finance"] += 1

            except ImportError:
                pass  # finance app no instalada
            except Exception:
                pass  # no bloquear el reset si falla la limpieza financiera

        return Response({
            "ok": True,
            "student_id": student.id,
            "period": period,
            "deleted": deleted,
        })
