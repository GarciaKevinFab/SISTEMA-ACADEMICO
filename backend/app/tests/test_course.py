import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_course():
    response = client.post(
        "/courses/",
        json={
            "name": "Mathematics",
            "description": "Basic Math Course",
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2025-06-01T00:00:00"
        }
    )
    assert response.status_code == 200
    assert "id" in response.json()
    assert response.json()["name"] == "Mathematics"

def test_get_course():
    # Primero creamos un curso
    create_response = client.post(
        "/courses/",
        json={
            "name": "Mathematics",
            "description": "Basic Math Course",
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2025-06-01T00:00:00"
        }
    )
    course_id = create_response.json()["id"]

    # Luego obtenemos el curso creado
    response = client.get(f"/courses/{course_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Mathematics"

def test_update_course():
    # Primero creamos un curso
    create_response = client.post(
        "/courses/",
        json={
            "name": "Mathematics",
            "description": "Basic Math Course",
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2025-06-01T00:00:00"
        }
    )
    course_id = create_response.json()["id"]

    # Luego actualizamos el curso
    response = client.put(
        f"/courses/{course_id}",
        json={"name": "Advanced Mathematics", "description": "Advanced Math Course"}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Advanced Mathematics"
def test_delete_course():
    # Primero creamos un curso
    create_response = client.post(
        "/courses/",
        json={
            "name": "Mathematics",
            "description": "Basic Math Course",
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2025-06-01T00:00:00"
        }
    )
    course_id = create_response.json()["id"]

    # Luego eliminamos el curso
    response = client.delete(f"/courses/{course_id}")
    assert response.status_code == 204

    # Verificamos que el curso ya no existe
    response = client.get(f"/courses/{course_id}")
    assert response.status_code == 404

def test_get_all_courses():
    # Crear varios cursos
    for i in range(3):
        client.post(
            "/courses/",
            json={
                "name": f"Course {i}",
                "description": f"Description for course {i}",
                "start_date": "2025-01-01T00:00:00",
                "end_date": "2025-06-01T00:00:00"
            }
        )

    # Obtener todos los cursos
    response = client.get("/courses/")
    assert response.status_code == 200
    assert len(response.json()) == 3  # Verificamos que se hayan creado 3 cursos
