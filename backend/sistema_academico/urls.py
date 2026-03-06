from django.contrib import admin
from django.urls import path, include
from django.conf import settings             # Importación única
from django.conf.urls.static import static
from django.http import JsonResponse

def health(_):
    return JsonResponse({"status": "healthy"})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health),

    # 🔥 Rutas específicas
    path("api/catalogs/", include("catalogs.urls")),
    path("api/acl/", include("acl.urls")),
    path("api/finance/", include("finance.urls")),
    path("api/minedu/", include("minedu.urls")),
    path("api/research/", include("research.urls")),
    path("api/audit", include("audit.urls")),
    path("api/academic/", include("academic.urls")),

    # Rutas genéricas
    path("api/", include("reports.urls")),
    path("api/", include("graduates.urls")),
    path("api/", include("security_mfa.urls")),
    path("api/", include("users.urls")),
    path("api/", include("students.urls")),
    path("api/", include("admission.urls")),
    path("api/", include("mesa_partes.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include("portal.urls")),
    path("api/", include("rest_framework.urls")),
]

# ✅ ESTA ES LA FORMA CORRECTA
# Solo agregamos las rutas de imágenes si estamos en modo desarrollo (DEBUG=True)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)