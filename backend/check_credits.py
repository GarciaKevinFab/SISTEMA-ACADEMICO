import django, os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
try:
    django.setup()
except:
    pass

from django.db.models import Sum
from academic.models import Plan, PlanCourse

for plan in Plan.objects.filter(is_deleted=False).order_by("id"):
    print("")
    print("Plan #%d: %s" % (plan.id, plan.name))
    sems = PlanCourse.objects.filter(plan=plan, semester__gt=0).values("semester").annotate(total=Sum("credits")).order_by("semester")
    for s in sems:
        sem = s["semester"]
        total = s["total"]
        flag = " EXCEDE 22" if total > 22 else ""
        print("  Sem %2d: %2d cr%s" % (sem, total, flag))
    bad = PlanCourse.objects.filter(plan=plan, credits__lte=3, weekly_hours__gte=5, semester__gt=0).select_related("course")
    for pc in bad:
        n = pc.display_name or pc.course.name
        print("  WARNING PC#%d: %s -> %dcr / %dh" % (pc.id, n, pc.credits, pc.weekly_hours))