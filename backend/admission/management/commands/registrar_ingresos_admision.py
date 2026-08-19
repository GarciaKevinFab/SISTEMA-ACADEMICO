"""Backfill de finanzas: registra el IncomeEntry (Reportes de ingresos) de
los pagos de admisión APROBADOS que no lo tienen — aprobados antes de que
existiera el registro automático, o cuyo registro falló en silencio (caso
convocatoria Auxiliar de Educación). No crea CashMovement (es histórico).

Uso:
    python manage.py registrar_ingresos_admision            # simulación
    python manage.py registrar_ingresos_admision --aplicar  # registra
"""
from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_datetime


class Command(BaseCommand):
    help = ("Registra en Reportes de ingresos los pagos de admisión "
            "aprobados que no tienen su ingreso registrado")

    def add_arguments(self, parser):
        parser.add_argument("--aplicar", action="store_true",
                            help="Sin este flag solo muestra lo que registraría")

    def handle(self, *args, **opts):
        from admission.models import Payment
        from finance.models import IncomeEntry, Concept

        aplicar = opts["aplicar"]
        qs = (Payment.objects.filter(status="PAID")
              .select_related("application__applicant", "application__call"))
        faltan = [p for p in qs if not (p.meta or {}).get("income_registered")]
        self.stdout.write(f"Pagos aprobados SIN ingreso registrado: {len(faltan)}")
        if not faltan:
            return

        concept = Concept.objects.filter(type="ADMISION").first()
        if not concept:
            concept, _ = Concept.objects.get_or_create(
                code="ADMISION",
                defaults={"name": "Derecho de Admisión", "type": "ADMISION",
                          "default_amount": 0},
            )

        n = 0
        for p in faltan:
            app = p.application
            applicant = app.applicant if app else None
            dni = applicant.dni if applicant else str(p.id)
            meta = p.meta or {}
            dt = parse_datetime(meta.get("confirmed_at") or "")
            fecha = dt.date() if dt else (p.created_at.date() if p.created_at else None)
            carrera = (app.career_name if app else "") or ""
            titulo = (f"{concept.name} - "
                      f"{app.call.title if app and app.call else ''}").strip(" -")
            self.stdout.write(
                f"  {dni} | {carrera or 'sin carrera'} | S/ {p.amount} | {fecha}")
            if not aplicar:
                continue
            IncomeEntry.objects.create(
                date=fecha,
                subject_id=dni,
                concept=concept,
                concept_name=titulo,
                career_name=carrera,
                amount=p.amount,
            )
            meta["income_registered"] = True
            meta["income_date"] = str(fecha)
            meta["income_backfill"] = True
            p.meta = meta
            p.save(update_fields=["meta"])
            n += 1

        if aplicar:
            self.stdout.write(self.style.SUCCESS(f"{n} ingreso(s) registrados"))
        else:
            self.stdout.write("Modo simulación — vuelve a correr con --aplicar")
