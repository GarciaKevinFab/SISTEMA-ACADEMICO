import pyotp
import jwt
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserMFA
from .utils import gen_secret_base32, gen_backup_codes, hash_codes, consume_backup_code

User = get_user_model()
ISSUER_NAME = "IESPP-GALL"


def _get_or_create_mfa(user):
    obj, _ = UserMFA.objects.get_or_create(user=user)
    return obj


def _issue_jwt_pair_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


def _make_mfa_temp_token(user_id: int, minutes=5):
    """
    Token temporal para completar MFA (NO es el access normal).
    Lo usamos para /auth/mfa/challenge.
    """
    now = timezone.now()
    payload = {
        "mfa_uid": int(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
        "typ": "mfa",
    }
    # usa SECRET_KEY para firmar (simple). Si quieres: settings.SIMPLE_JWT['SIGNING_KEY']
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


# ----------------------------
# 1) Setup / Verify / Disable
# ----------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mfa_setup(request):
    user = request.user
    mfa = _get_or_create_mfa(user)

    if not mfa.secret:
        mfa.secret = gen_secret_base32()
        mfa.save(update_fields=["secret"])

    totp = pyotp.TOTP(mfa.secret)
    account_name = getattr(user, "email", None) or user.get_username()
    otpauth_url = totp.provisioning_uri(name=account_name, issuer_name=ISSUER_NAME)

    return Response({"otpauth_url": otpauth_url, "secret": mfa.secret, "enabled": mfa.enabled})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mfa_verify(request):
    code = str(request.data.get("code", "")).strip()
    if not code:
        return Response({"detail": "code requerido"}, status=400)

    mfa = _get_or_create_mfa(request.user)
    if not mfa.secret:
        return Response({"detail": "mfa no inicializado"}, status=409)

    totp = pyotp.TOTP(mfa.secret)
    if not totp.verify(code, valid_window=1):
        return Response({"detail": "code inválido"}, status=400)

    mfa.enabled = True
    mfa.save(update_fields=["enabled"])
    return Response({"ok": True, "enabled": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mfa_disable(request):
    mfa = _get_or_create_mfa(request.user)
    mfa.enabled = False
    mfa.secret = ""
    mfa.backup_codes = []
    mfa.save(update_fields=["enabled", "secret", "backup_codes"])
    return Response({"ok": True, "enabled": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mfa_backup_codes(request):
    mfa = _get_or_create_mfa(request.user)

    plain = gen_backup_codes()
    mfa.backup_codes = hash_codes(plain)
    mfa.save(update_fields=["backup_codes"])

    return Response({"codes": plain})


# ----------------------------
# 2) MFA Challenge (2do factor)
# ----------------------------

@api_view(["POST"])
@permission_classes([AllowAny])
def mfa_challenge(request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return Response({"detail": "token requerido"}, status=401)

    token = auth[7:].strip()

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("typ") != "mfa":
            return Response({"detail": "token inválido"}, status=401)
        uid = int(payload.get("mfa_uid"))
    except Exception:
        return Response({"detail": "token inválido"}, status=401)

    try:
        user = User.objects.get(pk=uid)
    except User.DoesNotExist:
        return Response({"detail": "usuario no encontrado"}, status=404)

    code = str(request.data.get("code", "")).strip()
    if not code:
        return Response({"detail": "code requerido"}, status=400)

    mfa = _get_or_create_mfa(user)
    if not (mfa.enabled and mfa.secret):
        return Response({"detail": "MFA no habilitado"}, status=409)

    totp = pyotp.TOTP(mfa.secret)
    if totp.verify(code, valid_window=1):
        tokens = _issue_jwt_pair_for_user(user)
        return Response({"ok": True, "method": "TOTP", **tokens})

    ok, new_list = consume_backup_code(mfa.backup_codes, code)
    if ok:
        mfa.backup_codes = new_list
        mfa.save(update_fields=["backup_codes"])
        tokens = _issue_jwt_pair_for_user(user)
        return Response({"ok": True, "method": "BACKUP", **tokens})

    return Response({"detail": "code inválido"}, status=400)


# ----------------------------
# 3) (OPCIONAL) Login con MFA
#    Si NO usas esto, /challenge nunca lo vas a usar.
# ----------------------------

@api_view(["POST"])
@permission_classes([AllowAny])
def auth_login(request):
    """
    POST /api/auth/login
    body: { username, password }

    - Si el usuario NO tiene MFA: devuelve access/refresh normal
    - Si TIENE MFA: devuelve mfa_required + mfa_token temporal (para /auth/mfa/challenge)
    """
    username = str(request.data.get("username", "")).strip()
    password = str(request.data.get("password", "")).strip()

    if not username or not password:
        return Response({"detail": "username y password requeridos"}, status=400)

    user = authenticate(request, username=username, password=password)
    if not user:
        return Response({"detail": "Credenciales inválidas"}, status=401)

    # si está desactivado, tú decides: bloquear o dejar pasar
    if hasattr(user, "is_active") and not user.is_active:
        return Response({"detail": "Usuario inactivo"}, status=403)

    mfa = _get_or_create_mfa(user)
    if mfa.enabled and mfa.secret:
        temp = _make_mfa_temp_token(user.id, minutes=5)
        return Response({"mfa_required": True, "mfa_token": temp})

    tokens = _issue_jwt_pair_for_user(user)
    return Response({"mfa_required": False, **tokens})
