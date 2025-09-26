# acl/serializers.py
from rest_framework import serializers
from .models import Role, Permission

class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = "__all__"   # evita romper si tu modelo tiene campos extra

class RoleSerializer(serializers.ModelSerializer):
    # exponemos permisos como lista de códigos (strings)
    permissions = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )
    # y leemos como objetos con todo (opcional): si no quieres, bórralo
    permissions_detail = PermissionSerializer(source="permissions", many=True, read_only=True)

    class Meta:
        model = Role
        fields = ["id", "name", "description", "permissions", "permissions_detail"]

    def create(self, validated_data):
        codes = validated_data.pop("permissions", [])
        role = Role.objects.create(**validated_data)
        if codes:
            perms = Permission.objects.filter(code__in=codes)
            role.permissions.set(perms)
        return role

    def update(self, instance, validated_data):
        codes = validated_data.pop("permissions", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        if codes is not None:
            perms = Permission.objects.filter(code__in=codes)
            instance.permissions.set(perms)
        return instance
