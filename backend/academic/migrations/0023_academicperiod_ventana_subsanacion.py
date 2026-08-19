# Ventana de matrícula de SUBSANACIÓN: rango propio para los alumnos con
# estado académico SUBSANACIÓN (padrón); si no se configura, se matriculan
# dentro de las ventanas regulares.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("academic", "0022_sesion_aprendizaje"),
    ]

    operations = [
        migrations.AddField(
            model_name="academicperiod",
            name="subsanacion_start",
            field=models.DateTimeField(
                blank=True,
                help_text="Inicio de la matrícula de subsanación",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="academicperiod",
            name="subsanacion_end",
            field=models.DateTimeField(
                blank=True,
                help_text="Fin de la matrícula de subsanación",
                null=True,
            ),
        ),
    ]
