# Candado de unicidad: una sola ficha de catalogs.Teacher por usuario.
# Va separado de la 0010 (fusión de gemelas) porque Postgres no permite
# CREATE INDEX en la misma transacción que los DELETE de la fusión
# ("pending trigger events").
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalogs", "0010_fusionar_teachers_duplicados"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="teacher",
            constraint=models.UniqueConstraint(
                condition=models.Q(("user__isnull", False)),
                fields=("user",),
                name="uniq_catalogs_teacher_user",
            ),
        ),
    ]
