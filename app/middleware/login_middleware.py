import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from time import time

class LoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.logger = logging.getLogger("api")

    async def dispatch(self, request: Request, call_next):
        start = time()
        response = await call_next(request)
        self.logger.info(
            f"{request.method} {request.url} -> {response.status_code} in {time() - start:.4f}s"
        )
        return response
