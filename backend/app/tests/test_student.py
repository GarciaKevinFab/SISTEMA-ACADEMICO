import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_student():
    response = client.post(
        "/students/",
        json={
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "password": "Password123"
        }
    )
    assert response.status_code == 200
    assert "id" in response.json()
    assert response.json()["email"] == "john.doe@example.com"

def test_get_student():
    # Primero creamos un estudiante
    create_response = client.post(
        "/students/",
        json={
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "password": "Password123"
        }
    )
    student_id = create_response.json()["id"]

    # Luego obtenemos el estudiante creado
    response = client.get(f"/students/{student_id}")
    assert response.status_code == 200
    assert response.json()["email"] == "john.doe@example.com"

def test_update_student():
    # Primero creamos un estudiante
    create_response = client.post(
        "/students/",
        json={
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "password": "Password123"
        }
    )
    student_id = create_response.json()["id"]

    # Luego actualizamos el estudiante
    response = client.put(
        f"/students/{student_id}",
        json={"first_name": "John", "last_name": "Smith", "email": "john.smith@example.com"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "john.smith@example.com"
def test_delete_student():
    # Primero creamos un estudiante
    create_response = client.post(
        "/students/",
        json={
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "password": "Password123"
        }
    )
    student_id = create_response.json()["id"]

    # Luego eliminamos el estudiante
    response = client.delete(f"/students/{student_id}")
    assert response.status_code == 204

    # Verificamos que el estudiante ya no existe
    response = client.get(f"/students/{student_id}")
    assert response.status_code == 404

def test_get_all_students():
    # Crear varios estudiantes
    for i in range(3):
        client.post(
            "/students/",
            json={
                "first_name": f"Student{i}",
                "last_name": "Test",
                "email": f"student{i}@example.com",
                "password": "Password123"
            }
        )

    # Obtener todos los estudiantes
    response = client.get("/students/")
    assert response.status_code == 200
    assert len(response.json()) == 3  # Verificamos que se hayan creado 3 estudiantes
