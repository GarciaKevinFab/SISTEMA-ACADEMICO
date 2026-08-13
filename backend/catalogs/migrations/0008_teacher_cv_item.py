"""Hoja de Vida del docente — ítems del CV con documento que acredita."""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("catalogs", "0007_teacher_rd_nombramiento"),
    ]

    operations = [
        migrations.CreateModel(
            name="TeacherCVItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True,
                                           serialize=False, verbose_name="ID")),
                ("seccion", models.CharField(choices=[
                    ("FORMACION", "II. Formación profesional"),
                    ("ESPECIALIZACION", "III. Especialización y actualización"),
                    ("EXPERIENCIA", "IV. Experiencia laboral"),
                    ("EVENTO", "V.a Participación en eventos académicos"),
                    ("PUBLICACION", "V.b Publicaciones"),
                    ("MERITO", "VI. Méritos"),
                    ("INVESTIGACION", "VII. Investigación"),
                ], max_length=20)),
                ("subseccion", models.CharField(blank=True, default="", choices=[
                    ("PREGRADO", "Estudios de pregrado"),
                    ("POSTGRADO", "Estudios de postgrado"),
                    ("SEGUNDA_ESP", "Especialización o segunda especialización"),
                    ("DIPLOMADO", "Diplomado"),
                    ("ACTIVIDAD", "Actividad formativa"),
                    ("IDIOMA", "Idioma extranjero"),
                    ("LENGUA", "Lengua originaria"),
                    ("TIC", "Capacitación en TIC"),
                    ("EXP_SUPERIOR", "Docente en educación superior"),
                    ("EXP_BASICA", "Docente en educación básica / ETP"),
                    ("EXP_CONTINUA", "Formación docente en servicio / continua"),
                    ("", "—"),
                ], max_length=20)),
                ("institucion", models.CharField(blank=True, default="", max_length=255)),
                ("titulo", models.CharField(blank=True, default="", max_length=255)),
                ("detalle", models.CharField(blank=True, default="", max_length=500)),
                ("lugar", models.CharField(blank=True, default="", max_length=120)),
                ("duracion", models.CharField(blank=True, default="", max_length=80)),
                ("fecha_inicio", models.DateField(blank=True, null=True)),
                ("fecha_fin", models.DateField(blank=True, null=True)),
                ("archivo", models.FileField(blank=True, null=True,
                                             upload_to="teachers/cv/")),
                ("orden", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("teacher", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="cv_items", to="catalogs.teacher")),
            ],
            options={
                "ordering": ["seccion", "subseccion", "orden", "fecha_inicio", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="teachercvitem",
            index=models.Index(fields=["teacher", "seccion"],
                               name="catalogs_te_teacher_02a815_idx"),
        ),
    ]
