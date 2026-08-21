"""Programas academicos a cargo de cada coordinador de area."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("personal", "0004_grados_tecnico_secundaria"),
        ("catalogs", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="jefelinea",
            name="careers",
            field=models.ManyToManyField(
                blank=True, related_name="coordinadores", to="catalogs.career"),
        ),
    ]
