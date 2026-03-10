"""
Funciones auxiliares y helpers para el módulo académico
"""
import os
import re
import base64
import unicodedata
import mimetypes
import requests
from datetime import datetime, date
from typing import Optional, Tuple
from django.conf import settings
from django.utils import timezone
from acl.models import Role, UserRole
from django.contrib.auth import get_user_model


# ══════════════════════════════════════════════════════════════
#  CONVERSIÓN DE TIPOS
# ══════════════════════════════════════════════════════════════

def _to_int(value, default=None):
    """Convierte a entero de forma segura."""
    if value is None:
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def _to_float(value, default=None):
    """Convierte a float de forma segura."""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def _to_str(value, default=""):
    """Convierte a string limpio."""
    if value is None:
        return default
    return str(value).strip()


def _safe_float(v):
    try:
        if v is None:
            return None
        s = str(v).strip()
        return None if s == "" else float(s)
    except Exception:
        return None


def _fmt_grade(g):
    if g is None:
        return ""
    try:
        gf = float(g)
        if gf.is_integer():
            return str(int(gf))
        return f"{gf:.2f}".rstrip("0").rstrip(".")
    except Exception:
        return ""


# ══════════════════════════════════════════════════════════════
#  NORMALIZACIÓN DE TEXTO
# ══════════════════════════════════════════════════════════════

def _norm_text(s: str) -> str:
    s = "" if s is None else str(s)
    s = s.strip()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"\s+", " ", s)
    return s.lower()


def _norm_txt(s: str) -> str:
    s = (s or "").strip()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", s).strip().lower()


def _norm_key(s: str) -> str:
    return (s or "").strip().lower()


def _norm_term(s: str) -> str:
    s = "" if s is None else str(s)
    s = s.strip().upper()
    s = re.sub(r"\s+", "", s)
    return s.replace("/", "-")


# ══════════════════════════════════════════════════════════════
#  PERÍODOS ACADÉMICOS
# ══════════════════════════════════════════════════════════════

def _term_sort_key(term: str) -> Tuple:
    """
    Clave de ordenamiento para períodos académicos.
    Soporta: 2018-I, 2018-II, 2018-1, 2018-2, 2025-VERANO.
    VERANO se ordena después de II del mismo año.
    """
    t = _norm_term(term)
    m = re.match(r"^(\d{4})-(I|II|1|2)$", t)
    if m:
        year = int(m.group(1))
        sem  = 1 if m.group(2) in ("I", "1") else 2
        return (year, sem, t)
    # Verano u otros formatos: después de II del mismo año
    m2 = re.match(r"^(\d{4})-(.+)$", t)
    if m2:
        return (int(m2.group(1)), 3, t)
    return (9999, 9, t)


def current_period(dt: Optional[date] = None) -> str:
    """
    Retorna el período académico actual basado en el mes.
      Enero–Junio  → {año}-I
      Julio–Diciembre → {año}-II

    >>> current_period()   # En marzo 2026 → '2026-I'
    """
    ref   = dt or timezone.now().date()
    sem   = "I" if ref.month <= 6 else "II"
    return f"{ref.year}-{sem}"


def parse_period(period: str) -> Tuple[int, int]:
    """
    Descompone un período en (año, semestre_num).
    '2026-I' → (2026, 1)
    '2026-II' → (2026, 2)
    '2025-VERANO' → (2025, 3)
    Lanza ValueError si el formato es inválido.
    """
    t = _norm_term(period)
    m = re.match(r"^(\d{4})-(I|II|1|2)$", t)
    if m:
        year = int(m.group(1))
        sem  = 1 if m.group(2) in ("I", "1") else 2
        return (year, sem)
    # Verano
    m2 = re.match(r"^(\d{4})-(VERANO)$", t)
    if m2:
        return (int(m2.group(1)), 3)
    raise ValueError(f"Formato de período inválido: {period!r}")


def period_label(period: str) -> str:
    """
    Versión legible de un período.
    '2026-I' → 'Semestre I – 2026'
    '2025-VERANO' → 'Verano – 2025'
    """
    try:
        year, sem = parse_period(period)
        if sem == 3:
            return f"Verano – {year}"
        return f"Semestre {'I' if sem == 1 else 'II'} – {year}"
    except ValueError:
        return period


def next_period(period: str) -> str:
    """Retorna el período siguiente: '2026-I' → '2026-II', '2026-II' → '2027-I', '2025-VERANO' → '2026-I'."""
    year, sem = parse_period(period)
    if sem == 1:
        return f"{year}-II"
    if sem == 3:
        # Después de verano viene el I del año siguiente
        return f"{year + 1}-I"
    return f"{year + 1}-I"


def prev_period(period: str) -> str:
    """Retorna el período anterior: '2026-II' → '2026-I', '2026-I' → '2025-II', '2025-VERANO' → '2025-II'."""
    year, sem = parse_period(period)
    if sem == 3:
        # Antes de verano está el II del mismo año
        return f"{year}-II"
    if sem == 2:
        return f"{year}-I"
    return f"{year - 1}-II"


def period_range(from_period: str, to_period: str):
    """
    Genera todos los períodos en el rango [from_period, to_period] inclusive.
    Útil para generar listas de períodos en selectores.
    """
    current = from_period
    while _term_sort_key(current) <= _term_sort_key(to_period):
        yield current
        current = next_period(current)


def validate_period_format(period: str) -> bool:
    """True si el string tiene formato de período válido."""
    try:
        parse_period(period)
        return True
    except ValueError:
        return False


# ══════════════════════════════════════════════════════════════
#  VENTANA DE MATRÍCULA
# ══════════════════════════════════════════════════════════════

def get_enrollment_window_info(period_code: str, now=None) -> dict:
    """
    Devuelve el window_info para un período dado.
    Si el AcademicPeriod no existe, retorna estado FREE.
    Evita importar el modelo en el top-level para prevenir
    dependencias circulares.
    """
    from academic.models import AcademicPeriod

    obj = AcademicPeriod.get_or_none(period_code)
    if obj is None:
        return {
            "status":                AcademicPeriod.STATUS_FREE,
            "is_open":               True,
            "enrollment_start":      None,
            "enrollment_end":        None,
            "extemporary_start":     None,
            "extemporary_end":       None,
            "extemporary_surcharge": 0.0,
        }
    return obj.window_info(now)


def assert_enrollment_window(period_code: str, now=None):
    """
    Lanza una excepción DRF con 403 si la ventana de matrícula está CLOSED.
    Uso en vistas:
        assert_enrollment_window(period)  # levanta si está cerrada
    """
    from rest_framework.exceptions import PermissionDenied
    from academic.models import AcademicPeriod

    status = AcademicPeriod.get_status_for_period(period_code, now)
    if status == AcademicPeriod.STATUS_CLOSED:
        raise PermissionDenied(
            "La matrícula para este período está cerrada. "
            "Comuníquese con Secretaría Académica."
        )


# ══════════════════════════════════════════════════════════════
#  IMÁGENES Y ARCHIVOS
# ══════════════════════════════════════════════════════════════

def url_to_data_uri(url: str) -> str:
    if not url:
        return ""
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        ctype = r.headers.get("content-type") or "image/png"
        b64 = base64.b64encode(r.content).decode("ascii")
        return f"data:{ctype};base64,{b64}"
    except Exception:
        return ""


def _file_to_data_uri(abs_path: str):
    try:
        if not abs_path or not os.path.exists(abs_path):
            return None
        mime, _ = mimetypes.guess_type(abs_path)
        mime = mime or "application/octet-stream"
        with open(abs_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        return f"data:{mime};base64,{b64}"
    except Exception:
        return None


def _template_kardex_image_to_data_uri(filename: str) -> str:
    try:
        if not filename:
            return ""
        abs_path = os.path.join(
            settings.BASE_DIR,
            "academic", "templates", "kardex", "images", filename,
        )
        return _file_to_data_uri(abs_path) or ""
    except Exception:
        return ""


def _media_url_to_abs_path(media_url: str):
    if not media_url:
        return None
    s = str(media_url).strip()
    rel = s.split("/media/", 1)[1] if "/media/" in s else s.lstrip("/")
    return os.path.join(str(settings.MEDIA_ROOT), rel)


def _abs_media_url(request, maybe_url: str) -> str:
    if not maybe_url:
        return ""
    u = str(maybe_url).strip()
    if not u:
        return ""
    if u.startswith("http://") or u.startswith("https://"):
        return u
    if not u.startswith("/"):
        u = "/" + u
    try:
        return request.build_absolute_uri(u)
    except Exception:
        return u


# ══════════════════════════════════════════════════════════════
#  USUARIOS Y ROLES
# ══════════════════════════════════════════════════════════════

def _get_full_name(u) -> str:
    if not u:
        return ""
    if hasattr(u, "get_full_name"):
        try:
            fn = (u.get_full_name() or "").strip()
            if fn:
                return fn
        except Exception:
            pass
    for attr in ("full_name", "name"):
        if hasattr(u, attr):
            v = (getattr(u, attr) or "").strip()
            if v:
                return v
    first = (getattr(u, "first_name", "") or "").strip()
    last  = (getattr(u, "last_name",  "") or "").strip()
    if first or last:
        return f"{first} {last}".strip()
    return (
        getattr(u, "username", "")
        or getattr(u, "email", "")
        or f"User {getattr(u, 'id', '')}"
    ).strip()


def list_users_by_role_names(role_names):
    User = get_user_model()
    role_ids = list(Role.objects.filter(name__in=role_names).values_list("id", flat=True))
    if not role_ids:
        return User.objects.none()
    user_ids = (
        UserRole.objects
        .filter(role_id__in=role_ids)
        .values_list("user_id", flat=True)
        .distinct()
    )
    return User.objects.filter(id__in=user_ids, is_active=True)


def list_teacher_users_qs():
    return list_users_by_role_names(["TEACHER", "DOCENTE", "PROFESOR"])


def list_student_users_qs():
    return list_users_by_role_names(["STUDENT", "ALUMNO", "ESTUDIANTE"])


def user_has_any_role(user, names) -> bool:
    if not user:
        return False
    if getattr(user, "is_superuser", False):
        return True
    try:
        return UserRole.objects.filter(user=user, role__name__in=names).exists()
    except Exception:
        return False


def _can_admin_enroll(user) -> bool:
    return (
        user_has_any_role(user, ["REGISTRAR", "ADMIN_ACADEMIC", "ADMIN_ACADEMICO", "ADMIN_SYSTEM"])
        or getattr(user, "is_staff", False)
        or getattr(user, "is_superuser", False)
    )


def _can_delete_plans(user) -> bool:
    return user_has_any_role(user, ["ADMIN_SYSTEM"]) or getattr(user, "is_superuser", False)


def count_teachers() -> int:
    from academic.models import Teacher
    qs = list_teacher_users_qs()
    return qs.count() if qs.exists() else Teacher.objects.count()


# ══════════════════════════════════════════════════════════════
#  HELPER PARA RESPUESTAS DRF
# ══════════════════════════════════════════════════════════════

def ok(data=None, **extra):
    from rest_framework.response import Response
    payload = data or {}
    payload.update(extra)
    return Response(payload)


# ══════════════════════════════════════════════════════════════
#  CONSTANTES
# ══════════════════════════════════════════════════════════════

DAY_TO_INT = {"MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6, "SUN": 7}
INT_TO_DAY = {v: k for k, v in DAY_TO_INT.items()}

PASSING_GRADE = 11  # vigesimal

ALLOWED_ATT = {"PRESENT", "ABSENT", "LATE", "EXCUSED"}

ACTA_LEVELS       = {"PI", "I", "P", "L", "D"}
LEVEL_TO_NUM      = {"PI": 1, "I": 2, "P": 3, "L": 4, "D": 5}
ACTA_REQUIRED_FIELDS = ["C1_LEVEL", "C2_LEVEL", "C3_LEVEL", "FINAL"]

SEM_LABELS = {
    1: "PRIMERO", 2: "SEGUNDO", 3: "TERCERO",  4: "CUARTO",  5: "QUINTO",
    6: "SEXTO",   7: "SEPTIMO", 8: "OCTAVO",   9: "NOVENO",  10: "DECIMO",
}

KARDEX_POS = {
    "name":         (165, 695),
    "code":         (420, 678),
    "nota_x":       300,
    "row_y_start":  604,
    "row_step":     18.0,
    "rows_per_page": 30,
}