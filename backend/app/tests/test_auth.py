import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_register():
    response = client.post(
        "/register",
        json={"email": "test@example.com", "full_name": "Test User", "password": "Password123"}
    )
    assert response.status_code == 200
    assert "id" in response.json()
    assert response.json()["email"] == "test@example.com"

def test_login():
    client.post(
        "/register",
        json={"email": "test@example.com", "full_name": "Test User", "password": "Password123"}
    )
    response = client.post(
        "/login",
        json={"email": "test@example.com", "password": "Password123"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_invalid_login():
    response = client.post(
        "/login",
        json={"email": "nonexistent@example.com", "password": "WrongPassword"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"
def test_get_current_user():
    # Registramos un usuario primero
    client.post(
        "/register",
        json={"email": "test@example.com", "full_name": "Test User", "password": "Password123"}
    )
    login_response = client.post(
        "/login",
        json={"email": "test@example.com", "password": "Password123"}
    )
    access_token = login_response.json()["access_token"]

    response = client.get(
        "/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"
    assert response.json()["full_name"] == "Test User"
