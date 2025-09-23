from django.contrib.auth.models import Group
from rest_framework import serializers
from .models import AppPermission, RolePermission

class AppPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppPermission
        fields = ["id", "code", "description"]

class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    permissions_resolved = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ["id", "name", "permissions", "permissions_resolved"]

    def get_permissions_resolved(self, obj):
        return list(obj.role_permissions.select_related("permission").values_list("permission__code", flat=True))

    def create(self, validated_data):
        codes = validated_data.pop("permissions", [])
        role = Group.objects.create(**validated_data)
        self._save_permissions(role, codes)
        return role

    def update(self, instance, validated_data):
        codes = validated_data.pop("permissions", None)
        instance.name = validated_data.get("name", instance.name)
        instance.save(update_fields=["name"])
        if codes is not None:
            RolePermission.objects.filter(role=instance).delete()
            self._save_permissions(instance, codes)
        return instance

    def _save_permissions(self, role, codes):
        if not codes:
            return
        perms = {p.code: p for p in AppPermission.objects.filter(code__in=codes)}
        to_create = []
        for c in codes:
            p = perms.get(c)
            if p:
                to_create.append(RolePermission(role=role, permission=p))
        RolePermission.objects.bulk_create(to_create, ignore_conflicts=True)
