# backend/admission/views.py
from datetime import timedelta
import os

from django.conf import settings
from django.http import HttpResponse
from django.db import models
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from django.db.models import Count
from django.db.models.functions import TruncDate

from .models import (
    Career,
    AdmissionCall,
    AdmissionScheduleItem,
    Applicant,
    Application,
    ApplicationDocument,
    Payment,
    EvaluationScore,
    AdmissionParam,
    ResultPublication,
)

from .serializers import (
    CareerSerializer,
    AdmissionCallSerializer,
    AdmissionScheduleItemSerializer,
    ApplicantSerializer,
    ApplicationSerializer,
    ApplicationDocumentSerializer,
    PaymentSerializer,
    EvaluationScoreSerializer,
    AdmissionParamSerializer,
)

# =========================================================
# Helpers
# =========================================================
def _has_field(model, name: str) -> bool:
    try:
        model._meta.get_field(name)
        return True
    except Exception:
        return False


def _ensure_media_tmp():
    tmpdir = os.path.join(settings.MEDIA_ROOT, "tmp")
    os.makedirs(tmpdir, exist_ok=True)
    return tmpdir


def _write_stub_pdf(abs_path: str, title="Documento", subtitle=""):
    try:
        from reportlab.pdfgen import canvas  # type: ignore
        from reportlab.lib.pagesizes import A4  # type: ignore

        c = canvas.Canvas(abs_path, pagesize=A4)
        w, h = A4
        c.setFont("Helvetica-Bold", 16)
        c.drawString(72, h - 72, title)
        c.setFont("Helvetica", 12)
        if subtitle:
            c.drawString(72, h - 100, subtitle)
        c.drawString(72, h - 130, "Generado automáticamente.")
        c.showPage()
        c.save()
    except Exception:
        minimal_pdf = b"""%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 62 >>stream
BT /F1 18 Tf 72 720 Td (Documento) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000061 00000 n
0000000116 00000 n
0000000236 00000 n
0000000404 00000 n
trailer<< /Size 6 /Root 1 0 R >>
startxref
500
%%EOF
"""
        with open(abs_path, "wb") as f:
            f.write(minimal_pdf)


def _parse_dt(v):
    """Acepta ISO con Z o sin Z; devuelve aware datetime o None."""
    if not v:
        return None
    if isinstance(v, str):
        s = v.strip()
        # Django parse_datetime no siempre traga "Z"
        if s.endswith("Z"):
            s = s.replace("Z", "+00:00")
        dt = parse_datetime(s)
        if dt and timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return dt
    return None


def _is_active_call(call: AdmissionCall) -> bool:
    """
    Activa = dentro del rango de inscripción y no cerrada.
    Si no hay fechas, fallback: no cerrada y (published == False).
    """
    m = call.meta or {}
    if m.get("closed") is True:
        return False

    now = timezone.now()
    rs = _parse_dt(m.get("registration_start"))
    re = _parse_dt(m.get("registration_end"))

    if rs and re:
        return rs <= now <= re

    # Fallback para casos sin fechas:
    return (call.published is False)


# =========================================================
# Mapping FE <-> Model AdmissionCall
# =========================================================
def _fe_to_call(payload: dict) -> dict:
    year = payload.get("academic_year")
    period = payload.get("academic_period")

    careers = payload.get("careers") or []
    if not careers:
        ids = payload.get("available_careers") or []
        vacs = payload.get("career_vacancies") or {}
        careers = [{"career_id": cid, "vacancies": vacs.get(cid, 0)} for cid in ids]

    vac_total = 0
    for c in careers:
        try:
            vac_total += int(c.get("vacancies") or 0)
        except Exception:
            pass

    # NO uses "status" para setear published (te rompe el portal)
    published = bool(payload.get("published", False))

    meta = {
        "description": payload.get("description", "") or "",
        "academic_year": year,
        "academic_period": period,
        "registration_start": payload.get("registration_start"),
        "registration_end": payload.get("registration_end"),
        "exam_date": payload.get("exam_date"),
        "results_date": payload.get("results_date"),
        "application_fee": payload.get("application_fee"),
        "max_applications_per_career": payload.get("max_applications_per_career"),
        "minimum_age": payload.get("minimum_age"),
        "maximum_age": payload.get("maximum_age"),
        "required_documents": payload.get("required_documents") or [],
        "careers": careers,
        # guardamos status si viene, pero no gobierna published
        "status": payload.get("status"),
    }

    return {
        "title": payload.get("name") or payload.get("title") or "Convocatoria",
        "period": f"{year}-{period}" if year and period else (payload.get("period") or ""),
        "published": published,
        "vacants_total": vac_total,
        "meta": meta,
    }


def _call_to_fe(obj: AdmissionCall) -> dict:
    m = obj.meta or {}
    careers = m.get("careers") or []

    career_names = {c.id: c.name for c in Career.objects.all()}
    norm_careers = []
    for it in careers:
        cid = it.get("career_id") or it.get("id")
        if not cid:
            continue
        name = it.get("name") or it.get("career_name") or career_names.get(cid, f"Carrera {cid}")
        vac = it.get("vacancies") or it.get("quota") or it.get("slots") or 0
        try:
            vac = int(vac)
        except Exception:
            vac = 0
        norm_careers.append({"id": cid, "career_id": cid, "name": name, "vacancies": vac})

    apps_count = getattr(obj, "applications_count", 0)

    # status real para UI:
    status = "OPEN" if _is_active_call(obj) else ("PUBLISHED" if obj.published else "CLOSED")

    return {
        "id": obj.id,
        "name": obj.title,
        "description": m.get("description", ""),
        "academic_year": m.get("academic_year"),
        "academic_period": m.get("academic_period"),
        "registration_start": m.get("registration_start"),
        "registration_end": m.get("registration_end"),
        "exam_date": m.get("exam_date"),
        "results_date": m.get("results_date"),
        "application_fee": m.get("application_fee", 0),
        "max_applications_per_career": m.get("max_applications_per_career", 1),
        "minimum_age": m.get("minimum_age"),
        "maximum_age": m.get("maximum_age"),
        "required_documents": m.get("required_documents", []),
        "careers": norm_careers,
        "total_applications": apps_count,
        "status": status,
    }


# =========================================================
# PUBLIC - Convocatorias
# Endpoint: /admission-calls/public
# ✅ ahora devuelve ACTIVAS por fechas
# =========================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def calls_list_public(request):
    qs = AdmissionCall.objects.all().order_by("id").annotate(applications_count=models.Count("applications"))
    active = [c for c in qs if _is_active_call(c)]
    return Response([_call_to_fe(o) for o in active])


# =========================================================
# ADMIN - Convocatorias (GET/POST)
# Endpoint: /admission-calls
# =========================================================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def calls_collection(request):
    if request.method == "GET":
        qs = AdmissionCall.objects.all().order_by("id").annotate(applications_count=models.Count("applications"))
        return Response([_call_to_fe(o) for o in qs])

    payload = request.data or {}
    mapped = _fe_to_call(payload)
    s = AdmissionCallSerializer(data=mapped)
    s.is_valid(raise_exception=True)
    obj = s.save()
    return Response(_call_to_fe(obj), status=201)


# =========================================================
# Schedule por convocatoria
# =========================================================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def call_schedule_collection(request, call_id: int):
    if request.method == "GET":
        qs = AdmissionScheduleItem.objects.filter(call_id=call_id).order_by("id")
        return Response(AdmissionScheduleItemSerializer(qs, many=True).data)

    payload = request.data.copy()
    payload["call"] = call_id
    s = AdmissionScheduleItemSerializer(data=payload)
    s.is_valid(raise_exception=True)
    obj = s.save()
    return Response(AdmissionScheduleItemSerializer(obj).data, status=201)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def call_schedule_detail(request, call_id: int, item_id: int):
    try:
        obj = AdmissionScheduleItem.objects.get(pk=item_id, call_id=call_id)
    except AdmissionScheduleItem.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    if request.method == "PUT":
        s = AdmissionScheduleItemSerializer(obj, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        obj = s.save()
        return Response(AdmissionScheduleItemSerializer(obj).data)

    obj.delete()
    return Response(status=204)


# =========================================================
# Carreras
# =========================================================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def careers_collection(request):
    if request.method == "GET":
        qs = Career.objects.all().order_by("id")
        return Response(CareerSerializer(qs, many=True).data)

    s = CareerSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    obj = s.save()
    return Response(CareerSerializer(obj).data, status=201)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def career_detail(request, career_id: int):
    try:
        row = Career.objects.get(pk=career_id)
    except Career.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    if request.method == "GET":
        return Response(CareerSerializer(row).data)

    if request.method == "PUT":
        s = CareerSerializer(row, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        obj = s.save()
        return Response(CareerSerializer(obj).data)

    row.delete()
    return Response(status=204)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def career_toggle_active(request, career_id: int):
    try:
        row = Career.objects.get(pk=career_id)
    except Career.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    row.is_active = not bool(row.is_active)
    row.save(update_fields=["is_active", "updated_at"])
    return Response(CareerSerializer(row).data)


# =========================================================
# Postulaciones
# =========================================================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def applications_collection(request):
    if request.method == "GET":
        qs = Application.objects.all().order_by("id")
        call_id = request.query_params.get("call_id")
        if call_id:
            qs = qs.filter(call_id=call_id)
        return Response(ApplicationSerializer(qs, many=True).data)

    payload = request.data or {}

    # Exigir applicant real (por tu modelo: dni/names/email obligatorios)
    applicant_id = payload.get("applicant")
    if not applicant_id:
        app = Applicant.objects.filter(user=request.user).first()
        if not app:
            return Response({"detail": "Primero crea tu perfil de postulante (/applicants)."}, status=400)
        payload = {**payload, "applicant": app.id}

    s = ApplicationSerializer(data=payload)
    s.is_valid(raise_exception=True)
    obj = s.save()
    return Response(ApplicationSerializer(obj).data, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def applications_me(request):
    app = Applicant.objects.filter(user=request.user).first()
    if not app:
        return Response([])
    qs = Application.objects.filter(applicant=app).order_by("-id")
    return Response(ApplicationSerializer(qs, many=True).data)


# =========================================================
# Documentos
# =========================================================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def application_docs_collection(request, application_id: int):
    try:
        Application.objects.get(pk=application_id)
    except Application.DoesNotExist:
        return Response({"detail": "application not found"}, status=404)

    if request.method == "GET":
        qs = ApplicationDocument.objects.filter(application_id=application_id).order_by("id")
        data = ApplicationDocumentSerializer(qs, many=True).data
        # agrega file_url
        for i, obj in enumerate(qs):
            try:
                data[i]["file_url"] = obj.file.url
            except Exception:
                data[i]["file_url"] = None
        return Response(data)

    # POST multipart: DRF maneja request.data + request.FILES
    data = request.data.copy()
    data["application"] = application_id
    s = ApplicationDocumentSerializer(data=data)
    s.is_valid(raise_exception=True)
    obj = s.save()
    out = ApplicationDocumentSerializer(obj).data
    try:
        out["file_url"] = obj.file.url
    except Exception:
        out["file_url"] = None
    return Response(out, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def application_doc_review(request, application_id: int, document_id: int):
    try:
        doc = ApplicationDocument.objects.get(pk=document_id, application_id=application_id)
    except ApplicationDocument.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    data = request.data or {}

    if "status" in data:
        doc.status = data.get("status")

    # acepta "note" o "observations" (tu FE manda observations)
    note = data.get("note")
    if note is None:
        note = data.get("observations")
    if note is not None:
        doc.note = str(note)

    doc.save()
    out = ApplicationDocumentSerializer(doc).data
    try:
        out["file_url"] = doc.file.url
    except Exception:
        out["file_url"] = None
    return Response(out)


# =========================================================
# Pago (OneToOne)
# =========================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def application_payment_start(request, application_id: int):
    try:
        app = Application.objects.select_related("call").get(pk=application_id)
    except Application.DoesNotExist:
        return Response({"detail": "application not found"}, status=404)

    payload = request.data or {}
    method = payload.get("method") or "EFECTIVO"

    fee = 0
    try:
        fee = float((app.call.meta or {}).get("application_fee") or 0)
    except Exception:
        fee = 0

    pay, _created = Payment.objects.update_or_create(
        application=app,
        defaults={
            "method": method,
            "status": "STARTED",
            "amount": fee,
        },
    )
    return Response(PaymentSerializer(pay).data, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def application_payment_status(request, application_id: int):
    pay = Payment.objects.filter(application_id=application_id).first()
    if not pay:
        return Response({"detail": "payment not found"}, status=404)
    return Response(PaymentSerializer(pay).data)


# =========================================================
# Evaluación (OneToOne)
# =========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def eval_list_for_scoring(request):
    qs = Application.objects.all().order_by("id")
    return Response(ApplicationSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def eval_save_scores(request, application_id: int):
    try:
        app = Application.objects.get(pk=application_id)
    except Application.DoesNotExist:
        return Response({"detail": "application not found"}, status=404)

    rubric = request.data or {}

    # calcula total si no viene
    total = rubric.get("total")
    if total is None:
        t = 0
        for v in rubric.values():
            try:
                t += float(v)
            except Exception:
                pass
        total = t

    score, _ = EvaluationScore.objects.update_or_create(
        application=app,
        defaults={"rubric": rubric, "total": total},
    )

    app.status = "EVALUATED"
    app.save(update_fields=["status"])

    return Response(EvaluationScoreSerializer(score).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def eval_bulk_compute(request):
    return Response({"ok": True})


# =========================================================
# Resultados
# =========================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def results_list(request):
    call_id = request.query_params.get("call_id")
    qs = Application.objects.all().order_by("id")
    if call_id:
        qs = qs.filter(call_id=call_id)
    return Response(ApplicationSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def results_publish(request):
    call_id = (request.data or {}).get("call_id")
    if not call_id:
        return Response({"detail": "call_id requerido"}, status=400)

    try:
        call = AdmissionCall.objects.get(pk=call_id)
    except AdmissionCall.DoesNotExist:
        return Response({"detail": "call not found"}, status=404)

    call.published = True
    call.save(update_fields=["published"])

    ResultPublication.objects.update_or_create(
        call=call,
        defaults={"published": True, "payload": {"published_at": timezone.now().isoformat()}},
    )

    return Response({"ok": True, "published": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def results_close(request):
    call_id = (request.data or {}).get("call_id")
    if not call_id:
        return Response({"detail": "call_id requerido"}, status=400)

    try:
        call = AdmissionCall.objects.get(pk=call_id)
    except AdmissionCall.DoesNotExist:
        return Response({"detail": "call not found"}, status=404)

    meta = call.meta or {}
    meta["closed"] = True
    call.meta = meta
    call.save(update_fields=["meta"])
    return Response({"ok": True, "closed": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def results_acta_pdf(request):
    call_id = request.query_params.get("call_id") or "all"
    tmpdir = _ensure_media_tmp()
    filename = f"acta-call-{call_id}.pdf"
    abs_path = os.path.join(tmpdir, filename)
    _write_stub_pdf(abs_path, title="Acta de Resultados", subtitle=f"Convocatoria: {call_id}")

    with open(abs_path, "rb") as f:
        data = f.read()

    resp = HttpResponse(data, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp


# =========================================================
# Reportes (stub)
# =========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reports_admission_xlsx(request):
    resp = HttpResponse(
        b"",
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    resp["Content-Disposition"] = 'attachment; filename="admission.xlsx"'
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reports_admission_summary(request):
    return Response({"total_applications": Application.objects.count()})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reports_ranking_xlsx(request):
    resp = HttpResponse(
        b"",
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    resp["Content-Disposition"] = 'attachment; filename="ranking.xlsx"'
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reports_vacants_vs_xlsx(request):
    resp = HttpResponse(
        b"",
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    resp["Content-Disposition"] = 'attachment; filename="vacants-vs.xlsx"'
    return resp


# =========================================================
# Params
# =========================================================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admission_params(request):
    obj = AdmissionParam.objects.order_by("id").first()
    if request.method == "GET":
        if not obj:
            obj = AdmissionParam.objects.create(data={})
        return Response(AdmissionParamSerializer(obj).data)

    if not obj:
        s = AdmissionParamSerializer(data={"data": request.data or {}})
        s.is_valid(raise_exception=True)
        obj = s.save()
        return Response(AdmissionParamSerializer(obj).data)

    obj.data = request.data or {}
    obj.save(update_fields=["data"])
    return Response(AdmissionParamSerializer(obj).data)


# =========================================================
# Applicant
# =========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def applicant_me(request):
    app = Applicant.objects.filter(user=request.user).first()
    if not app:
        return Response({"exists": False})
    return Response({"exists": True, "applicant": ApplicantSerializer(app).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def applicant_create(request):
    data = request.data.copy()
    data["user"] = request.user.id
    s = ApplicantSerializer(data=data)
    s.is_valid(raise_exception=True)
    obj = s.save()
    return Response(ApplicantSerializer(obj).data, status=201)


# =========================================================
# Payments admin
# =========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def payments_list(request):
    qs = Payment.objects.all().order_by("-id")
    status = request.query_params.get("status")
    if status:
        qs = qs.filter(status=status)
    return Response(PaymentSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def payment_confirm(request, payment_id: int):
    try:
        p = Payment.objects.get(pk=payment_id)
    except Payment.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    p.status = "CONFIRMED"
    p.save(update_fields=["status"])
    return Response(PaymentSerializer(p).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def payment_void(request, payment_id: int):
    try:
        p = Payment.objects.get(pk=payment_id)
    except Payment.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    p.status = "VOID"
    p.save(update_fields=["status"])
    return Response(PaymentSerializer(p).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def payment_receipt_pdf(request, payment_id: int):
    try:
        p = Payment.objects.get(pk=payment_id)
    except Payment.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    tmpdir = _ensure_media_tmp()
    filename = f"receipt-{payment_id}.pdf"
    abs_path = os.path.join(tmpdir, filename)
    _write_stub_pdf(abs_path, title="Recibo de Pago", subtitle=f"Pago #{payment_id} – estado: {p.status}")

    with open(abs_path, "rb") as f:
        data = f.read()

    resp = HttpResponse(data, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp


# =========================================================
# Dashboard
# =========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admission_dashboard(request):
    calls_open = AdmissionCall.objects.filter(published=False).count()
    total_applications = Application.objects.count()

    by_career = (
        Application.objects.values("career_name")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    by_career = [{"name": r["career_name"] or "Sin carrera", "value": r["count"]} for r in by_career]

    trend = []
    since = timezone.now() - timedelta(days=14)
    # Application no tiene created_at, así que no rompemos:
    # si lo agregas después, aquí lo activas.
    # (por ahora trend vacío)

    return Response({
        "total_applications": total_applications,
        "calls_open": calls_open,
        "by_career": by_career,
        "trend": trend,
    })
