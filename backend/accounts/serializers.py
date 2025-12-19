# backend/accounts/serializers.py
from django.contrib.auth import get_user_model
from rest_framework import serializers
from acl.models import Role

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "full_name", "is_active", "roles"]

    def get_roles(self, obj):
        return list(obj.roles.values_list("name", flat=True))

class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    roles = serializers.ListField(child=serializers.CharField(), required=False)

    class Meta:
        model = User
        fields = ["username", "email", "full_name", "password", "roles"]

    def create(self, validated_data):
        roles = validated_data.pop("roles", [])
        pwd = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(pwd)
        user.is_active = True
        user.save()

        if roles:
            role_objs = []
            for name in roles:
                r, _ = Role.objects.get_or_create(name=str(name).strip())
                role_objs.append(r)
            user.roles.set(role_objs)

        return user

class UserUpdateSerializer(serializers.ModelSerializer):
    roles = serializers.ListField(child=serializers.CharField(), required=False)

    class Meta:
        model = User
        fields = ["email", "full_name", "roles"]
