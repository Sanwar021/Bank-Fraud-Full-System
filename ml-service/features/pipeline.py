import os
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List

FEATURE_NAMES = [
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

class FeaturePipeline:
    def __init__(self, scaler_path: str = None):
        self.feature_names = FEATURE_NAMES
        self.scaler = None
        if scaler_path and os.path.exists(scaler_path):
            self.scaler = joblib.load(scaler_path)

    def fit(self, X: pd.DataFrame):
        from sklearn.preprocessing import StandardScaler
        self.scaler = StandardScaler()
        self.scaler.fit(X[self.feature_names])
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        if self.scaler is None:
            raise ValueError("Scaler is not fitted yet.")
        return self.scaler.transform(X[self.feature_names])

    def transform_dict(self, data: Dict[str, Any]) -> np.ndarray:
        row = []
        for name in self.feature_names:
            val = data.get(name, 0.0)
            if isinstance(val, bool):
                val = 1.0 if val else 0.0
            row.append(float(val))
        arr = np.array([row])
        if self.scaler is not None:
            return self.scaler.transform(arr)
        return arr

    def save(self, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        joblib.dump(self.scaler, filepath)

    @classmethod
    def load(cls, filepath: str):
        pipeline = cls(scaler_path=filepath)
        return pipeline

