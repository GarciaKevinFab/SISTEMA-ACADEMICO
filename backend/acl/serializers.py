# acl/serializers.py
from rest_framework import serializers
from .models import Role, Permission

class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ("id", "code", "label")  # dentro de Meta, no como atributo de clase

# acl/serializers.py
class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField(read_only=True)  # <-- lectura como códigos
    permissions_detail = PermissionSerializer(source="permissions", many=True, read_only=True)
    # mantener un write_only opcional si posteas permisos por rol al crear/actualizar
    permissions_input = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)

    class Meta:
        model = Role
        fields = ["id", "name", "description", "permissions", "permissions_detail", "permissions_input"]

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
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        if codes is not None:
            perms = Permission.objects.filter(code__in=codes)
            instance.permissions.set(perms)
        return instance
