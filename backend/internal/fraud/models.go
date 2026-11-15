package fraud

type AccountContext struct {
	SourceAccountNumber      string  `json:"source_account_number"`
	SourceAccountBalance     float64 `json:"source_account_balance"`
	DestinationAccountNumber string  `json:"destination_account_number"`
	CustomerIncome           float64 `json:"customer_income"`
}

type TransactionFeatures struct {
	Amount                float64 `json:"amount"`
	TransferType          string  `json:"transfer_type"`
	TransactionHour       int     `json:"transaction_hour"`
	DayOfWeek             int     `json:"day_of_week"`
	IsWeekend             bool    `json:"is_weekend"`
	TransactionChannel    string  `json:"transaction_channel"`
	AvgTransactionAmount  float64 `json:"avg_transaction_amount"`
	TxAmountDeviation     float64 `json:"tx_amount_deviation"`
	HistoricalTxFrequency float64 `json:"historical_tx_frequency"`
	IsNewBeneficiary      bool    `json:"is_new_beneficiary"`
	IsNewDevice           bool    `json:"is_new_device"`
	IsNewIP               bool    `json:"is_new_ip"`
	GeoDistanceKm         float64 `json:"geo_distance_km"`
	TxCount1m             int     `json:"tx_count_1m"`
	TxCount1h             int     `json:"tx_count_1h"`
	TxCount24h            int     `json:"tx_count_24h"`
	TxSum1h               float64 `json:"tx_sum_1h"`
	TxSum24h              float64 `json:"tx_sum_24h"`
	BalanceDrainRatio     float64 `json:"balance_drain_ratio"`
	FailedLoginCount      int     `json:"failed_login_count"`
}

type SHAPContributor struct {
	Feature      string  `json:"feature"`
	Value        float64 `json:"value"`
	ShapValue    float64 `json:"shap_value"`
	Contribution string  `json:"contribution"` // "INCREASES_RISK" or "DECREASES_RISK"
	Description  string  `json:"description"`
}

type FraudScoreRequest struct {
	TransactionID       string              `json:"transaction_id"`
	CustomerID          string              `json:"customer_id"`
	AccountContext      AccountContext      `json:"account_context"`
	TransactionFeatures TransactionFeatures `json:"transaction_features"`
	RecentSequence      []float64           `json:"recent_sequence"`
}

type FraudScoreResponse struct {
	XGBScore           float64           `json:"xgb_score"`
	IForestScore       float64           `json:"iforest_score"`
	AutoencoderScore   float64           `json:"autoencoder_score"`
	EnsembleScore      float64           `json:"ensemble_score"`
	RiskClassification string            `json:"risk_classification"`
	TopSHAPFeatures    []SHAPContributor `json:"top_shap_features"`
	ModelVersion       string            `json:"model_version"`
	ProcessingTimeMs   int               `json:"processing_time_ms"`
}
