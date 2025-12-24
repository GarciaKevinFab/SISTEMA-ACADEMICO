from datetime import datetime
import os
from django.conf import settings
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db import models  # si usarás annotate más adelante
from .models import Career, AdmissionCall, Application
from .serializers import CareerSerializer, AdmissionCallSerializer

# =========================================================
# Helpers (archivos en /media/tmp)
# =========================================================
def _ensure_media_tmp():
    tmpdir = os.path.join(settings.MEDIA_ROOT, "tmp")
    os.makedirs(tmpdir, exist_ok=True)
    return tmpdir

def _fe_to_call(payload):
    """Mapea el JSON del front a tu modelo AdmissionCall."""
    year = payload.get("academic_year")
    period = payload.get("academic_period")
    return {
        "title": payload.get("name") or payload.get("title") or "Convocatoria",
        "period": f"{year}-{period}" if year and period else payload.get("period") or "",
        "published": payload.get("status", "OPEN") != "OPEN",
        "vacants_total": sum(int((c.get("vacancies") or 0)) for c in (payload.get("careers") or [])),
        "meta": {
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
            "careers": payload.get("careers") or [],  # guardamos tal cual
        },
    }

def _call_to_fe(obj):
    """Proyecta tu modelo → shape que usa el front."""
    m = obj.meta or {}
    careers = m.get("careers") or []
    return {
        "id": obj.id,
        "name": obj.title,
        "description": m.get("description",""),
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
        "careers": careers,
        "total_applications": getattr(obj, "applications_count", 0),
        "status": "OPEN" if not obj.published else "PUBLISHED",
    }

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
        c.drawString(72, h - 130, "Generado automáticamente (stub).")
        c.showPage()
        c.save()
    except Exception:
        minimal_pdf = b"""%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 62 >>stream
BT /F1 18 Tf 72 720 Td (Acta de resultados) Tj ET
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

# =========================================================
# Almacenamiento en memoria (solo dev)
# =========================================================
_COUNTERS = {"call": 1, "career": 1, "app": 1, "doc": 1, "sched": 1, "pay": 1}
_CALLS = {}           # id -> {id, name, status, ...}
_CAREERS = {}         # id -> {id, name, code, description, ...}
_APPLICATIONS = {}    # id -> {id, applicant_user_id, call_id, career_id, status, rubric,total}
_DOCS = {}            # doc_id -> {id, application_id, document_type, file_url, status, observations}
_SCHEDULE = {}        # call_id -> [ {id, title, start,end} ]
_PAYMENTS = {}        # id -> {id, application_id, status}
_PARAMS = {"exam_weight": 0.7, "merit_weight": 0.3}
_RESULTS = {"published": False, "closed": False}

def _next(key):
    _COUNTERS[key] += 1
    return _COUNTERS[key] - 1

# ---------------------------------------------------------
# Normalizadores para convocatorias
# ---------------------------------------------------------
def _to_iso(dt_value):
    """
    Acepta: str (datetime-local 'YYYY-MM-DDTHH:MM' o ISO), datetime, None.
    Devuelve: cadena ISO o None.
    """
    if not dt_value:
        return None
    if isinstance(dt_value, datetime):
        return dt_value.isoformat()
    s = str(dt_value).strip()
    for fmt, cut in (("%Y-%m-%dT%H:%M:%S", 19), ("%Y-%m-%dT%H:%M", 16)):
        try:
            return datetime.strptime(s[:cut], fmt).isoformat()
        except Exception:
            pass
    try:
        _ = datetime.fromisoformat(s.replace("Z", ""))
        return s
    except Exception:
        return None

def _build_call_row(cid, payload):
    """
    Construye el dict completo de convocatoria desde el payload del FE,
    aceptando sinónimos. También resuelve carreras con vacantes.
    """
    year = payload.get("academic_year", payload.get("year", datetime.utcnow().year))
    period = payload.get("academic_period", payload.get("period"))

    reg_start = _to_iso(payload.get("registration_start", payload.get("start_date")))
    reg_end = _to_iso(payload.get("registration_end", payload.get("end_date")))
    exam = _to_iso(payload.get("exam_date", payload.get("exam_at")))
    results = _to_iso(payload.get("results_date", payload.get("results_at")))

    fee = float(payload.get("application_fee", payload.get("fee", 0)) or 0)
    max_choices = int(payload.get("max_applications_per_career", payload.get("max_choices", 1)) or 1)

    # carreras desde arreglo o desde available_careers + career_vacancies
    careers = []
    if payload.get("careers"):
        for it in payload["careers"]:
            cid_ = it.get("career_id", it.get("id"))
            if not cid_:
                continue
            name_ = it.get("name") or it.get("career_name") or _CAREERS.get(cid_, {}).get("name", f"Carrera {cid_}")
            vac_ = int(it.get("vacancies", it.get("quota", it.get("slots", 0)) or 0))
            careers.append({"id": cid_, "career_id": cid_, "name": name_, "vacancies": vac_})
    else:
        ids = payload.get("available_careers") or []
        vacs = payload.get("career_vacancies") or {}
        for cid_ in ids:
            name_ = _CAREERS.get(cid_, {}).get("name", f"Carrera {cid_}")
            vac_ = int(vacs.get(cid_, 0) or 0)
            careers.append({"id": cid_, "career_id": cid_, "name": name_, "vacancies": vac_})

    row = {
        "id": cid,
        "name": payload.get("name", f"Convocatoria {cid}"),
        "description": payload.get("description", ""),
        "academic_year": year,
        "academic_period": period,
        "registration_start": reg_start,
        "registration_end": reg_end,
        "exam_date": exam,
        "results_date": results,
        "application_fee": fee,
        "max_applications_per_career": max_choices,
        "minimum_age": int(payload.get("minimum_age", 0) or 0),
        "maximum_age": int(payload.get("maximum_age", 0) or 0),
        "required_documents": payload.get("required_documents", []),
        "careers": careers,
        "public": bool(payload.get("public", True)),
        "status": payload.get("status", "OPEN"),
        # sinónimos
        "year": year,
        "period": period,
        "start_date": reg_start,
        "end_date": reg_end,
        "fee": fee,
        "max_choices": max_choices,
        # métrica
        "total_applications": 0,
    }
    return row

# =========================================================
# Dashboard
# =========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admission_dashboard(request):
    total_applicants = len({a["applicant_user_id"] for a in _APPLICATIONS.values()})
    total_applications = len(_APPLICATIONS)
    total_evaluated = len([a for a in _APPLICATIONS.values() if a.get("total") is not None])
    total_admitted = len([a for a in _APPLICATIONS.values() if a.get("admitted")])
    return Response({
        "total_applicants": total_applicants,
        "total_applications": total_applications,
        "total_evaluated": total_evaluated,
        "total_admitted": total_admitted,
    })

# =========================================================
# Convocatorias
# =========================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def calls_list_public(request):
    rows = [c for c in _CALLS.values() if c.get("public", True)]
    return Response(rows)

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def calls_collection(request):
    if request.method == "GET":
        # añade total_applications por convocatoria
        by_call = {}
        for a in _APPLICATIONS.values():
            k = a.get("call_id")
            if k:
                by_call[k] = by_call.get(k, 0) + 1
        rows = []
        for c in _CALLS.values():
            c2 = dict(c)
            c2["total_applications"] = by_call.get(c2["id"], 0)
            rows.append(c2)
        return Response(rows)

    payload = request.data or {}
    cid = _next("call")
    row = _build_call_row(cid, payload)
    _CALLS[cid] = row
    return Response(row, status=201)

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def call_schedule_collection(request, call_id: int):
    if request.method == "GET":
        return Response(_SCHEDULE.get(call_id, []))
    it = request.data or {}
    sid = _next("sched")
    item = {
        "id": sid,
        "title": it.get("title", f"Hito {sid}"),
        "start": it.get("start"),
        "end": it.get("end"),
    }
    _SCHEDULE.setdefault(call_id, []).append(item)
    return Response(item, status=201)

@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def call_schedule_detail(request, call_id: int, item_id: int):
    items = _SCHEDULE.get(call_id, [])
    idx = next((i for i, x in enumerate(items) if x["id"] == item_id), -1)
    if idx < 0:
        return Response({"detail": "Not found"}, status=404)
    if request.method == "PUT":
        data = request.data or {}
        items[idx].update({k: v for k, v in data.items() if k in ("title","start","end")})
        return Response(items[idx])
    items.pop(idx)
    return Response(status=204)

# =========================================================
# Carreras (completo)
# =========================================================
def _career_defaults(payload):
    now = datetime.utcnow().isoformat()
    return {
        "name": payload.get("name", ""),
        "code": payload.get("code", ""),
        "description": payload.get("description", ""),
        "duration_semesters": int(payload.get("duration_semesters") or 0),
        "vacancies": int(payload.get("vacancies") or 0),
        "degree_type": payload.get("degree_type", "BACHELOR"),
        "modality": payload.get("modality", "PRESENCIAL"),
        "is_active": bool(payload.get("is_active", True)),
        "created_at": now,
        "updated_at": now,
    }

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def careers_collection(request):
    if request.method == "GET":
        return Response(list(_CAREERS.values()))

    payload = request.data or {}
    cid = _next("career")
    row = {"id": cid, **_career_defaults(payload)}
    _CAREERS[cid] = row
    return Response(row, status=201)

@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def career_detail(request, career_id: int):
    row = _CAREERS.get(career_id)
    if not row:
        return Response({"detail": "Not found"}, status=404)

    if request.method == "GET":
        return Response(row)

    if request.method == "PUT":
        data = request.data or {}
        allowed = {
            "name", "code", "description", "duration_semesters", "vacancies",
            "degree_type", "modality", "is_active"
        }
        for k, v in data.items():
            if k in allowed:
                if k in ("duration_semesters", "vacancies"):
                    try:
                        row[k] = int(v)
                    except Exception:
                        row[k] = 0
                elif k == "is_active":
                    row[k] = bool(v)
                else:
                    row[k] = v
        row["updated_at"] = datetime.utcnow().isoformat()
        _CAREERS[career_id] = row
        return Response(row)

    # DELETE
    del _CAREERS[career_id]
    return Response(status=204)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def career_toggle_active(request, career_id: int):
    row = _CAREERS.get(career_id)
    if not row:
        return Response({"detail": "Not found"}, status=404)
    row["is_active"] = not bool(row.get("is_active"))
    row["updated_at"] = datetime.utcnow().isoformat()
    return Response(row)

# =========================================================
# Postulaciones
# =========================================================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def applications_collection(request):
    if request.method == "GET":
        call_id = request.query_params.get("call_id")
        career_id = request.query_params.get("career_id")
        rows = list(_APPLICATIONS.values())
        if call_id:
            rows = [r for r in rows if str(r.get("call_id")) == str(call_id)]
        if career_id:
            rows = [r for r in rows if str(r.get("career_id")) == str(career_id)]
        return Response(rows)
    p = request.data or {}
    aid = _next("app")
    row = {
        "id": aid,
        "applicant_user_id": request.user.id,
        "call_id": p.get("call_id"),
        "career_id": p.get("career_id"),
        "status": "CREATED",
        "created_at": datetime.utcnow().isoformat(),
        "rubric": None,
        "total": None,
        "admitted": False,
    }
    _APPLICATIONS[aid] = row
    return Response(row, status=201)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def applications_me(request):
    rows = [a for a in _APPLICATIONS.values() if a["applicant_user_id"] == request.user.id]
    return Response(rows)

# =========================================================
# Documentos por postulante
# =========================================================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def application_docs_collection(request, application_id: int):
    if application_id not in _APPLICATIONS:
        return Response({"detail":"application not found"}, status=404)
    if request.method == "GET":
        rows = [d for d in _DOCS.values() if d["application_id"] == application_id]
        return Response(rows)
    f = request.FILES.get("file")
    doc_type = request.data.get("document_type", "OTHER")
    if not f:
        return Response({"detail":"file requerido"}, status=400)
    tmpdir = _ensure_media_tmp()
    doc_id = _next("doc")
    filename = f"app{application_id}-doc{doc_id}-{f.name}"
    abs_path = os.path.join(tmpdir, filename)
    with open(abs_path, "wb") as out:
        for chunk in f.chunks():
            out.write(chunk)
    row = {
        "id": doc_id,
        "application_id": application_id,
        "document_type": doc_type,
        "file_url": f"/media/tmp/{filename}",
        "status": "UPLOADED",
        "observations": "",
    }
    _DOCS[doc_id] = row
    return Response(row, status=201)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def application_doc_review(request, application_id: int, document_id: int):
    row = _DOCS.get(document_id)
    if not row or row["application_id"] != application_id:
        return Response({"detail":"Not found"}, status=404)
    data = request.data or {}
    row["status"] = data.get("status", row["status"])
    row["observations"] = data.get("observations", row.get("observations",""))
    return Response(row)

# =========================================================
# Pago
# =========================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def application_payment_start(request, application_id: int):
    if application_id not in _APPLICATIONS:
        return Response({"detail":"application not found"}, status=404)
    pid = _next("pay")
    _PAYMENTS[pid] = {"id": pid, "application_id": application_id, "status": "PENDING"}
    return Response({"payment_id": pid, "status": "PENDING"})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def application_payment_status(request, application_id: int):
    pay = next((p for p in _PAYMENTS.values() if p["application_id"] == application_id), None)
    if not pay:
        return Response({"detail":"payment not found"}, status=404)
    return Response(pay)

# =========================================================
# Evaluación
# =========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def eval_list_for_scoring(request):
    rows = [a for a in _APPLICATIONS.values() if a.get("total") is None]
    return Response(rows)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def eval_save_scores(request, application_id: int):
    a = _APPLICATIONS.get(application_id)
    if not a:
        return Response({"detail":"application not found"}, status=404)
    rubric = request.data or {}
    a["rubric"] = rubric
    a["total"] = float(rubric.get("total", 0))
    a["admitted"] = bool(rubric.get("admitted", False))
    a["status"] = "EVALUATED"
    return Response(a)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def eval_bulk_compute(request):
    call_id = request.data.get("call_id")
    affected = 0
    for a in _APPLICATIONS.values():
        if call_id and str(a.get("call_id")) != str(call_id):
            continue
        if a.get("total") is not None:
            a["admitted"] = a["total"] >= 14
            affected += 1
    return Response({"ok": True, "affected": affected})

# =========================================================
# Resultados
# =========================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def results_list(request):
    call_id = request.query_params.get("call_id")
    rows = [a for a in _APPLICATIONS.values() if a.get("admitted")]
    if call_id:
        rows = [r for r in rows if str(r.get("call_id")) == str(call_id)]
    return Response(rows)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def results_publish(request):
    _RESULTS["published"] = True
    return Response({"ok": True, "published": True})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def results_close(request):
    _RESULTS["closed"] = True
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
# Reportes
# =========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reports_admission_xlsx(request):
    resp = HttpResponse(b"", content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    resp["Content-Disposition"] = 'attachment; filename="admission.xlsx"'
    return resp

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reports_admission_summary(request):
    by_career = {}
    for a in _APPLICATIONS.values():
        c = a.get("career_id") or 0
        by_career[c] = by_career.get(c, 0) + 1
    return Response({
        "total_applications": len(_APPLICATIONS),
        "by_career": [{"career_id": k, "count": v} for k, v in by_career.items()],
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reports_ranking_xlsx(request):
    resp = HttpResponse(b"", content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    resp["Content-Disposition"] = 'attachment; filename="ranking.xlsx"'
    return resp

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reports_vacants_vs_xlsx(request):
    resp = HttpResponse(b"", content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    resp["Content-Disposition"] = 'attachment; filename="vacants-vs.xlsx"'
    return resp

# =========================================================
# Parámetros
# =========================================================
@api_view(["GET","POST"])
@permission_classes([IsAuthenticated])
def admission_params(request):
    global _PARAMS
    if request.method == "GET":
        return Response(_PARAMS)
    _PARAMS.update(request.data or {})
    return Response(_PARAMS)

# =========================================================
# Perfil postulante
# =========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def applicant_me(request):
    return Response({
        "user_id": request.user.id,
        "fullname": getattr(request.user, "get_full_name", lambda: request.user.username)(),
        "email": getattr(request.user, "email", ""),
    })

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def applicant_create(request):
    data = request.data or {}
    data["user_id"] = request.user.id
    return Response(data, status=201)

# =========================================================
# Pagos - bandeja admin
# =========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def payments_list(request):
    status = request.query_params.get("status")
    rows = list(_PAYMENTS.values())
    if status:
        rows = [r for r in rows if r.get("status") == status]
    return Response(rows)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def payment_confirm(request, payment_id: int):
    p = _PAYMENTS.get(payment_id)
    if not p:
        return Response({"detail":"Not found"}, status=404)
    p["status"] = "CONFIRMED"
    return Response(p)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def payment_void(request, payment_id: int):
    p = _PAYMENTS.get(payment_id)
    if not p:
        return Response({"detail":"Not found"}, status=404)
    p["status"] = "VOID"
    return Response(p)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def payment_receipt_pdf(request, payment_id: int):
    p = _PAYMENTS.get(payment_id)
    if not p:
        return Response({"detail":"Not found"}, status=404)
    tmpdir = _ensure_media_tmp()
    filename = f"receipt-{payment_id}.pdf"
    abs_path = os.path.join(tmpdir, filename)
    _write_stub_pdf(abs_path, title="Recibo de Pago", subtitle=f"Pago #{payment_id} – estado: {p['status']}")
    with open(abs_path, "rb") as f:
        data = f.read()
    resp = HttpResponse(data, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp

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

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def calls_collection(request):
    if request.method == "GET":
        qs = AdmissionCall.objects.all().order_by("id")
        # si quieres contar postulaciones:
        qs = qs.annotate(applications_count=models.Count("applications"))
        data = [_call_to_fe(o) for o in qs]
        return Response(data)

    payload = request.data or {}
    mapped = _fe_to_call(payload)
    s = AdmissionCallSerializer(data=mapped)
    s.is_valid(raise_exception=True)
    obj = s.save()
    return Response(_call_to_fe(obj), status=201)

def _has_field(model, name: str) -> bool:
    try:
        model._meta.get_field(name)
        return True
    except Exception:
        return False

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admission_dashboard(request):
    """
    Shape ideal para tu DashboardHome:
      - total_applications
      - calls_open
      - by_career: [{ name, value }]
      - trend: [{ date, value }]
    """

    # OPEN CALLS (OPEN = no publicado en tu lógica actual)
    calls_open = AdmissionCall.objects.filter(published=False).count()

    # TOTAL APPLICATIONS
    total_applications = Application.objects.count()

    # BY CAREER (BarChart)
    career_fk = "career" if _has_field(Application, "career") else ("career_id" if _has_field(Application, "career_id") else None)

    by_career = []
    if career_fk == "career":
        rows = (
            Application.objects.values("career__id", "career__name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        by_career = [{"name": r["career__name"] or f"Carrera {r['career__id']}", "value": r["count"]} for r in rows]
    elif career_fk == "career_id":
        rows = (
            Application.objects.values("career_id")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        names = {c.id: c.name for c in Career.objects.all()}
        by_career = [{"name": names.get(r["career_id"], f"Carrera {r['career_id']}"), "value": r["count"]} for r in rows]

    # TREND (últimos 14 días)
    created_field = "created_at" if _has_field(Application, "created_at") else ("created" if _has_field(Application, "created") else None)
    trend = []
    if created_field:
        since = timezone.now() - timedelta(days=14)
        qs = (
            Application.objects
            .filter(**{f"{created_field}__gte": since})
            .annotate(day=TruncDate(created_field))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        trend = [{"date": str(r["day"]), "value": r["count"]} for r in qs]

    return Response({
        "total_applications": total_applications,
        "calls_open": calls_open,
        "by_career": by_career,
        "trend": trend,
    })