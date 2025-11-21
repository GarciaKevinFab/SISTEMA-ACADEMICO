# backend/acl/serializers.py
from rest_framework import serializers
from .models import Role, Permission


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ("id", "code", "label")


class RoleSerializer(serializers.ModelSerializer):
    # Lectura como lista de códigos
    permissions = serializers.SerializerMethodField(read_only=True)
    # Detalle de permisos
    permissions_detail = PermissionSerializer(
        source="permissions", many=True, read_only=True
    )
    # Escritura: lista de códigos de permisos
    permissions_input = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Role
        fields = (
            "id",
            "name",
            "description",
            "permissions",
            "permissions_detail",
            "permissions_input",
        )

    def get_permissions(self, obj):
        return list(obj.permissions.values_list("code", flat=True))

    def create(self, validated_data):
        codes = validated_data.pop("permissions_input", [])
        role = Role.objects.create(**validated_data)
        if codes:
            perms = Permission.objects.filter(code__in=codes)
            role.permissions.set(perms)
        return role

    def update(self, instance, validated_data):
        codes = validated_data.pop("permissions_input", None)

        # Actualizar campos básicos
        instance.name = validated_data.get("name", instance.name)
        instance.description = validated_data.get("description", instance.description)
        instance.save()

        # Actualizar permisos si vienen
        if codes is not None:
            perms = Permission.objects.filter(code__in=codes)
            instance.permissions.set(perms)

        return instance
