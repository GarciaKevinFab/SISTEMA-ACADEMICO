from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("academic", "0017_alter_teacher_user_on_delete"),
    ]

    operations = [
        migrations.AddField(
            model_name="enrollmentpayment",
            name="nro_secuencia",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="enrollmentpayment",
            name="codigo_caja",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="enrollmentpayment",
            name="fecha_movimiento",
            field=models.DateField(blank=True, null=True),
        ),
    ]
