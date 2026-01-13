from django.core.management.base import BaseCommand
from students.models import Student
import pandas as pd

COLUMN_MAP = {
    "REGIÓN": "region",
    "PROVINCIA": "provincia",
    "DISTRITO": "distrito",
    "CÓDIGO_MODULAR": "codigo_modular",
    "NOMBRE DE LA INSTITUCIÓN": "nombre_institucion",
    "GESTIÓN": "gestion",
    "TIPO": "tipo",
    "Programa / Carrera": "programa_carrera",
    "Ciclo": "ciclo",
    "Turno": "turno",
    "Seccion": "seccion",
    "Apellido Paterno": "apellido_paterno",
    "Apellido Materno": "apellido_materno",
    "Nombres": "nombres",
    "Fecha Nac": "fecha_nac",
    "Sexo": "sexo",
    "Num Documento": "num_documento",
    "Lengua": "lengua",
    "Periodo": "periodo",
    "Discapacidad": "discapacidad",
    "tipo de discapacidad": "tipo_discapacidad",
}

class Command(BaseCommand):
    help = "Importa estudiantes desde un Excel con la plantilla oficial."

    def add_arguments(self, parser):
        parser.add_argument("filepath", type=str)
        parser.add_argument("--update", action="store_true", help="Actualiza si ya existe num_documento")

    def handle(self, *args, **opts):
        path = opts["filepath"]
        do_update = opts["update"]

        df = pd.read_excel(path)

        # Validación rápida de columnas
        missing = [c for c in COLUMN_MAP.keys() if c not in df.columns]
        if missing:
            self.stderr.write(self.style.ERROR(f"Faltan columnas: {missing}"))
            return

        created, updated, skipped = 0, 0, 0

        for _, row in df.iterrows():
            payload = {}
            for col, field in COLUMN_MAP.items():
                val = row.get(col)
                if pd.isna(val):
                    val = "" if field not in ("ciclo", "fecha_nac") else None
                payload[field] = val

            # Normalizaciones básicas
            payload["ciclo"] = int(payload["ciclo"]) if payload["ciclo"] not in (None, "") else None

            # num_documento es UNIQUE: es la llave
            num_doc = str(payload["num_documento"]).strip()
            if not num_doc:
                skipped += 1
                continue

            payload["num_documento"] = num_doc

            obj = Student.objects.filter(num_documento=num_doc).first()
            if obj:
                if do_update:
                    for k, v in payload.items():
                        setattr(obj, k, v)
                    obj.save()
                    updated += 1
                else:
                    skipped += 1
            else:
                Student.objects.create(**payload)
                created += 1

        self.stdout.write(self.style.SUCCESS(
            f"Import listo. created={created}, updated={updated}, skipped={skipped}"
        ))
