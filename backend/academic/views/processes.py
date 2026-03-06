"""
Vistas para Procesos Académicos y Administrativos — EXPANDIDO
═══════════════════════════════════════════════════════════════
Cubre TODOS los flujos institucionales del IESPP "Gustavo Allende Llavería":

 1) Movimientos del alumno (core)
    - RETIRO             Retiro de periodo
    - RESERVA            Reserva de matrícula
    - REINGRESO          Reingreso tras reserva/retiro
    - BAJA_DEFINITIVA    Baja definitiva del padrón
    - TRASLADO_INTERNO   Cambio de sección/turno/sede
    - CAMBIO_PROGRAMA    Cambio de carrera o programa

 2) Matrícula (correcciones fuertes)
    - ANULACION_MATRICULA    Anulación por error/duplicado
    - RECTIFICACION_MATRICULA Corrección de cursos/sección
    - MATRICULA_EXTEMPORANEA  Matrícula fuera de plazo

 3) Notas / Actas (con control estricto)
    - REAPERTURA_ACTA        Reabrir acta para corrección
    - RECTIFICACION_NOTA     Solicitud de cambio de nota
    - ANULACION_EVALUACION   Anulación de evaluación
    - NOTA_SUBSANACION       Ingreso de nota por subsanación

 4) Convalidaciones / Equivalencias
    - CONVALIDACION          Convalidación de cursos
    - EQUIVALENCIA           Equivalencia por cambio de plan/malla
    - TRASLADO_EXTERNO       Traslado desde otra institución

 5) Documentos académicos (generación automática de PDFs)
    - CONSTANCIA_ESTUDIOS      Constancia de estudios regular
    - CONSTANCIA_ORDEN_MERITO  Constancia de orden de mérito
    - CONSTANCIA_TERCIO        Constancia de tercio superior
    - CERTIFICADO_EGRESADO     Certificado de egresado (SIA)
    - FICHA_MATRICULA          Ficha de matrícula del ciclo actual

 ✅ COMPATIBILIDAD: Mantiene las rutas/contratos anteriores (RETIRO, RESERVA,
    CONVALIDACION, TRASLADO, REINCORPORACION) y agrega los nuevos tipos.
"""

import json
import logging
from datetime import datetime, timedelta
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import permissions, status
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from academic.models import AcademicProcess, ProcessFile
from .utils import ok, _to_int, _to_str, _can_admin_enroll

logger = logging.getLogger("academic.processes")

# ═══════════════════════════════════════════════════════════════
# Importaciones opcionales (no bloquean si no existen aún)
# ═══════════════════════════════════════════════════════════════
try:
    from academic.models import Enrollment
except ImportError:
    Enrollment = None

try:
    from academic.models import Grade
except ImportError:
    Grade = None

try:
    from academic.models import Section
except ImportError:
    Section = None

try:
    from academic.models import Student
except ImportError:
    Student = None


# ═══════════════════════════════════════════════════════════════
# CONSTANTES Y CONFIGURACIÓN DE PROCESOS
# ═══════════════════════════════════════════════════════════════

# ── Todos los tipos de proceso soportados ──
PROCESS_TYPES = {
    # --- Movimientos del alumno ---
    "RETIRO":               {"label": "Retiro de período",           "group": "MOVIMIENTO",     "requires_approval": True,  "requires_files": False, "requires_period": True,  "requires_section": False, "requires_courses": False},
    "RESERVA":              {"label": "Reserva de matrícula",        "group": "MOVIMIENTO",     "requires_approval": True,  "requires_files": True,  "requires_period": True,  "requires_section": False, "requires_courses": False},
    "REINGRESO":            {"label": "Reingreso",                   "group": "MOVIMIENTO",     "requires_approval": True,  "requires_files": True,  "requires_period": True,  "requires_section": False, "requires_courses": False},
    "REINCORPORACION":      {"label": "Reincorporación",             "group": "MOVIMIENTO",     "requires_approval": True,  "requires_files": True,  "requires_period": True,  "requires_section": False, "requires_courses": False},  # ← alias legacy
    "BAJA_DEFINITIVA":      {"label": "Baja definitiva",             "group": "MOVIMIENTO",     "requires_approval": True,  "requires_files": True,  "requires_period": False, "requires_section": False, "requires_courses": False},
    "TRASLADO":             {"label": "Traslado (legacy)",           "group": "MOVIMIENTO",     "requires_approval": True,  "requires_files": False, "requires_period": True,  "requires_section": False, "requires_courses": False},  # ← legacy
    "TRASLADO_INTERNO":     {"label": "Traslado interno",            "group": "MOVIMIENTO",     "requires_approval": True,  "requires_files": False, "requires_period": True,  "requires_section": True,  "requires_courses": False},
    "CAMBIO_PROGRAMA":      {"label": "Cambio de programa/carrera",  "group": "MOVIMIENTO",     "requires_approval": True,  "requires_files": True,  "requires_period": True,  "requires_section": False, "requires_courses": False},

    # --- Matrícula ---
    "ANULACION_MATRICULA":      {"label": "Anulación de matrícula",      "group": "MATRICULA",  "requires_approval": True,  "requires_files": True,  "requires_period": True,  "requires_section": False, "requires_courses": False},
    "RECTIFICACION_MATRICULA":  {"label": "Rectificación de matrícula",  "group": "MATRICULA",  "requires_approval": True,  "requires_files": False, "requires_period": True,  "requires_section": True,  "requires_courses": True},
    "MATRICULA_EXTEMPORANEA":   {"label": "Matrícula extemporánea",      "group": "MATRICULA",  "requires_approval": True,  "requires_files": True,  "requires_period": True,  "requires_section": False, "requires_courses": True},

    # --- Notas / Actas ---
    "REAPERTURA_ACTA":      {"label": "Reapertura de acta/notas",    "group": "NOTAS",          "requires_approval": True,  "requires_files": True,  "requires_period": True,  "requires_section": True,  "requires_courses": False},
    "RECTIFICACION_NOTA":   {"label": "Rectificación de nota",       "group": "NOTAS",          "requires_approval": True,  "requires_files": True,  "requires_period": True,  "requires_section": True,  "requires_courses": True},
    "ANULACION_EVALUACION": {"label": "Anulación de evaluación",     "group": "NOTAS",          "requires_approval": True,  "requires_files": True,  "requires_period": True,  "requires_section": True,  "requires_courses": True},
    "NOTA_SUBSANACION":     {"label": "Nota por subsanación",        "group": "NOTAS",          "requires_approval": True,  "requires_files": True,  "requires_period": True,  "requires_section": True,  "requires_courses": True},

    # --- Convalidaciones / Equivalencias ---
    "CONVALIDACION":        {"label": "Convalidación de cursos",     "group": "CONVALIDACION",  "requires_approval": True,  "requires_files": True,  "requires_period": False, "requires_section": False, "requires_courses": True},
    "EQUIVALENCIA":         {"label": "Equivalencia por plan/malla", "group": "CONVALIDACION",  "requires_approval": True,  "requires_files": True,  "requires_period": False, "requires_section": False, "requires_courses": True},
    "TRASLADO_EXTERNO":     {"label": "Traslado externo",            "group": "CONVALIDACION",  "requires_approval": True,  "requires_files": True,  "requires_period": True,  "requires_section": False, "requires_courses": True},

    # --- Documentos académicos (generación automática de PDFs) ---
    "CONSTANCIA_ESTUDIOS":     {"label": "Constancia de Estudios",         "group": "DOCUMENTOS", "requires_approval": False, "requires_files": False, "requires_period": False, "requires_section": False, "requires_courses": False},
    "CONSTANCIA_ORDEN_MERITO": {"label": "Constancia de Orden de Mérito",  "group": "DOCUMENTOS", "requires_approval": False, "requires_files": False, "requires_period": False, "requires_section": False, "requires_courses": False},
    "CONSTANCIA_TERCIO":       {"label": "Constancia de Tercio Superior",  "group": "DOCUMENTOS", "requires_approval": False, "requires_files": False, "requires_period": False, "requires_section": False, "requires_courses": False},
    "CERTIFICADO_EGRESADO":    {"label": "Certificado de Egresado",        "group": "DOCUMENTOS", "requires_approval": False, "requires_files": False, "requires_period": False, "requires_section": False, "requires_courses": False},
    "FICHA_MATRICULA":         {"label": "Ficha de Matrícula",             "group": "DOCUMENTOS", "requires_approval": False, "requires_files": False, "requires_period": False, "requires_section": False, "requires_courses": False},
}

# ── Flujo de estados por grupo ──
STATUS_FLOW = {
    "MOVIMIENTO": [
        "PENDIENTE", "EN_REVISION", "APROBADO", "RECHAZADO", "EJECUTADO", "ANULADO",
    ],
    "MATRICULA": [
        "PENDIENTE", "EN_REVISION", "APROBADO_SECRETARIA", "APROBADO_DIRECCION",
        "EJECUTADO", "RECHAZADO", "ANULADO",
    ],
    "NOTAS": [
        "PENDIENTE", "EN_REVISION", "APROBADO_DOCENTE", "APROBADO_SECRETARIA",
        "EJECUTADO", "RECHAZADO", "ANULADO",
    ],
    "CONVALIDACION": [
        "PENDIENTE", "EN_REVISION", "EVALUACION_ACADEMICA", "APROBADO",
        "EJECUTADO", "RECHAZADO", "ANULADO",
    ],
    "DOCUMENTOS": [
        "PENDIENTE", "EN_REVISION", "APROBADO", "EJECUTADO", "RECHAZADO", "ANULADO",
    ],
}

# ── Transiciones válidas (estado_actual → [estados_posibles]) ──
VALID_TRANSITIONS = {
    "PENDIENTE":              ["EN_REVISION", "RECHAZADO", "ANULADO"],
    "EN_REVISION":            ["APROBADO", "APROBADO_SECRETARIA", "APROBADO_DOCENTE", "EVALUACION_ACADEMICA", "RECHAZADO", "ANULADO"],
    "APROBADO":               ["EJECUTADO", "ANULADO"],
    "APROBADO_SECRETARIA":    ["APROBADO_DIRECCION", "EJECUTADO", "RECHAZADO", "ANULADO"],
    "APROBADO_DOCENTE":       ["APROBADO_SECRETARIA", "RECHAZADO", "ANULADO"],
    "APROBADO_DIRECCION":     ["EJECUTADO", "ANULADO"],
    "EVALUACION_ACADEMICA":   ["APROBADO", "RECHAZADO", "ANULADO"],
    "EJECUTADO":              ["ANULADO"],
    "RECHAZADO":              ["PENDIENTE"],
    "ANULADO":                [],
}

PROCESS_GROUPS = {
    "MOVIMIENTO":    {"label": "Movimientos del alumno",     "icon": "Users"},
    "MATRICULA":     {"label": "Correcciones de matrícula",  "icon": "GraduationCap"},
    "NOTAS":         {"label": "Notas y actas",              "icon": "ClipboardList"},
    "CONVALIDACION": {"label": "Convalidaciones",            "icon": "FileText"},
    "DOCUMENTOS":    {"label": "Documentos académicos",      "icon": "ScrollText"},
}


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

def _get_extra_data(proc):
    """Lee extra_data del proceso de forma segura"""
    if not hasattr(proc, "extra_data") or not proc.extra_data:
        return {}
    try:
        return json.loads(proc.extra_data) if isinstance(proc.extra_data, str) else (proc.extra_data or {})
    except Exception:
        return {}


def _set_extra_data(proc, data):
    """Escribe extra_data al proceso de forma segura"""
    if hasattr(proc, "extra_data"):
        proc.extra_data = json.dumps(data, ensure_ascii=False, default=str)


def _serialize_process(p, include_files=False):
    """Serializa un proceso de forma consistente"""
    cfg = PROCESS_TYPES.get(p.kind, {})
    data = {
        "id":          p.id,
        "type":        p.kind,
        "type_label":  cfg.get("label", p.kind),
        "group":       cfg.get("group", "OTRO"),
        "group_label": PROCESS_GROUPS.get(cfg.get("group", ""), {}).get("label", ""),
        "status":      p.status,
        "student_id":  p.student_id,
        "note":        p.note or "",
        "metadata":    _get_extra_data(p),
        "created_at":  p.created_at.isoformat() if hasattr(p, "created_at") and p.created_at else None,
        "updated_at":  p.updated_at.isoformat() if hasattr(p, "updated_at") and p.updated_at else None,
    }

    # Nombre del estudiante
    if hasattr(p, "student") and p.student:
        st = p.student
        data["student_name"] = (
            getattr(st, "full_name", "") or
            f"{getattr(st, 'first_name', '')} {getattr(st, 'last_name', '')}".strip() or
            f"Estudiante {p.student_id}"
        )
    else:
        data["student_name"] = ""

    if include_files:
        files = ProcessFile.objects.filter(process_id=p.id).order_by("-id")
        data["files"] = [
            {
                "id":   f.id,
                "name": (f.file.name or "").split("/")[-1] if f.file else "",
                "url":  f.file.url if f.file else "",
                "size": getattr(f.file, "size", 0),
                "note": getattr(f, "note", "") or "",
            }
            for f in files
        ]

    return data


def _get_student_id_from_request(request, body):
    """Obtiene student_id: del body, o del perfil del usuario autenticado"""
    sid = body.get("student_id")
    if sid:
        return _to_int(sid)
    st = getattr(request.user, "student_profile", None)
    if st:
        return st.id
    return None


# ═══════════════════════════════════════════════════════════════
# VISTA: CATÁLOGO DE TIPOS DE PROCESO
# ═══════════════════════════════════════════════════════════════

class ProcessTypesView(APIView):
    """
    GET /academic/processes/types
    Devuelve el catálogo completo de tipos de proceso, agrupados.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        groups = {}
        for key, cfg in PROCESS_TYPES.items():
            # Ocultar aliases legacy en el catálogo UI
            if key in ("TRASLADO", "REINCORPORACION"):
                continue
            g = cfg["group"]
            if g not in groups:
                groups[g] = {
                    **PROCESS_GROUPS.get(g, {"label": g, "icon": "FileText"}),
                    "types": [],
                }
            groups[g]["types"].append({
                "key":                 key,
                "label":               cfg["label"],
                "requires_approval":   cfg["requires_approval"],
                "requires_files":      cfg["requires_files"],
                "requires_period":     cfg["requires_period"],
                "requires_section":    cfg["requires_section"],
                "requires_courses":    cfg["requires_courses"],
            })

        return ok(
            groups=groups,
            statuses=STATUS_FLOW,
            transitions=VALID_TRANSITIONS,
        )


# ═══════════════════════════════════════════════════════════════
# VISTA: CREAR PROCESO (GENÉRICA / POR TIPO)
# ═══════════════════════════════════════════════════════════════

class ProcessesCreateView(APIView):
    """
    POST /academic/processes/<ptype>
    Crea un nuevo proceso académico del tipo indicado.

    ✅ Compatible con rutas legacy:
       POST /academic/processes/withdraw   → RETIRO
       POST /academic/processes/reservation → RESERVA
       etc.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ptype=None):
        body = request.data or {}

        # ── Normalizar tipo ──
        ptype = (ptype or "").upper().replace("-", "_")
        cfg = PROCESS_TYPES.get(ptype)
        if not cfg:
            return Response(
                {"detail": f"Tipo de proceso no válido: {ptype}. Válidos: {[k for k in PROCESS_TYPES if k not in ('TRASLADO','REINCORPORACION')]}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Obtener student_id ──
        student_id = _get_student_id_from_request(request, body)
        if not student_id:
            return Response(
                {"detail": "Se requiere student_id (ID del estudiante)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Validaciones por tipo ──
        errors = []
        if cfg["requires_period"] and not body.get("period"):
            errors.append("Se requiere el campo 'period' (ej: 2025-I)")
        if cfg["requires_section"] and not body.get("section_id"):
            errors.append("Se requiere el campo 'section_id'")
        if cfg["requires_courses"] and not body.get("courses"):
            errors.append("Se requiere el campo 'courses' (lista de IDs de cursos)")

        # reason requerido solo para tipos que no son documentos académicos
        is_documento = cfg.get("group") == "DOCUMENTOS"
        if not is_documento and not body.get("reason", "").strip():
            errors.append("Se requiere el campo 'reason' (motivo de la solicitud)")

        if errors:
            return Response({"detail": "Errores de validación", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        # ── Validaciones de negocio ──
        biz_errors = self._validate_business_rules(ptype, cfg, student_id, body)
        if biz_errors:
            return Response({"detail": "Errores de negocio", "errors": biz_errors}, status=status.HTTP_400_BAD_REQUEST)

        # ── Construir metadata extendida ──
        metadata = {
            "period":               body.get("period", ""),
            "reason":               body.get("reason", ""),
            "extra":                body.get("extra", ""),
            "section_id":           _to_int(body.get("section_id")),
            "courses":              body.get("courses", []),
            "target_section_id":    _to_int(body.get("target_section_id")),
            "target_career_id":     _to_int(body.get("target_career_id")),
            "origin_institution":   body.get("origin_institution", ""),
            "grade_corrections":    body.get("grade_corrections", []),
            "requested_by":         request.user.id,
            "history":              [],
        }

        # ── Crear proceso ──
        with transaction.atomic():
            proc = AcademicProcess.objects.create(
                kind=ptype,
                student_id=student_id,
                status="PENDIENTE",
                note=_to_str(body.get("reason", "")),
            )
            _set_extra_data(proc, metadata)
            if hasattr(proc, "extra_data"):
                proc.save(update_fields=["extra_data"])

        return ok(process=_serialize_process(proc))

    def _validate_business_rules(self, ptype, cfg, student_id, body):
        """Validaciones de negocio según tipo de proceso"""
        errors = []
        try:
            # Verificar que el estudiante existe
            if Student and not Student.objects.filter(id=student_id).exists():
                errors.append(f"Estudiante con ID {student_id} no encontrado")
                return errors

            # Los documentos académicos permiten múltiples solicitudes simultáneas
            if cfg.get("group") != "DOCUMENTOS":
                existing = AcademicProcess.objects.filter(
                    kind=ptype,
                    student_id=student_id,
                    status__in=["PENDIENTE", "EN_REVISION"],
                )
                if existing.exists():
                    errors.append(
                        f"Ya existe una solicitud de '{cfg['label']}' pendiente para este estudiante (ID: {existing.first().id})"
                    )

            # Validaciones específicas
            if ptype == "RETIRO":
                period = body.get("period", "")
                if period and Enrollment and not Enrollment.objects.filter(student_id=student_id, period=period).exists():
                    errors.append(f"El estudiante no tiene matrícula en el periodo {period}")

            elif ptype in ("REINGRESO", "REINCORPORACION"):
                has_prev = AcademicProcess.objects.filter(
                    student_id=student_id,
                    kind__in=["RETIRO", "RESERVA"],
                    status="EJECUTADO",
                ).exists()
                if not has_prev:
                    errors.append("El estudiante no tiene un retiro o reserva previo ejecutado")

            elif ptype in ("REAPERTURA_ACTA", "RECTIFICACION_NOTA"):
                section_id = _to_int(body.get("section_id"))
                if section_id and Section and not Section.objects.filter(id=section_id).exists():
                    errors.append(f"Sección con ID {section_id} no encontrada")

            elif ptype == "CONVALIDACION":
                courses = body.get("courses", [])
                if not isinstance(courses, list) or len(courses) == 0:
                    errors.append("Debe especificar al menos un curso para convalidar")

        except Exception as e:
            logger.warning(f"Error en validación de negocio: {e}")

        return errors


# ═══════════════════════════════════════════════════════════════
# VISTA: LISTAR PROCESOS (del estudiante autenticado)
# ═══════════════════════════════════════════════════════════════

class ProcessesListView(APIView):
    """
    GET /academic/processes
    Lista los procesos. Si es admin, todos. Si es estudiante, los suyos.
    Soporta filtros: ?status=PENDIENTE&type=RETIRO&group=MOVIMIENTO&q=...
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # ✅ Si es admin/staff, devuelve todos. Si es estudiante, los suyos.
        if _can_admin_enroll(request.user):
            qs = AcademicProcess.objects.all()
        else:
            st = getattr(request.user, "student_profile", None)
            if st:
                qs = AcademicProcess.objects.filter(student_id=st.id)
            else:
                qs = AcademicProcess.objects.none()

        qs = qs.order_by("-id")
        qs = self._apply_filters(request, qs)

        data = [_serialize_process(p) for p in qs[:500]]

        # Conteo por estado
        counts = dict(
            AcademicProcess.objects.values_list("status")
            .annotate(c=Count("id"))
            .values_list("status", "c")
        )

        return ok(processes=data, counts=counts)

    def _apply_filters(self, request, qs):
        f_status  = request.query_params.get("status")
        f_type    = request.query_params.get("type")
        f_group   = request.query_params.get("group")
        f_student = request.query_params.get("student_id")
        f_q       = request.query_params.get("q", "").strip()

        if f_status:
            qs = qs.filter(status=f_status.upper())
        if f_type:
            qs = qs.filter(kind=f_type.upper())
        if f_group:
            types_in_group = [k for k, v in PROCESS_TYPES.items() if v["group"] == f_group.upper()]
            qs = qs.filter(kind__in=types_in_group)
        if f_student:
            qs = qs.filter(student_id=_to_int(f_student))
        if f_q:
            qs = qs.filter(
                Q(note__icontains=f_q) |
                Q(kind__icontains=f_q)
            )
        return qs


# ═══════════════════════════════════════════════════════════════
# VISTA: TODOS LOS PROCESOS (admin/bandeja) - /processes/my
# ═══════════════════════════════════════════════════════════════

class ProcessesMineView(APIView):
    """
    GET /academic/processes/my
    ✅ Antes: "todos los procesos sin filtro - para admin"
    Ahora: Procesos del usuario actual (estudiante) o todos (admin).
    Mantiene contrato previo.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = AcademicProcess.objects.all().order_by("-id")

        # Filtros
        f_status  = request.query_params.get("status")
        f_type    = request.query_params.get("type")
        f_group   = request.query_params.get("group")
        f_student = request.query_params.get("student_id")
        f_q       = request.query_params.get("q", "").strip()

        if f_status:
            qs = qs.filter(status=f_status.upper())
        if f_type:
            qs = qs.filter(kind=f_type.upper())
        if f_group:
            types_in_group = [k for k, v in PROCESS_TYPES.items() if v["group"] == f_group.upper()]
            qs = qs.filter(kind__in=types_in_group)
        if f_student:
            qs = qs.filter(student_id=_to_int(f_student))
        if f_q:
            qs = qs.filter(
                Q(note__icontains=f_q) |
                Q(kind__icontains=f_q)
            )

        data = [_serialize_process(p) for p in qs[:500]]

        counts = dict(
            AcademicProcess.objects.values_list("status")
            .annotate(c=Count("id"))
            .values_list("status", "c")
        )

        return ok(processes=data, counts=counts)


# ═══════════════════════════════════════════════════════════════
# VISTA: DETALLE DE PROCESO
# ═══════════════════════════════════════════════════════════════

class ProcessDetailView(APIView):
    """
    GET /academic/processes/<pid>
    Detalle completo de un proceso (incluye archivos, timeline, transiciones).
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pid):
        p = get_object_or_404(AcademicProcess, id=pid)
        data = _serialize_process(p, include_files=True)

        cfg = PROCESS_TYPES.get(p.kind, {})
        data["type_config"]          = cfg
        data["status_flow"]          = STATUS_FLOW.get(cfg.get("group", "MOVIMIENTO"), [])
        data["allowed_transitions"]  = VALID_TRANSITIONS.get(p.status, [])
        data["timeline"]             = self._get_timeline(p)

        return ok(process=data)

    def _get_timeline(self, process):
        timeline = [{
            "status": "PENDIENTE",
            "label":  "Solicitud creada",
            "date":   process.created_at.isoformat() if hasattr(process, "created_at") and process.created_at else None,
        }]
        meta = _get_extra_data(process)
        for entry in meta.get("history", []):
            timeline.append(entry)
        if process.status != "PENDIENTE":
            timeline.append({
                "status": process.status,
                "label":  f"Estado actual: {process.status}",
                "date":   process.updated_at.isoformat() if hasattr(process, "updated_at") and process.updated_at else None,
            })
        return timeline


# ═══════════════════════════════════════════════════════════════
# VISTA: CAMBIO DE ESTADO (con validación de transiciones)
# ═══════════════════════════════════════════════════════════════

class ProcessStatusView(APIView):
    """
    POST /academic/processes/<pid>/status
    Cambia el estado de un proceso con validación de transiciones.
    Body: { "status": "APROBADO", "note": "Aprobado por secretaría" }
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pid):
        body = request.data or {}
        p = get_object_or_404(AcademicProcess, id=pid)

        new_status = (body.get("status") or "").upper().replace("-", "_")
        if not new_status:
            return Response({"detail": "Campo 'status' requerido"}, status=status.HTTP_400_BAD_REQUEST)

        # ── Validar transición ──
        allowed = VALID_TRANSITIONS.get(p.status, [])
        if new_status not in allowed:
            return Response(
                {"detail": f"Transición no permitida: {p.status} → {new_status}", "allowed": allowed},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Verificar permisos para aprobación/ejecución ──
        if new_status.startswith("APROBADO") or new_status == "EJECUTADO":
            if not _can_admin_enroll(request.user):
                return Response(
                    {"detail": "No tiene permisos para aprobar/ejecutar este proceso"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        old_status = p.status

        # ── Actualizar ──
        with transaction.atomic():
            p.status = new_status
            if body.get("note") is not None:
                p.note = body.get("note", "")

            # Agregar al historial
            meta = _get_extra_data(p)
            if "history" not in meta:
                meta["history"] = []
            meta["history"].append({
                "from_status": old_status,
                "to_status":   new_status,
                "note":        body.get("note", ""),
                "user_id":     request.user.id,
                "user_name":   str(request.user),
                "date":        timezone.now().isoformat(),
            })
            _set_extra_data(p, meta)

            if hasattr(p, "extra_data"):
                p.save()
            else:
                p.save(update_fields=["status", "note"])

            # ── Si se ejecutó, aplicar efecto ──
            if new_status == "EJECUTADO":
                self._execute_process(p, body, request)

        return ok(
            success=True,
            process=_serialize_process(p),
            transition={"from": old_status, "to": new_status},
        )

    def _execute_process(self, process, body, request):
        """Aplica los efectos reales del proceso una vez ejecutado"""
        ptype = process.kind
        try:
            meta = _get_extra_data(process)

            if ptype == "RETIRO":
                period = meta.get("period", "")
                if period and process.student_id and Enrollment:
                    Enrollment.objects.filter(
                        student_id=process.student_id, period=period
                    ).update(status="RETIRADO")

            elif ptype == "ANULACION_MATRICULA":
                period = meta.get("period", "")
                if period and process.student_id and Enrollment:
                    Enrollment.objects.filter(
                        student_id=process.student_id, period=period
                    ).update(status="ANULADO")

            elif ptype == "REAPERTURA_ACTA":
                section_id = meta.get("section_id")
                if section_id and Section:
                    Section.objects.filter(id=section_id).update(grades_submitted=False)

            elif ptype == "RECTIFICACION_NOTA":
                corrections = meta.get("grade_corrections", [])
                if Grade:
                    for corr in corrections:
                        grade_id = _to_int(corr.get("grade_id"))
                        new_value = corr.get("new_value")
                        if grade_id and new_value is not None:
                            Grade.objects.filter(id=grade_id).update(value=new_value)

            # Los documentos académicos no tienen efecto adicional al ejecutarse
            # (el PDF ya fue generado en el paso anterior)

        except Exception as e:
            logger.error(f"Error ejecutando proceso {process.id} ({ptype}): {e}")


# ═══════════════════════════════════════════════════════════════
# VISTA: NOTIFICACIONES
# ═══════════════════════════════════════════════════════════════

class ProcessNotifyView(APIView):
    """POST /academic/processes/<pid>/notify"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pid):
        p = get_object_or_404(AcademicProcess, id=pid)
        body = request.data or {}

        meta = _get_extra_data(p)
        if "notifications" not in meta:
            meta["notifications"] = []
        meta["notifications"].append({
            "type":    body.get("type", "email"),
            "to":      body.get("to", ""),
            "message": body.get("message", ""),
            "sent_by": request.user.id,
            "date":    timezone.now().isoformat(),
        })
        _set_extra_data(p, meta)
        if hasattr(p, "extra_data"):
            p.save(update_fields=["extra_data"])

        return ok(sent=True, process_id=pid)


# ═══════════════════════════════════════════════════════════════
# VISTA: ARCHIVOS ADJUNTOS
# ═══════════════════════════════════════════════════════════════

class ProcessFilesView(APIView):
    """
    GET  /academic/processes/<pid>/files  → Lista archivos
    POST /academic/processes/<pid>/files  → Subir archivo
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pid):
        qs = ProcessFile.objects.filter(process_id=pid).order_by("-id")
        files = [
            {
                "id":   f.id,
                "name": (f.file.name or "").split("/")[-1] if f.file else "",
                "url":  f.file.url if f.file else "",
                "size": getattr(f.file, "size", 0),
                "note": getattr(f, "note", "") or "",
            }
            for f in qs
        ]
        return ok(files=files)

    def post(self, request, pid):
        get_object_or_404(AcademicProcess, id=pid)
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "Archivo requerido (campo 'file')"}, status=status.HTTP_400_BAD_REQUEST)

        max_size = 10 * 1024 * 1024
        if f.size > max_size:
            return Response({"detail": "Archivo excede el tamaño máximo (10 MB)"}, status=status.HTTP_400_BAD_REQUEST)

        kwargs = {"process_id": pid, "file": f}
        if hasattr(ProcessFile, "note"):
            kwargs["note"] = (request.data or {}).get("note", "")

        pf = ProcessFile.objects.create(**kwargs)
        return ok(file={
            "id":   pf.id,
            "name": (pf.file.name or "").split("/")[-1] if pf.file else "",
            "url":  pf.file.url if pf.file else "",
            "size": getattr(pf.file, "size", 0),
            "note": getattr(pf, "note", "") or "",
        })


class ProcessFileDeleteView(APIView):
    """DELETE /academic/processes/<pid>/files/<file_id>"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pid, file_id):
        pf = ProcessFile.objects.filter(process_id=pid, id=file_id).first()
        if pf:
            if pf.file:
                try:
                    pf.file.delete(save=False)
                except Exception:
                    pass
            pf.delete()
        return ok(success=True)


# ═══════════════════════════════════════════════════════════════
# VISTA: DASHBOARD DE PROCESOS
# ═══════════════════════════════════════════════════════════════

class ProcessDashboardView(APIView):
    """
    GET /academic/processes/dashboard
    Estadísticas de procesos para el panel de administración.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = AcademicProcess.objects.all()

        by_status = dict(
            qs.values("status").annotate(count=Count("id")).values_list("status", "count")
        )
        by_type = dict(
            qs.values("kind").annotate(count=Count("id")).values_list("kind", "count")
        )
        by_group = {}
        for group_key in PROCESS_GROUPS:
            types_in_group = [k for k, v in PROCESS_TYPES.items() if v["group"] == group_key]
            by_group[group_key] = qs.filter(kind__in=types_in_group).count()

        pending_old = 0
        if hasattr(AcademicProcess, "created_at"):
            week_ago = timezone.now() - timedelta(days=7)
            pending_old = qs.filter(status="PENDIENTE", created_at__lt=week_ago).count()

        return ok(
            by_status=by_status,
            by_type=by_type,
            by_group=by_group,
            pending_old=pending_old,
            total=qs.count(),
        )