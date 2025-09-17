import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from time import time

class LoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.logger = logging.getLogger("api")

    async def dispatch(self, request: Request, call_next):
        start_time = time()
        response = await call_next(request)
        process_time = time() - start_time
        self.logger.info(
            f"Request: {request.method} {request.url} | Response: {response.status_code} | Process Time: {process_time:.4f}s"
        )
        return response
