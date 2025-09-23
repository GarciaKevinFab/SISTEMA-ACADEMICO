from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register(r'portal/pages', PagesViewSet, basename='portal-pages')
router.register(r'portal/news', NewsViewSet, basename='portal-news')
router.register(r'portal/documents', DocumentsViewSet, basename='portal-documents')

urlpatterns = [
    path('', include(router.urls)),

    # Públicos
    path('public/contact', public_contact),                 # POST
    path('public/preinscriptions', public_preinscription),  # POST

    # Inbox
    path('portal/inbox', inbox_list),                       # GET
    path('portal/inbox/<int:id>', inbox_get),               # GET
    path('portal/inbox/<int:id>/status', inbox_set_status), # POST
]
