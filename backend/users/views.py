from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.authentication import JWTAuthentication

from acl.models import Permission, Role, RolePermission ,UserRole
from .serializers import UserSerializer, CreateUserSerializer

User = get_user_model()

# --- Auth (JWT) ---
token_obtain_pair = TokenObtainPairView.as_view()
token_refresh = TokenRefreshView.as_view()

# --- Users CRUD ---
@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def users_collection(request):
    if request.method == 'GET':
        qs = User.objects.all().order_by('id')
        # filtros opcionales
        q = request.query_params.get('q')
        if q:
            qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q) |
                           Q(first_name__icontains=q) | Q(last_name__icontains=q))
        return Response(UserSerializer(qs[:200], many=True).data)
    # create
    ser = CreateUserSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    user = ser.save()
    return Response(UserSerializer(user).data, status=201)

@api_view(['GET','PUT','DELETE'])
@permission_classes([IsAuthenticated])
def user_detail(request, id: int):
    try: user = User.objects.get(pk=id)
    except User.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    if request.method == 'GET':
        return Response(UserSerializer(user).data)
    if request.method == 'PUT':
        # update campos básicos
        for f in ['email','first_name','last_name','username']:
            if f in request.data: setattr(user, f, request.data[f])
        user.save()
        return Response(UserSerializer(user).data)
    user.delete(); return Response(status=204)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def user_activate(request, id: int):
    try: user = User.objects.get(pk=id)
    except User.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    user.is_active = True; user.save(update_fields=['is_active'])
    return Response({"ok": True})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def user_deactivate(request, id: int):
    try: user = User.objects.get(pk=id)
    except User.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    user.is_active = False; user.save(update_fields=['is_active'])
    return Response({"ok": True})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def user_reset_password(request, id: int):
    try: user = User.objects.get(pk=id)
    except User.DoesNotExist: return Response({"detail":"Not found"}, status=404)
    new_pwd = request.data.get('new_password')
    if not new_pwd:
        import secrets, string
        new_pwd = ''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(12))
    user.set_password(new_pwd); user.save()
    return Response({"ok": True, "new_password": new_pwd})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def users_search(request):
    q = request.query_params.get('q','')
    qs = User.objects.filter(
        Q(username__icontains=q) | Q(email__icontains=q) |
        Q(first_name__icontains=q) | Q(last_name__icontains=q)
    ).order_by('id')[:50]
    return Response(UserSerializer(qs, many=True).data)

@api_view(['GET','POST'])
@authentication_classes([JWTAuthentication])     # <- fuerza JWT aquí
@permission_classes([IsAuthenticated])
def user_roles(request, id: int):
    try:
        user = User.objects.get(pk=id)
    except User.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    if request.method == 'GET':
        # nombres de roles actuales
        names = list(user.roles.values_list('name', flat=True).distinct())
        return Response(names)

    # --- POST: reemplaza roles del usuario ---
    names = request.data.get('roles', []) or []
    roles = list(Role.objects.filter(name__in=names))

    # limpiar y volver a crear vínculos en la tabla through
    UserRole.objects.filter(user=user).delete()
    UserRole.objects.bulk_create(
        [UserRole(user=user, role=r) for r in roles],
        ignore_conflicts=True
    )

    return Response({"ok": True, "roles": [r.name for r in roles]})

# --- PERFIL DEL USUARIO AUTENTICADO ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auth_me(request):
    u = request.user

    roles = list(
        Role.objects.filter(role_users__user=u)
        .values_list('name', flat=True)
        .distinct()
    )

    base_perms = Permission.objects.filter(
        rolepermission__role__in=Role.objects.filter(role_users__user=u)
    ).values_list('code', flat=True).distinct()

    # (opcional) expande alias para compat con tu front
    PERM_ALIASES = {
        "desk.intake.manage": "mpv.processes.review",
        "desk.reports.view": "mpv.reports.view",
        "desk.track.view": "mpv.public.tracking",
        "academic.plans.manage": "academic.plans.edit",
        "academic.sections.manage": "academic.sections.create",
        "academic.grades.manage": "academic.grades.edit",
        "academic.attendance.manage": "academic.attendance.edit",
        "academic.view": "academic.sections.view",
        "minedu.integrations.run": "minedu.integration.export",
    }
    perms = set(base_perms)
    changed = True
    while changed:
        changed = False
        for k, v in PERM_ALIASES.items():
            if k in perms and v not in perms:
                perms.add(v)
                changed = True

    data = {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "full_name": (f"{u.first_name} {u.last_name}").strip() or u.username,
        "roles": roles,
        "permissions": sorted(perms),
    }
    return Response(data)