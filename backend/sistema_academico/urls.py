from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

def health(_):
    # "build" permite verificar qué versión del código está cargada en memoria
    info = {"status": "healthy", "build": "2026-07-22-directorio-v3"}
    try:
        from acl.models import UserRole
        from django.contrib.auth import get_user_model
        from catalogs.models import Teacher as CatTeacher
        U = get_user_model()
        names = ["TEACHER", "DOCENTE", "PROFESOR"]
        info["dbg"] = {
            "teacher_acl_userrole": UserRole.objects.filter(role__name__in=names)
                                    .values("user_id").distinct().count(),
            "teacher_user_roles_m2m": U.objects.filter(roles__name__in=names)
                                      .distinct().count(),
            "catalog_teachers": CatTeacher.objects.count(),
        }
    except Exception as exc:
        info["dbg_error"] = f"{type(exc).__name__}: {exc}"[:300]
    return JsonResponse(info)

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

# ══════════════════════════════════════════════════════════════
# Página pública de verificación de postulante (QR de constancia)
# Renderiza HTML completo desde Django — no depende del frontend React
# ══════════════════════════════════════════════════════════════
from admission.views.certificates import verify_applicant_page
from mesa_partes.views import track_procedure_page
from academic.views.enrollment_verify import verify_enrollment_page
urlpatterns += [
    path("public/admission/search", verify_applicant_page),
    path("public/procedures/track/<str:code>", track_procedure_page),
    path("public/procedures/track", track_procedure_page),
    path("public/academic/enrollment", verify_enrollment_page),
]