from typing import Dict, Any, List

class EnsembleArbiter:
    def __init__(
        self,
        weight_xgb: float = 0.50,
        weight_iforest: float = 0.25,
        weight_autoencoder: float = 0.25,
        low_threshold: float = 30.0,
        high_threshold: float = 70.0,
    ):
        self.weight_xgb = weight_xgb
        self.weight_iforest = weight_iforest
        self.weight_autoencoder = weight_autoencoder
        self.low_threshold = low_threshold
        self.high_threshold = high_threshold

    def calculate_ensemble(
        self,
        xgb_risk: float,
        iforest_risk: float,
        autoencoder_risk: float,
    ) -> Dict[str, Any]:
        """
        Combines 3 normalized model risk scores into calibrated final ensemble risk.
        """
        final_risk = (
            (xgb_risk * self.weight_xgb)
            + (iforest_risk * self.weight_iforest)
            + (autoencoder_risk * self.weight_autoencoder)
        )
        final_risk = round(min(max(final_risk, 0.0), 100.0), 2)

        if final_risk < self.low_threshold:
            classification = "LOW RISK"
            action = "APPROVE"
        elif final_risk < self.high_threshold:
            classification = "MEDIUM RISK"
            action = "OTP_REQUIRED"
        else:
            classification = "HIGH RISK"
            action = "BLOCK"

        return {
            "ensemble_score": final_risk,
            "classification": classification,
            "action": action,
            "weights": {
                "xgboost": self.weight_xgb,
                "isolation_forest": self.weight_iforest,
                "autoencoder": self.weight_autoencoder,
            },
        }

