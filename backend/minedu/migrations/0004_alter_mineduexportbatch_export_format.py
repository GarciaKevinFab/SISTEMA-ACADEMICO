# Agrega el formato PDF a las exportaciones (Certificado de Estudios por estudiante)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("minedu", "0003_alter_mineducode_type_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="mineduexportbatch",
            name="export_format",
            field=models.CharField(
                choices=[("XLSX", "Excel"), ("CSV", "CSV"), ("PDF", "PDF")],
                default="XLSX",
                max_length=10,
            ),
        ),
    ]
