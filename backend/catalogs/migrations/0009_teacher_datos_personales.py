# I. Datos personales de la Hoja de Vida (perfil de postulante docente):
# apellidos y nombres separados, sexo, teléfono fijo, dirección y ubigeo.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalogs", "0008_teacher_cv_item"),
    ]

    operations = [
        migrations.AddField(
            model_name="teacher",
            name="apellido_paterno",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="teacher",
            name="apellido_materno",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="teacher",
            name="nombres",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="teacher",
            name="sexo",
            field=models.CharField(
                blank=True,
                choices=[("M", "Masculino"), ("F", "Femenino")],
                default="",
                max_length=1,
            ),
        ),
        migrations.AddField(
            model_name="teacher",
            name="telefono_fijo",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="teacher",
            name="direccion",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="teacher",
            name="region",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="teacher",
            name="provincia",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="teacher",
            name="distrito",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
    ]
