"""Grados academicos para personal sin grado universitario."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("personal", "0003_jefelinea_rd_regional")]

    operations = [
        migrations.AlterField(
            model_name="personal",
            name="grado_academico",
            field=models.CharField(
                blank=True, default="", max_length=20,
                choices=[
                    ("SECUNDARIA", "Secundaria completa"),
                    ("TECNICO", "Técnico (a)"),
                    ("PROFESOR", "Profesor (a)"),
                    ("BACHILLER", "Bachiller (a)"),
                    ("LICENCIADO", "Licenciado (a)"),
                    ("MAGISTER", "Magister (a)"),
                    ("DOCTOR", "Doctor (a)"),
                ],
            ),
        ),
    ]
