from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProcedureViewSet

router = DefaultRouter()
router.register('', ProcedureViewSet, basename='procedure')

urlpatterns = [
    path('', include(router.urls)),
]
