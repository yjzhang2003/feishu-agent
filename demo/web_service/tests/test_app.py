import pytest
from demo.web_service.app import app


@pytest.fixture
def client():
    app.testing = True
    with app.test_client() as client:
        yield client


# Passing tests

def test_index(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "ok"


def test_add(client):
    resp = client.get("/add?a=3&b=4")
    assert resp.status_code == 200
    assert resp.get_json()["result"] == 7


def test_add_defaults(client):
    resp = client.get("/add")
    assert resp.status_code == 200
    assert resp.get_json()["result"] == 0


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "healthy"


def test_divide_normal(client):
    resp = client.get("/divide?a=10&b=2")
    assert resp.status_code == 200
    assert resp.get_json()["result"] == 5.0


def test_concat_normal(client):
    # This will fail until bug is fixed (str + int)
    resp = client.get("/concat?prefix=hi_&num=1")
    assert resp.status_code == 200


# Failing tests (intentional bugs)

def test_divide_by_zero(client):
    resp = client.get("/divide?a=10&b=0")
    assert resp.status_code == 200  # Currently crashes with 500


def test_user_missing_name(client):
    resp = client.get("/user?id=alice")
    assert resp.status_code == 200  # Currently crashes with 500 (KeyError)


def test_concat_type_error(client):
    resp = client.get("/concat?prefix=test_&num=5")
    assert resp.status_code == 200  # Currently crashes with 500 (TypeError)
