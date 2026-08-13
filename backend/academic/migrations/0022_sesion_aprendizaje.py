"""Sesiones de aprendizaje del docente (PDF por día de clase del curso)."""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("academic", "0021_enrollment_tipo_matricula"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SesionAprendizaje",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True,
                                           serialize=False, verbose_name="ID")),
                ("fecha", models.DateField()),
                ("semana", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("tema", models.CharField(max_length=255)),
                ("archivo", models.FileField(upload_to="sesiones/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="sesiones_subidas",
                    to=settings.AUTH_USER_MODEL)),
                ("section", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="sesiones_aprendizaje",
                    to="academic.section")),
            ],
            options={"ordering": ["fecha", "id"]},
        ),
        migrations.AddIndex(
            model_name="sesionaprendizaje",
            index=models.Index(fields=["section", "fecha"],
                               name="academic_se_section_41d76d_idx"),
        ),
    ]
