from django.shortcuts import render

# Create your views here.
from django.db.models import Sum
from django.http import HttpResponse, FileResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import *
from .serializers import *

# --------- Catálogos ---------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catalog_lines(request):
    return Response(LineSerializer(ResearchLine.objects.all(), many=True).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catalog_advisors(request):
    return Response(AdvisorSerializer(Advisor.objects.all(), many=True).data)

# --------- Proyectos ---------
@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def projects_collection(request):
    if request.method == 'GET':
        qs = Project.objects.all().order_by('-updated_at')
        status_f = request.query_params.get('status')
        line_id = request.query_params.get('line_id')
        if status_f: qs = qs.filter(status=status_f)
        if line_id: qs = qs.filter(line_id=line_id)
        return Response(ProjectSerializer(qs[:200], many=True).data)
    ser = ProjectSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = ser.save()
    return Response(ProjectSerializer(obj).data, status=201)

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
        ser = ProjectSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ProjectSerializer(obj).data)
    obj.delete()
    return Response(status=204)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def project_change_status(request, id: int):
    try: obj = Project.objects.get(pk=id)
    except Project.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    st = request.data.get('status')
    if not st: return Response({"detail":"status requerido"}, status=400)
    obj.status = st; obj.save(update_fields=['status'])
    return Response({"ok": True, "id": obj.id, "status": obj.status})

# --------- Cronograma ---------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def schedule_list(request, projectId: int):
    return Response(ScheduleItemSerializer(ScheduleItem.objects.filter(project_id=projectId), many=True).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def schedule_bulk(request, projectId: int):
    items = request.data.get('items', [])
    ScheduleItem.objects.filter(project_id=projectId).delete()
    objs = [ScheduleItem(project_id=projectId, name=i['name'], start=i['start'], end=i['end'],
                         progress=i.get('progress',0), meta=i.get('meta',{})) for i in items]
    ScheduleItem.objects.bulk_create(objs)
    return Response({"ok": True, "count": len(objs)})

# --------- Entregables ---------
@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def deliverables_collection(request, projectId: int):
    if request.method == 'GET':
        return Response(DeliverableSerializer(Deliverable.objects.filter(project_id=projectId), many=True).data)
    ser = DeliverableSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(project_id=projectId)
    return Response(DeliverableSerializer(obj).data, status=201)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def deliverable_update(request, deliverableId: int):
    try: d = Deliverable.objects.get(pk=deliverableId)
    except Deliverable.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    ser = DeliverableSerializer(d, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(DeliverableSerializer(d).data)

# --------- Evaluaciones ---------
@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def evaluations_collection(request, projectId: int):
    if request.method == 'GET':
        return Response(EvaluationSerializer(Evaluation.objects.filter(project_id=projectId), many=True).data)
    payload = request.data or {}
    ev = Evaluation.objects.create(project_id=projectId, rubric=payload)
    return Response(EvaluationSerializer(ev).data, status=201)

# --------- Equipo ---------
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
    try: m = TeamMember.objects.get(pk=memberId, project_id=projectId)
    except TeamMember.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    if request.method == 'PATCH':
        ser = TeamMemberSerializer(m, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(TeamMemberSerializer(m).data)
    m.delete(); return Response(status=204)

# --------- Presupuesto ---------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def budget_list(request, projectId: int):
    items = BudgetItem.objects.filter(project_id=projectId)
    summary = items.aggregate(total=Sum('amount'), executed=Sum('executed'))
    return Response({"items": BudgetItemSerializer(items, many=True).data, "summary": summary})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def budget_create_item(request, projectId: int):
    ser = BudgetItemSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(project_id=projectId)
    return Response(BudgetItemSerializer(obj).data, status=201)

@api_view(['PATCH','DELETE'])
@permission_classes([IsAuthenticated])
def budget_item_detail(request, projectId: int, itemId: int):
    try: it = BudgetItem.objects.get(pk=itemId, project_id=projectId)
    except BudgetItem.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    if request.method == 'PATCH':
        ser = BudgetItemSerializer(it, data=request.data, partial=True)
        ser.is_valid(raise_exception=True); ser.save()
        return Response(BudgetItemSerializer(it).data)
    it.delete(); return Response(status=204)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def budget_upload_receipt(request, projectId: int, itemId: int):
    try: it = BudgetItem.objects.get(pk=itemId, project_id=projectId)
    except BudgetItem.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    f = request.FILES.get('file')
    if not f: return Response({"detail":"file requerido"}, status=400)
    it.receipt = f; it.save(update_fields=['receipt'])
    return Response({"ok": True, "id": it.id})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def budget_export_xlsx(request, projectId: int):
    # XLSX vacío como stub; genera real con openpyxl si quieres
    resp = HttpResponse(b'', content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = f'attachment; filename="project_{projectId}_budget.xlsx"'
    return resp

# --------- Ética & Propiedad Intelectual ---------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ethics_ip_get(request, projectId: int):
    obj, _ = EthicsIP.objects.get_or_create(project_id=projectId)
    return Response(EthicsIPSerializer(obj).data)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def ethics_set(request, projectId: int):
    obj, _ = EthicsIP.objects.get_or_create(project_id=projectId)
    ethics = request.data or {}
    obj.ethics = ethics; obj.save(update_fields=['ethics'])
    return Response(EthicsIPSerializer(obj).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ethics_upload_doc(request, projectId: int):
    obj, _ = EthicsIP.objects.get_or_create(project_id=projectId)
    f = request.FILES.get('file')
    if not f: return Response({"detail":"file requerido"}, status=400)
    obj.ethics_doc = f; obj.save(update_fields=['ethics_doc'])
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
    if not f: return Response({"detail":"file requerido"}, status=400)
    obj.ip_doc = f; obj.save(update_fields=['ip_doc'])
    return Response({"ok": True})

# --------- Publicaciones ---------
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
    try: p = Publication.objects.get(pk=pubId, project_id=projectId)
    except Publication.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    if request.method == 'PATCH':
        ser = PublicationSerializer(p, data=request.data, partial=True)
        ser.is_valid(raise_exception=True); ser.save()
        return Response(PublicationSerializer(p).data)
    p.delete(); return Response(status=204)

# --------- Convocatorias / Propuestas / Revisión ---------
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
    try: c = Call.objects.get(pk=id)
    except Call.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    if request.method == 'PATCH':
        ser = CallSerializer(c, data=request.data, partial=True)
        ser.is_valid(raise_exception=True); ser.save()
        return Response(CallSerializer(c).data)
    c.delete(); return Response(status=204)

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
    try: p = Proposal.objects.get(pk=proposalId, call_id=callId)
    except Proposal.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    p.status = 'SUBMITTED'; p.save(update_fields=['status'])
    return Response({"ok": True, "status": p.status})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_assign(request, callId: int, proposalId: int):
    reviewer_id = request.data.get('reviewer_id')
    if not reviewer_id: return Response({"detail":"reviewer_id requerido"}, status=400)
    try: p = Proposal.objects.get(pk=proposalId, call_id=callId)
    except Proposal.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    ProposalReview.objects.create(proposal=p, reviewer_id=reviewer_id, rubric={})
    return Response({"ok": True})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def review_rubric_get(request, callId: int, proposalId: int):
    try: p = Proposal.objects.get(pk=proposalId, call_id=callId)
    except Proposal.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    last = p.reviews.order_by('-id').first()
    return Response(ProposalReviewSerializer(last).data if last else {})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_save(request, callId: int, proposalId: int):
    try: p = Proposal.objects.get(pk=proposalId, call_id=callId)
    except Proposal.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    pr = ProposalReview.objects.create(proposal=p, reviewer_id=request.data.get('reviewer_id', 0), rubric=request.data or {})
    p.status = 'REVIEWED'; p.save(update_fields=['status'])
    return Response(ProposalReviewSerializer(pr).data, status=201)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def calls_ranking(request, callId: int):
    # ranking simple: promedio del 'total' en rubric
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
    # XLSX vacío como stub
    resp = HttpResponse(b'', content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = f'attachment; filename="call_{callId}_ranking.xlsx"'
    return resp

# --------- Reportes (summary) ---------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reports_summary(request):
    year = request.query_params.get('year')
    status_f = request.query_params.get('status')
    qs = Project.objects.all()
    if status_f: qs = qs.filter(status=status_f)
    # year podría filtrar por start_date.year/end_date.year (omito para MVP)
    data = {
        "total": qs.count(),
        "by_status": list(qs.values('status').order_by().annotate(count=models.Count('id'))),
    }
    return Response(data)
