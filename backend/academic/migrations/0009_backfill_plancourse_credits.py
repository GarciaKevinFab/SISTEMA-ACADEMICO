from django.db import migrations


def forwards(apps, schema_editor):
    PlanCourse = apps.get_model("academic", "PlanCourse")

    qs = PlanCourse.objects.select_related("course").all()

    for pc in qs.iterator():
        # Si ya tiene créditos válidos, no tocar
        if int(getattr(pc, "credits", 0) or 0) > 0:
            continue

        cr = 0
        try:
            cr = int(getattr(pc.course, "credits", 0) or 0)
        except Exception:
            cr = 0

        pc.credits = cr if cr > 0 else 3
        pc.save(update_fields=["credits"])


class Migration(migrations.Migration):

    dependencies = [
        ("academic", "0008_plancourse_credits_plancourse_uniq_plan_course"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
