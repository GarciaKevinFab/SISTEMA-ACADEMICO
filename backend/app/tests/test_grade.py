import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_grade():
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

    # Luego creamos la calificación
    grade_response = client.post(
        "/grades/",
        json={"student_id": student_id, "course_id": course_id, "grade_value": 95.0}
    )
    assert grade_response.status_code == 200
    assert "id" in grade_response.json()
    assert grade_response.json()["student_id"] == student_id
    assert grade_response.json()["course_id"] == course_id
    assert grade_response.json()["grade_value"] == 95.0

def test_get_grade():
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

    # Creamos la calificación
    grade_response = client.post(
        "/grades/",
        json={"student_id": student_id, "course_id": course_id, "grade_value": 95.0}
    )
    grade_id = grade_response.json()["id"]

    # Luego obtenemos la calificación creada
    response = client.get(f"/grades/{grade_id}")
    assert response.status_code == 200
    assert response.json()["student_id"] == student_id
    assert response.json()["course_id"] == course_id
    assert response.json()["grade_value"] == 95.0
def test_update_grade():
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

    # Creamos la calificación
    grade_response = client.post(
        "/grades/",
        json={"student_id": student_id, "course_id": course_id, "grade_value": 95.0}
    )
    grade_id = grade_response.json()["id"]

    # Luego actualizamos la calificación
    response = client.put(
        f"/grades/{grade_id}",
        json={"grade_value": 98.0}
    )
    assert response.status_code == 200
    assert response.json()["grade_value"] == 98.0

def test_delete_grade():
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

    # Creamos la calificación
    grade_response = client.post(
        "/grades/",
        json={"student_id": student_id, "course_id": course_id, "grade_value": 95.0}
    )
    grade_id = grade_response.json()["id"]

    # Luego eliminamos la calificación
    response = client.delete(f"/grades/{grade_id}")
    assert response.status_code == 204

    # Verificamos que la calificación ya no existe
    response = client.get(f"/grades/{grade_id}")
    assert response.status_code == 404
