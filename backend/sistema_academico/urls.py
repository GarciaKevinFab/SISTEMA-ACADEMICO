from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

def health(_):
    return JsonResponse({"status": "healthy"})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health),

    # módulos
    path("api/", include("reports.urls")),
    path("api/research/", include("research.urls")),
    path("api/", include("security_mfa.urls")),

    path("api/", include("users.urls")),
    path("api/acl/", include("acl.urls")),
    path("api/", include("catalogs.urls")),
    path("api/", include("academic.urls")),
    path("api/", include("admission.urls")),
    path("api/", include("mesa_partes.urls")),
    path("api/finance/", include("finance.urls")),
    path("api/minedu/", include("minedu.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include("portal.urls")),

    # ✅ audit como módulo
    path("api/audit", include("audit.urls")),

    # browsable api login
    path("api/", include("rest_framework.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
