from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0003_student_plan"),
    ]

    operations = [
        migrations.AddField(
            model_name="student",
            name="estado_academico",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "Normal"),
                    ("LICENCIA", "Licencia"),
                    ("REINCORPORACION", "Reincorporación"),
                    ("TRASLADO", "Traslado"),
                    ("SUBSANACION", "Subsanación"),
                ],
                default="",
                help_text="Estado especial del alumno; con licencia no puede ser calificado",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="student",
            name="estado_rd",
            field=models.CharField(
                blank=True,
                default="",
                help_text="N° de Resolución Directoral que sustenta el estado",
                max_length=80,
            ),
        ),
    ]
