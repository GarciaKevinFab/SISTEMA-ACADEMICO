"""Siembra los cargos de jefatura de línea del Reglamento de la Ley N° 30512.

Las filas no las crea el usuario: son los cargos que exige la norma (p. 31).
El panel solo asigna el RESPONSABLE de cada uno.
"""
from django.db import migrations

CARGOS = [
    ("DIRECTOR_GENERAL", "a"),
    ("JEFE_UNIDAD_ACADEMICA", "b"),
    ("JEFE_AREA_ADMINISTRACION", "b"),
    ("COORD_AREA_INICIAL", "c"),
    ("COORD_AREA_PRIMARIA", "c"),
    ("COORD_AREA_EDUC_FISICA", "c"),
    ("COORD_PRACTICA_INVESTIGACION", "d"),
    ("SECRETARIO_ACADEMICO", "e"),
    ("JEFE_INVESTIGACION", "f"),
    ("JEFE_FORMACION_CONTINUA", "g"),
    ("JEFE_BIENESTAR", "h"),
    ("COORD_AREA_CALIDAD", "i"),
    ("JEFE_UNIDAD_POSGRADO", "j"),
]


def sembrar(apps, schema_editor):
    JefeLinea = apps.get_model("personal", "JefeLinea")
    for i, (codigo, letra) in enumerate(CARGOS):
        JefeLinea.objects.update_or_create(
            cargo=codigo, defaults={"letra": letra, "orden": i})


def borrar(apps, schema_editor):
    JefeLinea = apps.get_model("personal", "JefeLinea")
    JefeLinea.objects.filter(
        cargo__in=[c for c, _ in CARGOS], teacher__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [("personal", "0001_initial")]

    operations = [migrations.RunPython(sembrar, borrar)]
