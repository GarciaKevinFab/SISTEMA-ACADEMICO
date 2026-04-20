"""
backup_admission — genera un ZIP con todos los datos de admisión.

El ZIP contiene:
  - data.json          → dump de todas las tablas (AdmissionCall, Applicant,
                          Application, Preferences, Documents, Payments,
                          Evaluations, Results)
  - files/admission/   → copia de TODOS los archivos de media/admission/
                          (docs de postulantes, vouchers, reglamentos)
  - summary.txt        → resumen con conteos y fecha

Uso:
    python manage.py backup_admission
    python manage.py backup_admission --output /tmp/mi_backup.zip
"""
import io
import json
import os
import zipfile
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand
from django.core.serializers.json import DjangoJSONEncoder
from django.conf import settings
from django.forms.models import model_to_dict

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


def _serialize_queryset(qs, extra_fields=None):
    """Convierte un queryset en lista de dicts JSON-friendly."""
    result = []
    for obj in qs:
        data = model_to_dict(obj)
        # File fields: guardar path relativo
        for f in obj._meta.fields:
            if f.get_internal_type() in ("FileField", "ImageField"):
                val = getattr(obj, f.name)
                data[f.name] = val.name if val else None
        # Timestamps que model_to_dict no incluye
        for attr in ("created_at", "updated_at"):
            if hasattr(obj, attr):
                val = getattr(obj, attr)
                if val:
                    data[attr] = val.isoformat()
        if extra_fields:
            for k, fn in extra_fields.items():
                try:
                    data[k] = fn(obj)
                except Exception:
                    data[k] = None
        result.append(data)
    return result


class Command(BaseCommand):
    help = "Genera un ZIP con todos los datos de admisión (JSON + archivos)"

    def add_arguments(self, parser):
        parser.add_argument("--output", type=str, default=None,
                            help="Ruta del ZIP (default: backend/backups/admission_backup_<fecha>.zip)")

    def handle(self, *args, **opts):
        now = datetime.now()
        ts = now.strftime("%Y-%m-%d_%H-%M-%S")

        # Ruta de salida
        output = opts["output"]
        if not output:
            backups_dir = Path(settings.BASE_DIR) / "backups"
            backups_dir.mkdir(exist_ok=True)
            output = backups_dir / f"admission_backup_{ts}.zip"
        output = Path(output)

        self.stdout.write(f"Generando backup en {output}…")

        # ── 1. Dump de tablas ──
        data = {
            "backup_at": now.isoformat(),
            "admission_calls": _serialize_queryset(AdmissionCall.objects.all()),
            "schedule_items": _serialize_queryset(AdmissionScheduleItem.objects.all()),
            "applicants": _serialize_queryset(Applicant.objects.all()),
            "applications": _serialize_queryset(
                Application.objects.all(),
                extra_fields={
                    "call_title": lambda a: a.call.title if a.call else "",
                    "applicant_dni": lambda a: a.applicant.dni if a.applicant else "",
                    "applicant_name": lambda a: a.applicant.names if a.applicant else "",
                }
            ),
            "application_preferences": _serialize_queryset(
                ApplicationPreference.objects.all(),
                extra_fields={"career_name": lambda p: p.career.name if p.career else ""}
            ),
            "application_documents": _serialize_queryset(ApplicationDocument.objects.all()),
            "payments": _serialize_queryset(Payment.objects.all()),
            "evaluation_scores": _serialize_queryset(EvaluationScore.objects.all()),
            "result_publications": _serialize_queryset(ResultPublication.objects.all()),
        }

        counts = {k: len(v) for k, v in data.items() if isinstance(v, list)}
        self.stdout.write("Conteos:")
        for k, v in counts.items():
            self.stdout.write(f"  • {k}: {v}")

        # ── 2. Escribir ZIP ──
        media_root = Path(getattr(settings, "MEDIA_ROOT", ""))
        copied_files = 0
        skipped_files = 0

        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zf:
            # data.json
            zf.writestr(
                "data.json",
                json.dumps(data, cls=DjangoJSONEncoder, ensure_ascii=False, indent=2)
            )

            # summary.txt
            summary_lines = [
                f"BACKUP DE ADMISIÓN",
                f"Generado: {now.strftime('%Y-%m-%d %H:%M:%S')}",
                f"",
                f"Conteos:",
            ]
            for k, v in counts.items():
                summary_lines.append(f"  {k}: {v}")
            zf.writestr("summary.txt", "\n".join(summary_lines))

            # Archivos de media/admission/ (docs, vouchers, reglamentos)
            if media_root.exists():
                admission_media = media_root / "admission"
                if admission_media.exists():
                    for root, dirs, files in os.walk(admission_media):
                        for fname in files:
                            full = Path(root) / fname
                            try:
                                arc = "files/" + str(full.relative_to(media_root)).replace("\\", "/")
                                zf.write(full, arc)
                                copied_files += 1
                            except Exception as exc:
                                skipped_files += 1
                                self.stdout.write(self.style.WARNING(
                                    f"  Saltando {full}: {exc}"
                                ))

        size_mb = output.stat().st_size / (1024 * 1024)
        self.stdout.write(self.style.SUCCESS(
            f"\n✓ Backup generado:"
            f"\n  Archivo: {output}"
            f"\n  Tamaño:  {size_mb:.2f} MB"
            f"\n  Archivos de media copiados: {copied_files}"
            + (f" (saltados: {skipped_files})" if skipped_files else "")
        ))
        return str(output)
