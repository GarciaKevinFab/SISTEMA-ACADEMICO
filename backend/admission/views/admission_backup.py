"""
admission/views/admission_backup.py

Endpoints para:
  - GET  /admission/backup.zip  → descarga ZIP con backup organizado por postulante
  - POST /admission/reset       → borra todos los datos de admisión (requiere confirmación)

El ZIP tiene esta estructura:

  backup_admision_<fecha>.zip
    ├── README.txt                       (instrucciones + conteos)
    ├── convocatorias.json               (todas las AdmissionCall)
    ├── resumen.csv                      (una fila por postulante)
    └── postulantes/
        └── 60104681_OSORIO_CORONEL_SARITA/
            ├── perfil.json              (Applicant + Applications + pagos)
            └── documentos/
                ├── FOTO_CARNET_...
                ├── DNI_...
                └── voucher_pago.pdf
"""
import io
import json
import logging
import os
import re
import traceback
import zipfile
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.forms.models import model_to_dict
from django.http import HttpResponse
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger("admission.backup")

from admission.models import (
    AdmissionCall,
    AdmissionScheduleItem,
    Applicant,
    Application,
    ApplicationPreference,
    ApplicationDocument,
    Payment,
    EvaluationScore,
    ResultPublication,
)

User = get_user_model()


def _slug(s: str) -> str:
    """Sanitiza un nombre para usarlo en ruta de archivo."""
    s = (s or "").strip()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"\s+", "_", s)
    return s[:80]


def _serialize_obj(obj, extra=None):
    """Dict JSON-friendly de un modelo Django."""
    data = model_to_dict(obj)
    # File fields → path
    for f in obj._meta.fields:
        if f.get_internal_type() in ("FileField", "ImageField"):
            val = getattr(obj, f.name)
            data[f.name] = val.name if val else None
    for attr in ("created_at", "updated_at"):
        if hasattr(obj, attr):
            val = getattr(obj, attr)
            if val:
                data[attr] = val.isoformat()
    if extra:
        data.update(extra)
    return data


def _build_backup_zip_bytes(call_id=None, only_with_applications=True) -> bytes:
    """Genera el ZIP completo en memoria y retorna los bytes.

    Args:
      call_id: si se pasa, solo incluye postulantes de esa convocatoria.
      only_with_applications: si True (default), excluye Applicants
        huérfanos (sin ninguna Application).
    """
    # Normalizar call_id a int o None
    call_id_int = None
    if call_id not in (None, "", "__all__"):
        try:
            call_id_int = int(call_id)
        except (TypeError, ValueError):
            call_id_int = None

    now = datetime.now()
    media_root = Path(getattr(settings, "MEDIA_ROOT", ""))

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:

        # ── 1. Convocatorias ──
        calls_qs = AdmissionCall.objects.all()
        if call_id_int is not None:
            calls_qs = calls_qs.filter(pk=call_id_int)
        calls_data = [_serialize_obj(c) for c in calls_qs]

        sched_qs = AdmissionScheduleItem.objects.all()
        if call_id_int is not None:
            sched_qs = sched_qs.filter(call_id=call_id_int)
        schedule_data = [_serialize_obj(s) for s in sched_qs]

        rp_qs = ResultPublication.objects.all()
        if call_id_int is not None:
            rp_qs = rp_qs.filter(call_id=call_id_int)
        result_pubs = [_serialize_obj(r) for r in rp_qs]
        zf.writestr(
            "convocatorias.json",
            json.dumps({
                "backup_at": now.isoformat(),
                "admission_calls": calls_data,
                "schedule_items": schedule_data,
                "result_publications": result_pubs,
            }, cls=DjangoJSONEncoder, ensure_ascii=False, indent=2)
        )

        # ── 2. Postulantes ──
        applicants_qs = Applicant.objects.prefetch_related(
            "applications__call", "applications__preferences__career",
            "applications__documents", "applications__payment",
            "applications__scores",
        )

        # Filtros para evitar datos de prueba/huérfanos
        if call_id_int is not None:
            applicants_qs = applicants_qs.filter(applications__call_id=call_id_int).distinct()
        elif only_with_applications:
            applicants_qs = applicants_qs.filter(applications__isnull=False).distinct()

        applicants = list(applicants_qs)

        # Resumen CSV
        csv_lines = [
            '"DNI","Apellidos Nombres","Email","Telefono","Convocatorias","Estados","Carpeta"'
        ]

        def _safe_payment(app):
            """OneToOneField puede lanzar RelatedObjectDoesNotExist."""
            try:
                return getattr(app, "payment", None)
            except Exception:
                return None

        total_files = 0
        processed = 0
        skipped_applicants = 0
        for ap in applicants:
            try:
                dni = ap.dni or f"sin-dni-{ap.id}"
                names_slug = _slug(ap.names or "sin-nombre")
                if not names_slug:
                    names_slug = f"id{ap.id}"
                folder = f"postulantes/{dni}_{names_slug}"

                apps_data = []
                estados = []
                convos = []
                for app in ap.applications.all():
                    try:
                        career_pref = []
                        for p in app.preferences.all().order_by("rank"):
                            career_pref.append({
                                "rank": p.rank,
                                "career_id": p.career_id,
                                "career_name": p.career.name if p.career else "",
                            })

                        pay = _safe_payment(app)
                        pay_data = _serialize_obj(pay) if pay else None

                        docs_data = [_serialize_obj(d) for d in app.documents.all()]
                        scores_data = [_serialize_obj(s) for s in app.scores.all()]

                        apps_data.append({
                            **_serialize_obj(app),
                            "call_title": app.call.title if app.call else "",
                            "call_period": app.call.period if app.call else "",
                            "career_preferences": career_pref,
                            "payment": pay_data,
                            "documents": docs_data,
                            "evaluation_scores": scores_data,
                        })
                        estados.append(app.status or "")
                        if app.call:
                            convos.append(app.call.title or "")
                    except Exception as exc_app:
                        logger.warning("Error serializando application %s: %s", app.id, exc_app)

                perfil = {
                    "applicant": _serialize_obj(ap),
                    "applications": apps_data,
                }
                zf.writestr(
                    f"{folder}/perfil.json",
                    json.dumps(perfil, cls=DjangoJSONEncoder, ensure_ascii=False, indent=2),
                )

                # Copiar documentos físicos
                for app in ap.applications.all():
                    for d in app.documents.all():
                        if d.file and d.file.name:
                            file_path = media_root / d.file.name
                            if file_path.exists():
                                try:
                                    ext = Path(d.file.name).suffix or ""
                                    orig = _slug(d.original_name or d.document_type or "doc")[:50] or "doc"
                                    doc_arc = f"{folder}/documentos/{d.document_type or 'DOC'}_{orig}{ext}"
                                    zf.write(file_path, doc_arc)
                                    total_files += 1
                                except Exception as exc_f:
                                    logger.warning("No se pudo copiar %s: %s", file_path, exc_f)
                    pay = _safe_payment(app)
                    if pay and pay.voucher and pay.voucher.name:
                        file_path = media_root / pay.voucher.name
                        if file_path.exists():
                            try:
                                ext = Path(pay.voucher.name).suffix or ""
                                zf.write(file_path, f"{folder}/documentos/VOUCHER_PAGO{ext}")
                                total_files += 1
                            except Exception as exc_v:
                                logger.warning("No se pudo copiar voucher %s: %s", file_path, exc_v)

                # CSV (escapar comillas)
                def _q(s):
                    return str(s or "").replace('"', "'")
                csv_lines.append(
                    '"{}","{}","{}","{}","{}","{}","{}"'.format(
                        _q(dni), _q(ap.names), _q(ap.email), _q(ap.phone),
                        _q(" | ".join(convos)), _q(" | ".join(estados)), _q(folder),
                    )
                )
                processed += 1
            except Exception as exc_ap:
                logger.warning("Error procesando applicant %s (DNI %s): %s",
                               getattr(ap, "id", "?"), getattr(ap, "dni", "?"), exc_ap)
                skipped_applicants += 1

        # Resumen
        zf.writestr("resumen.csv", "\ufeff" + "\n".join(csv_lines))

        # README
        readme = f"""BACKUP DE ADMISIÓN
Generado: {now.strftime('%Y-%m-%d %H:%M:%S')}

ESTRUCTURA:
  convocatorias.json        → Dump de todas las convocatorias y cronogramas
  resumen.csv               → Lista maestra con todos los postulantes
  postulantes/<DNI>_<NOM>/  → Carpeta por cada postulante con:
      perfil.json               → Datos personales + postulaciones + pagos + evaluaciones
      documentos/               → Archivos físicos subidos por el postulante
          (FOTO_CARNET_, DNI_, VOUCHER_PAGO_, etc.)

CONTEOS:
  Convocatorias:       {len(calls_data)}
  Postulantes:         {processed}
  Postulantes saltados: {skipped_applicants}
  Postulaciones:       {Application.objects.count()}
  Pagos:               {Payment.objects.count()}
  Documentos (meta):   {ApplicationDocument.objects.count()}
  Archivos copiados:   {total_files}

Para restaurar manualmente, los JSON tienen todos los IDs originales.
"""
        zf.writestr("README.txt", readme)

    return buf.getvalue()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admission_backup_zip(request):
    """
    GET /admission/backup.zip

    Query params:
      - call_id (opcional): solo postulantes de esa convocatoria
      - include_orphans (opcional): "1" para incluir postulantes sin
        postulación (datos de prueba). Por default se excluyen.
    """
    call_id = request.query_params.get("call_id")
    include_orphans = str(request.query_params.get("include_orphans", "")).lower() in ("1", "true", "yes")

    try:
        zip_bytes = _build_backup_zip_bytes(
            call_id=call_id if call_id else None,
            only_with_applications=not include_orphans,
        )
    except Exception as exc:
        tb = traceback.format_exc()
        logger.exception("Error generando backup: %s\n%s", exc, tb)
        return Response(
            {"detail": "Error generando backup: {}".format(str(exc))},
            status=500,
        )

    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    resp = HttpResponse(zip_bytes, content_type="application/zip")
    resp["Content-Disposition"] = f'attachment; filename="backup_admision_{ts}.zip"'
    resp["Content-Length"] = len(zip_bytes)
    return resp


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def admission_reset(request):
    """
    POST /admission/reset
    Body:
      {
        "confirm": "BORRAR ADMISION",        # Obligatorio, texto exacto
        "include_students": false              # opcional: también borrar
                                                #   Students creados por el
                                                #   proceso de admisión (sin
                                                #   matrícula).
      }

    SIEMPRE preserva estudiantes matriculados y cualquier Student cuyo DNI
    no aparezca en los Applicants (estudiantes de otros procesos manuales).
    """
    data = request.data or {}
    confirm = str(data.get("confirm", "")).strip().upper()
    include_students = bool(data.get("include_students", False))

    if confirm != "BORRAR ADMISION":
        return Response(
            {"detail": "Debes confirmar escribiendo 'BORRAR ADMISION' en el campo 'confirm'"},
            status=400,
        )

    # Permisos: solo staff o superuser
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({"detail": "No autorizado"}, status=403)

    # ── Conteos antes ──
    counts_before = {
        "admission_calls": AdmissionCall.objects.count(),
        "applicants": Applicant.objects.count(),
        "applications": Application.objects.count(),
        "application_documents": ApplicationDocument.objects.count(),
        "payments": Payment.objects.count(),
        "evaluation_scores": EvaluationScore.objects.count(),
    }

    students_deleted = 0
    users_deleted = 0
    skipped_enrolled = 0
    skipped_not_from_admission = 0

    # ── Si se pide borrar Students, identificarlos ANTES de borrar Applicants ──
    students_to_delete_ids = []
    user_ids_to_delete = []
    if include_students:
        from students.models import Student
        from academic.models import Enrollment

        # 1. DNIs de postulantes (del proceso de admisión)
        admission_dnis = set(
            Applicant.objects.exclude(dni="").values_list("dni", flat=True)
        )

        if admission_dnis:
            # 2. IDs de estudiantes con cualquier matrícula (preservarlos)
            enrolled_ids = set(Enrollment.objects.values_list("student_id", flat=True))

            # 3. Students cuyo num_documento coincida con un DNI de admisión
            candidates = Student.objects.filter(num_documento__in=admission_dnis)

            for st in candidates:
                if st.id in enrolled_ids:
                    skipped_enrolled += 1
                    continue
                students_to_delete_ids.append(st.id)
                if st.user_id:
                    user_ids_to_delete.append(st.user_id)

            # Contar los que NO se borran por no venir de admisión
            skipped_not_from_admission = (
                Student.objects.exclude(id__in=enrolled_ids)
                .exclude(num_documento__in=admission_dnis)
                .count()
            )

    with transaction.atomic():
        # Borrar datos de admisión
        ApplicationDocument.objects.all().delete()
        EvaluationScore.objects.all().delete()
        Payment.objects.all().delete()
        ApplicationPreference.objects.all().delete()
        Application.objects.all().delete()
        ResultPublication.objects.all().delete()
        AdmissionScheduleItem.objects.all().delete()
        Applicant.objects.all().delete()
        AdmissionCall.objects.all().delete()

        # Borrar Students y Users sólo identificados (vinieron del proceso de
        # admisión y no están matriculados)
        if students_to_delete_ids:
            from students.models import Student
            students_deleted = Student.objects.filter(
                id__in=students_to_delete_ids
            ).delete()[0]

        if user_ids_to_delete:
            try:
                users_deleted = User.objects.filter(id__in=user_ids_to_delete).delete()[0]
            except Exception:
                users_deleted = 0

    return Response({
        "ok": True,
        "deleted": counts_before,
        "students_deleted": students_deleted,
        "users_deleted": users_deleted,
        "skipped_enrolled": skipped_enrolled,
        "skipped_not_from_admission": skipped_not_from_admission,
    })
