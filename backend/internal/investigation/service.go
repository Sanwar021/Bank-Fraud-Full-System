package investigation

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/bank-investigation/backend/internal/audit"
	"github.com/bank-investigation/backend/internal/ledger"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

var (
	ErrAlertNotFound     = errors.New("fraud alert not found")
	ErrInvalidDecision   = errors.New("invalid analyst decision")
	ErrAlertAlreadyDealt = errors.New("alert is already resolved")
)

type InvestigationOverview struct {
	TotalTransactions   int64           `json:"total_transactions"`
	TotalVolume         decimal.Decimal `json:"total_volume"`
	PendingAlerts       int64           `json:"pending_alerts"`
	ConfirmedFraudCount int64           `json:"confirmed_fraud_count"`
	FalsePositiveCount  int64           `json:"false_positive_count"`
	ReleasedCount       int64           `json:"released_count"`
	BlockedCount        int64           `json:"blocked_count"`
	HeldCount           int64           `json:"held_count"`
	AvgRiskScore        float64         `json:"avg_risk_score"`
	HighRiskCount       int64           `json:"high_risk_count"`
	MediumRiskCount     int64           `json:"medium_risk_count"`
	LowRiskCount        int64           `json:"low_risk_count"`
}

type InvestigationService struct {
	db           *gorm.DB
	ledgerEngine *ledger.LedgerEngine
	auditSvc     *audit.AuditService
}

func NewInvestigationService(db *gorm.DB, ledgerEngine *ledger.LedgerEngine, auditSvc *audit.AuditService) *InvestigationService {
	return &InvestigationService{
		db:           db,
		ledgerEngine: ledgerEngine,
		auditSvc:     auditSvc,
	}
}

func (s *InvestigationService) GetOverviewMetrics(ctx context.Context) (*InvestigationOverview, error) {
	var overview InvestigationOverview

	// Total Transactions
	s.db.WithContext(ctx).Model(&models.Transaction{}).Count(&overview.TotalTransactions)

	// Total Volume
	var totalVol decimal.NullDecimal
	s.db.WithContext(ctx).Model(&models.Transaction{}).
		Where("status = ?", models.TxStatusCompleted).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&totalVol)
	if totalVol.Valid {
		overview.TotalVolume = totalVol.Decimal
	} else {
		overview.TotalVolume = decimal.Zero
	}

	// Status counts
	s.db.WithContext(ctx).Model(&models.FraudAlert{}).Where("status = ?", "PENDING").Count(&overview.PendingAlerts)
	s.db.WithContext(ctx).Model(&models.Transaction{}).Where("status = ?", models.TxStatusBlocked).Count(&overview.BlockedCount)
	s.db.WithContext(ctx).Model(&models.Transaction{}).Where("status = ?", models.TxStatusHeldForReview).Count(&overview.HeldCount)

	// Adjudication counts
	s.db.WithContext(ctx).Model(&models.FraudAnalystDecision{}).Where("decision = ?", "CONFIRMED_FRAUD").Count(&overview.ConfirmedFraudCount)
	s.db.WithContext(ctx).Model(&models.FraudAnalystDecision{}).Where("decision = ?", "FALSE_POSITIVE").Count(&overview.FalsePositiveCount)
	s.db.WithContext(ctx).Model(&models.FraudAnalystDecision{}).Where("decision = ?", "RELEASED").Count(&overview.ReleasedCount)

	// Risk classification counts
	s.db.WithContext(ctx).Model(&models.Transaction{}).Where("risk_decision = ?", models.RiskHigh).Count(&overview.HighRiskCount)
	s.db.WithContext(ctx).Model(&models.Transaction{}).Where("risk_decision = ?", models.RiskMedium).Count(&overview.MediumRiskCount)
	s.db.WithContext(ctx).Model(&models.Transaction{}).Where("risk_decision = ?", models.RiskLow).Count(&overview.LowRiskCount)

	// Average Risk Score
	var avgScore float64
	s.db.WithContext(ctx).Model(&models.Transaction{}).
		Where("risk_score IS NOT NULL").
		Select("COALESCE(AVG(risk_score), 0)").
		Scan(&avgScore)
	overview.AvgRiskScore = avgScore

	return &overview, nil
}

func (s *InvestigationService) GetFraudAlerts(
	ctx context.Context,
	status, severity string,
	page, limit int,
) ([]models.FraudAlert, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	query := s.db.WithContext(ctx).Model(&models.FraudAlert{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if severity != "" {
		query = query.Where("severity = ?", severity)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var alerts []models.FraudAlert
	err := query.
		Preload("Transaction").
		Preload("Transaction.SourceAccount").
		Preload("Transaction.SourceAccount.Customer").
		Preload("Transaction.DestinationAccount").
		Preload("Transaction.FraudScore").
		Preload("Decisions").
		Preload("Decisions.Analyst").
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&alerts).Error

	return alerts, total, err
}

func (s *InvestigationService) GetAlertDetails(ctx context.Context, alertID uuid.UUID) (*models.FraudAlert, error) {
	var alert models.FraudAlert
	err := s.db.WithContext(ctx).
		Preload("Transaction").
		Preload("Transaction.SourceAccount").
		Preload("Transaction.SourceAccount.Customer").
		Preload("Transaction.DestinationAccount").
		Preload("Transaction.FraudScore").
		Preload("Decisions").
		Preload("Decisions.Analyst").
		Where("id = ?", alertID).
		First(&alert).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrAlertNotFound
	}
	return &alert, err
}

type AdjudicateRequest struct {
	Decision string `json:"decision" binding:"required"` // CONFIRMED_FRAUD, FALSE_POSITIVE, RELEASED, ESCALATED
	Reason   string `json:"reason" binding:"required"`
	Notes    string `json:"notes"`
}

func (s *InvestigationService) AdjudicateAlert(
	ctx context.Context,
	alertID, analystID uuid.UUID,
	req AdjudicateRequest,
	ip string,
) error {
	switch req.Decision {
	case "CONFIRMED_FRAUD", "FALSE_POSITIVE", "RELEASED", "ESCALATED":
	default:
		return ErrInvalidDecision
	}

	var alert models.FraudAlert
	if err := s.db.WithContext(ctx).Preload("Transaction").Where("id = ?", alertID).First(&alert).Error; err != nil {
		return ErrAlertNotFound
	}

	// Create Decision record
	decisionRecord := models.FraudAnalystDecision{
		AlertID:   alert.ID,
		AnalystID: analystID,
		Decision:  req.Decision,
		Reason:    req.Reason,
		Notes:     req.Notes,
		CreatedAt: time.Now().UTC(),
	}

	if err := s.db.WithContext(ctx).Create(&decisionRecord).Error; err != nil {
		return fmt.Errorf("failed to save analyst decision: %w", err)
	}

	// Update Alert status
	alertStatus := "RESOLVED"
	if req.Decision == "ESCALATED" {
		alertStatus = "ESCALATED"
	}

	s.db.WithContext(ctx).Model(&alert).Updates(map[string]interface{}{
		"status":      alertStatus,
		"assigned_to": analystID,
		"updated_at":  time.Now().UTC(),
	})

	// Process business outcome on the Transaction
	if alert.Transaction != nil {
		txRecord := alert.Transaction
		switch req.Decision {
		case "CONFIRMED_FRAUD":
			s.db.WithContext(ctx).Model(txRecord).Update("status", models.TxStatusBlocked)
			s.recordStatusTransition(ctx, txRecord.ID, models.TxStatusBlocked, fmt.Sprintf("Analyst confirmed fraud: %s", req.Reason), &analystID)

			// Optionally freeze the source account if requested in reason
			if txRecord.SourceAccountID != nil {
				s.db.WithContext(ctx).Model(&models.Account{}).Where("id = ?", *txRecord.SourceAccountID).Update("status", models.AccountStatusFrozen)
			}

		case "FALSE_POSITIVE":
			s.recordStatusTransition(ctx, txRecord.ID, txRecord.Status, fmt.Sprintf("Analyst tagged as False Positive: %s", req.Reason), &analystID)

		case "RELEASED":
			// If transaction was in a holding/pending state, release and post to ledger!
			if txRecord.Status == models.TxStatusHeldForReview || txRecord.Status == models.TxStatusOTPRequired || txRecord.Status == models.TxStatusBlocked {
				s.db.WithContext(ctx).Model(txRecord).Update("status", models.TxStatusApproved)
				s.recordStatusTransition(ctx, txRecord.ID, models.TxStatusApproved, fmt.Sprintf("Analyst override: approved and released. Reason: %s", req.Reason), &analystID)

				// Post double-entry ledger!
				_, err := s.ledgerEngine.PostApprovedTransaction(ctx, txRecord.ID)
				if err != nil {
					return fmt.Errorf("transaction approved but failed to post ledger: %w", err)
				}
			}
		}
	}

	_ = s.auditSvc.Log(
		&analystID,
		models.RoleFraudAnalyst,
		"FRAUD_ALERT_ADJUDICATED",
		"FRAUD_ALERT",
		alert.ID.String(),
		ip,
		"SUCCESS",
		map[string]interface{}{
			"decision":       req.Decision,
			"transaction_id": alert.TransactionID,
			"reason":         req.Reason,
		},
	)

	// Broadcast update to all connected analysts via SSE
	GlobalSSEHub.Broadcast("alert_adjudicated", map[string]interface{}{
		"alert_id":       alert.ID,
		"transaction_id": alert.TransactionID,
		"decision":       req.Decision,
		"analyst_id":     analystID,
		"status":         alertStatus,
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
	})

	return nil
}

func (s *InvestigationService) GetLiveTransactions(ctx context.Context, limit int) ([]models.Transaction, error) {
	if limit < 1 || limit > 50 {
		limit = 20
	}

	var txs []models.Transaction
	err := s.db.WithContext(ctx).
		Preload("SourceAccount").
		Preload("SourceAccount.Customer").
		Preload("DestinationAccount").
		Preload("FraudScore").
		Preload("FraudAlert").
		Order("created_at DESC").
		Limit(limit).
		Find(&txs).Error

	return txs, err
}

func (s *InvestigationService) GetAuditLogs(
	ctx context.Context,
	action, outcome string,
	page, limit int,
) ([]models.AuditLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	query := s.db.WithContext(ctx).Model(&models.AuditLog{})
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if outcome != "" {
		query = query.Where("outcome = ?", outcome)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var logs []models.AuditLog
	err := query.
		Preload("Actor").
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&logs).Error

	return logs, total, err
}

func (s *InvestigationService) recordStatusTransition(ctx context.Context, txID uuid.UUID, status, reason string, changedBy *uuid.UUID) {
	history := models.TransactionStatusHistory{
		TransactionID: txID,
		Status:        status,
		Reason:        reason,
		ChangedBy:     changedBy,
		CreatedAt:     time.Now().UTC(),
	}
	_ = s.db.WithContext(ctx).Create(&history)
}
