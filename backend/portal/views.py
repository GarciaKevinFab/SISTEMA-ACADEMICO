from django.shortcuts import render

# Create your views here.
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import *
from .serializers import *

# --------- Páginas ---------
class PagesViewSet(viewsets.ModelViewSet):
    queryset = Page.objects.all().order_by('-updated_at')
    serializer_class = PageSerializer
    http_method_names = ['get','post','patch','delete']
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        qs = self.queryset
        q = request.query_params.get('q')
        published = request.query_params.get('is_published')
        if q: qs = qs.filter(Q(title__icontains=q) | Q(content__icontains=q))
        if published is not None:
            if str(published).lower() in ('1','true','yes'): qs = qs.filter(is_published=True)
            elif str(published).lower() in ('0','false','no'): qs = qs.filter(is_published=False)
        return Response(PageSerializer(qs[:200], many=True).data)

    # GET /portal/pages/{slug}
    @action(detail=False, methods=['get'], url_path=r'(?P<slug>[^/]+)')
    def by_slug(self, request, slug=None):
        try:
            p = Page.objects.get(slug=slug)
        except Page.DoesNotExist:
            return Response({"detail":"Not found"}, status=404)
        return Response(PageSerializer(p).data)

    # POST /portal/pages/{id}/publish
    @action(detail=True, methods=['post'], url_path='publish')
    def publish_toggle(self, request, pk=None):
        page = self.get_object()
        page.is_published = bool(request.data.get('is_published', True))
        page.save(update_fields=['is_published'])
        return Response({"ok": True, "id": page.id, "is_published": page.is_published})

# --------- Noticias ---------
class NewsViewSet(viewsets.ModelViewSet):
    queryset = NewsItem.objects.all().order_by('-publish_at','-created_at')
    serializer_class = NewsSerializer
    http_method_names = ['get','post','patch','delete']
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]  # por si subes cover como multipart

    def list(self, request, *args, **kwargs):
        qs = self.queryset
        published = request.query_params.get('published')
        q = request.query_params.get('q')
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(summary__icontains=q) | Q(body__icontains=q))
        if published is not None:
            trueish = str(published).lower() in ('1','true','yes')
            qs = qs.filter(published=trueish)
        return Response(NewsSerializer(qs[:200], many=True).data)

    # POST /portal/news/{id}/publish
    @action(detail=True, methods=['post'], url_path='publish')
    def publish_toggle(self, request, pk=None):
        item = self.get_object()
        item.published = bool(request.data.get('published', True))
        item.save(update_fields=['published'])
        return Response({"ok": True, "id": item.id, "published": item.published})

# --------- Documentos ---------
class DocumentsViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all().order_by('-updated_at')
    serializer_class = DocumentSerializer
    http_method_names = ['get','post','patch','delete']
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        # soporta multipart: title, category, file
        title = request.data.get('title','')
        category = request.data.get('category','')
        file = request.FILES.get('file')
        if not file: return Response({"detail":"file requerido"}, status=400)
        doc = Document.objects.create(title=title, category=category, file=file, published=False)
        return Response(DocumentSerializer(doc).data, status=201)

    # POST /portal/documents/{id}/publish
    @action(detail=True, methods=['post'], url_path='publish')
    def publish_toggle(self, request, pk=None):
        doc = self.get_object()
        doc.published = bool(request.data.get('published', True))
        doc.save(update_fields=['published'])
        return Response({"ok": True, "id": doc.id, "published": doc.published})

# --------- Formularios públicos ---------
@api_view(['POST'])
@permission_classes([AllowAny])
def public_contact(request):
    payload = request.data or {}
    # Guarda en inbox
    InboxItem.objects.create(type="CONTACT", data=payload)
    # Aquí podrías disparar notificación (email) al admin.
    return Response({"ok": True})

@api_view(['POST'])
@permission_classes([AllowAny])
def public_preinscription(request):
    payload = request.data or {}
    InboxItem.objects.create(type="PREINSCRIPTION", data=payload)
    return Response({"ok": True})

# --------- Bandeja de contenidos ---------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inbox_list(request):
    qs = InboxItem.objects.all().order_by('-created_at')
    t = request.query_params.get('type')
    status_f = request.query_params.get('status')
    if t: qs = qs.filter(type=t)
    if status_f: qs = qs.filter(status=status_f)
    return Response(InboxItemSerializer(qs[:300], many=True).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inbox_get(request, id: int):
    try:
        item = InboxItem.objects.get(pk=id)
    except InboxItem.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    return Response(InboxItemSerializer(item).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def inbox_set_status(request, id: int):
    try:
        item = InboxItem.objects.get(pk=id)
    except InboxItem.DoesNotExist:
        return Response({"detail":"Not found"}, status=404)
    status_val = request.data.get('status')
    if status_val not in dict(INBOX_STATUS):
        return Response({"detail":"status inválido"}, status=400)
    item.status = status_val
    item.save(update_fields=['status'])
    return Response({"ok": True, "id": item.id, "status": item.status})
