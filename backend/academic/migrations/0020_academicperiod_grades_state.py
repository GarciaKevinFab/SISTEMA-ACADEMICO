from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("academic", "0019_academicperiod_grades_window"),
    ]

    operations = [
        migrations.AddField(
            model_name="academicperiod",
            name="grades_state",
            field=models.CharField(
                choices=[("OPEN", "En evaluación"), ("CLOSED", "Cerrado")],
                default="OPEN",
                help_text="Estado del registro de calificaciones del período",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="academicperiod",
            name="grades_closed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
