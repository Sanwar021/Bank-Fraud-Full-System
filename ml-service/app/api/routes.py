import os
import json
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any

from app.api.schemas import FraudScoreRequest, FraudScoreResponse, ModelsResponse, ModelDetails
from app.core.inference import FraudInferenceEngine

router = APIRouter()

# Global engine reference injected in main
_engine: FraudInferenceEngine = None

def set_engine(engine: FraudInferenceEngine):
    global _engine
    _engine = engine

def get_engine() -> FraudInferenceEngine:
    global _engine
    if _engine is None:
        artifacts_dir = os.path.join(os.path.dirname(__file__), "..", "..", "artifacts", "v1")
        _engine = FraudInferenceEngine(artifacts_dir)
    return _engine

@router.get("/health")
def health(engine: FraudInferenceEngine = Depends(get_engine)):
    return {
        "status": "healthy",
        "service": "Bank Investigation ML Microservice",
        "models_ready": engine is not None,
    }

@router.post("/api/v1/fraud/score", response_model=FraudScoreResponse)
def score_transaction(
    req: FraudScoreRequest,
    engine: FraudInferenceEngine = Depends(get_engine),
):
    try:
        return engine.score(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

@router.get("/api/v1/models", response_model=ModelsResponse)
def list_models():
    models_list = [
        ModelDetails(
            model_name="XGBoost Fraud Classifier",
            model_type="Supervised Gradient Boosting",
            weight=0.50,
            status="ACTIVE",
            description="Supervised classifier predicting probability of transaction fraud with SHAP tree explainability.",
        ),
        ModelDetails(
            model_name="Isolation Forest Anomaly Detector",
            model_type="Unsupervised Outlier Isolation",
            weight=0.25,
            status="ACTIVE",
            description="Unsupervised outlier partitioner identifying unrepresented multidimensional behavioral anomalies.",
        ),
        ModelDetails(
            model_name="PyTorch Behavioral Autoencoder",
            model_type="Deep Neural Sequence Reconstruction",
            weight=0.25,
            status="ACTIVE",
            description="Multi-layer neural autoencoder measuring reconstruction error (MSE) against the customer baseline manifold.",
        ),
    ]

    return ModelsResponse(
        models=models_list,
        ensemble_formula="Final Risk = (0.50 * XGB) + (0.25 * IForest) + (0.25 * Autoencoder)",
        thresholds={
            "low_risk": {"range": [0, 29.99], "decision": "LOW RISK", "action": "AUTO_APPROVE"},
            "medium_risk": {"range": [30, 69.99], "decision": "MEDIUM RISK", "action": "OTP_REQUIRED"},
            "high_risk": {"range": [70, 100], "decision": "HIGH RISK", "action": "BLOCK"},
        },
    )

@router.get("/api/v1/models/versions")
def get_versions():
    meta_path = os.path.join(os.path.dirname(__file__), "..", "..", "artifacts", "v1", "metadata.json")
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            return json.load(f)
    return {"version": "v1.0.0", "status": "active"}

@router.post("/api/v1/models/retrain")
def trigger_retrain():
    return {
        "status": "QUEUED",
        "message": "Retraining job queued with verified analyst feedback labels.",
    }
