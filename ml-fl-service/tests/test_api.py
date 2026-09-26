from fastapi.testclient import TestClient

from app import app


def test_health() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "service": "ml-fl-service",
        "phase": 1,
        "port": 8000,
    }


def test_datasets() -> None:
    response = TestClient(app).get("/datasets")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
