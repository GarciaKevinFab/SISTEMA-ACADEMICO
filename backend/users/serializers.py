from django.contrib.auth import get_user_model
from rest_framework import serializers
from acl.models import Role

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    def get_roles(self, obj):
        return list(obj.roles.values_list('name', flat=True))

    class Meta:
        model = User
        fields = ['id','username','email','first_name','last_name','is_active','roles']

class CreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    roles = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False, default=[]
    )

    class Meta:
        model = User
        fields = ['username','email','first_name','last_name','password','roles']

    def create(self, validated):
        roles_names = validated.pop('roles', [])
        pwd = validated.pop('password')
        user = User(**validated)
        user.set_password(pwd); user.save()

        if roles_names:
            from acl.models import Role, UserRole
            roles = Role.objects.filter(name__in=roles_names)
            UserRole.objects.bulk_create(
                [UserRole(user=user, role=r) for r in roles],
                ignore_conflicts=True
            )
        return user