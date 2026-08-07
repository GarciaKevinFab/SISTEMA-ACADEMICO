from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalogs", "0006_teacher_profile_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="teacher",
            name="condicion_laboral",
            field=models.CharField(
                blank=True,
                choices=[("NOMBRADO", "Nombrado (a)"), ("CONTRATADO", "Contratado (a)")],
                default="",
                help_text="Nombrado o contratado",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="teacher",
            name="rd_nombramiento",
            field=models.CharField(
                blank=True,
                default="",
                help_text="N° de R.D. de nombramiento o contrato",
                max_length=120,
            ),
        ),
        migrations.AddField(
            model_name="teacher",
            name="rd_fecha",
            field=models.DateField(blank=True, help_text="Fecha de la R.D.", null=True),
        ),
    ]
