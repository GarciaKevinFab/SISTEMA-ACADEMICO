from django.db import migrations

def forwards(apps, schema_editor):
    Plan = apps.get_model("academic", "Plan")
    Plan.objects.filter(is_deleted=True).update(is_deleted=False)
class Migration(migrations.Migration):

    dependencies = [
        ('academic', '0009_backfill_plancourse_credits'),
    ]

   
    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]