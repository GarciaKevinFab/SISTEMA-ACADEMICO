import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_enrollment():
    # Primero creamos un estudiante y un curso
    student_response = client.post(
        "/students/",
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "password": "Password123"
        }
    )
    student_id = student_response.json()["id"]

    course_response = client.post(
        "/courses/",
        json={
            "name": "Physics",
            "description": "Introductory Physics Course",
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2025-06-01T00:00:00"
        }
    )
    course_id = course_response.json()["id"]

    # Luego creamos la inscripción
    enrollment_response = client.post(
        "/enrollments/",
        json={"student_id": student_id, "course_id": course_id}
    )
    assert enrollment_response.status_code == 200
    assert "id" in enrollment_response.json()
    assert enrollment_response.json()["student_id"] == student_id
    assert enrollment_response.json()["course_id"] == course_id

def test_get_enrollment():
    # Primero creamos un estudiante y un curso
    student_response = client.post(
        "/students/",
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "password": "Password123"
        }
    )
    student_id = student_response.json()["id"]

    course_response = client.post(
        "/courses/",
        json={
            "name": "Physics",
            "description": "Introductory Physics Course",
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2025-06-01T00:00:00"
        }
    )
    course_id = course_response.json()["id"]

    # Creamos la inscripción
    enrollment_response = client.post(
        "/enrollments/",
        json={"student_id": student_id, "course_id": course_id}
    )
    enrollment_id = enrollment_response.json()["id"]

    # Luego obtenemos la inscripción creada
    response = client.get(f"/enrollments/{enrollment_id}")
    assert response.status_code == 200
    assert response.json()["student_id"] == student_id
    assert response.json()["course_id"] == course_id
def test_update_enrollment():
    # Primero creamos un estudiante y un curso
    student_response = client.post(
        "/students/",
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "password": "Password123"
        }
    )
    student_id = student_response.json()["id"]

    course_response = client.post(
        "/courses/",
        json={
            "name": "Physics",
            "description": "Introductory Physics Course",
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2025-06-01T00:00:00"
        }
    )
    course_id = course_response.json()["id"]

    # Creamos la inscripción
    enrollment_response = client.post(
        "/enrollments/",
        json={"student_id": student_id, "course_id": course_id}
    )
    enrollment_id = enrollment_response.json()["id"]

    # Luego actualizamos la inscripción
    response = client.put(
        f"/enrollments/{enrollment_id}",
        json={"status": "completed"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "completed"

def test_delete_enrollment():
    # Primero creamos un estudiante y un curso
    student_response = client.post(
        "/students/",
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "password": "Password123"
        }
    )
    student_id = student_response.json()["id"]

    course_response = client.post(
        "/courses/",
        json={
            "name": "Physics",
            "description": "Introductory Physics Course",
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2025-06-01T00:00:00"
        }
    )
    course_id = course_response.json()["id"]

    # Creamos la inscripción
    enrollment_response = client.post(
        "/enrollments/",
        json={"student_id": student_id, "course_id": course_id}
    )
    enrollment_id = enrollment_response.json()["id"]

    # Luego eliminamos la inscripción
    response = client.delete(f"/enrollments/{enrollment_id}")
    assert response.status_code == 204

    # Verificamos que la inscripción ya no existe
    response = client.get(f"/enrollments/{enrollment_id}")
    assert response.status_code == 404
