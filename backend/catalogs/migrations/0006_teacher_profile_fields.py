from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalogs", "0005_alter_teacher_user_on_delete"),
    ]

    operations = [
        migrations.AddField(
            model_name="teacher",
            name="fecha_nac",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="teacher",
            name="grado_academico",
            field=models.CharField(
                blank=True,
                choices=[
                    ("PROFESOR", "Profesor (a)"),
                    ("BACHILLER", "Bachiller (a)"),
                    ("LICENCIADO", "Licenciado (a)"),
                    ("MAGISTER", "Magister (a)"),
                    ("DOCTOR", "Doctor (a)"),
                ],
                default="",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="teacher",
            name="photo",
            field=models.ImageField(blank=True, null=True, upload_to="teachers/photos/"),
        ),
    ]
