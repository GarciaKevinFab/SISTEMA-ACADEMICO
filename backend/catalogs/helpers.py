# backend/catalogs/helpers.py
"""
Helpers compartidos para import robusto de carreras, planes y estudiantes
"""
import re
import unicodedata
from typing import Optional
from catalogs.models import Career
from academic.models import Plan, PlanCourse
from django.db.models import Count, Q


def _norm_txt(s: str) -> str:
    """Normalización agresiva (quita tildes, espacios, mayús)"""
    s = (s or "").strip()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def _norm_key(s: str) -> str:
    """Normalización sin puntuación para cache keys"""
    return re.sub(r"[.\-/_ ]", "", _norm_txt(s)).strip()


def career_base_name(full_name: str) -> str:
    """
    Extrae el nombre base de la carrera (sin RVM, códigos, paréntesis)

    Ejemplos:
      "EDUCACIÓN INICIAL (RVM 163-2019-MINEDU)" → "EDUCACIÓN INICIAL"
      "EDUCACIÓN PRIMARIA (RVM 204-2019-MINEDU)" → "EDUCACIÓN PRIMARIA"
      "EDUCACIÓN FÍSICA (RVM 147-2020-MINEDU)"  → "EDUCACIÓN FÍSICA"
    """
    s = (full_name or "").strip().upper()

    # Quita todo lo que esté entre paréntesis (incluye RVM)
    s = re.sub(r"\s*\([^)]*\)\s*", "", s).strip()

    # Quita sufijos de normativas sueltos (sin paréntesis)
    s = re.sub(
        r"\s*(RVM|R\.V\.M\.|D\.S\.|DS|R\.M\.|RM)\s*[\d\-\s]+.*$",
        "",
        s,
        flags=re.IGNORECASE,
    ).strip()

    return s


def match_career_robust(career_name: str) -> Optional[Career]:
    """
    Match robusto de carrera en este orden:
    1. Exacto por nombre completo
    2. Por nombre base (sin RVM) exacto
    3. Cualquier career cuyo nombre base coincida
    4. icontains bilateral
    5. Normalización agresiva (sin tildes, sin espacios)

    Returns:
        Career si encuentra match, None si no
    """
    name = (career_name or "").strip()
    if not name:
        return None

    # 1. Match exacto
    car = Career.objects.filter(name__iexact=name).first()
    if car:
        return car

    # 2. Match base vs base exacto
    base = career_base_name(name)
    if base:
        car = Career.objects.filter(name__iexact=base).first()
        if car:
            return car

        # 3. Cualquier career cuyo career_base_name coincida con base
        for c in Career.objects.all().only("id", "name"):
            if career_base_name(c.name) == base:
                return c

        # 4a. base contenido en nombre DB
        car = Career.objects.filter(name__icontains=base).first()
        if car:
            return car

        # 4b. nombre DB base contenido en nuestro base
        for c in Career.objects.all().only("id", "name"):
            c_base = career_base_name(c.name)
            if c_base and c_base in base:
                return c

    # 5. Normalización agresiva total
    norm = _norm_txt(name)
    for c in Career.objects.all().only("id", "name"):
        if _norm_txt(c.name) == norm:
            return c

    return None


def ensure_career_for_import(career_name: str, code: str = None) -> Career:
    """
    Asegura que exista una Career (crea si no existe).
    Usa match robusto para evitar duplicados.

    Args:
        career_name: Nombre de la carrera (puede incluir RVM)
        code: Código único (opcional, se genera si no viene)

    Returns:
        Career instance
    """
    car = match_career_robust(career_name)
    if car:
        return car

    final_name = career_base_name(career_name) or career_name.strip().upper()

    if not code:
        slug = re.sub(r"[^A-Z0-9]", "", final_name[:10].upper())
        code = slug or "CAR"
        k = 1
        test_code = code
        while Career.objects.filter(code=test_code).exists():
            k += 1
            test_code = f"{code[:8]}{k:02d}"
        code = test_code

    return Career.objects.create(name=final_name, code=code)


def _parse_year_from_period(period_code: str) -> Optional[int]:
    """
    Extrae el año de un código de período.
    Acepta: "2025-II", "2025-I", "2025/2", "2025 I", "2025"
    Retorna: int año, o None si no parsea
    """
    if not period_code:
        return None
    m = re.search(r"(20\d{2})", str(period_code))
    if m:
        y = int(m.group(1))
        if 2000 <= y <= 2100:
            return y
    return None


def pick_plan_for_student(career: Career, period_code: str = None) -> Optional[Plan]:
    """
    Elige el mejor plan para un estudiante según su año de matrícula.

    Prioridad:
    1. Plan cuyo rango (start_year..end_year) incluye el año del período
    2. Plan más reciente que empezó ANTES del año del período
    3. Plan más completo (más cursos) y más reciente sin filtro de año

    Args:
        career: Career instance
        period_code: Código de período (ej: "2022-I", "2015-II")

    Returns:
        Plan instance o None
    """
    if not career:
        return None

    qs = (
        Plan.objects
        .filter(career=career, is_deleted=False)
        .annotate(n_courses=Count("plan_courses"))
    )

    if not qs.exists():
        return None

    year = _parse_year_from_period(period_code) if period_code else None

    if year:
        # 1. Rango exacto incluye el año
        plan = (
            qs
            .filter(start_year__lte=year, end_year__gte=year)
            .order_by("-n_courses", "-start_year", "-id")
            .first()
        )
        if plan:
            return plan

        # 2. Plan más reciente que empezó antes del año de matrícula
        plan = (
            qs
            .filter(start_year__lte=year)
            .order_by("-start_year", "-n_courses", "-id")
            .first()
        )
        if plan:
            return plan

    # 3. Fallback: plan con más cursos y más reciente
    return qs.order_by("-n_courses", "-start_year", "-id").first()


def match_plan_course_for_grade(student, course, plan_id: int = None) -> Optional[PlanCourse]:
    """
    Busca el PlanCourse correcto para un AcademicGradeRecord.

    Orden de prioridad:
    1. course_id exacto en el plan del estudiante
    2. display_code / course.code (normalizado)
    3. display_name / course.name (normalizado agresivo)

    Args:
        student: Student instance (se usa student.plan_id si plan_id no viene)
        course: Course instance
        plan_id: Plan ID override (opcional)

    Returns:
        PlanCourse instance o None
    """
    pid = plan_id or getattr(student, "plan_id", None)
    if not pid:
        return None

    # 1. Por course_id exacto (más rápido y confiable)
    pc = PlanCourse.objects.filter(plan_id=pid, course_id=course.id).first()
    if pc:
        return pc

    # 2. Por código
    code_norm = (getattr(course, "code", "") or "").strip().upper()
    if code_norm:
        pc = (
            PlanCourse.objects
            .select_related("course")
            .filter(plan_id=pid)
            .filter(
                Q(display_code__iexact=code_norm) |
                Q(course__code__iexact=code_norm)
            )
            .first()
        )
        if pc:
            return pc

    # 3. Por nombre normalizado
    name_norm = _norm_key(getattr(course, "name", "") or "")
    if name_norm:
        for pc in PlanCourse.objects.select_related("course").filter(plan_id=pid):
            dn = _norm_key(getattr(pc, "display_name", "") or "")
            cn = _norm_key(getattr(pc.course, "name", "") or "")
            if name_norm in (dn, cn):
                return pc

    return None