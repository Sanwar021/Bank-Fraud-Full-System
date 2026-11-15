import os
import xgboost as xgb
import numpy as np
import shap
from typing import Tuple, List, Dict, Any

DEFAULT_FEATURE_NAMES = [
    "amount",
    "transaction_hour",
    "day_of_week",
    "is_weekend",
    "avg_transaction_amount",
    "tx_amount_deviation",
    "historical_tx_frequency",
    "is_new_beneficiary",
    "is_new_device",
    "is_new_ip",
    "geo_distance_km",
    "tx_count_1m",
    "tx_count_1h",
    "tx_count_24h",
    "tx_sum_1h",
    "tx_sum_24h",
    "balance_drain_ratio",
    "failed_login_count",
]

class XGBoostFraudClassifier:
    def __init__(self, model_path: str = None):
        self.model = None
        self.explainer = None
        self.feature_names = DEFAULT_FEATURE_NAMES
        if model_path and os.path.exists(model_path):
            self.load(model_path)

    def fit(self, X: np.ndarray, y: np.ndarray, feature_names: List[str] = None):
        self.feature_names = feature_names
        dtrain = xgb.DMatrix(X, label=y, feature_names=feature_names)
        
        # Calculate scale_pos_weight for class imbalance (~50:1)
        scale_pos = (len(y) - sum(y)) / max(sum(y), 1)

        params = {
            "max_depth": 5,
            "eta": 0.08,
            "objective": "binary:logistic",
            "eval_metric": ["logloss", "aucpr"],
            "scale_pos_weight": scale_pos,
            "seed": 42,
            "tree_method": "hist",
        }

        self.model = xgb.train(
            params,
            dtrain,
            num_boost_round=120,
        )
        self.explainer = shap.TreeExplainer(self.model)

    def predict_risk(self, X: np.ndarray, explain: bool = True) -> Tuple[float, float, List[Dict[str, Any]]]:
        """
        Returns:
            probability (0.0 - 1.0),
            normalized_risk_score (0.0 - 100.0),
            top_shap_features (list of dicts)
        """
        if self.model is None:
            raise ValueError("Model is not loaded.")

        dmatrix = xgb.DMatrix(X, feature_names=self.feature_names)
        raw_prob = float(self.model.predict(dmatrix)[0])
        risk_score = round(min(max(raw_prob * 100.0, 0.0), 100.0), 2)

        shap_contributions = []
        if explain and self.explainer is not None:
            try:
                shap_values = self.explainer.shap_values(X)
                if len(shap_values.shape) > 1:
                    sv = shap_values[0]
                else:
                    sv = shap_values

                features_with_shap = []
                for idx, fname in enumerate(self.feature_names):
                    s_val = float(sv[idx])
                    raw_val = float(X[0, idx])
                    features_with_shap.append((fname, raw_val, s_val))

                features_with_shap.sort(key=lambda x: abs(x[2]), reverse=True)

                for fname, r_val, s_val in features_with_shap[:5]:
                    direction = "INCREASES_RISK" if s_val > 0 else "DECREASES_RISK"
                    desc = f"Feature '{fname}' ({r_val:.2f}) {direction.lower().replace('_', ' ')} by {abs(s_val):.3f}"
                    shap_contributions.append({
                        "feature": fname,
                        "value": round(r_val, 2),
                        "shap_value": round(s_val, 4),
                        "contribution": direction,
                        "description": desc,
                    })
            except Exception as e:
                shap_contributions = []

        return raw_prob, risk_score, shap_contributions

    def predict_proba_batch(self, X: np.ndarray) -> np.ndarray:
        dmatrix = xgb.DMatrix(X, feature_names=self.feature_names)
        return self.model.predict(dmatrix)

    def save(self, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        self.model.save_model(filepath)

    def load(self, filepath: str):
        self.model = xgb.Booster()
        self.model.load_model(filepath)
        self.explainer = shap.TreeExplainer(self.model)
