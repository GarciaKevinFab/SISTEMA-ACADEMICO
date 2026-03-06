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
from students.models import Student
from academic.models import Course, PlanCourse, Plan
from catalogs.models import Period, Campus, Classroom, Teacher, Career
from .utils import _require_staff, _csv_bytes

# Import AcademicGradeRecord si existe
try:
    from academic.models import AcademicGradeRecord
except Exception:
    AcademicGradeRecord = None


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
    
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        if dataset == "STUDENTS":
            rows = list(Student.objects.all().values(
                "num_documento", "nombres", "apellido_paterno", "apellido_materno",
                "sexo", "fecha_nac",
                "region", "provincia", "distrito",
                "codigo_modular", "nombre_institucion", "gestion", "tipo",
                "programa_carrera", "ciclo", "turno", "seccion", "periodo",
                "lengua", "discapacidad", "tipo_discapacidad",
                "email", "celular", "plan_id", "user_id",
            ))
            headers = [
                "num_documento", "nombres", "apellido_paterno", "apellido_materno",
                "sexo", "fecha_nac",
                "region", "provincia", "distrito",
                "codigo_modular", "nombre_institucion", "gestion", "tipo",
                "programa_carrera", "ciclo", "turno", "seccion", "periodo",
                "lengua", "discapacidad", "tipo_discapacidad",
                "email", "celular", "plan_id", "user_id",
            ]
            zf.writestr(f"students_{now}.csv", _csv_bytes(rows, headers))
        
        elif dataset == "COURSES":
            rows = list(Course.objects.all().values("code", "name", "credits"))
            headers = ["code", "name", "credits"]
            zf.writestr(f"courses_{now}.csv", _csv_bytes(rows, headers))
            
            pc_rows = list(PlanCourse.objects.all().values(
                "plan_id", "course_id", "semester", "weekly_hours", "type"
            ))
            pc_headers = ["plan_id", "course_id", "semester", "weekly_hours", "type"]
            zf.writestr(f"plan_courses_{now}.csv", _csv_bytes(pc_rows, pc_headers))
        
        elif dataset == "GRADES":
            if AcademicGradeRecord is None:
                return Response(
                    {"detail": "AcademicGradeRecord no existe. Agrégalo y migra."},
                    status=400
                )
            
            rows = list(AcademicGradeRecord.objects.select_related(
                "student", "course"
            ).values(
                "student__num_documento", "course__code", "term", "final_grade", "components"
            ))
            headers = ["student__num_documento", "course__code", "term", "final_grade", "components"]
            zf.writestr(f"grades_{now}.csv", _csv_bytes(rows, headers))
        
        elif dataset == "CATALOGS":
            p_rows = list(Period.objects.all().values(
                "code", "year", "term", "start_date", "end_date", "is_active", "label"
            ))
            p_headers = ["code", "year", "term", "start_date", "end_date", "is_active", "label"]
            zf.writestr(f"catalog_periods_{now}.csv", _csv_bytes(p_rows, p_headers))
            
            c_rows = list(Campus.objects.all().values("code", "name", "address"))
            c_headers = ["code", "name", "address"]
            zf.writestr(f"catalog_campuses_{now}.csv", _csv_bytes(c_rows, c_headers))
            
            a_rows = list(Classroom.objects.all().values("campus_id", "code", "name", "capacity"))
            a_headers = ["campus_id", "code", "name", "capacity"]
            zf.writestr(f"catalog_classrooms_{now}.csv", _csv_bytes(a_rows, a_headers))
            
            t_rows = list(Teacher.objects.all().values("document", "full_name", "email", "phone", "specialization"))
            t_headers = ["document", "full_name", "email", "phone", "specialization"]
            zf.writestr(f"catalog_teachers_{now}.csv", _csv_bytes(t_rows, t_headers))
            
            ac_rows = list(Career.objects.all().values("id", "name", "code"))
            ac_headers = ["id", "name", "code"]
            zf.writestr(f"academic_careers_{now}.csv", _csv_bytes(ac_rows, ac_headers))
            
            pl_rows = list(Plan.objects.all().values(
                "id", "career_id", "name", "start_year", "end_year", "semesters"
            ))
            pl_headers = ["id", "career_id", "name", "start_year", "end_year", "semesters"]
            zf.writestr(f"academic_plans_{now}.csv", _csv_bytes(pl_rows, pl_headers))
        
        else:
            return Response({"detail": "dataset inválido"}, status=400)
        
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