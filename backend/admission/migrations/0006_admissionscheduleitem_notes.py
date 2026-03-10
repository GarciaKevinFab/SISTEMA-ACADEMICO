from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("admission", "0005_application_created_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="admissionscheduleitem",
            name="notes",
            field=models.TextField(blank=True, default=""),
        ),
    ]
