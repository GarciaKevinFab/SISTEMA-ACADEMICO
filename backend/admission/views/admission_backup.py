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
import os
import re
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


def _build_backup_zip_bytes() -> bytes:
    """Genera el ZIP completo en memoria y retorna los bytes."""
    now = datetime.now()
    media_root = Path(getattr(settings, "MEDIA_ROOT", ""))

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:

        # ── 1. Convocatorias ──
        calls_data = [_serialize_obj(c) for c in AdmissionCall.objects.all()]
        schedule_data = [_serialize_obj(s) for s in AdmissionScheduleItem.objects.all()]
        result_pubs = [_serialize_obj(r) for r in ResultPublication.objects.all()]
        zf.writestr(
            "convocatorias.json",
            json.dumps({
                "backup_at": now.isoformat(),
                "admission_calls": calls_data,
                "schedule_items": schedule_data,
                "result_publications": result_pubs,
            }, cls=DjangoJSONEncoder, ensure_ascii=False, indent=2)
        )

        # ── 2. Por postulante ──
        applicants = (
            Applicant.objects
            .prefetch_related("applications__call", "applications__preferences__career",
                              "applications__documents", "applications__payment",
                              "applications__scores")
            .all()
        )

        # Resumen CSV
        csv_lines = [
            '"DNI","Apellidos Nombres","Email","Telefono","Convocatorias","Estados","Carpeta"'
        ]

        total_files = 0
        for ap in applicants:
            dni = ap.dni or "sin-dni"
            names_slug = _slug(ap.names or "sin-nombre")
            folder = f"postulantes/{dni}_{names_slug}"

            # perfil.json con aplicaciones, documentos, pagos
            apps_data = []
            estados = []
            convos = []
            for app in ap.applications.all():
                career_pref = []
                for p in app.preferences.all().order_by("rank"):
                    career_pref.append({
                        "rank": p.rank,
                        "career_id": p.career_id,
                        "career_name": p.career.name if p.career else "",
                    })

                pay = getattr(app, "payment", None)
                pay_data = _serialize_obj(pay) if pay else None

                docs_data = []
                for d in app.documents.all():
                    docs_data.append(_serialize_obj(d))

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

            perfil = {
                "applicant": _serialize_obj(ap),
                "applications": apps_data,
            }
            zf.writestr(f"{folder}/perfil.json",
                        json.dumps(perfil, cls=DjangoJSONEncoder, ensure_ascii=False, indent=2))

            # Copiar documentos físicos de cada postulante
            for app in ap.applications.all():
                for d in app.documents.all():
                    if d.file and d.file.name:
                        file_path = media_root / d.file.name
                        if file_path.exists():
                            try:
                                ext = Path(d.file.name).suffix or ""
                                orig = _slug(d.original_name or d.document_type or "doc")[:50]
                                doc_arc = f"{folder}/documentos/{d.document_type or 'DOC'}_{orig}{ext}"
                                zf.write(file_path, doc_arc)
                                total_files += 1
                            except Exception:
                                pass
                # Voucher del pago
                pay = getattr(app, "payment", None)
                if pay and pay.voucher and pay.voucher.name:
                    file_path = media_root / pay.voucher.name
                    if file_path.exists():
                        try:
                            ext = Path(pay.voucher.name).suffix or ""
                            zf.write(file_path, f"{folder}/documentos/VOUCHER_PAGO{ext}")
                            total_files += 1
                        except Exception:
                            pass

            # Línea del CSV
            csv_lines.append(
                f'"{dni}","{ap.names or ""}","{ap.email or ""}","{ap.phone or ""}",'
                f'"{" | ".join(convos)}","{" | ".join(estados)}","{folder}"'
            )

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
  Convocatorias:     {len(calls_data)}
  Postulantes:       {applicants.count()}
  Postulaciones:     {Application.objects.count()}
  Pagos:             {Payment.objects.count()}
  Documentos:        {ApplicationDocument.objects.count()}
  Archivos copiados: {total_files}

Para restaurar manualmente, los JSON tienen todos los IDs originales.
"""
        zf.writestr("README.txt", readme)

    return buf.getvalue()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admission_backup_zip(request):
    """
    GET /admission/backup.zip

    Genera el backup completo en memoria y lo descarga.
    """
    zip_bytes = _build_backup_zip_bytes()
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
        "include_students": false              # opcional: también borrar Students no matriculados
      }
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

    with transaction.atomic():
        ApplicationDocument.objects.all().delete()
        EvaluationScore.objects.all().delete()
        Payment.objects.all().delete()
        ApplicationPreference.objects.all().delete()
        Application.objects.all().delete()
        ResultPublication.objects.all().delete()
        AdmissionScheduleItem.objects.all().delete()
        Applicant.objects.all().delete()
        AdmissionCall.objects.all().delete()

        if include_students:
            from students.models import Student
            from academic.models import Enrollment
            enrolled_ids = set(Enrollment.objects.values_list("student_id", flat=True))
            students_qs = Student.objects.exclude(id__in=enrolled_ids)
            user_ids = [s.user_id for s in students_qs if s.user_id]

            students_deleted = students_qs.count()
            students_qs.delete()

            # Borrar users asociados
            try:
                users_deleted = User.objects.filter(id__in=user_ids).delete()[0]
            except Exception:
                users_deleted = 0

    return Response({
        "ok": True,
        "deleted": counts_before,
        "students_deleted": students_deleted,
        "users_deleted": users_deleted,
    })
