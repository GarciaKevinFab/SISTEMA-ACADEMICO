"""R.D. Regional en PDF para cada jefatura de línea."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("personal", "0002_sembrar_cargos_ley_30512")]

    operations = [
        migrations.AddField(
            model_name="jefelinea",
            name="resolucion_archivo",
            field=models.FileField(blank=True, null=True,
                                   upload_to="personal/rd/"),
        ),
        migrations.AddField(
            model_name="jefelinea",
            name="resolucion_subida",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
