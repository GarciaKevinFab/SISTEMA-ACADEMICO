import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_procedure():
    # Primero creamos un estudiante
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

    # Luego creamos el procedimiento
    response = client.post(
        "/procedures/",
        json={"student_id": student_id, "procedure_type": "Medical", "status": "in_progress"}
    )
    assert response.status_code == 200
    assert "id" in response.json()
    assert response.json()["student_id"] == student_id
    assert response.json()["procedure_type"] == "Medical"
    assert response.json()["status"] == "in_progress"

def test_get_procedure():
    # Primero creamos un estudiante
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

    # Luego creamos el procedimiento
    procedure_response = client.post(
        "/procedures/",
        json={"student_id": student_id, "procedure_type": "Medical", "status": "in_progress"}
    )
    procedure_id = procedure_response.json()["id"]

    # Luego obtenemos el procedimiento creado
    response = client.get(f"/procedures/{procedure_id}")
    assert response.status_code == 200
    assert response.json()["student_id"] == student_id
    assert response.json()["procedure_type"] == "Medical"
    assert response.json()["status"] == "in_progress"
def test_update_procedure():
    # Primero creamos un estudiante
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

    # Luego creamos el procedimiento
    procedure_response = client.post(
        "/procedures/",
        json={"student_id": student_id, "procedure_type": "Medical", "status": "in_progress"}
    )
    procedure_id = procedure_response.json()["id"]

    # Luego actualizamos el procedimiento
    response = client.put(
        f"/procedures/{procedure_id}",
        json={"status": "completed"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "completed"

def test_delete_procedure():
    # Primero creamos un estudiante
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

    # Luego creamos el procedimiento
    procedure_response = client.post(
        "/procedures/",
        json={"student_id": student_id, "procedure_type": "Medical", "status": "in_progress"}
    )
    procedure_id = procedure_response.json()["id"]

    # Luego eliminamos el procedimiento
    response = client.delete(f"/procedures/{procedure_id}")
    assert response.status_code == 204

    # Verificamos que el procedimiento ya no existe
    response = client.get(f"/procedures/{procedure_id}")
    assert response.status_code == 404
