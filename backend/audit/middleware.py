import uuid
from django.utils.deprecation import MiddlewareMixin

class RequestIdMiddleware(MiddlewareMixin):
    def process_request(self, request):
        # request_id (acepta uno externo si viene del proxy)
        rid = request.headers.get('X-Request-Id') or uuid.uuid4().hex[:12]
        request.request_id = rid

        # IP del cliente (simple; ajusta si usas reverse proxy)
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            request.client_ip = xff.split(',')[0].strip()
        else:
            request.client_ip = request.META.get('REMOTE_ADDR')
