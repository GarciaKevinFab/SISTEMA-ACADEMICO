# Generated manually — adds Office.head (encargado) FK

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("mesa_partes", "0002_alter_office_options_alter_procedure_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="office",
            name="head",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="offices_as_head",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Encargado",
            ),
        ),
    ]
