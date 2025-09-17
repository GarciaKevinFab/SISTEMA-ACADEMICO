import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = str(uuid.uuid4())  # Generar un nuevo Correlation ID
        request.state.correlation_id = correlation_id  # Almacenar en el estado de la solicitud
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id  # Incluir en los encabezados de la respuesta
        return response
