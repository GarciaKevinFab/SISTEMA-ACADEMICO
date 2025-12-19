# backend/users/serializers.py
from django.contrib.auth import get_user_model
from rest_framework import serializers

from acl.models import Role

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "full_name", "is_active", "is_staff", "is_superuser", "roles"]

    def get_roles(self, obj):
        # roles = ManyToMany a acl.Role
        if hasattr(obj, "roles"):
            return list(obj.roles.values_list("name", flat=True))
        return []


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    roles = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list
    )

    class Meta:
        model = User
        fields = ["username", "email", "full_name", "password", "roles"]

    def create(self, validated_data):
        roles = validated_data.pop("roles", [])
        password = validated_data.pop("password")

        user = User(**validated_data)
        user.set_password(password)
        user.is_active = True
        user.save()

        if roles and hasattr(user, "roles"):
            role_qs = []
            for name in roles:
                r, _ = Role.objects.get_or_create(name=str(name).strip())
                role_qs.append(r)
            user.roles.set(role_qs)

        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    roles = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )

    class Meta:
        model = User
        fields = ["email", "full_name", "is_active", "roles"]

    def update(self, instance, validated_data):
        roles = validated_data.pop("roles", None)

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()

        if roles is not None and hasattr(instance, "roles"):
            role_qs = []
            for name in roles:
                r, _ = Role.objects.get_or_create(name=str(name).strip())
                role_qs.append(r)
            instance.roles.set(role_qs)

        return instance
