"""
Backups y Export de Datasets
"""
import os
import io
import zipfile
from datetime import datetime, timedelta
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.http import Http404, FileResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from catalogs.models import BackupExport
from catalogs.serializers import BackupExportSerializer
from .utils import _require_staff, _csv_bytes

# ── Imports por módulo (lazy-safe) ──
from students.models import Student
from academic.models import Course, PlanCourse, Plan
from catalogs.models import Period, Campus, Classroom, Teacher, Career

try:
    from academic.models import AcademicGradeRecord
except Exception:
    AcademicGradeRecord = None

try:
    from academic.models import Enrollment, EnrollmentItem, EnrollmentPayment
except Exception:
    Enrollment = EnrollmentItem = EnrollmentPayment = None

try:
    from django.contrib.auth import get_user_model
    User = get_user_model()
except Exception:
    User = None

try:
    from acl.models import Role, Permission, UserRole
except Exception:
    Role = Permission = UserRole = None

try:
    from admission.models import (
        AdmissionCall, Applicant, Application,
        ApplicationDocument, Payment as AdmissionPayment,
        EvaluationScore,
    )
except Exception:
    AdmissionCall = Applicant = Application = None
    ApplicationDocument = AdmissionPayment = EvaluationScore = None

try:
    from mesa_partes.models import Office, ProcedureType, Procedure, ProcedureEvent, ProcedureFile
except Exception:
    Office = ProcedureType = Procedure = ProcedureEvent = ProcedureFile = None

try:
    from finance.models import (
        Concept, BankAccount, CashSession, CashMovement,
        StudentAccountCharge, StudentAccountPayment, Receipt,
        InventoryItem, Employee,
    )
except Exception:
    Concept = BankAccount = CashSession = CashMovement = None
    StudentAccountCharge = StudentAccountPayment = Receipt = None
    InventoryItem = Employee = None

try:
    from graduates.models import Graduate, GradoTituloType
except Exception:
    Graduate = GradoTituloType = None

try:
    from research.models import Project as ResearchProject, Publication, ResearchLine, Advisor
except Exception:
    ResearchProject = Publication = ResearchLine = Advisor = None

try:
    from audit.models import AuditLog
except Exception:
    AuditLog = None


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

def _zip_add_folder(zf: zipfile.ZipFile, folder_path: str, arc_prefix: str):
    """Agrega carpeta completa al ZIP"""
    folder_path = os.path.abspath(folder_path)
    if not os.path.exists(folder_path):
        return
    
    for root, _, files in os.walk(folder_path):
        for f in files:
            fp = os.path.join(root, f)
            rel = os.path.relpath(fp, folder_path).replace("\\", "/")
            zf.write(fp, f"{arc_prefix}/{rel}")


def _dumpdata_json_bytes():
    """Genera dumpdata JSON"""
    buf = io.StringIO()
    call_command(
        "dumpdata",
        "--natural-foreign",
        "--natural-primary",
        "--indent", "2",
        stdout=buf
    )
    return buf.getvalue().encode("utf-8")


def _try_add_sqlite_db(zf: zipfile.ZipFile):
    """Agrega DB SQLite si existe"""
    try:
        db = settings.DATABASES.get("default", {})
        if db.get("ENGINE") == "django.db.backends.sqlite3":
            name = db.get("NAME")
            if name and os.path.exists(name):
                zf.write(str(name), "db/db.sqlite3")
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════
# BACKUPS
# ═══════════════════════════════════════════════════════════════

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def backups_collection(request):
    """Lista o crea backups"""
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok
    
    if request.method == "GET":
        qs = BackupExport.objects.all().order_by("-created_at")
        return Response({"items": BackupExportSerializer(qs, many=True).data})
    
    # POST - Crear backup
    scope = (request.data.get("scope") or "FULL").upper().strip()
    if scope not in ("FULL", "DATA_ONLY", "FILES_ONLY"):
        return Response(
            {"detail": "scope inválido (FULL|DATA_ONLY|FILES_ONLY)"},
            status=400
        )
    
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
    """Descarga backup"""
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok
    
    try:
        b = BackupExport.objects.get(pk=id)
    except BackupExport.DoesNotExist:
        raise Http404
    
    if not b.file:
        raise Http404
    
    return FileResponse(
        b.file.open("rb"),
        as_attachment=True,
        filename=os.path.basename(b.file.name)
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def backup_delete(request, id: int):
    """Elimina backup"""
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok
    
    try:
        b = BackupExport.objects.get(pk=id)
    except BackupExport.DoesNotExist:
        raise Http404
    
    try:
        if b.file:
            b.file.delete(save=False)
    except Exception:
        pass
    
    b.delete()
    return Response({"ok": True, "deleted_id": id})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def backups_cleanup(request):
    """Limpia backups antiguos"""
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok
    
    days = int(request.data.get("days") or 30)
    only_datasets = bool(request.data.get("only_datasets") or False)
    cutoff = timezone.now() - timedelta(days=days)
    
    qs = BackupExport.objects.filter(created_at__lt=cutoff)
    if only_datasets:
        qs = qs.filter(scope__startswith="DATASET_")
    
    deleted = 0
    for b in qs:
        try:
            if b.file:
                b.file.delete(save=False)
        except Exception:
            pass
        b.delete()
        deleted += 1
    
    return Response({
        "ok": True,
        "deleted": deleted,
        "days": days,
        "only_datasets": only_datasets
    })


# ═══════════════════════════════════════════════════════════════
# EXPORT DATASET
# ═══════════════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def export_dataset(request):
    """Exporta dataset específico a ZIP"""
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok
    
    dataset = (request.data.get("dataset") or "DATA").upper().strip()
    now = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # ── Mapa de exportadores ──
    def _export_students(zf):
        rows = list(Student.objects.all().values(
            "num_documento", "nombres", "apellido_paterno", "apellido_materno",
            "sexo", "fecha_nac", "region", "provincia", "distrito",
            "codigo_modular", "nombre_institucion", "gestion", "tipo",
            "programa_carrera", "ciclo", "turno", "seccion", "periodo",
            "lengua", "discapacidad", "tipo_discapacidad",
            "email", "celular", "plan_id", "user_id",
        ))
        h = list(rows[0].keys()) if rows else ["num_documento", "nombres"]
        zf.writestr(f"students_{now}.csv", _csv_bytes(rows, h))

    def _export_courses(zf):
        rows = list(Course.objects.all().values("code", "name", "credits"))
        zf.writestr(f"courses_{now}.csv", _csv_bytes(rows, ["code", "name", "credits"]))
        pc = list(PlanCourse.objects.all().values("plan_id", "course_id", "semester", "weekly_hours", "type"))
        zf.writestr(f"plan_courses_{now}.csv", _csv_bytes(pc, ["plan_id", "course_id", "semester", "weekly_hours", "type"]))

    def _export_grades(zf):
        if AcademicGradeRecord is None:
            zf.writestr(f"grades_{now}.csv", "# AcademicGradeRecord no disponible\n")
            return
        rows = list(AcademicGradeRecord.objects.select_related("student", "course").values(
            "student__num_documento", "course__code", "term", "final_grade", "components"
        ))
        zf.writestr(f"grades_{now}.csv", _csv_bytes(rows, ["student__num_documento", "course__code", "term", "final_grade", "components"]))

    def _export_catalogs(zf):
        zf.writestr(f"catalog_periods_{now}.csv", _csv_bytes(
            list(Period.objects.all().values("code", "year", "term", "start_date", "end_date", "is_active", "label")),
            ["code", "year", "term", "start_date", "end_date", "is_active", "label"]))
        zf.writestr(f"catalog_campuses_{now}.csv", _csv_bytes(
            list(Campus.objects.all().values("code", "name", "address")),
            ["code", "name", "address"]))
        zf.writestr(f"catalog_classrooms_{now}.csv", _csv_bytes(
            list(Classroom.objects.all().values("campus_id", "code", "name", "capacity")),
            ["campus_id", "code", "name", "capacity"]))
        zf.writestr(f"catalog_teachers_{now}.csv", _csv_bytes(
            list(Teacher.objects.all().values("document", "full_name", "email", "phone", "specialization")),
            ["document", "full_name", "email", "phone", "specialization"]))
        zf.writestr(f"catalog_careers_{now}.csv", _csv_bytes(
            list(Career.objects.all().values("id", "name", "code")),
            ["id", "name", "code"]))
        zf.writestr(f"catalog_plans_{now}.csv", _csv_bytes(
            list(Plan.objects.all().values("id", "career_id", "name", "start_year", "end_year", "semesters")),
            ["id", "career_id", "name", "start_year", "end_year", "semesters"]))

    def _export_users(zf):
        if User is None:
            return
        rows = list(User.objects.all().values("id", "username", "email", "full_name", "is_active", "is_staff", "is_superuser", "last_login"))
        zf.writestr(f"users_{now}.csv", _csv_bytes(rows, ["id", "username", "email", "full_name", "is_active", "is_staff", "is_superuser", "last_login"]))
        if Role:
            zf.writestr(f"roles_{now}.csv", _csv_bytes(
                list(Role.objects.all().values("id", "name", "description")),
                ["id", "name", "description"]))
        if UserRole:
            zf.writestr(f"user_roles_{now}.csv", _csv_bytes(
                list(UserRole.objects.all().values("user_id", "role__name")),
                ["user_id", "role_name"]))

    def _export_enrollment(zf):
        if Enrollment is None:
            return
        rows = list(Enrollment.objects.all().values(
            "id", "student_id", "student__num_documento", "period", "status", "total_credits", "created_at", "confirmed_at"
        ))
        zf.writestr(f"enrollments_{now}.csv", _csv_bytes(rows,
            ["id", "student_id", "student__num_documento", "period", "status", "total_credits", "created_at", "confirmed_at"]))
        if EnrollmentItem:
            items = list(EnrollmentItem.objects.all().values(
                "enrollment_id", "plan_course_id", "plan_course__course__code", "section_id", "credits"
            ))
            zf.writestr(f"enrollment_items_{now}.csv", _csv_bytes(items,
                ["enrollment_id", "plan_course_id", "course_code", "section_id", "credits"]))
        if EnrollmentPayment:
            pays = list(EnrollmentPayment.objects.all().values(
                "id", "student_id", "period", "amount", "channel", "operation_code", "status", "created_at"
            ))
            zf.writestr(f"enrollment_payments_{now}.csv", _csv_bytes(pays,
                ["id", "student_id", "period", "amount", "channel", "operation_code", "status", "created_at"]))

    def _export_admission(zf):
        if AdmissionCall is None:
            return
        zf.writestr(f"admission_calls_{now}.csv", _csv_bytes(
            list(AdmissionCall.objects.all().values("id", "title", "period", "published", "vacants_total")),
            ["id", "title", "period", "published", "vacants_total"]))
        if Applicant:
            zf.writestr(f"admission_applicants_{now}.csv", _csv_bytes(
                list(Applicant.objects.all().values("id", "dni", "names", "email", "phone")),
                ["id", "dni", "names", "email", "phone"]))
        if Application:
            zf.writestr(f"admission_applications_{now}.csv", _csv_bytes(
                list(Application.objects.all().values("id", "call_id", "applicant_id", "career_name", "status", "created_at")),
                ["id", "call_id", "applicant_id", "career_name", "status", "created_at"]))
        if AdmissionPayment:
            zf.writestr(f"admission_payments_{now}.csv", _csv_bytes(
                list(AdmissionPayment.objects.all().values("id", "application_id", "method", "status", "amount", "channel", "created_at")),
                ["id", "application_id", "method", "status", "amount", "channel", "created_at"]))
        if EvaluationScore:
            zf.writestr(f"admission_scores_{now}.csv", _csv_bytes(
                list(EvaluationScore.objects.all().values("id", "application_id", "phase", "total")),
                ["id", "application_id", "phase", "total"]))

    def _export_mesa_partes(zf):
        if Procedure is None:
            return
        if Office:
            zf.writestr(f"mp_offices_{now}.csv", _csv_bytes(
                list(Office.objects.all().values("id", "name", "description", "is_active", "head_id")),
                ["id", "name", "description", "is_active", "head_id"]))
        if ProcedureType:
            zf.writestr(f"mp_procedure_types_{now}.csv", _csv_bytes(
                list(ProcedureType.objects.all().values("id", "name", "description", "processing_days", "cost", "is_active")),
                ["id", "name", "description", "processing_days", "cost", "is_active"]))
        zf.writestr(f"mp_procedures_{now}.csv", _csv_bytes(
            list(Procedure.objects.all().values(
                "id", "tracking_code", "procedure_type_id", "applicant_name", "applicant_document",
                "applicant_email", "status", "current_office_id", "assignee_id", "created_at", "updated_at"
            )),
            ["id", "tracking_code", "procedure_type_id", "applicant_name", "applicant_document",
             "applicant_email", "status", "current_office_id", "assignee_id", "created_at", "updated_at"]))
        if ProcedureEvent:
            zf.writestr(f"mp_events_{now}.csv", _csv_bytes(
                list(ProcedureEvent.objects.all().values("id", "procedure_id", "at", "type", "description", "actor_id")),
                ["id", "procedure_id", "at", "type", "description", "actor_id"]))

    def _export_finance(zf):
        if Concept is None:
            return
        zf.writestr(f"fin_concepts_{now}.csv", _csv_bytes(
            list(Concept.objects.all().values("id", "code", "name", "type", "default_amount")),
            ["id", "code", "name", "type", "default_amount"]))
        if BankAccount:
            zf.writestr(f"fin_bank_accounts_{now}.csv", _csv_bytes(
                list(BankAccount.objects.all().values("id", "bank_name", "account_number", "currency")),
                ["id", "bank_name", "account_number", "currency"]))
        if StudentAccountCharge:
            zf.writestr(f"fin_charges_{now}.csv", _csv_bytes(
                list(StudentAccountCharge.objects.all().values(
                    "id", "subject_id", "subject_type", "concept_name", "amount", "due_date", "paid", "created_at"
                )),
                ["id", "subject_id", "subject_type", "concept_name", "amount", "due_date", "paid", "created_at"]))
        if StudentAccountPayment:
            zf.writestr(f"fin_payments_{now}.csv", _csv_bytes(
                list(StudentAccountPayment.objects.all().values(
                    "id", "subject_id", "subject_type", "amount", "method", "ref", "date", "created_at"
                )),
                ["id", "subject_id", "subject_type", "amount", "method", "ref", "date", "created_at"]))
        if Receipt:
            zf.writestr(f"fin_receipts_{now}.csv", _csv_bytes(
                list(Receipt.objects.all().values(
                    "id", "receipt_number", "concept", "description", "amount",
                    "customer_name", "customer_document", "status", "issued_at", "paid_at"
                )),
                ["id", "receipt_number", "concept", "description", "amount",
                 "customer_name", "customer_document", "status", "issued_at", "paid_at"]))
        if Employee:
            zf.writestr(f"fin_employees_{now}.csv", _csv_bytes(
                list(Employee.objects.all().values(
                    "id", "employee_code", "first_name", "last_name", "document_number",
                    "position", "department", "contract_type", "salary", "status"
                )),
                ["id", "employee_code", "first_name", "last_name", "document_number",
                 "position", "department", "contract_type", "salary", "status"]))

    def _export_graduates(zf):
        if Graduate is None:
            return
        zf.writestr(f"graduates_{now}.csv", _csv_bytes(
            list(Graduate.objects.all().values(
                "id", "dni", "apellidos_nombres", "grado_titulo", "especialidad", "nivel",
                "anio_ingreso", "anio_egreso", "fecha_sustentacion", "resolucion_acta",
                "codigo_diploma", "registro_pedagogico", "is_active"
            )),
            ["id", "dni", "apellidos_nombres", "grado_titulo", "especialidad", "nivel",
             "anio_ingreso", "anio_egreso", "fecha_sustentacion", "resolucion_acta",
             "codigo_diploma", "registro_pedagogico", "is_active"]))
        if GradoTituloType:
            zf.writestr(f"grado_titulo_types_{now}.csv", _csv_bytes(
                list(GradoTituloType.objects.all().values("id", "code", "name", "diploma_label", "is_active")),
                ["id", "code", "name", "diploma_label", "is_active"]))

    def _export_research(zf):
        if ResearchProject is None:
            return
        if ResearchLine:
            zf.writestr(f"research_lines_{now}.csv", _csv_bytes(
                list(ResearchLine.objects.all().values("id", "name", "description", "is_active")),
                ["id", "name", "description", "is_active"]))
        if Advisor:
            zf.writestr(f"research_advisors_{now}.csv", _csv_bytes(
                list(Advisor.objects.all().values("id", "full_name", "email", "specialty", "orcid", "is_active")),
                ["id", "full_name", "email", "specialty", "orcid", "is_active"]))
        zf.writestr(f"research_projects_{now}.csv", _csv_bytes(
            list(ResearchProject.objects.all().values(
                "id", "title", "line_id", "advisor_id", "status", "start_date", "end_date", "created_at"
            )),
            ["id", "title", "line_id", "advisor_id", "status", "start_date", "end_date", "created_at"]))
        if Publication:
            zf.writestr(f"research_publications_{now}.csv", _csv_bytes(
                list(Publication.objects.all().values("id", "project_id", "type", "title", "journal", "year", "doi", "indexed")),
                ["id", "project_id", "type", "title", "journal", "year", "doi", "indexed"]))

    def _export_audit(zf):
        if AuditLog is None:
            return
        rows = list(AuditLog.objects.order_by("-timestamp")[:10000].values(
            "id", "timestamp", "actor_id", "actor_name", "action", "entity", "entity_id", "summary", "ip"
        ))
        zf.writestr(f"audit_log_{now}.csv", _csv_bytes(rows,
            ["id", "timestamp", "actor_id", "actor_name", "action", "entity", "entity_id", "summary", "ip"]))

    # ── Registro de datasets válidos ──
    DATASETS = {
        "STUDENTS": _export_students,
        "COURSES": _export_courses,
        "GRADES": _export_grades,
        "CATALOGS": _export_catalogs,
        "USERS": _export_users,
        "ENROLLMENT": _export_enrollment,
        "ADMISSION": _export_admission,
        "MESA_PARTES": _export_mesa_partes,
        "FINANCE": _export_finance,
        "GRADUATES": _export_graduates,
        "RESEARCH": _export_research,
        "AUDIT": _export_audit,
    }

    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        exporter = DATASETS.get(dataset)
        if exporter is None:
            valid = ", ".join(sorted(DATASETS.keys()))
            return Response({"detail": f"dataset inválido. Válidos: {valid}"}, status=400)

        exporter(zf)
        zf.writestr("meta/info.txt", f"dataset={dataset}\ncreated_at={now}\n")
    
    zbuf.seek(0)
    
    obj = BackupExport.objects.create(scope=f"DATASET_{dataset}")
    filename = f"export_{dataset.lower()}_{now}.zip"
    obj.file.save(filename, ContentFile(zbuf.getvalue()))
    obj.save(update_fields=["file"])
    
    rel = f"/catalogs/exports/backups/{obj.id}/download"
    absu = request.build_absolute_uri(rel)
    
    return Response({
        "ok": True,
        "dataset": dataset,
        "backup_id": obj.id,
        "download_url": rel,
        "download_absolute_url": absu,
        "file_url": obj.file.url if obj.file else None,
        "file_absolute_url": request.build_absolute_uri(obj.file.url) if obj.file else None,
    })