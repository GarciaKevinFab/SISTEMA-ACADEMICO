import logging
import time

class LoggingMiddleware:
    """
    Middleware de Django que registra método, URL, status y tiempo.
    Agrega cabecera X-Process-Time.
    """
    def __init__(self, get_response):
        self.get_response = get_response
        self.logger = logging.getLogger("api")

    def __call__(self, request):
        start = time.time()
        response = self.get_response(request)
        dur = time.time() - start
        self.logger.info(
            "Request: %s %s | Response: %s | Process Time: %.4fs",
            request.method, request.get_full_path(), response.status_code, dur
        )
        response["X-Process-Time"] = f"{dur:.4f}"
        return response

# Alias opcional si en settings alguna vez usaste 'LogingMiddleware'
LogingMiddleware = LoggingMiddleware
