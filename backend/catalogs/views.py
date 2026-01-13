# backend/catalogs/views.py
# ✅ Archivo completo (catálogos + importadores + backups) con:
# - Import PLAN (semestres por bloques + credits correctos)
# - Import STUDENTS (crea User + rol STUDENT vía ACL real UserRole + enlaza Student.plan FK)
# - Import GRADES (lee CALIFICACIONES.xlsx real + normaliza DNI 7/8 + enlaza Course/PlanCourse/AcademicGradeRecord)
# - SQLite lock retry + batches (evita romper transacciones)
#
# ⚠️ Recomendación (settings.py):
# DATABASES["default"]["OPTIONS"] = {"timeout": 30}

from __future__ import annotations

import os
import io
import csv
import json
import re
import time
import zipfile
import unicodedata
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Tuple

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.db import models, transaction, IntegrityError
from django.db.utils import OperationalError
from django.http import Http404, HttpResponse, FileResponse
from django.db.models import Q
from django.contrib.auth import get_user_model

from openpyxl import Workbook, load_workbook

from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from catalogs.models import Period
from acl.models import Role, UserRole
from students.models import Student
from academic.models import Career, Plan, Course, PlanCourse

# ✅ si implementaste AcademicGradeRecord
try:
    from academic.models import AcademicGradeRecord
except Exception:
    AcademicGradeRecord = None

# ✅ sincronizar carreras al módulo de admisión
try:
    from admission.models import Career as AdmissionCareer
except Exception:
    AdmissionCareer = None

from .models import (
    Campus, Classroom, Teacher,
    InstitutionSetting, MediaAsset,
    ImportJob, BackupExport
)
from .serializers import (
    PeriodSerializer, CampusSerializer, ClassroomSerializer, TeacherSerializer,
    MediaAssetSerializer, BackupExportSerializer
)

User = get_user_model()

# ─────────────────────────────────────────────────────────────
# Utils
# ─────────────────────────────────────────────────────────────

def _norm(s):
    s = "" if s is None else str(s)
    s = s.strip()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    s = re.sub(r"\s+", " ", s)
    return s

def _to_int(v, default=None):
    try:
        if v == "" or v is None:
            return default
        return int(float(v))
    except Exception:
        return default

def _to_float(v, default=None):
    try:
        if v == "" or v is None:
            return default
        return float(v)
    except Exception:
        return default

def _parse_date_yyyy_mm_dd(s):
    s = (s or "").strip()
    if not s:
        return None
    try:
        y, m, d = [int(x) for x in s.split("-")]
        return date(y, m, d)
    except Exception:
        return None

def _retry_db(fn, tries=10, delay=0.5):
    """
    Reintenta operaciones DB cuando SQLite se bloquea.
    """
    last = None
    for _ in range(tries):
        try:
            return fn()
        except OperationalError as e:
            last = e
            if "database is locked" in str(e).lower():
                time.sleep(delay)
                continue
            raise
    if last:
        raise last

def list_items(serializer_cls, queryset):
    return Response({"items": serializer_cls(queryset, many=True).data})

def _require_staff(request):
    if not request.user.is_authenticated or not request.user.is_staff:
        return Response({"detail": "No autorizado."}, status=403)
    return None

def _xlsx_response(wb: Workbook, filename: str):
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    resp = HttpResponse(
        buf.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp

def _csv_bytes(rows: List[dict], headers: List[str]) -> bytes:
    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=headers, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        # JSONFields / dicts -> string
        rr = {}
        for k in headers:
            v = r.get(k)
            if isinstance(v, (dict, list)):
                rr[k] = json.dumps(v, ensure_ascii=False)
            else:
                rr[k] = "" if v is None else v
        w.writerow(rr)
    return out.getvalue().encode("utf-8-sig")

def _parse_period_code(code: str):
    """
    Acepta: 2026-I, 2026-II, 2026-III
    Retorna: (year:int, term:str) o (None, None)
    """
    s = (code or "").strip().upper()
    if not s:
        return None, None
    parts = s.split("-")
    if len(parts) != 2:
        return None, None
    try:
        year = int(parts[0])
    except Exception:
        return None, None
    term = parts[1]
    if term not in ("I", "II", "III"):
        return None, None
    return year, term

def _slug_code(s: str, maxlen: int = 10) -> str:
    s = _norm(s).upper()
    s = re.sub(r"[^A-Z0-9]", "", s)
    return (s[:maxlen] or "CRS")

# ─────────────────────────────────────────────────────────────
# Student headers (excel oficial)
# ─────────────────────────────────────────────────────────────

STUDENT_HEADER_ALIASES = {
    "region": "region",
    "provincia": "provincia",
    "distrito": "distrito",

    "codigo modular": "codigo_modular",
    "codigo_modular": "codigo_modular",
    "nombre de la institucion": "nombre_institucion",
    "nombre institucion": "nombre_institucion",

    "gestion": "gestion",
    "tipo": "tipo",

    "programa / carrera": "programa_carrera",
    "programa carrera": "programa_carrera",

    "ciclo": "ciclo",
    "turno": "turno",
    "seccion": "seccion",
    "periodo": "periodo",

    "apellido paterno": "apellido_paterno",
    "apellido materno": "apellido_materno",
    "nombres": "nombres",

    "fecha nac": "fecha_nac",
    "fecha nac.": "fecha_nac",

    "sexo": "sexo",

    "num documento": "num_documento",
    "num. documento": "num_documento",

    "lengua": "lengua",
    "discapacidad": "discapacidad",
    "tipo de discapacidad": "tipo_discapacidad",
}

def _read_rows(file, mapping: dict):
    """
    Lee XLSX/CSV. Devuelve lista de dicts con __row__.
    Auto-mapea el Excel oficial de alumnos si detecta encabezados.
    """
    name = (getattr(file, "name", "") or "").lower()

    def apply_mapping(row: dict):
        if not mapping:
            return row
        out = dict(row)
        for field, col in (mapping or {}).items():
            if col and col in row:
                out[field] = row.get(col)
        return out

    # XLSX
    if name.endswith((".xlsx", ".xlsm", ".xltx", ".xls")):
        wb = load_workbook(file, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []

        headers = [str(h).strip() if h is not None else "" for h in rows[0]]

        header_map = {}
        for j, h in enumerate(headers):
            nh = _norm(h)
            if nh in STUDENT_HEADER_ALIASES:
                header_map[j] = STUDENT_HEADER_ALIASES[nh]

        out = []
        for i, r in enumerate(rows[1:], start=2):
            row_raw = {headers[j]: r[j] for j in range(len(headers)) if headers[j]}
            row_raw = {k: ("" if v is None else v) for k, v in row_raw.items()}

            row_auto = {}
            for j in range(len(headers)):
                key = header_map.get(j)
                if key:
                    row_auto[key] = "" if r[j] is None else r[j]

            row_final = row_auto if row_auto else row_raw
            row_final = apply_mapping(row_final)
            out.append({**row_final, "__row__": i})
        return out

    # CSV
    raw = file.read()
    try:
        text = raw.decode("utf-8-sig")
    except Exception:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    out = []
    for idx, row in enumerate(reader, start=2):
        row = {k.strip(): ("" if v is None else str(v).strip()) for k, v in row.items() if k}

        row_auto = {}
        for k, v in row.items():
            nk = _norm(k)
            if nk in STUDENT_HEADER_ALIASES:
                row_auto[STUDENT_HEADER_ALIASES[nk]] = v

        row_final = row_auto if row_auto else row
        row_final = apply_mapping(row_final)
        out.append({**row_final, "__row__": idx})
    return out

# ─────────────────────────────────────────────────────────────
# PLAN de estudios (tu Excel real: semestre como BLOQUE)
# ─────────────────────────────────────────────────────────────

def _career_from_sheet_name(sheet: str) -> str:
    raw = (sheet or "").strip()
    raw = re.sub(r"\b20\d{2}\b", "", raw).strip()
    raw = re.sub(r"\s+", " ", raw).strip()
    key = _norm(raw)

    MAP = {
        "inicial": "EDUCACIÓN INICIAL",
        "primaria": "EDUCACIÓN PRIMARIA",
        "ed. fisica": "EDUCACIÓN FÍSICA",
        "ed fisica": "EDUCACIÓN FÍSICA",
        "educacion fisica": "EDUCACIÓN FÍSICA",
        "comunicacion": "COMUNICACIÓN",
    }
    return MAP.get(key, raw.upper())

def _normalize_semester_value(v) -> str:
    s = "" if v is None else str(v).strip()
    if not s:
        return ""
    s = s.replace(" ", "")
    return _norm(s)

def _is_semester_label(v) -> Optional[int]:
    sem_map = {
        "primero": 1, "segundo": 2, "tercero": 3, "cuarto": 4, "quinto": 5,
        "sexto": 6, "septimo": 7, "octavo": 8, "noveno": 9, "decimo": 10,
    }
    key = _normalize_semester_value(v)
    return sem_map.get(key)

def _read_study_plan_xlsx(file):
    """
    Lee plan por hojas.
    - Detecta semestre por BLOQUES (PRIMERO..DECIMO) aunque sean celdas combinadas.
    - Detecta columnas 'AREAS/ASIGNATURAS' y 'CRED'.
    - Retorna dicts: {career_name, semester, course_name, credits}
    """
    wb = load_workbook(file, data_only=True, read_only=True, keep_links=False)
    out = []

    for sheet in wb.sheetnames:
        ws = wb[sheet]
        career_name = _career_from_sheet_name(sheet)
        if not career_name:
            continue

        current_sem = None
        course_col = None
        cred_col = None
        header_found = False
        empty_streak = 0

        for ridx, row in enumerate(ws.iter_rows(values_only=True), start=1):
            # 1) semestre por bloque
            for cell in row:
                sem = _is_semester_label(cell)
                if sem:
                    current_sem = sem
                    break

            # 2) header detection
            if not header_found:
                row_norm = [(_norm(x) if x is not None else "") for x in row]
                for j, h in enumerate(row_norm):
                    if ("areas" in h) or ("asignaturas" in h):
                        course_col = j
                        break
                for j, h in enumerate(row_norm):
                    if "cred" in h:
                        cred_col = j
                        break
                if course_col is not None and cred_col is not None:
                    header_found = True
                continue

            # 3) data rows
            if course_col is None or course_col >= len(row):
                continue

            course_name = "" if row[course_col] is None else str(row[course_col]).strip()
            if not course_name:
                empty_streak += 1
                if empty_streak >= 25:
                    break
                continue
            empty_streak = 0

            credits = 0
            if cred_col is not None and cred_col < len(row):
                credits = _to_int(row[cred_col], 0) or 0

            if not current_sem:
                continue

            out.append({
                "__row__": ridx,
                "career_name": career_name,
                "semester": int(current_sem),
                "course_name": course_name,
                "credits": int(credits),
            })

    return out

# ─────────────────────────────────────────────────────────────
# CALIFICACIONES.xlsx (real)
# ─────────────────────────────────────────────────────────────

def _read_calificaciones_xlsx(file):
    """
    Lee CALIFICACIONES.xlsx real.
    Headers esperados (flexibles):
      NUMERO_DOCUMENTO, PERIODO, PROGRAMA, CICLO, CURSO, PROMEDIO_VIGESIMAL
    """
    wb = load_workbook(file, data_only=True, read_only=True, keep_links=False)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    headers = [(_norm(h) if h is not None else "") for h in rows[0]]

    def idx_match(*names):
        wanted = {_norm(x) for x in names}
        for i, h in enumerate(headers):
            if h in wanted:
                return i
        return None

    i_doc = idx_match("NUMERO_DOCUMENTO", "NUM DOCUMENTO", "NUM_DOCUMENTO", "DNI")
    i_periodo = idx_match("PERIODO", "PERIOD")
    i_programa = idx_match("PROGRAMA", "PROGRAMA / CARRERA", "PROGRAMA_CARRERA")
    i_ciclo = idx_match("CICLO")
    i_curso = idx_match("CURSO", "ASIGNATURA")
    i_nota = idx_match("PROMEDIO_VIGESIMAL", "PROMEDIO", "FINAL", "NOTA", "PROM_FINAL")

    out = []
    for ridx, r in enumerate(rows[1:], start=2):
        def get(i):
            return r[i] if i is not None and i < len(r) else None

        doc = "" if get(i_doc) is None else str(get(i_doc)).strip()
        doc = re.sub(r"\.0$", "", doc)  # 7289521.0
        if doc.isdigit() and len(doc) < 8:
            doc = doc.zfill(8)

        periodo = "" if get(i_periodo) is None else str(get(i_periodo)).strip()
        programa = "" if get(i_programa) is None else str(get(i_programa)).strip()
        ciclo = _to_int(get(i_ciclo), None)
        curso = "" if get(i_curso) is None else str(get(i_curso)).strip()
        nota = _to_float(get(i_nota), None)

        if not doc or not periodo or not curso or nota is None:
            continue

        out.append({
            "__row__": ridx,
            "doc": doc,
            "periodo": periodo,
            "programa": programa,
            "ciclo": ciclo,
            "curso": curso,
            "nota": nota,
        })

    return out

# ─────────────────────────────────────────────────────────────
# Catálogos CRUD
# ─────────────────────────────────────────────────────────────

class PeriodsViewSet(viewsets.ModelViewSet):
    queryset = Period.objects.all()
    serializer_class = PeriodSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(Period, "start_date"):
            return qs.order_by("-start_date")
        return qs.order_by("-id")

    def list(self, request, *args, **kwargs):
        return list_items(self.serializer_class, self.get_queryset())

    @action(detail=True, methods=["post"], url_path="active")
    def set_active(self, request, pk=None):
        is_active = bool(request.data.get("is_active", False))
        p = self.get_object()
        if is_active:
            Period.objects.update(is_active=False)
        p.is_active = is_active
        p.save(update_fields=["is_active"])
        return Response({"ok": True, "id": p.id, "is_active": p.is_active})

class CampusesViewSet(viewsets.ModelViewSet):
    queryset = Campus.objects.all().order_by("name")
    serializer_class = CampusSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]

    def list(self, request, *args, **kwargs):
        return list_items(self.serializer_class, self.get_queryset())

class ClassroomsViewSet(viewsets.ModelViewSet):
    queryset = Classroom.objects.select_related("campus").all()
    serializer_class = ClassroomSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = super().get_queryset()
        campus_id = self.request.query_params.get("campus_id")
        if campus_id:
            qs = qs.filter(campus_id=campus_id)
        if hasattr(Classroom, "code"):
            return qs.order_by("campus__name", "code")
        return qs.order_by("campus__name", "id")

    def list(self, request, *args, **kwargs):
        return list_items(self.serializer_class, self.get_queryset())

class TeachersViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.select_related("user").all()
    serializer_class = TeacherSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = super().get_queryset()
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            cond = Q()
            if hasattr(Teacher, "document"):
                cond |= Q(document__icontains=q)
            if hasattr(Teacher, "email"):
                cond |= Q(email__icontains=q)
            if hasattr(Teacher, "phone"):
                cond |= Q(phone__icontains=q)
            if hasattr(Teacher, "specialization"):
                cond |= Q(specialization__icontains=q)
            cond |= (Q(user__full_name__icontains=q) | Q(user__username__icontains=q) | Q(user__email__icontains=q))
            qs = qs.filter(cond)
        return qs.order_by("user__full_name", "user__username", "id")

    def list(self, request, *args, **kwargs):
        return list_items(self.serializer_class, self.get_queryset())

# ─────────────────────────────────────────────────────────────
# Ubigeo (demo estático)
# ─────────────────────────────────────────────────────────────

UBIGEO_DATA = {
    "LIMA": {"LIMA": ["LIMA", "LA MOLINA", "SURCO", "MIRAFLORES"], "HUAURA": ["HUACHO", "HUALMAY"]},
    "PIURA": {"PIURA": ["PIURA", "CASTILLA"]},
}

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ubigeo_search(request):
    q = (request.query_params.get("q") or "").strip().upper()
    res = []
    if q:
        for dep, provs in UBIGEO_DATA.items():
            if q in dep:
                res.append({"department": dep})
            for prov, dists in provs.items():
                if q in prov:
                    res.append({"department": dep, "province": prov})
                for dist in dists:
                    if q in dist:
                        res.append({"department": dep, "province": prov, "district": dist})
    return Response(res[:50])

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ubigeo_departments(request):
    return Response(sorted(list(UBIGEO_DATA.keys())))

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ubigeo_provinces(request):
    dep = (request.query_params.get("department") or "").upper()
    return Response(sorted(list(UBIGEO_DATA.get(dep, {}).keys())))

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ubigeo_districts(request):
    dep = (request.query_params.get("department") or "").upper()
    prov = (request.query_params.get("province") or "").upper()
    return Response(sorted(UBIGEO_DATA.get(dep, {}).get(prov, [])))

# ─────────────────────────────────────────────────────────────
# Institution settings + media
# ─────────────────────────────────────────────────────────────

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def institution_settings(request):
    obj, _ = InstitutionSetting.objects.get_or_create(pk=1)
    if request.method == "GET":
        return Response(obj.data or {})
    obj.data = {**(obj.data or {}), **(request.data or {})}
    obj.save(update_fields=["data"])
    return Response(obj.data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def institution_media(request):
    file = request.FILES.get("file")
    kind = request.POST.get("kind")
    if not file or not kind:
        return Response({"detail": "file y kind requeridos"}, status=400)
    asset = MediaAsset.objects.create(kind=kind, file=file)
    return Response(MediaAssetSerializer(asset).data, status=201)

# ─────────────────────────────────────────────────────────────
# Import templates
# ─────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def imports_template(request, type: str):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    type = (type or "").lower().strip()
    wb = Workbook()
    ws = wb.active

    if type == "students":
        ws.title = "students"
        headers = [
            "REGIÓN","PROVINCIA","DISTRITO",
            "CÓDIGO_MODULAR","NOMBRE DE LA INSTITUCIÓN","GESTIÓN","TIPO",
            "Programa / Carrera","Ciclo","Turno","Seccion",
            "Apellido Paterno","Apellido Materno","Nombres",
            "Fecha Nac","Sexo","Num Documento",
            "Lengua","Periodo","Discapacidad","tipo de discapacidad",
        ]
        ws.append(headers)
        ws.append([
            "JUNIN","HUANCAYO","HUANCAYO",
            "123456","INSTITUTO X","PÚBLICA","IEST",
            "EDUCACIÓN INICIAL",1,"Mañana","A",
            "PEREZ","GOMEZ","JUAN",
            "2005-03-15","M","12345678",
            "CASTELLANO","2026-I","NO","",
        ])
        return _xlsx_response(wb, "students_template.xlsx")

    if type == "courses":
        ws.title = "courses"
        ws.append(["code","name","credits","hours","plan_id","semester","type"])
        ws.append(["SIS101","Introducción a Sistemas","3","3","1","1","MANDATORY"])
        return _xlsx_response(wb, "courses_template.xlsx")

    if type == "grades":
        ws.title = "grades"
        ws.append(["student_document","course_code","term","final_grade","PC1","PC2","EP","EF"])
        ws.append(["12345678","SIS101","2026-I","15","14","16","15","15"])
        return _xlsx_response(wb, "grades_template.xlsx")

    if type == "plans":
        # no hay plantilla real porque el plan viene por hojas (tu formato)
        ws.title = "info"
        ws.append(["Sube tu Plan de estudios .xlsx (con hojas por carrera)"])
        return _xlsx_response(wb, "plans_info.xlsx")

    return Response({"detail": "Tipo inválido"}, status=400)

# ─────────────────────────────────────────────────────────────
# Import start + status
# ─────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def imports_start(request, type: str):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    type = (type or "").lower().strip()
    file = request.FILES.get("file")
    mapping_raw = request.POST.get("mapping")
    mapping = {}

    if mapping_raw:
        try:
            mapping = json.loads(mapping_raw)
        except Exception:
            mapping = {}

    if not file:
        return Response({"detail": "file requerido"}, status=400)

    job = _retry_db(lambda: ImportJob.objects.create(type=type, file=file, mapping=mapping, status="RUNNING", result={}))

    errors: List[str] = []
    imported = 0
    updated = 0
    credentials: List[dict] = []

    try:
        # ✅ NO pongas un atomic global gigante (mata sqlite + rompe por 1 error)
        # atomic solo por batch en students

        # ============================================================
        # PLANS
        # ============================================================
        if type == "plans":
            fname = (getattr(file, "name", "") or "").lower()
            if fname.endswith(".xls"):
                return Response({"detail": "Convierte el plan de estudios a .xlsx (openpyxl no lee .xls)."}, status=400)
            if not fname.endswith(".xlsx"):
                return Response({"detail": "Para Plan de estudios sube un archivo .xlsx."}, status=400)

            created_careers = 0
            created_plans = 0
            created_courses = 0
            created_links = 0

            # 1) crear careers (Academic + Admission) por hoja
            wb_tmp = load_workbook(file, read_only=True, keep_links=False)
            sheet_names = list(wb_tmp.sheetnames)

            for sh in sheet_names:
                cn = _career_from_sheet_name(sh)
                if not cn:
                    continue

                if not Career.objects.filter(name__iexact=cn).exists():
                    Career.objects.create(name=cn)
                    created_careers += 1

                if AdmissionCareer is not None:
                    if not AdmissionCareer.objects.filter(name__iexact=cn).exists():
                        base = _slug_code(cn, 8)
                        code = base
                        k = 1
                        while AdmissionCareer.objects.filter(code__iexact=code).exists():
                            k += 1
                            code = f"{base[:6]}{k:02d}"

                        payload = {
                            "name": cn,
                            "code": code,
                            "duration_semesters": 0,
                            "vacancies": 0,
                            "is_active": True,
                        }
                        try:
                            AdmissionCareer.objects.create(**payload)
                        except Exception:
                            # no mates import por constraints raros
                            pass

            # reset puntero
            try:
                file.seek(0)
            except Exception:
                pass

            # 2) leer cursos reales (bloques)
            plan_rows = _read_study_plan_xlsx(file)

            for row in plan_rows:
                r = row.get("__row__", "?")
                career_name = (row.get("career_name") or "").strip()
                semester = row.get("semester")
                course_name = (row.get("course_name") or "").strip()
                credits = int(row.get("credits") or 0)

                if not career_name or not course_name or not semester:
                    errors.append(f"Fila {r}: carrera/semester/curso inválidos")
                    continue

                car = Career.objects.filter(name__iexact=career_name).first()
                if not car:
                    car = Career.objects.create(name=career_name)
                    created_careers += 1

                plan, plan_created = Plan.objects.get_or_create(
                    career=car,
                    name=f"Plan {career_name}",
                    defaults={"start_year": date.today().year, "semesters": 10},
                )
                if plan_created:
                    created_plans += 1

                # Course dedupe por nombre
                course = Course.objects.filter(name__iexact=course_name).first()
                if not course:
                    base = _slug_code(course_name, 10)
                    code = base
                    k = 1
                    while Course.objects.filter(code=code).exists():
                        k += 1
                        code = f"{base[:8]}{k:02d}"
                    course = Course.objects.create(code=code, name=course_name, credits=max(0, credits))
                    created_courses += 1
                else:
                    # ✅ SIEMPRE corrige credits si difiere
                    if int(credits) > 0 and int(course.credits or 0) != int(credits):
                        course.credits = int(credits)
                        course.save(update_fields=["credits"])

                pc, pc_created = PlanCourse.objects.get_or_create(
                    plan=plan,
                    course=course,
                    defaults={"semester": max(1, int(semester)), "weekly_hours": 3, "type": "MANDATORY"},
                )
                if pc_created:
                    created_links += 1
                else:
                    # corrige semester si difiere
                    if int(pc.semester or 0) != max(1, int(semester)):
                        pc.semester = max(1, int(semester))
                        pc.save(update_fields=["semester"])

                imported += 1

            # 3) actualizar duration_semesters en Admisión según max semester real
            if AdmissionCareer is not None:
                for car in Career.objects.all():
                    pl = Plan.objects.filter(career=car).first()
                    if not pl:
                        continue
                    mx = (PlanCourse.objects.filter(plan=pl).aggregate(mx=models.Max("semester")).get("mx")) or 0
                    if mx <= 0:
                        continue
                    adm = AdmissionCareer.objects.filter(name__iexact=car.name).first()
                    if adm and int(getattr(adm, "duration_semesters", 0) or 0) != int(mx):
                        adm.duration_semesters = int(mx)
                        adm.save(update_fields=["duration_semesters"])

            job.result = {"stats": {
                "created_careers": created_careers,
                "created_plans": created_plans,
                "created_courses": created_courses,
                "created_links": created_links,
            }}

        # ============================================================
        # STUDENTS / COURSES / GRADES
        # ============================================================
        elif type in ("students", "courses", "grades"):
            rows = _read_rows(file, mapping)

            # ----------------------------
            # STUDENTS
            # ----------------------------
            if type == "students":
                student_role, _ = _retry_db(lambda: Role.objects.get_or_create(name="STUDENT"))
                user_fields = {f.name for f in User._meta.fields}

                # info del campo email del user (si es unique)
                def _email_field_info():
                    try:
                        f = User._meta.get_field("email")
                        return {
                            "exists": True,
                            "unique": bool(getattr(f, "unique", False)),
                            "null": bool(getattr(f, "null", False)),
                        }
                    except Exception:
                        return {"exists": False, "unique": False, "null": False}

                EMAIL_INFO = _email_field_info()

                def _safe_unique_email(username: str, email: str):
                    email = (email or "").strip().lower()

                    # si viene email real, úsalo solo si no choca
                    if email:
                        conflict = User.objects.filter(email__iexact=email).exists()
                        if not conflict:
                            return email
                        errors.append(f"Email duplicado '{email}' (se usará dummy/NULL)")

                    # no hay email o está duplicado
                    if EMAIL_INFO["null"]:
                        return None  # NULL no choca unique en sqlite
                    if EMAIL_INFO["unique"]:
                        base = f"{username}@no-email.local"
                        e = base
                        k = 1
                        while User.objects.filter(email__iexact=e).exists():
                            k += 1
                            e = f"{username}-{k}@no-email.local"
                        return e
                    return ""

                def _set_name_fields(u, full_name: str):
                    if "full_name" in user_fields:
                        u.full_name = full_name
                    elif "name" in user_fields:
                        u.name = full_name

                def _ensure_user_for_student(st: Student, username: str, email: str, full_name: str, r: Any):
                    """
                    Crea o enlaza user SOLO si st.user es None.
                    Maneja email unique.
                    Retorna: (user, temp_password_or_none)
                    """
                    # ya tiene user
                    if st.user_id:
                        _retry_db(lambda: UserRole.objects.get_or_create(user_id=st.user_id, role_id=student_role.id))
                        return st.user, None

                    email_clean = (email or "").strip().lower()

                    # buscar por username
                    user = User.objects.filter(username=username).first()

                    # si no hay por username, buscar por email real (si existe)
                    if not user and email_clean:
                        user = User.objects.filter(email__iexact=email_clean).first()

                    # si el user ya está enlazado a otro estudiante, no usar
                    if user and Student.objects.filter(user_id=user.id).exists():
                        errors.append(f"Fila {r}: user '{getattr(user,'username','')}' ya está enlazado a otro estudiante")
                        return None, None

                    temp_password = None

                    if not user:
                        # username único
                        uname = username
                        k = 1
                        while User.objects.filter(username=uname).exists():
                            k += 1
                            uname = f"{username}-{k}"

                        user = User(username=uname, is_active=True, is_staff=False)

                        if "email" in user_fields:
                            user.email = _safe_unique_email(uname, email_clean)

                        _set_name_fields(user, full_name)

                        temp_password = get_random_string(10) + "!"
                        user.set_password(temp_password)

                        try:
                            _retry_db(lambda: user.save())
                        except IntegrityError as e:
                            # salvavidas
                            if "email" in str(e).lower() and "email" in user_fields:
                                user.email = _safe_unique_email(user.username, "")
                                _retry_db(lambda: user.save())
                                errors.append(f"Fila {r}: choque UNIQUE email (reintento ok)")
                            else:
                                raise
                    else:
                        # update seguro
                        changed = False
                        _set_name_fields(user, full_name)
                        changed = True

                        if "email" in user_fields and email_clean:
                            conflict = User.objects.filter(email__iexact=email_clean).exclude(id=user.id).exists()
                            if not conflict and (getattr(user, "email", "") or "").lower() != email_clean:
                                user.email = email_clean
                                changed = True

                        if not getattr(user, "is_active", True):
                            user.is_active = True
                            changed = True

                        if changed:
                            try:
                                _retry_db(lambda: user.save())
                            except IntegrityError as e:
                                if "email" in str(e).lower():
                                    errors.append(f"Fila {r}: update email falló por duplicado (omitido)")
                                else:
                                    raise

                    # rol STUDENT (ACL real)
                    _retry_db(lambda: UserRole.objects.get_or_create(user_id=user.id, role_id=student_role.id))

                    # enlazar student -> user
                    st.user = user
                    _retry_db(lambda: st.save(update_fields=["user"]))
                    return user, temp_password

                BATCH = 200
                buffer: List[Tuple[Any, dict]] = []

                def flush_batch(batch_rows: List[Tuple[Any, dict]]):
                    nonlocal imported, updated
                    with transaction.atomic():
                        for (r, payload) in batch_rows:
                            num_documento = payload["num_documento"]
                            nombres = payload["nombres"]
                            ap_pat = payload["ap_pat"]
                            ap_mat = payload["ap_mat"]
                            sexo = payload["sexo"]
                            fecha_nac = payload["fecha_nac"]

                            region = payload["region"]
                            provincia = payload["provincia"]
                            distrito = payload["distrito"]

                            codigo_modular = payload["codigo_modular"]
                            nombre_institucion = payload["nombre_institucion"]
                            gestion = payload["gestion"]
                            tipo_inst = payload["tipo_inst"]

                            programa_carrera = payload["programa_carrera"]
                            ciclo = payload["ciclo"]
                            turno = payload["turno"]
                            seccion = payload["seccion"]
                            periodo = payload["periodo"]
                            lengua = payload["lengua"]
                            discapacidad = payload["discapacidad"]
                            tipo_discapacidad = payload["tipo_discapacidad"]

                            # si no vienen, quedan ""
                            email = payload.get("email", "")
                            celular = payload.get("celular", "")

                            # Period catálogo
                            if periodo:
                                y, t = _parse_period_code(periodo)
                                if y and t:
                                    _retry_db(lambda: Period.objects.get_or_create(
                                        code=periodo,
                                        defaults={"year": y, "term": t, "label": periodo, "is_active": False},
                                    ))

                            # Plan FK
                            plan_obj = None
                            if programa_carrera:
                                car, _ = _retry_db(lambda: Career.objects.get_or_create(name=programa_carrera))
                                plan_obj, _ = _retry_db(lambda: Plan.objects.get_or_create(
                                    career=car,
                                    name=f"Plan {programa_carrera}",
                                    defaults={"start_year": date.today().year, "semesters": 10},
                                ))

                            # upsert student
                            st, created = _retry_db(lambda: Student.objects.get_or_create(
                                num_documento=num_documento,
                                defaults={"nombres": nombres, "apellido_paterno": ap_pat, "apellido_materno": ap_mat},
                            ))

                            # update always
                            st.nombres = nombres
                            st.apellido_paterno = ap_pat
                            st.apellido_materno = ap_mat
                            st.sexo = sexo
                            if fecha_nac:
                                st.fecha_nac = fecha_nac

                            st.region = region
                            st.provincia = provincia
                            st.distrito = distrito
                            st.codigo_modular = codigo_modular
                            st.nombre_institucion = nombre_institucion
                            st.gestion = gestion
                            st.tipo = tipo_inst

                            st.programa_carrera = programa_carrera
                            st.ciclo = ciclo
                            st.turno = turno
                            st.seccion = seccion
                            st.periodo = periodo
                            st.lengua = lengua
                            st.discapacidad = discapacidad
                            st.tipo_discapacidad = tipo_discapacidad

                            st.email = email
                            st.celular = celular
                            st.plan = plan_obj

                            # credenciales SOLO si no tiene user
                            username = num_documento
                            full_name = f"{nombres} {ap_pat} {ap_mat}".strip()
                            user, temp_password = _ensure_user_for_student(st, username, email, full_name, r)

                            _retry_db(lambda: st.save())

                            if temp_password and user:
                                credentials.append({
                                    "row": r,
                                    "num_documento": num_documento,
                                    "username": getattr(user, "username", username),
                                    "password": temp_password,
                                })

                            if created:
                                imported += 1
                            else:
                                updated += 1

                # parse rows to batch
                for row in rows:
                    r = row.get("__row__", "?")

                    num_documento = str(row.get("num_documento", "")).strip()
                    nombres = str(row.get("nombres", "")).strip()
                    ap_pat = str(row.get("apellido_paterno", "")).strip()
                    ap_mat = str(row.get("apellido_materno", "")).strip()
                    sexo = str(row.get("sexo", "")).strip()

                    fecha_val = row.get("fecha_nac")
                    if hasattr(fecha_val, "year") and hasattr(fecha_val, "month") and hasattr(fecha_val, "day"):
                        fecha_nac = fecha_val
                    else:
                        fecha_nac = _parse_date_yyyy_mm_dd(str(fecha_val).strip())

                    if not num_documento or not nombres:
                        errors.append(f"Fila {r}: Num Documento y Nombres son requeridos")
                        continue

                    payload = {
                        "num_documento": num_documento,
                        "nombres": nombres,
                        "ap_pat": ap_pat,
                        "ap_mat": ap_mat,
                        "sexo": sexo,
                        "fecha_nac": fecha_nac,
                        "region": str(row.get("region", "")).strip(),
                        "provincia": str(row.get("provincia", "")).strip(),
                        "distrito": str(row.get("distrito", "")).strip(),
                        "codigo_modular": str(row.get("codigo_modular", "")).strip(),
                        "nombre_institucion": str(row.get("nombre_institucion", "")).strip(),
                        "gestion": str(row.get("gestion", "")).strip(),
                        "tipo_inst": str(row.get("tipo", "")).strip(),
                        "programa_carrera": str(row.get("programa_carrera", "")).strip(),
                        "ciclo": _to_int(row.get("ciclo"), None),
                        "turno": str(row.get("turno", "")).strip(),
                        "seccion": str(row.get("seccion", "")).strip(),
                        "periodo": str(row.get("periodo", "")).strip(),
                        "lengua": str(row.get("lengua", "")).strip(),
                        "discapacidad": str(row.get("discapacidad", "")).strip(),
                        "tipo_discapacidad": str(row.get("tipo_discapacidad", "")).strip(),
                        # tu excel no trae -> queda ""
                        "email": str(row.get("email", "") or "").strip().lower(),
                        "celular": str(row.get("celular", "") or "").strip(),
                    }

                    buffer.append((r, payload))
                    if len(buffer) >= BATCH:
                        flush_batch(buffer)
                        buffer = []

                if buffer:
                    flush_batch(buffer)
                    buffer = []

            # ----------------------------
            # COURSES (manual template)
            # ----------------------------
            elif type == "courses":
                for row in rows:
                    r = row.get("__row__", "?")
                    code = str(row.get("code", "")).strip()
                    name = str(row.get("name", "")).strip()
                    credits = _to_int(row.get("credits"), None)
                    hours = _to_int(row.get("hours"), None)
                    if not code or not name:
                        errors.append(f"Fila {r}: code y name requeridos")
                        continue

                    course, _ = Course.objects.get_or_create(
                        code=code,
                        defaults={"name": name, "credits": max(0, credits or 0)},
                    )
                    course.name = name
                    if credits is not None:
                        course.credits = max(0, int(credits))
                    course.save()

                    plan_id = _to_int(row.get("plan_id"), None)
                    semester = _to_int(row.get("semester"), None)
                    ctype = str(row.get("type", "")).strip().upper()

                    if plan_id and semester:
                        plan = Plan.objects.filter(id=plan_id).first()
                        if not plan:
                            errors.append(f"Fila {r}: plan_id {plan_id} no existe")
                            continue

                        if ctype in ("OBLIGATORIO", "MANDATORY", "M"):
                            type_db = "MANDATORY"
                        elif ctype in ("ELECTIVO", "ELECTIVE", "E"):
                            type_db = "ELECTIVE"
                        else:
                            type_db = "MANDATORY"

                        pc, pc_created = PlanCourse.objects.get_or_create(
                            plan=plan,
                            course=course,
                            defaults={"semester": max(1, int(semester)), "weekly_hours": max(1, int(hours or 3)), "type": type_db},
                        )
                        if not pc_created:
                            if int(pc.semester or 0) != max(1, int(semester)):
                                pc.semester = max(1, int(semester))
                            pc.weekly_hours = max(1, int(hours or pc.weekly_hours or 3))
                            pc.type = type_db
                            pc.save()

                    imported += 1

            # ----------------------------
            # GRADES (CALIFICACIONES.xlsx)
            # ----------------------------
            elif type == "grades":
                if AcademicGradeRecord is None:
                    return Response({"detail": "AcademicGradeRecord no está implementado. Agrega el modelo y migra."}, status=400)

                cal_rows = _read_calificaciones_xlsx(file)

                for row in cal_rows:
                    r = row.get("__row__", "?")
                    doc = row["doc"]
                    term = row["periodo"]
                    ciclo = row.get("ciclo")
                    course_name = row["curso"]
                    final = row["nota"]

                    st = Student.objects.filter(num_documento=doc).first()
                    if not st:
                        errors.append(f"Fila {r}: no existe alumno con Num Documento {doc}")
                        continue

                    # Period catálogo si es 2024-I
                    y, t = _parse_period_code(term)
                    if y and t:
                        Period.objects.get_or_create(
                            code=term,
                            defaults={"year": y, "term": t, "label": term, "is_active": False},
                        )

                    # curso por nombre (case-insensitive)
                    course = Course.objects.filter(name__iexact=course_name).first()
                    if not course:
                        # fallback: crear curso para no perder nota
                        base = _slug_code(course_name, 10)
                        code = base
                        k = 1
                        while Course.objects.filter(code=code).exists():
                            k += 1
                            code = f"{base[:8]}{k:02d}"
                        course = Course.objects.create(code=code, name=course_name, credits=0)

                    # asegurar PlanCourse si hay plan + ciclo
                    if st.plan_id and ciclo:
                        PlanCourse.objects.get_or_create(
                            plan_id=st.plan_id,
                            course=course,
                            defaults={"semester": max(1, int(ciclo)), "weekly_hours": 3, "type": "MANDATORY"},
                        )

                    rec, created = AcademicGradeRecord.objects.get_or_create(
                        student=st,
                        course=course,
                        term=term,
                        defaults={"final_grade": float(final), "components": {}},
                    )
                    if not created:
                        rec.final_grade = float(final)
                        rec.save(update_fields=["final_grade"])

                    imported += 1

        else:
            return Response({"detail": "Tipo inválido"}, status=400)

        # OK
        job.status = "COMPLETED"
        if not isinstance(job.result, dict) or not job.result:
            job.result = {}
        job.result = {
            **job.result,
            "imported": imported,
            "updated": updated,
            "errors": errors,
            "credentials": credentials[:300],
        }
        job.save(update_fields=["status", "result"])
        return Response({"job_id": job.id})

    except Exception as e:
        job.status = "FAILED"
        job.result = {"imported": imported, "updated": updated, "errors": errors + [str(e)]}
        try:
            job.save(update_fields=["status", "result"])
        except Exception:
            pass
        return Response({"job_id": job.id, "detail": "Import failed", "error": str(e)}, status=500)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def imports_status(request, jobId: int):
    try:
        job = ImportJob.objects.get(pk=jobId)
    except ImportJob.DoesNotExist:
        return Response({"detail": "job not found"}, status=404)

    result = job.result if isinstance(job.result, dict) else {}
    return Response({
        "id": job.id,
        "state": job.status,
        "progress": 100 if job.status in ("COMPLETED", "FAILED") else 0,
        "errors": result.get("errors") or [],
        "imported": result.get("imported", 0),
        "updated": result.get("updated", 0),
        "credentials": result.get("credentials") or [],
        "stats": result.get("stats") or {},
    })

# ─────────────────────────────────────────────────────────────
# Backups / Export dataset
# ─────────────────────────────────────────────────────────────

def _zip_add_folder(zf: zipfile.ZipFile, folder_path: str, arc_prefix: str):
    folder_path = os.path.abspath(folder_path)
    if not os.path.exists(folder_path):
        return
    for root, _, files in os.walk(folder_path):
        for f in files:
            fp = os.path.join(root, f)
            rel = os.path.relpath(fp, folder_path).replace("\\", "/")
            zf.write(fp, f"{arc_prefix}/{rel}")

def _dumpdata_json_bytes():
    buf = io.StringIO()
    call_command("dumpdata", "--natural-foreign", "--natural-primary", "--indent", "2", stdout=buf)
    return buf.getvalue().encode("utf-8")

def _try_add_sqlite_db(zf: zipfile.ZipFile):
    try:
        db = settings.DATABASES.get("default", {})
        if db.get("ENGINE") == "django.db.backends.sqlite3":
            name = db.get("NAME")
            if name and os.path.exists(name):
                zf.write(str(name), "db/db.sqlite3")
    except Exception:
        pass

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def backups_collection(request):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    if request.method == "GET":
        qs = BackupExport.objects.all().order_by("-created_at")
        return Response({"items": BackupExportSerializer(qs, many=True).data})

    scope = (request.data.get("scope") or "FULL").upper().strip()
    if scope not in ("FULL", "DATA_ONLY", "FILES_ONLY"):
        return Response({"detail": "scope inválido (FULL|DATA_ONLY|FILES_ONLY)"}, status=400)

    obj = BackupExport.objects.create(scope=scope)

    now = datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_name = f"backup_{scope.lower()}_{now}.zip"

    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        if scope in ("FULL", "DATA_ONLY"):
            zf.writestr("data/dumpdata.json", _dumpdata_json_bytes())
            _try_add_sqlite_db(zf)

        if scope in ("FULL", "FILES_ONLY"):
            media_root = getattr(settings, "MEDIA_ROOT", None)
            if media_root:
                _zip_add_folder(zf, str(media_root), "media")

        zf.writestr("meta/info.txt", f"scope={scope}\ncreated_at={now}\n")

    zbuf.seek(0)
    obj.file.save(zip_name, ContentFile(zbuf.getvalue()))
    obj.save(update_fields=["file"])

    return Response({
        "id": obj.id,
        "scope": obj.scope,
        "file_url": obj.file.url if obj.file else None,
    }, status=201)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def backup_download(request, id: int):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    try:
        b = BackupExport.objects.get(pk=id)
    except BackupExport.DoesNotExist:
        raise Http404

    if not b.file:
        raise Http404

    return FileResponse(b.file.open("rb"), as_attachment=True, filename=os.path.basename(b.file.name))

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def export_dataset(request):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    dataset = (request.data.get("dataset") or "DATA").upper().strip()
    now = datetime.now().strftime("%Y%m%d_%H%M%S")

    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        if dataset == "STUDENTS":
            rows = list(Student.objects.all().values(
                "num_documento","nombres","apellido_paterno","apellido_materno",
                "sexo","fecha_nac",
                "region","provincia","distrito",
                "codigo_modular","nombre_institucion","gestion","tipo",
                "programa_carrera","ciclo","turno","seccion","periodo",
                "lengua","discapacidad","tipo_discapacidad",
                "email","celular","plan_id","user_id",
            ))
            headers = [
                "num_documento","nombres","apellido_paterno","apellido_materno",
                "sexo","fecha_nac",
                "region","provincia","distrito",
                "codigo_modular","nombre_institucion","gestion","tipo",
                "programa_carrera","ciclo","turno","seccion","periodo",
                "lengua","discapacidad","tipo_discapacidad",
                "email","celular","plan_id","user_id",
            ]
            zf.writestr(f"students_{now}.csv", _csv_bytes(rows, headers))

        elif dataset == "COURSES":
            rows = list(Course.objects.all().values("code","name","credits"))
            headers = ["code","name","credits"]
            zf.writestr(f"courses_{now}.csv", _csv_bytes(rows, headers))

            pc_rows = list(PlanCourse.objects.all().values("plan_id","course_id","semester","weekly_hours","type"))
            pc_headers = ["plan_id","course_id","semester","weekly_hours","type"]
            zf.writestr(f"plan_courses_{now}.csv", _csv_bytes(pc_rows, pc_headers))

        elif dataset == "GRADES":
            if AcademicGradeRecord is None:
                return Response({"detail": "AcademicGradeRecord no existe. Agrégalo y migra."}, status=400)

            rows = list(AcademicGradeRecord.objects.select_related("student","course").values(
                "student__num_documento","course__code","term","final_grade","components"
            ))
            headers = ["student__num_documento","course__code","term","final_grade","components"]
            zf.writestr(f"grades_{now}.csv", _csv_bytes(rows, headers))

        elif dataset == "CATALOGS":
            p_rows = list(Period.objects.all().values("code","year","term","start_date","end_date","is_active","label"))
            p_headers = ["code","year","term","start_date","end_date","is_active","label"]
            zf.writestr(f"catalog_periods_{now}.csv", _csv_bytes(p_rows, p_headers))

            c_rows = list(Campus.objects.all().values("code","name","address"))
            c_headers = ["code","name","address"]
            zf.writestr(f"catalog_campuses_{now}.csv", _csv_bytes(c_rows, c_headers))

            a_rows = list(Classroom.objects.all().values("campus_id","code","name","capacity"))
            a_headers = ["campus_id","code","name","capacity"]
            zf.writestr(f"catalog_classrooms_{now}.csv", _csv_bytes(a_rows, a_headers))

            t_rows = list(Teacher.objects.all().values("document","full_name","email","phone","specialization"))
            t_headers = ["document","full_name","email","phone","specialization"]
            zf.writestr(f"catalog_teachers_{now}.csv", _csv_bytes(t_rows, t_headers))

            ac_rows = list(Career.objects.all().values("id","name"))
            ac_headers = ["id","name"]
            zf.writestr(f"academic_careers_{now}.csv", _csv_bytes(ac_rows, ac_headers))

            pl_rows = list(Plan.objects.all().values("id","career_id","name","start_year","semesters"))
            pl_headers = ["id","career_id","name","start_year","semesters"]
            zf.writestr(f"academic_plans_{now}.csv", _csv_bytes(pl_rows, pl_headers))

        else:
            return Response({"detail": "dataset inválido"}, status=400)

        zf.writestr("meta/info.txt", f"dataset={dataset}\ncreated_at={now}\n")

    zbuf.seek(0)
    obj = BackupExport.objects.create(scope=f"DATASET_{dataset}")
    filename = f"export_{dataset.lower()}_{now}.zip"
    obj.file.save(filename, ContentFile(zbuf.getvalue()))
    obj.save(update_fields=["file"])

    return Response({
        "ok": True,
        "dataset": dataset,
        "backup_id": obj.id,
        "download_url": f"/catalogs/exports/backups/{obj.id}/download",
    })
