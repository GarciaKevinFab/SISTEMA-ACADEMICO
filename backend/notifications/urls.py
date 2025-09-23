from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register(r'templates', TemplateViewSet, basename='templates')

urlpatterns = [
    path('', include(router.urls)),
    # Templates
    path('templates/preview', template_preview),                 # POST
    # Events
    path('events', events_list),                                 # GET
    path('events/binding', events_set_binding),                  # POST
    # Send/Test
    path('send-test', send_test),                                # POST
    # Logs
    path('logs', logs_list),                                     # GET
    path('logs/<int:id>/retry', logs_retry),                     # POST
]
