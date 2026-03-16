from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("admission", "0007_payment_voucher_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="AdmissionModality",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, unique=True)),
                ("active", models.BooleanField(default=True)),
                ("order", models.PositiveIntegerField(default=0)),
            ],
            options={
                "ordering": ["order", "name"],
            },
        ),
    ]
