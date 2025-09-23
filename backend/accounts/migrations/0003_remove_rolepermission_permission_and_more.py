# backend/accounts/migrations/0003_cleanup_permissions.py
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_apppermission_rolepermission"),
    ]

    operations = [
        # Deja al User “limpio”
        migrations.AlterModelOptions(
            name="user",
            options={"verbose_name": "user", "verbose_name_plural": "users"},
        ),
        migrations.RemoveField(model_name="user", name="dni"),
        migrations.RemoveField(model_name="user", name="phone"),
        migrations.RemoveField(model_name="user", name="role"),
        migrations.AddField(
            model_name="user",
            name="mfa_enabled",
            field=models.BooleanField(default=False),
        ),

        # Elimina directamente los modelos heredados viejos
        migrations.DeleteModel(name="RolePermission"),
        migrations.DeleteModel(name="AppPermission"),
    ]
