import os
import time
from typing import Dict, Any, List

from features.pipeline import FeaturePipeline
from app.models.xgboost_model import XGBoostFraudClassifier
from app.models.isolation_forest import IsolationForestAnomalyDetector
from app.models.autoencoder import BehavioralAutoencoder
from app.core.ensemble import EnsembleArbiter
from app.api.schemas import FraudScoreRequest, FraudScoreResponse, SHAPContributor

class FraudInferenceEngine:
    def __init__(self, artifacts_dir: str):
        self.artifacts_dir = artifacts_dir
        self.version = "v1.0.0"

        scaler_path = os.path.join(artifacts_dir, "scaler.joblib")
        xgb_path = os.path.join(artifacts_dir, "xgboost.json")
        iforest_path = os.path.join(artifacts_dir, "isolation_forest.joblib")
        ae_path = os.path.join(artifacts_dir, "autoencoder.pt")

        print(f"[InferenceEngine] Loading model artifacts from {artifacts_dir}...")
        self.pipeline = FeaturePipeline.load(scaler_path)
        self.xgb_model = XGBoostFraudClassifier(xgb_path)
        self.iforest_model = IsolationForestAnomalyDetector(iforest_path)
        self.autoencoder_model = BehavioralAutoencoder(ae_path)
        self.arbiter = EnsembleArbiter()
        print("[InferenceEngine] All 3 fraud detection models loaded into memory.")

    def score(self, req: FraudScoreRequest) -> FraudScoreResponse:
        start_t = time.perf_counter()

        # 1. Transform features to standardized vector
        feat_dict = req.transaction_features.model_dump()
        vec = self.pipeline.transform_dict(feat_dict)

        # 2. Model 1: XGBoost Supervised Scoring + SHAP Explanations
        xgb_prob, xgb_risk, shap_contribs = self.xgb_model.predict_risk(vec, explain=True)

        # 3. Model 2: Isolation Forest Unsupervised Anomaly Scoring
        _, iforest_risk, iforest_deviations = self.iforest_model.predict_risk(vec)

        # 4. Model 3: PyTorch Behavioral Sequence Autoencoder
        _, ae_risk, ae_errors = self.autoencoder_model.predict_risk(vec)

        # 5. Ensemble Calculation
        decision = self.arbiter.calculate_ensemble(
            xgb_risk=xgb_risk,
            iforest_risk=iforest_risk,
            autoencoder_risk=ae_risk,
        )

        elapsed_ms = int((time.perf_counter() - start_t) * 1000)

        # Format SHAP features
        shap_models = []
        for s in shap_contribs:
            shap_models.append(SHAPContributor(
                feature=s["feature"],
                value=s["value"],
                shap_value=s["shap_value"],
                contribution=s["contribution"],
                description=s["description"],
            ))

        return FraudScoreResponse(
            xgb_score=round(xgb_risk, 2),
            iforest_score=round(iforest_risk, 2),
            autoencoder_score=round(ae_risk, 2),
            ensemble_score=round(decision["ensemble_score"], 2),
            risk_classification=decision["classification"],
            top_shap_features=shap_models,
            model_version=self.version,
            processing_time_ms=max(elapsed_ms, 1),
        )
