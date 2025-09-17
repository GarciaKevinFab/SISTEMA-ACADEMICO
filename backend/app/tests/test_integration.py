import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_integration():
    # Crear estudiante
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

    # Crear curso
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

    # Crear inscripción
    enrollment_response = client.post(
        "/enrollments/",
        json={"student_id": student_id, "course_id": course_id}
    )
    enrollment_id = enrollment_response.json()["id"]

    # Crear calificación
    grade_response = client.post(
        "/grades/",
        json={"student_id": student_id, "course_id": course_id, "grade_value": 90.0}
    )
    grade_id = grade_response.json()["id"]

    # Crear procedimiento
    procedure_response = client.post(
        "/procedures/",
        json={"student_id": student_id, "procedure_type": "Medical", "status": "in_progress"}
    )
    procedure_id = procedure_response.json()["id"]

    # Verificar que el estudiante esté inscrito en el curso y tenga una calificación
    grade_check = client.get(f"/grades/{grade_id}")
    assert grade_check.status_code == 200
    assert grade_check.json()["student_id"] == student_id
    assert grade_check.json()["course_id"] == course_id

    # Verificar que el procedimiento esté en progreso
    procedure_check = client.get(f"/procedures/{procedure_id}")
    assert procedure_check.status_code == 200
    assert procedure_check.json()["status"] == "in_progress"
def test_integration_with_update_and_delete():
    # Crear estudiante
    student_response = client.post(
        "/students/",
        json={
            "first_name": "John",
            "last_name": "Smith",
            "email": "john.smith@example.com",
            "password": "Password123"
        }
    )
    student_id = student_response.json()["id"]

    # Crear curso
    course_response = client.post(
        "/courses/",
        json={
            "name": "Chemistry",
            "description": "Introductory Chemistry Course",
            "start_date": "2025-02-01T00:00:00",
            "end_date": "2025-07-01T00:00:00"
        }
    )
    course_id = course_response.json()["id"]

    # Crear inscripción
    enrollment_response = client.post(
        "/enrollments/",
        json={"student_id": student_id, "course_id": course_id}
    )
    enrollment_id = enrollment_response.json()["id"]

    # Crear calificación
    grade_response = client.post(
        "/grades/",
        json={"student_id": student_id, "course_id": course_id, "grade_value": 88.0}
    )
    grade_id = grade_response.json()["id"]

    # Crear procedimiento
    procedure_response = client.post(
        "/procedures/",
        json={"student_id": student_id, "procedure_type": "Dental", "status": "pending"}
    )
    procedure_id = procedure_response.json()["id"]

    # Actualizar calificación
    update_grade_response = client.put(
        f"/grades/{grade_id}",
        json={"grade_value": 92.0}
    )
    assert update_grade_response.status_code == 200
    assert update_grade_response.json()["grade_value"] == 92.0

    # Eliminar inscripción
    delete_enrollment_response = client.delete(f"/enrollments/{enrollment_id}")
    assert delete_enrollment_response.status_code == 204

    # Verificar que la inscripción se haya eliminado
    enrollment_check = client.get(f"/enrollments/{enrollment_id}")
    assert enrollment_check.status_code == 404

    # Eliminar procedimiento
    delete_procedure_response = client.delete(f"/procedures/{procedure_id}")
    assert delete_procedure_response.status_code == 204

    # Verificar que el procedimiento se haya eliminado
    procedure_check = client.get(f"/procedures/{procedure_id}")
    assert procedure_check.status_code == 404
