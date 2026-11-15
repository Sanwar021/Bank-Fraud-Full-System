from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class AccountContextSchema(BaseModel):
    source_account_number: Optional[str] = ""
    source_account_balance: Optional[float] = 0.0
    destination_account_number: Optional[str] = ""
    customer_income: Optional[float] = 0.0

class TransactionFeaturesSchema(BaseModel):
    amount: float = Field(..., gt=0)
    transfer_type: Optional[str] = "INTERNAL"
    transaction_hour: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)
    is_weekend: bool = False
    transaction_channel: Optional[str] = "WEB"
    avg_transaction_amount: float = 250.0
    tx_amount_deviation: float = 0.0
    historical_tx_frequency: float = 1.0
    is_new_beneficiary: bool = False
    is_new_device: bool = False
    is_new_ip: bool = False
    geo_distance_km: float = 0.0
    tx_count_1m: int = 0
    tx_count_1h: int = 0
    tx_count_24h: int = 0
    tx_sum_1h: float = 0.0
    tx_sum_24h: float = 0.0
    balance_drain_ratio: float = 0.0
    failed_login_count: int = 0

class FraudScoreRequest(BaseModel):
    transaction_id: str
    customer_id: str
    account_context: Optional[AccountContextSchema] = None
    transaction_features: TransactionFeaturesSchema
    recent_sequence: Optional[List[float]] = None

class SHAPContributor(BaseModel):
    feature: str
    value: float
    shap_value: float
    contribution: str # INCREASES_RISK or DECREASES_RISK
    description: str

class FraudScoreResponse(BaseModel):
    xgb_score: float
    iforest_score: float
    autoencoder_score: float
    ensemble_score: float
    risk_classification: str
    top_shap_features: List[SHAPContributor]
    model_version: str
    processing_time_ms: int

class ModelDetails(BaseModel):
    model_name: str
    model_type: str
    weight: float
    status: str
    description: str

class ModelsResponse(BaseModel):
    models: List[ModelDetails]
    ensemble_formula: str
    thresholds: Dict[str, Any]
