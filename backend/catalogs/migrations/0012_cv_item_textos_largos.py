# Los docentes escriben descripciones extensas en la Hoja de Vida: con los
# topes originales (institucion/titulo 255, detalle 500) el guardado reventaba
# en Postgres con un 500 sin mensaje ("no le deja agregar"). Se amplían los
# campos de texto libre.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalogs", "0011_teacher_user_unico"),
    ]

    operations = [
        migrations.AlterField(
            model_name="teachercvitem",
            name="institucion",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AlterField(
            model_name="teachercvitem",
            name="titulo",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AlterField(
            model_name="teachercvitem",
            name="detalle",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AlterField(
            model_name="teachercvitem",
            name="lugar",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AlterField(
            model_name="teachercvitem",
            name="duracion",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
    ]
