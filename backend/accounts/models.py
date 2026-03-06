from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager

class UserManager(BaseUserManager):
    def create_user(self, username, email, password=None, full_name=""):
        if not username:
            raise ValueError("username es requerido")
        if not email:
            raise ValueError("email es requerido")

        email = self.normalize_email(email)
        user = self.model(username=username, email=email, full_name=full_name)

        # ✅ si no mandan password => temporal => obliga cambio
        is_temp = not password
        user.set_password(password or "Temp12345!")
        user.must_change_password = is_temp

        user.is_active = True
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, full_name=""):
        user = self.create_user(username=username, email=email, password=password, full_name=full_name)
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True

        # ✅ superuser NO debería estar obligado a cambiar (por si password vino vacío)
        user.must_change_password = False

        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(max_length=120, unique=True)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=200, blank=True, default="")

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    must_change_password = models.BooleanField(default=False)  # ✅ NUEVO

    roles = models.ManyToManyField("acl.Role", blank=True, related_name="members")

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    def __str__(self):
        return self.username

    def has_perm_code(self, code: str) -> bool:
        if self.is_superuser:
            return True
        return self.roles.filter(permissions__code=code).exists()
