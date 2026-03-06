"""
Change Teacher.user on_delete from PROTECT to SET_NULL.
Teacher already has null=True, blank=True, so SET_NULL is safe.
This prevents ProtectedError when deleting users.
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("catalogs", "0004_importjob_user"),
    ]

    operations = [
        migrations.AlterField(
            model_name="teacher",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="catalog_teachers",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
