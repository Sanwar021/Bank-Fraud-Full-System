import os
import sys
import pytest
from fastapi.testclient import TestClient

# Path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["models_ready"] is True

def test_models_metadata(client):
    response = client.get("/api/v1/models")
    assert response.status_code == 200
    data = response.json()
    assert len(data["models"]) == 3
    assert "xgb" in data["ensemble_formula"].lower()

def test_score_low_risk_genuine_transaction(client):
    payload = {
        "transaction_id": "tx-test-low-001",
        "customer_id": "cust-test-001",
        "account_context": {
            "source_account_number": "ACC-SAV-100001",
            "source_account_balance": 12500.0,
            "destination_account_number": "ACC-CUR-100002",
        },
        "transaction_features": {
            "amount": 120.0,
            "transfer_type": "INTERNAL",
            "transaction_hour": 14,
            "day_of_week": 2,
            "is_weekend": False,
            "transaction_channel": "WEB",
            "avg_transaction_amount": 150.0,
            "tx_amount_deviation": -0.20,
            "historical_tx_frequency": 15.0,
            "is_new_beneficiary": False,
            "is_new_device": False,
            "is_new_ip": False,
            "geo_distance_km": 5.0,
            "tx_count_1m": 0,
            "tx_count_1h": 1,
            "tx_count_24h": 2,
            "tx_sum_1h": 120.0,
            "tx_sum_24h": 240.0,
            "balance_drain_ratio": 0.01,
            "failed_login_count": 0,
        },
    }

    response = client.post("/api/v1/fraud/score", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "xgb_score" in data
    assert "iforest_score" in data
    assert "autoencoder_score" in data
    assert "ensemble_score" in data
    assert "top_shap_features" in data
    assert data["risk_classification"] == "LOW RISK"
    assert data["ensemble_score"] < 30.0

def test_score_high_risk_fraudulent_transaction(client):
    # Simulated Account Takeover (ATO) pattern
    payload = {
        "transaction_id": "tx-test-high-002",
        "customer_id": "cust-test-002",
        "account_context": {
            "source_account_number": "ACC-SAV-100005",
            "source_account_balance": 8000.0,
            "destination_account_number": "ACC-UNKNOWN-99",
        },
        "transaction_features": {
            "amount": 7500.0,
            "transfer_type": "INTERNAL",
            "transaction_hour": 3, # 3 AM
            "day_of_week": 1,
            "is_weekend": False,
            "transaction_channel": "WEB",
            "avg_transaction_amount": 200.0,
            "tx_amount_deviation": 36.5, # 3600% higher than average!
            "historical_tx_frequency": 12.0,
            "is_new_beneficiary": True,
            "is_new_device": True,
            "is_new_ip": True,
            "geo_distance_km": 1800.0, # Unknown location
            "tx_count_1m": 1,
            "tx_count_1h": 2,
            "tx_count_24h": 3,
            "tx_sum_1h": 7500.0,
            "tx_sum_24h": 7500.0,
            "balance_drain_ratio": 0.94, # Draining 94% of balance!
            "failed_login_count": 3, # 3 failed logins prior
        },
    }

    response = client.post("/api/v1/fraud/score", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["risk_classification"] == "HIGH RISK"
    assert data["ensemble_score"] >= 70.0
    assert len(data["top_shap_features"]) > 0
    # Top features should include amount, drain ratio, or new beneficiary
    top_feature_names = [f["feature"] for f in data["top_shap_features"]]
    assert any(feat in top_feature_names for feat in ["amount", "balance_drain_ratio", "tx_amount_deviation", "is_new_beneficiary"])
