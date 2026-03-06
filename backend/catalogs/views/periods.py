"""
ViewSet para Periodos Académicos
─────────────────────────────────
✅ CRUD estándar para catalogs.Period
✅ Sincroniza automáticamente con academic.AcademicPeriod
   al crear / actualizar / eliminar un período.
"""
import logging
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from catalogs.models import Period
from catalogs.serializers import PeriodSerializer
from .utils import list_items

logger = logging.getLogger(__name__)


# ── Sincronización catalogs.Period → academic.AcademicPeriod ──────────

def _sync_academic_period(period_instance):
    """
    Crea o actualiza el AcademicPeriod correspondiente a un Period de catálogos.
    Se llama automáticamente en perform_create / perform_update.
    """
    try:
        from academic.models import AcademicPeriod

        code = getattr(period_instance, "code", "") or ""
        code = code.strip().upper()
        if not code:
            return

        # Preferir fechas explícitas del Period
        start_date = getattr(period_instance, "start_date", None)
        end_date   = getattr(period_instance, "end_date", None)

        # Fallback: construir desde year + term si no hay fechas
        if not start_date or not end_date:
            from datetime import date
            year = getattr(period_instance, "year", None)
            term = getattr(period_instance, "term", "") or ""
            if year:
                year = int(year)
                if term.upper() in ("I", "1"):
                    start_date = start_date or date(year, 3, 1)
                    end_date   = end_date   or date(year, 7, 31)
                elif term.upper() in ("II", "2"):
                    start_date = start_date or date(year, 8, 1)
                    end_date   = end_date   or date(year, 12, 31)
                else:  # III / verano
                    start_date = start_date or date(year, 1, 1)
                    end_date   = end_date   or date(year, 2, 28)
            else:
                return  # Sin info suficiente

        AcademicPeriod.objects.update_or_create(
            code=code,
            defaults=dict(start=start_date, end=end_date),
        )
        logger.info(f"AcademicPeriod '{code}' sincronizado desde catalogs.Period")

    except Exception as e:
        logger.warning(f"Error sincronizando AcademicPeriod para "
                       f"'{getattr(period_instance, 'code', '?')}': {e}")


def _delete_academic_period(code: str):
    """Elimina el AcademicPeriod correspondiente solo si no tiene datos asociados."""
    try:
        from academic.models import AcademicPeriod, Section, Enrollment
        code = (code or "").strip().upper()
        if not code:
            return
        ap = AcademicPeriod.objects.filter(code=code).first()
        if not ap:
            return
        if Section.objects.filter(period=code).exists():
            logger.info(f"AcademicPeriod '{code}' tiene secciones, no se elimina")
            return
        if Enrollment.objects.filter(period=code).exists():
            logger.info(f"AcademicPeriod '{code}' tiene matrículas, no se elimina")
            return
        ap.delete()
        logger.info(f"AcademicPeriod '{code}' eliminado (sync)")
    except Exception as e:
        logger.warning(f"Error eliminando AcademicPeriod '{code}': {e}")


class PeriodsViewSet(viewsets.ModelViewSet):
    queryset = Period.objects.all()
    serializer_class = PeriodSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(Period, "start_date"):
            return qs.order_by("-start_date")
        return qs.order_by("-id")

    def list(self, request, *args, **kwargs):
        return list_items(self.serializer_class, self.get_queryset())

    def perform_create(self, serializer):
        instance = serializer.save()
        _sync_academic_period(instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        _sync_academic_period(instance)

    def perform_destroy(self, instance):
        code = getattr(instance, "code", "")
        instance.delete()
        _delete_academic_period(code)

    @action(detail=True, methods=["post"], url_path="active")
    def set_active(self, request, pk=None):
        is_active = bool(request.data.get("is_active", False))
        p = self.get_object()
        if is_active:
            Period.objects.update(is_active=False)
        p.is_active = is_active
        p.save(update_fields=["is_active"])
        return Response({"ok": True, "id": p.id, "is_active": p.is_active})