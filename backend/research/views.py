# research/views.py
from django.http import HttpResponse
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count
from django.conf import settings
import os
import traceback
from datetime import datetime

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .models import *
from .serializers import *

# ==============================
# Helpers (mapeo FE)
# ==============================
def _deliverable_to_fe(d: Deliverable):
    meta = d.meta or {}
    return {
        "id": d.id,
        "name": d.name,
        "description": d.description,
        "due_date": d.due_date,
        "status": d.status,
        "link": meta.get("link", ""),
        "updated_at": d.updated_at,
        "file_url": d.file.url if d.file else None,
    }

def _budget_item_to_fe(b: BudgetItem):
    meta = b.meta or {}
    return {
        "id": b.id,
        "date": meta.get("date"),
        "category": b.category,
        "item": b.concept,
        "planned": float(b.amount or 0),
        "executed": float(b.executed or 0),
        "doc_type": meta.get("doc_type", ""),
        "doc_number": meta.get("doc_number", ""),
        "receipt_url": b.receipt.url if b.receipt else None,
    }

def _fe_to_budget_payload(payload: dict):
    meta = {}
    if payload.get("date"): meta["date"] = payload["date"]
    if payload.get("doc_type"): meta["doc_type"] = payload["doc_type"]
    if payload.get("doc_number"): meta["doc_number"] = payload["doc_number"]
    return {
        "category": payload.get("category") or "Otros",
        "concept": payload.get("item") or "",
        "amount": payload.get("planned", 0) or 0,
        "executed": payload.get("executed", 0) or 0,
        "meta": meta,
    }

def _schedule_item_to_fe(s: ScheduleItem):
    m = s.meta or {}
    due = s.end or s.start
    return {
        "id": s.id,
        "title": s.name,
        "due_date": due,
        "responsible": m.get("responsible", ""),
        "status": m.get("status", "PLANNED"),
        "progress": s.progress or 0,
    }

def _fe_to_schedule_model(it: dict):
    meta = {}
    if it.get("responsible"): meta["responsible"] = it["responsible"]
    if it.get("status"): meta["status"] = it["status"]
    due = it.get("due_date")
    return {
        "name": it.get("title") or "",
        "start": due or it.get("start") or it.get("end"),
        "end": due or it.get("end") or it.get("start"),
        "progress": int(it.get("progress") or 0),
        "meta": meta,
    }

# --- Normalizador de fechas (soporta varios formatos) ---
def _normalize_date(v):
    """
    Devuelve 'YYYY-MM-DD' o None. Acepta:
      - YYYY-MM-DD
      - DD/MM/YYYY
      - MM/DD/YYYY
      - DD-MM-YYYY
    Si no matchea, devuelve el string original (deja que DRF valide).
    """
    if not v:
        return None
    s = str(v).strip()
    try:
        dt = datetime.strptime(s[:10], "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        pass
    for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            dt = datetime.strptime(s[:10], fmt)
            return dt.strftime("%Y-%m-%d")
        except Exception:
            continue
    return s[:10]

# --- Helpers: export a PDF/archivos en /media/tmp ---
def _ensure_media_tmp():
    tmpdir = os.path.join(settings.MEDIA_ROOT, "tmp")
    os.makedirs(tmpdir, exist_ok=True)
    return tmpdir

def _write_stub_pdf(abs_path: str, title="Reporte", subtitle=""):
    """
    Genera un PDF simple. Usa reportlab si está disponible; si no,
    escribe un PDF mínimo válido para permitir la descarga.
    """
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
        c.drawString(72, h - 130, "Documento generado automáticamente (stub).")
        c.save()
        return
    except Exception:
        # Fallback ultra-minimal
        minimal_pdf = b"""%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 62 >>stream
BT /F1 18 Tf 72 720 Td (Export generado) Tj ET
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

# ==============================
# Catálogos – GET/POST + PATCH/DELETE
# ==============================
@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def catalog_lines(request):
    if request.method == 'GET':
        return Response(LineSerializer(ResearchLine.objects.all(), many=True).data)
    ser = LineSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = ser.save()
    return Response(LineSerializer(obj).data, status=201)

@api_view(['PATCH','DELETE'])
@permission_classes([IsAuthenticated])
def catalog_line_detail(request, id:int):
    try:
        obj = ResearchLine.objects.get(pk=id)
    except ResearchLine.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    if request.method == 'PATCH':
        ser = LineSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True); ser.save()
        return Response(LineSerializer(obj).data)
    obj.delete()
    return Response(status=204)

@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def catalog_advisors(request):
    if request.method == 'GET':
        return Response(AdvisorSerializer(Advisor.objects.all(), many=True).data)
    ser = AdvisorSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = ser.save()
    return Response(AdvisorSerializer(obj).data, status=201)

@api_view(['PATCH','DELETE'])
@permission_classes([IsAuthenticated])
def catalog_advisor_detail(request, id:int):
    try:
        obj = Advisor.objects.get(pk=id)
    except Advisor.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    if request.method == 'PATCH':
        ser = AdvisorSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True); ser.save()
        return Response(AdvisorSerializer(obj).data)
    obj.delete()
    return Response(status=204)

# ==============================
# Cronograma
# ==============================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def schedule_list(request, projectId: int):
    items = ScheduleItem.objects.filter(project_id=projectId).order_by('start','end','id')
    data = [_schedule_item_to_fe(s) for s in items]
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def schedule_bulk(request, projectId: int):
    items = (request.data or {}).get('items', [])
    ScheduleItem.objects.filter(project_id=projectId).delete()
    objs = [ScheduleItem(project_id=projectId, **_fe_to_schedule_model(it)) for it in items]
    if objs:
        ScheduleItem.objects.bulk_create(objs)
    return Response({"ok": True, "count": len(objs)})

# ==============================
# Entregables
# ==============================
@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def deliverables_collection(request, projectId: int):
    if request.method == 'GET':
        rows = Deliverable.objects.filter(project_id=projectId).order_by('due_date','id')
        return Response([_deliverable_to_fe(d) for d in rows])
    payload = request.data.copy()
    meta = payload.get('meta') or {}
    if payload.get('link'): meta['link'] = payload['link']
    ser = DeliverableSerializer(data={**payload, "meta": meta})
    ser.is_valid(raise_exception=True)
    obj = ser.save(project_id=projectId)
    return Response(_deliverable_to_fe(obj), status=201)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def deliverable_update(request, deliverableId: int):
    try:
        d = Deliverable.objects.get(pk=deliverableId)
    except Deliverable.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    payload = request.data.copy()
    meta = d.meta or {}
    if 'link' in payload:
        if payload['link'] in (None, ''):
            meta.pop('link', None)
        else:
            meta['link'] = payload['link']
    payload['meta'] = meta
    ser = DeliverableSerializer(d, data=payload, partial=True)
    ser.is_valid(raise_exception=True); ser.save()
    return Response(_deliverable_to_fe(d))

# ==============================
# Evaluaciones
# ==============================
@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def evaluations_collection(request, projectId: int):
    if request.method == 'GET':
        return Response(EvaluationSerializer(Evaluation.objects.filter(project_id=projectId), many=True).data)
    payload = request.data or {}
    ev = Evaluation.objects.create(project_id=projectId, rubric=payload)
    return Response(EvaluationSerializer(ev).data, status=201)

# ==============================
# Equipo
# ==============================
@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def team_collection(request, projectId: int):
    if request.method == 'GET':
        return Response(TeamMemberSerializer(TeamMember.objects.filter(project_id=projectId), many=True).data)
    ser = TeamMemberSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(project_id=projectId)
    return Response(TeamMemberSerializer(obj).data, status=201)

@api_view(['PATCH','DELETE'])
@permission_classes([IsAuthenticated])
def team_member_detail(request, projectId: int, memberId: int):
    try:
        m = TeamMember.objects.get(pk=memberId, project_id=projectId)
    except TeamMember.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    if request.method == 'PATCH':
        ser = TeamMemberSerializer(m, data=request.data, partial=True)
        ser.is_valid(raise_exception=True); ser.save()
        return Response(TeamMemberSerializer(m).data)
    m.delete()
    return Response(status=204)

# ==============================
# Presupuesto
# ==============================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def budget_list(request, projectId: int):
    items = BudgetItem.objects.filter(project_id=projectId).order_by('id')
    data = [_budget_item_to_fe(b) for b in items]
    summary = {
        "planned": sum(x["planned"] for x in data),
        "executed": sum(x["executed"] for x in data),
    }
    return Response({"items": data, "summary": summary})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def budget_create_item(request, projectId: int):
    mapped = _fe_to_budget_payload(request.data or {})
    ser = BudgetItemSerializer(data=mapped)
    ser.is_valid(raise_exception=True)
    obj = ser.save(project_id=projectId)
    return Response(_budget_item_to_fe(obj), status=201)

@api_view(['PATCH','DELETE'])
@permission_classes([IsAuthenticated])
def budget_item_detail(request, projectId: int, itemId: int):
    try:
        it = BudgetItem.objects.get(pk=itemId, project_id=projectId)
    except BudgetItem.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    if request.method == 'PATCH':
        mapped = _fe_to_budget_payload(request.data or {})
        meta = it.meta or {}
        meta.update(mapped.get("meta") or {})
        mapped["meta"] = meta
        ser = BudgetItemSerializer(it, data=mapped, partial=True)
        ser.is_valid(raise_exception=True); ser.save()
        return Response(_budget_item_to_fe(it))
    it.delete()
    return Response(status=204)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def budget_upload_receipt(request, projectId: int, itemId: int):
    try:
        it = BudgetItem.objects.get(pk=itemId, project_id=projectId)
    except BudgetItem.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    f = request.FILES.get('file')
    if not f:
        return Response({"detail":"file requerido"}, status=400)
    it.receipt = f
    it.save(update_fields=['receipt'])
    return Response({"ok": True, "id": it.id, "receipt_url": it.receipt.url if it.receipt else None})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def budget_export_pdf_stub(request, projectId: int):
    # Genera un PDF real en /media/tmp
    tmpdir = _ensure_media_tmp()
    filename = f"budget-{projectId}.pdf"
    abs_path = os.path.join(tmpdir, filename)
    _write_stub_pdf(abs_path, title=f"Presupuesto del Proyecto #{projectId}")
    return Response({"success": True, "downloadUrl": f"/media/tmp/{filename}"})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def budget_export_xlsx(request, projectId: int):
    # Deja el XLSX como respuesta directa (stream)
    resp = HttpResponse(
        b'',
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    resp['Content-Disposition'] = f'attachment; filename="project_{projectId}_budget.xlsx"'
    return resp

# ==============================
# Ética & PI
# ==============================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ethics_ip_get(request, projectId: int):
    obj, _ = EthicsIP.objects.get_or_create(project_id=projectId)
    return Response(EthicsIPSerializer(obj).data)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def ethics_set(request, projectId: int):
    obj, _ = EthicsIP.objects.get_or_create(project_id=projectId)
    obj.ethics = request.data or {}
    obj.save(update_fields=['ethics'])
    return Response(EthicsIPSerializer(obj).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ethics_upload_doc(request, projectId: int):
    obj, _ = EthicsIP.objects.get_or_create(project_id=projectId)
    f = request.FILES.get('file')
    if not f:
        return Response({"detail":"file requerido"}, status=400)
    obj.ethics_doc = f
    obj.save(update_fields=['ethics_doc'])
    return Response({"ok": True})

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def ip_set(request, projectId: int):
    obj, _ = EthicsIP.objects.get_or_create(project_id=projectId)
    obj.ip = request.data or {}
    obj.save(update_fields=['ip'])
    return Response(EthicsIPSerializer(obj).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ip_upload_doc(request, projectId: int):
    obj, _ = EthicsIP.objects.get_or_create(project_id=projectId)
    f = request.FILES.get('file')
    if not f:
        return Response({"detail":"file requerido"}, status=400)
    obj.ip_doc = f
    obj.save(update_fields=['ip_doc'])
    return Response({"ok": True})

# ==============================
# Publicaciones
# ==============================
@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def publications_collection(request, projectId: int):
    if request.method == 'GET':
        return Response(PublicationSerializer(Publication.objects.filter(project_id=projectId), many=True).data)
    ser = PublicationSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(project_id=projectId)
    return Response(PublicationSerializer(obj).data, status=201)

@api_view(['PATCH','DELETE'])
@permission_classes([IsAuthenticated])
def publication_detail(request, projectId: int, pubId: int):
    try:
        p = Publication.objects.get(pk=pubId, project_id=projectId)
    except Publication.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    if request.method == 'PATCH':
        ser = PublicationSerializer(p, data=request.data, partial=True)
        ser.is_valid(raise_exception=True); ser.save()
        return Response(PublicationSerializer(p).data)
    p.delete()
    return Response(status=204)

# ==============================
# Convocatorias / Revisión
# ==============================
@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def calls_collection(request):
    if request.method == 'GET':
        return Response(CallSerializer(Call.objects.all().order_by('-start_date'), many=True).data)
    ser = CallSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = ser.save()
    return Response(CallSerializer(obj).data, status=201)

@api_view(['PATCH','DELETE'])
@permission_classes([IsAuthenticated])
def call_detail(request, id: int):
    try:
        c = Call.objects.get(pk=id)
    except Call.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    if request.method == 'PATCH':
        ser = CallSerializer(c, data=request.data, partial=True)
        ser.is_valid(raise_exception=True); ser.save()
        return Response(CallSerializer(c).data)
    c.delete()
    return Response(status=204)

@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def proposals_collection(request, callId: int):
    if request.method == 'GET':
        return Response(ProposalSerializer(Proposal.objects.filter(call_id=callId), many=True).data)
    ser = ProposalSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(call_id=callId)
    return Response(ProposalSerializer(obj).data, status=201)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def proposal_submit(request, callId: int, proposalId: int):
    try:
        p = Proposal.objects.get(pk=proposalId, call_id=callId)
    except Proposal.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    p.status = 'SUBMITTED'
    p.save(update_fields=['status'])
    return Response({"ok": True, "status": p.status})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_assign(request, callId: int, proposalId: int):
    reviewer_id = request.data.get('reviewer_id')
    if not reviewer_id:
        return Response({"detail":"reviewer_id requerido"}, status=400)
    try:
        p = Proposal.objects.get(pk=proposalId, call_id=callId)
    except Proposal.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    ProposalReview.objects.create(proposal=p, reviewer_id=reviewer_id, rubric={})
    return Response({"ok": True})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def review_rubric_get(request, callId: int, proposalId: int):
    try:
        p = Proposal.objects.get(pk=proposalId, call_id=callId)
    except Proposal.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    last = p.reviews.order_by('-id').first()
    return Response(ProposalReviewSerializer(last).data if last else {})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_save(request, callId: int, proposalId: int):
    try:
        p = Proposal.objects.get(pk=proposalId, call_id=callId)
    except Proposal.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    pr = ProposalReview.objects.create(
        proposal=p,
        reviewer_id=request.data.get('reviewer_id', 0),
        rubric=request.data or {}
    )
    p.status = 'REVIEWED'
    p.save(update_fields=['status'])
    return Response(ProposalReviewSerializer(pr).data, status=201)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def calls_ranking(request, callId: int):
    rows = []
    for pr in Proposal.objects.filter(call_id=callId):
        totals = [float(r.rubric.get('total', 0)) for r in pr.reviews.all()]
        avg = sum(totals)/len(totals) if totals else 0.0
        rows.append({"proposal_id": pr.id, "title": pr.title, "avg_total": avg})
    rows.sort(key=lambda x: x['avg_total'], reverse=True)
    return Response(rows)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def calls_ranking_export(request, callId: int):
    # Genera PDF real del ranking (stub)
    tmpdir = _ensure_media_tmp()
    filename = f"call-{callId}-ranking.pdf"
    abs_path = os.path.join(tmpdir, filename)
    _write_stub_pdf(abs_path, title=f"Ranking de Postulaciones - Convocatoria #{callId}")
    return Response({"success": True, "downloadUrl": f"/media/tmp/{filename}"})

# ==============================
# Reportes
# ==============================
from django.db.models import FloatField
from django.db.models.functions import Cast

def _safe_avg_rubric_total(qs_projects):
    """
    Promedio robusto de rubric.total:
    - Soporta rubric.total como number o string numérico.
    - Evita crashear si hay '' / None / 'N/A'.
    - 1) Intenta AVG en SQL (rápido).
    - 2) Si falla por datos raros, cae a promedio en Python (seguro).
    """
    base = Evaluation.objects.filter(project__in=qs_projects)

    # 1) Intento SQL (Postgres)
    try:
        val = base.exclude(rubric__total__isnull=True).exclude(rubric__total="").aggregate(
            a=Avg(Cast("rubric__total", FloatField()))
        ).get("a")
        return float(val or 0)
    except Exception:
        # 2) Fallback Python (no falla nunca)
        totals = list(base.values_list("rubric__total", flat=True))
        nums = []
        for t in totals:
            try:
                nums.append(float(t))
            except (TypeError, ValueError):
                pass
        return (sum(nums) / len(nums)) if nums else 0.0


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reports_summary(request):
    year = request.query_params.get('year')
    status_f = request.query_params.get('status')

    qs = Project.objects.all()
    if status_f:
        qs = qs.filter(status=status_f)
    if year:
        qs = qs.filter(start_date__year=year)

    avg_score = _safe_avg_rubric_total(qs)

    data = {
        "total_projects": qs.count(),
        "total_advisors": Advisor.objects.filter(project__in=qs).distinct().count(),
        "total_deliverables": Deliverable.objects.filter(project__in=qs).count(),
        "avg_score": avg_score,
        "by_status": list(qs.values('status').order_by().annotate(count=Count('id'))),
    }
    return Response(data)


@api_view(['POST','GET'])
@permission_classes([IsAuthenticated])
def reports_summary_export_stub(request):
    year = request.query_params.get('year') or (request.data or {}).get('year') or ''
    suffix = f"-{year}" if year else ""
    filename = f"research-summary{suffix}.pdf"
    tmpdir = _ensure_media_tmp()
    abs_path = os.path.join(tmpdir, filename)
    _write_stub_pdf(abs_path, title="Reporte de Investigación", subtitle=f"Año: {year}" if year else "Resumen general")
    return Response({"success": True, "downloadUrl": f"/media/tmp/{filename}"})

# ---------- Proyectos (CRUD + cambio de estado) ----------
@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def projects_collection(request):
    if request.method == 'GET':
        qs = Project.objects.all().order_by('-updated_at')
        status_f = request.query_params.get('status')
        line_id = request.query_params.get('line_id')
        if status_f:
            qs = qs.filter(status=status_f)
        if line_id:
            qs = qs.filter(line_id=line_id)
        return Response(ProjectSerializer(qs[:200], many=True).data)

    try:
        payload = request.data.copy() if hasattr(request, "data") else dict(request.POST)

        if 'line_id' in payload and 'line' not in payload and payload.get('line_id') not in (None, '', 'null'):
            payload['line'] = payload['line_id']
        if 'advisor_id' in payload and 'advisor' not in payload and payload.get('advisor_id') not in (None, '', 'null'):
            payload['advisor'] = payload['advisor_id']

        for k in ('start_date', 'end_date'):
            if payload.get(k):
                payload[k] = _normalize_date(payload[k])

        if payload.get('budget') in (None, '', 'null'):
            payload['budget'] = 0

        payload.setdefault('status', 'DRAFT')

        ser = ProjectSerializer(data=payload)
        ser.is_valid(raise_exception=True)

        advisors_ids = payload.get('advisors_ids') or payload.get('advisors') or []

        with transaction.atomic():
            try:
                obj = ser.save(created_by=request.user)
            except TypeError:
                obj = ser.save()

            try:
                if advisors_ids and hasattr(obj, "advisors"):
                    if isinstance(advisors_ids, str):
                        advisors_ids = [x for x in advisors_ids.split(',') if x]
                    obj.advisors.set(list(map(int, advisors_ids)))
            except Exception:
                pass

        return Response(ProjectSerializer(obj).data, status=201)

    except ValidationError as e:
        return Response({"detail": "Validation error", "errors": e.detail}, status=400)
    except IntegrityError as e:
        return Response({"detail": str(e)}, status=400)
    except Exception as e:
        tb = traceback.format_exc(limit=2)
        return Response({"detail": f"{e}", "hint": tb}, status=400)

@api_view(['GET','PATCH','DELETE'])
@permission_classes([IsAuthenticated])
def project_detail(request, id: int):
    try:
        obj = Project.objects.get(pk=id)
    except Project.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)

    if request.method == 'GET':
        return Response(ProjectSerializer(obj).data)

    if request.method == 'PATCH':
        payload = request.data.copy() if hasattr(request, "data") else dict(request.POST)

        if 'line_id' in payload and payload.get('line_id') not in (None, '', 'null'):
            payload['line'] = payload.pop('line_id')
        if 'advisor_id' in payload and payload.get('advisor_id') not in (None, '', 'null'):
            payload['advisor'] = payload.pop('advisor_id')

        for k in ('start_date', 'end_date'):
            if payload.get(k):
                payload[k] = _normalize_date(payload[k])

        if 'budget' in payload and payload.get('budget') in (None, '', 'null'):
            payload['budget'] = 0

        ser = ProjectSerializer(obj, data=payload, partial=True)
        try:
            ser.is_valid(raise_exception=True)
            with transaction.atomic():
                try:
                    obj = ser.save(updated_by=request.user)
                except TypeError:
                    obj = ser.save()

                advisors_ids = payload.get('advisors_ids') or payload.get('advisors')
                if advisors_ids is not None and hasattr(obj, "advisors"):
                    if isinstance(advisors_ids, str):
                        advisors_ids = [x for x in advisors_ids.split(',') if x]
                    obj.advisors.set(list(map(int, advisors_ids)))
        except ValidationError as e:
            return Response({"detail": "Validation error", "errors": e.detail}, status=400)

        return Response(ProjectSerializer(obj).data)

    obj.delete()
    return Response(status=204)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def project_change_status(request, id: int):
    try:
        obj = Project.objects.get(pk=id)
    except Project.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    st = request.data.get('status')
    if not st:
        return Response({"detail":"status requerido"}, status=400)
    obj.status = st
    obj.save(update_fields=['status'])
    return Response({"ok": True, "id": obj.id, "status": obj.status})
