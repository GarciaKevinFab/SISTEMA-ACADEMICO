from django.urls import path
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

class MeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        u = request.user
        return Response({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "roles": [g.name for g in u.groups.all()],
            "is_active": u.is_active,
            "mfa_enabled": getattr(u, "mfa_enabled", False),
        })

urlpatterns = [
    path("login", TokenObtainPairView.as_view()),   # POST {username, password}
    path("refresh", TokenRefreshView.as_view()),    # POST {refresh}
    path("me", MeView.as_view()),                   # GET con Bearer
]
