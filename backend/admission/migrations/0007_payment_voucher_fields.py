from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("admission", "0006_admissionscheduleitem_notes"),
    ]

    operations = [
        migrations.AddField(
            model_name="payment",
            name="channel",
            field=models.CharField(
                choices=[
                    ("AGENCIA_BN", "Agencia Banco de la Nación"),
                    ("CAJERO_MULTIRED", "Cajero Multired"),
                    ("PAGALO", "Págalo.pe"),
                ],
                default="AGENCIA_BN",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="payment",
            name="nro_secuencia",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="payment",
            name="codigo_caja",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="payment",
            name="fecha_movimiento",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="voucher",
            field=models.FileField(
                blank=True, null=True, upload_to="admission/vouchers/"
            ),
        ),
    ]
