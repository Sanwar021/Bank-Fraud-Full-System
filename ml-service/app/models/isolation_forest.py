import os
import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Tuple, List, Dict, Any

class IsolationForestAnomalyDetector:
    def __init__(self, model_path: str = None):
        self.model = None
        self.feature_names = None
        self.feature_means = None
        self.feature_stds = None
        if model_path and os.path.exists(model_path):
            self.load(model_path)

    def fit(self, X: np.ndarray, feature_names: List[str] = None):
        self.feature_names = feature_names
        self.feature_means = np.mean(X, axis=0)
        self.feature_stds = np.std(X, axis=0) + 1e-6

        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.03,
            max_samples="auto",
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X)

    def predict_risk(self, X: np.ndarray) -> Tuple[float, float, List[Dict[str, Any]]]:
        """
        Returns:
            anomaly_score,
            normalized_risk_score (0 - 100),
            top_deviating_features
        """
        if self.model is None:
            raise ValueError("Model is not loaded.")

        # decision_function: lower means more anomalous. Typical range: -0.5 to 0.5
        score = float(self.model.decision_function(X)[0])

        # Normalize to 0-100 risk:
        # score <= -0.25 -> 100 risk, score >= 0.20 -> 0 risk
        normalized_risk = (0.20 - score) / (0.20 - (-0.25)) * 100.0
        normalized_risk = round(min(max(normalized_risk, 0.0), 100.0), 2)

        # Feature deviations (Z-score from normal baseline)
        deviations = []
        if self.feature_means is not None and self.feature_names is not None:
            z_scores = np.abs((X[0] - self.feature_means) / self.feature_stds)
            top_indices = np.argsort(z_scores)[::-1][:4]
            for idx in top_indices:
                fname = self.feature_names[idx]
                z = float(z_scores[idx])
                if z > 1.5:
                    deviations.append({
                        "feature": fname,
                        "deviation_sigma": round(z, 2),
                        "description": f"Feature '{fname}' deviates {z:.1f}σ from typical cluster baseline",
                    })

        return score, normalized_risk, deviations

    def save(self, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        payload = {
            "model": self.model,
            "feature_names": self.feature_names,
            "feature_means": self.feature_means,
            "feature_stds": self.feature_stds,
        }
        joblib.dump(payload, filepath)

    def load(self, filepath: str):
        payload = joblib.load(filepath)
        self.model = payload["model"]
        self.feature_names = payload["feature_names"]
        self.feature_means = payload.get("feature_means")
        self.feature_stds = payload.get("feature_stds")

