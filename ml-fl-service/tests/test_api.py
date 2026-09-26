from fastapi.testclient import TestClient

from app import app


def test_health() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["service"] == "ml-fl-service"
    assert body["phase"] == "demo-complete"
    assert body["port"] == 8000
    assert isinstance(body["model_ready"], bool)


def test_datasets() -> None:
    response = TestClient(app).get("/datasets")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
