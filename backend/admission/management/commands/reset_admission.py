"""
reset_admission — borra datos de admisión para volver a empezar limpio.

Uso:
    # Solo admisión (convocatorias, postulaciones, pagos, documentos, etc.)
    python manage.py reset_admission --yes

    # También borra Students e Users creados por el importador de ingresantes
    # (solo los que NO estén matriculados en ningún período)
    python manage.py reset_admission --yes --include-students

    # Dry-run: muestra qué se borraría sin borrar nada
    python manage.py reset_admission --dry-run
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.contrib.auth import get_user_model

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


class Command(BaseCommand):
    help = "Borra datos de admisión (convocatorias, postulantes, etc.)"

    def add_arguments(self, parser):
        parser.add_argument("--yes", action="store_true",
                            help="Confirma la ejecución (requerido, salvo con --dry-run)")
        parser.add_argument("--dry-run", action="store_true",
                            help="Solo muestra qué se borraría, no borra nada")
        parser.add_argument("--include-students", action="store_true",
                            help="También borra Students sin matrícula e Users asociados")

    def handle(self, *args, **opts):
        confirmed = opts["yes"]
        dry_run = opts["dry_run"]
        include_students = opts["include_students"]

        if not confirmed and not dry_run:
            raise CommandError(
                "Se requiere --yes para ejecutar (o --dry-run para simular)."
            )

        # ── Conteos antes ──
        counts = {
            "AdmissionCall": AdmissionCall.objects.count(),
            "AdmissionScheduleItem": AdmissionScheduleItem.objects.count(),
            "Applicant": Applicant.objects.count(),
            "Application": Application.objects.count(),
            "ApplicationPreference": ApplicationPreference.objects.count(),
            "ApplicationDocument": ApplicationDocument.objects.count(),
            "Payment": Payment.objects.count(),
            "EvaluationScore": EvaluationScore.objects.count(),
            "ResultPublication": ResultPublication.objects.count(),
        }

        self.stdout.write(self.style.WARNING("Datos que serán borrados:"))
        for k, v in counts.items():
            self.stdout.write(f"  • {k}: {v}")

        # ── Students/Users si se pide ──
        students_to_delete = []
        users_to_delete = []
        if include_students:
            from students.models import Student
            from academic.models import Enrollment
            # Students sin matrícula
            enrolled_ids = set(Enrollment.objects.values_list("student_id", flat=True))
            all_students = Student.objects.exclude(id__in=enrolled_ids)
            students_to_delete = list(all_students)
            user_ids = [s.user_id for s in students_to_delete if s.user_id]
            users_to_delete = list(User.objects.filter(id__in=user_ids))

            self.stdout.write(self.style.WARNING("\nTambién se borrarán:"))
            self.stdout.write(f"  • Students sin matrícula: {len(students_to_delete)}")
            self.stdout.write(f"  • Users asociados: {len(users_to_delete)}")

        if dry_run:
            self.stdout.write(self.style.SUCCESS("\n[DRY-RUN] No se borró nada."))
            return

        # ── Borrar ──
        with transaction.atomic():
            # Orden: dependientes primero (por si las FK no tienen CASCADE)
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
                for st in students_to_delete:
                    st.delete()
                # Eliminar users (los UserRoles se borran por cascade)
                for u in users_to_delete:
                    try:
                        u.delete()
                    except Exception as exc:
                        self.stdout.write(self.style.WARNING(
                            f"No se pudo borrar user {u.username}: {exc}"
                        ))

        self.stdout.write(self.style.SUCCESS("\n✓ Reset de admisión completado."))
