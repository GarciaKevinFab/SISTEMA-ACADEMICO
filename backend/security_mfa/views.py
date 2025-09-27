import pyotp
import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import UserMFA
from .utils import gen_secret_base32, gen_backup_codes, hash_codes, consume_backup_code

User = get_user_model()
ISSUER_NAME = "IESPP-GALL"

def _get_or_create_mfa(user):
    obj, _ = UserMFA.objects.get_or_create(user=user)
    return obj

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mfa_setup(request):
    user = request.user
    mfa = _get_or_create_mfa(user)
    if not mfa.secret:
        mfa.secret = gen_secret_base32()
        mfa.save(update_fields=['secret'])
    totp = pyotp.TOTP(mfa.secret)
    account_name = getattr(user, 'email', None) or user.get_username()
    otpauth_url = totp.provisioning_uri(name=account_name, issuer_name=ISSUER_NAME)
    return Response({"otpauth_url": otpauth_url, "secret": mfa.secret})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mfa_verify(request):
    code = str(request.data.get('code', '')).strip()
    if not code:
        return Response({"detail": "code requerido"}, status=400)
    mfa = _get_or_create_mfa(request.user)
    if not mfa.secret:
        return Response({"detail": "mfa no inicializado"}, status=409)
    totp = pyotp.TOTP(mfa.secret)
    if not (totp.verify(code, valid_window=1)):
        return Response({"detail": "code inválido"}, status=400)
    mfa.enabled = True
    mfa.save(update_fields=['enabled'])
    return Response({"ok": True, "enabled": True})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mfa_disable(request):
    mfa = _get_or_create_mfa(request.user)
    mfa.enabled = False
    mfa.secret = ""
    mfa.backup_codes = []
    mfa.save(update_fields=['enabled','secret','backup_codes'])
    return Response({"ok": True, "enabled": False})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mfa_backup_codes(request):
    mfa = _get_or_create_mfa(request.user)
    plain = gen_backup_codes()
    mfa.backup_codes = hash_codes(plain)
    mfa.save(update_fields=['backup_codes'])
    return Response({"codes": plain})

# Segundo factor durante login (token temporal Bearer con 'mfa_uid')
@api_view(['POST'])
@permission_classes([AllowAny])
def mfa_challenge(request):
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return Response({"detail": "token requerido"}, status=401)
    token = auth[7:].strip()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        uid = int(payload.get('mfa_uid'))
    except Exception:
        return Response({"detail": "token inválido"}, status=401)

    try:
        user = User.objects.get(pk=uid)
    except User.DoesNotExist:
        return Response({"detail": "usuario no encontrado"}, status=404)

    code = str(request.data.get('code', '')).strip()
    if not code:
        return Response({"detail": "code requerido"}, status=400)

    mfa = _get_or_create_mfa(user)
    if not (mfa.enabled and mfa.secret):
        return Response({"detail": "MFA no habilitado"}, status=409)

    totp = pyotp.TOTP(mfa.secret)
    if totp.verify(code, valid_window=1):
        return Response({"ok": True, "method": "TOTP"})

    ok, new_list = consume_backup_code(mfa.backup_codes, code)
    if ok:
        mfa.backup_codes = new_list
        mfa.save(update_fields=['backup_codes'])
        return Response({"ok": True, "method": "BACKUP"})

    return Response({"detail": "code inválido"}, status=400)
