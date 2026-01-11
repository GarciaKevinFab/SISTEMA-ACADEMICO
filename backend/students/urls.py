# backend/students/urls.py
from django.urls import path
from .views import (
    students_collection,
    students_detail,
    students_photo,
    students_link_user,
    students_me,
    students_me_photo,
    students_sync_from_users,   # ✅ NUEVO
)

urlpatterns = [
    path("students", students_collection),
    path("students/<int:pk>", students_detail),
    path("students/<int:pk>/photo", students_photo),
    path("students/<int:pk>/link-user", students_link_user),
    path("students/me", students_me),
    path("students/me/photo", students_me_photo),

    # ✅ NUEVO
    path("students/sync-from-users", students_sync_from_users),
]
