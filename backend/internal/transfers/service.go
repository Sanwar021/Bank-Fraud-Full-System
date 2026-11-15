package transfers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/bank-investigation/backend/internal/audit"
	"github.com/bank-investigation/backend/internal/auth"
	"github.com/bank-investigation/backend/internal/database"
	"github.com/bank-investigation/backend/internal/fraud"
	"github.com/bank-investigation/backend/internal/investigation"
	"github.com/bank-investigation/backend/internal/ledger"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/bank-investigation/backend/internal/notifications"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

var (
	ErrTransferNotFound     = errors.New("transfer not found")
	ErrInvalidAmount        = errors.New("transfer amount must be strictly greater than zero")
	ErrSourceDestSame       = errors.New("source and destination accounts must be distinct")
	ErrAccountNotOwned      = errors.New("you do not have authorization over the source account")
	ErrTransferNotPendingOTP = errors.New("transfer is not pending OTP verification")
	ErrTransferCannotCancel = errors.New("transfer cannot be cancelled in its current state")
)

type TransferService struct {
	db           *gorm.DB
	ledgerEngine *ledger.LedgerEngine
	fraudClient  *fraud.FraudClient
	cache        database.CacheService
	auditSvc     *audit.AuditService
	notifSvc     *notifications.NotificationService
	authSvc      *auth.AuthService
}

func NewTransferService(
	db *gorm.DB,
	ledgerEngine *ledger.LedgerEngine,
	fraudClient *fraud.FraudClient,
	cache database.CacheService,
	auditSvc *audit.AuditService,
	notifSvc *notifications.NotificationService,
	authSvc *auth.AuthService,
) *TransferService {
	return &TransferService{
		db:           db,
		ledgerEngine: ledgerEngine,
		fraudClient:  fraudClient,
		cache:        cache,
		auditSvc:     auditSvc,
		notifSvc:     notifSvc,
		authSvc:      authSvc,
	}
}

type InitiateTransferRequest struct {
	SourceAccountID      uuid.UUID       `json:"source_account_id" binding:"required"`
	DestinationAccountID *uuid.UUID      `json:"destination_account_id"`
	DestinationAccNumber string          `json:"destination_account_number"`
	TransferType         string          `json:"transfer_type" binding:"required"` // INTERNAL, INTERBANK, BILL_PAY
	Amount               decimal.Decimal `json:"amount" binding:"required"`
	Description          string          `json:"description"`
	IdempotencyKey       *string         `json:"idempotency_key"`
	Channel              string          `json:"channel"` // WEB, MOBILE
}

type TransferResult struct {
	Transaction *models.Transaction       `json:"transaction"`
	FraudScore  *fraud.FraudScoreResponse `json:"fraud_score,omitempty"`
	RequiresOTP bool                      `json:"requires_otp"`
	DemoOTP     string                    `json:"demo_otp,omitempty"`
}

func (s *TransferService) InitiateTransfer(
	ctx context.Context,
	req InitiateTransferRequest,
	customerID, userID uuid.UUID,
	ip, userAgent string,
) (*TransferResult, error) {
	if req.Amount.LessThanOrEqual(decimal.Zero) {
		return nil, ErrInvalidAmount
	}

	// 1. Fetch and validate source account
	var srcAcct models.Account
	if err := s.db.WithContext(ctx).Where("id = ?", req.SourceAccountID).First(&srcAcct).Error; err != nil {
		return nil, errors.New("source account not found")
	}

	if srcAcct.CustomerID != customerID {
		return nil, ErrAccountNotOwned
	}

	if srcAcct.Status != models.AccountStatusActive {
		return nil, errors.New("source account is not active")
	}

	// 2. Fetch and validate destination account
	var dstAcct models.Account
	if req.DestinationAccountID != nil && *req.DestinationAccountID != uuid.Nil {
		if err := s.db.WithContext(ctx).Where("id = ?", *req.DestinationAccountID).First(&dstAcct).Error; err != nil {
			return nil, errors.New("destination account not found")
		}
	} else if req.DestinationAccNumber != "" {
		if err := s.db.WithContext(ctx).Where("account_number = ?", req.DestinationAccNumber).First(&dstAcct).Error; err != nil {
			return nil, fmt.Errorf("destination account '%s' not found", req.DestinationAccNumber)
		}
	} else {
		return nil, errors.New("must specify destination account ID or destination account number")
	}

	if srcAcct.ID == dstAcct.ID {
		return nil, ErrSourceDestSame
	}

	// 3. Compute fees based on transfer type
	fee := decimal.Zero
	switch req.TransferType {
	case models.TransferInterbank:
		fee = decimal.NewFromFloat(1.50)
	case models.TransferBillPay:
		fee = decimal.NewFromFloat(0.50)
	default:
		req.TransferType = models.TransferInternal
	}

	// Pre-validation: Balance check
	if srcAcct.Balance.LessThan(req.Amount.Add(fee)) {
		return nil, ledger.ErrInsufficientBalance
	}

	// 4. Generate transaction record with INITIATED state
	txRef := fmt.Sprintf("TXN-%s-%d", time.Now().Format("20060102"), time.Now().UnixNano()%100000000)

	channel := req.Channel
	if channel == "" {
		channel = "WEB"
	}

	metaMap := map[string]interface{}{
		"ip_address": ip,
		"user_agent": userAgent,
		"channel":    channel,
	}
	metaJSON, _ := json.Marshal(metaMap)

	txRecord := models.Transaction{
		Reference:            txRef,
		SourceAccountID:      &srcAcct.ID,
		DestinationAccountID: &dstAcct.ID,
		TransferType:         req.TransferType,
		Amount:               req.Amount,
		Fee:                  fee,
		Status:               models.TxStatusInitiated,
		RiskDecision:         "PENDING",
		IdempotencyKey:       req.IdempotencyKey,
		Description:          req.Description,
		Metadata:             string(metaJSON),
		CreatedAt:            time.Now().UTC(),
		UpdatedAt:            time.Now().UTC(),
	}

	if err := s.db.WithContext(ctx).Create(&txRecord).Error; err != nil {
		return nil, fmt.Errorf("failed to initiate transaction: %w", err)
	}

	// Record status history: INITIATED -> VALIDATION -> RISK_ASSESSMENT
	s.recordStatusTransition(ctx, txRecord.ID, models.TxStatusInitiated, "Transaction received and validated")
	s.recordStatusTransition(ctx, txRecord.ID, models.TxStatusRiskAssessment, "Initiating multi-model fraud risk assessment")

	// 5. Assemble Real-Time ML Features
	features := s.assembleFraudFeatures(ctx, srcAcct, dstAcct, customerID, req.Amount, channel)

	fraudReq := fraud.FraudScoreRequest{
		TransactionID: txRecord.ID.String(),
		CustomerID:    customerID.String(),
		AccountContext: fraud.AccountContext{
			SourceAccountNumber:      srcAcct.AccountNumber,
			SourceAccountBalance:     srcAcct.Balance.InexactFloat64(),
			DestinationAccountNumber: dstAcct.AccountNumber,
		},
		TransactionFeatures: features,
		RecentSequence:      []float64{req.Amount.InexactFloat64()},
	}

	// 6. Call Python ML Microservice (with 150ms timeout)
	fraudResp, mlErr := s.fraudClient.ScoreTransaction(ctx, fraudReq)

	// Fallback check: If ML Service is down or timed out -> Fail Safe (HELD_FOR_REVIEW)
	if mlErr != nil {
		s.recordStatusTransition(ctx, txRecord.ID, models.TxStatusHeldForReview, fmt.Sprintf("ML Service unavailable: %v", mlErr))
		s.db.WithContext(ctx).Model(&txRecord).Updates(map[string]interface{}{
			"status":        models.TxStatusHeldForReview,
			"risk_decision": "HELD FOR REVIEW",
		})

		_ = s.auditSvc.Log(&userID, models.RoleCustomer, "TRANSFER_HELD", "TRANSACTION", txRecord.ID.String(), ip, "HOLD", map[string]interface{}{
			"reason": "ml_service_timeout",
			"error":  mlErr.Error(),
		})

		_, _ = s.notifSvc.Send(
			userID,
			"FRAUD_ALERT",
			"IN_APP",
			"Transfer Held for Security Review",
			fmt.Sprintf("Your transfer of %s %s is currently being reviewed by our security team.", srcAcct.Currency, req.Amount.StringFixed(2)),
			nil,
		)

		investigation.GlobalSSEHub.Broadcast("transaction_held", map[string]interface{}{
			"transaction_id": txRecord.ID,
			"reference":      txRecord.Reference,
			"amount":         txRecord.Amount,
			"status":         txRecord.Status,
			"reason":         "ml_service_timeout",
			"created_at":     txRecord.CreatedAt,
		})

		return &TransferResult{
			Transaction: &txRecord,
			RequiresOTP: false,
		}, nil
	}

	// 7. Process ML Scoring Results
	ensembleScoreDec := decimal.NewFromFloat(fraudResp.EnsembleScore)
	topShapJSON, _ := json.Marshal(fraudResp.TopSHAPFeatures)

	fraudScoreModel := models.FraudScore{
		TransactionID:      txRecord.ID,
		XGBScore:           decimal.NewFromFloat(fraudResp.XGBScore),
		IForestScore:       decimal.NewFromFloat(fraudResp.IForestScore),
		AutoencoderScore:   decimal.NewFromFloat(fraudResp.AutoencoderScore),
		EnsembleScore:      ensembleScoreDec,
		RiskClassification: fraudResp.RiskClassification,
		TopSHAPFeatures:    string(topShapJSON),
		ProcessingTimeMs:   fraudResp.ProcessingTimeMs,
		ModelVersion:       fraudResp.ModelVersion,
		CreatedAt:          time.Now().UTC(),
	}
	_ = s.db.WithContext(ctx).Create(&fraudScoreModel)

	txRecord.RiskScore = &ensembleScoreDec
	txRecord.RiskDecision = fraudResp.RiskClassification

	// Update Velocity Counters in Redis/Cache
	s.updateVelocityCounters(ctx, srcAcct.ID, req.Amount)

	var demoOTP string

	// 8. Execute Decision based on Configurable Thresholds
	if fraudResp.EnsembleScore < 30.0 {
		// LOW RISK: Auto-Approve and post double-entry ledger immediately
		txRecord.Status = models.TxStatusApproved
		s.db.WithContext(ctx).Model(&txRecord).Updates(map[string]interface{}{
			"status":        models.TxStatusApproved,
			"risk_score":    ensembleScoreDec,
			"risk_decision": models.RiskLow,
		})

		s.recordStatusTransition(ctx, txRecord.ID, models.TxStatusApproved, "Low risk auto-approval")

		// Post atomic double-entry ledger entries!
		completedTx, postErr := s.ledgerEngine.PostApprovedTransaction(ctx, txRecord.ID)
		if postErr != nil {
			s.recordStatusTransition(ctx, txRecord.ID, models.TxStatusRejected, fmt.Sprintf("Ledger posting failed: %v", postErr))
			return nil, postErr
		}

		_ = s.auditSvc.Log(&userID, models.RoleCustomer, "TRANSFER_COMPLETED", "TRANSACTION", txRecord.ID.String(), ip, "SUCCESS", map[string]interface{}{
			"amount": req.Amount,
			"risk":   fraudResp.EnsembleScore,
		})

		investigation.GlobalSSEHub.Broadcast("transaction_completed", map[string]interface{}{
			"transaction_id": completedTx.ID,
			"reference":      completedTx.Reference,
			"amount":         completedTx.Amount,
			"risk_score":     ensembleScoreDec,
			"status":         completedTx.Status,
			"created_at":     completedTx.CreatedAt,
		})

		return &TransferResult{
			Transaction: completedTx,
			FraudScore:  fraudResp,
			RequiresOTP: false,
		}, nil

	} else if fraudResp.EnsembleScore < 70.0 {
		// MEDIUM RISK: Step-up OTP required before posting
		txRecord.Status = models.TxStatusOTPRequired
		s.db.WithContext(ctx).Model(&txRecord).Updates(map[string]interface{}{
			"status":        models.TxStatusOTPRequired,
			"risk_score":    ensembleScoreDec,
			"risk_decision": models.RiskMedium,
		})

		s.recordStatusTransition(ctx, txRecord.ID, models.TxStatusOTPRequired, "Elevated risk score requiring step-up two-factor authentication")

		// Create Alert for analyst queue
		alert := models.FraudAlert{
			TransactionID: txRecord.ID,
			RiskScore:     ensembleScoreDec,
			Severity:      "MEDIUM",
			Status:        "PENDING",
			CreatedAt:     time.Now().UTC(),
			UpdatedAt:     time.Now().UTC(),
		}
		_ = s.db.WithContext(ctx).Create(&alert)

		investigation.GlobalSSEHub.Broadcast("fraud_alert", map[string]interface{}{
			"alert_id":       alert.ID,
			"transaction_id": txRecord.ID,
			"risk_score":     ensembleScoreDec,
			"severity":       "MEDIUM",
			"reference":      txRecord.Reference,
			"amount":         req.Amount,
			"status":         "PENDING",
			"created_at":     alert.CreatedAt,
		})

		// Request OTP
		code, _ := s.authSvc.RequestOTP(userID, "TRANSFER")
		demoOTP = code

		_ = s.auditSvc.Log(&userID, models.RoleCustomer, "TRANSFER_OTP_CHALLENGE", "TRANSACTION", txRecord.ID.String(), ip, "CHALLENGE", map[string]interface{}{
			"risk_score": fraudResp.EnsembleScore,
		})

		return &TransferResult{
			Transaction: &txRecord,
			FraudScore:  fraudResp,
			RequiresOTP: true,
			DemoOTP:     demoOTP,
		}, nil

	} else {
		// HIGH RISK: Blocked & Flagged
		txRecord.Status = models.TxStatusBlocked
		s.db.WithContext(ctx).Model(&txRecord).Updates(map[string]interface{}{
			"status":        models.TxStatusBlocked,
			"risk_score":    ensembleScoreDec,
			"risk_decision": models.RiskHigh,
		})

		s.recordStatusTransition(ctx, txRecord.ID, models.TxStatusBlocked, "Critical fraud risk threshold exceeded. Transaction blocked.")

		alert := models.FraudAlert{
			TransactionID: txRecord.ID,
			RiskScore:     ensembleScoreDec,
			Severity:      "HIGH",
			Status:        "PENDING",
			CreatedAt:     time.Now().UTC(),
			UpdatedAt:     time.Now().UTC(),
		}
		_ = s.db.WithContext(ctx).Create(&alert)

		investigation.GlobalSSEHub.Broadcast("fraud_alert", map[string]interface{}{
			"alert_id":       alert.ID,
			"transaction_id": txRecord.ID,
			"risk_score":     ensembleScoreDec,
			"severity":       "HIGH",
			"reference":      txRecord.Reference,
			"amount":         req.Amount,
			"status":         "PENDING",
			"created_at":     alert.CreatedAt,
		})

		_ = s.auditSvc.Log(&userID, models.RoleCustomer, "TRANSFER_BLOCKED", "TRANSACTION", txRecord.ID.String(), ip, "BLOCKED", map[string]interface{}{
			"risk_score": fraudResp.EnsembleScore,
		})

		_, _ = s.notifSvc.Send(
			userID,
			"FRAUD_ALERT",
			"IN_APP",
			"Transaction Blocked - High Risk Detected",
			fmt.Sprintf("Your transfer of %s %s was blocked by our automated fraud defense system. Contact support for investigation.", srcAcct.Currency, req.Amount.StringFixed(2)),
			map[string]interface{}{
				"transaction_id": txRecord.ID,
				"risk_score":     fraudResp.EnsembleScore,
			},
		)

		return &TransferResult{
			Transaction: &txRecord,
			FraudScore:  fraudResp,
			RequiresOTP: false,
		}, nil
	}
}

func (s *TransferService) VerifyTransferOTP(
	ctx context.Context,
	txID, userID uuid.UUID,
	code, ip string,
) (*models.Transaction, error) {
	var txRecord models.Transaction
	if err := s.db.WithContext(ctx).Where("id = ?", txID).First(&txRecord).Error; err != nil {
		return nil, ErrTransferNotFound
	}

	if txRecord.Status != models.TxStatusOTPRequired {
		return nil, ErrTransferNotPendingOTP
	}

	valid, err := s.authSvc.VerifyOTP(userID, "TRANSFER", code)
	if err != nil || !valid {
		return nil, errors.New("invalid or expired verification code")
	}

	// Transition to APPROVED
	txRecord.Status = models.TxStatusApproved
	s.db.WithContext(ctx).Model(&txRecord).Update("status", models.TxStatusApproved)
	s.recordStatusTransition(ctx, txRecord.ID, models.TxStatusApproved, "OTP challenge verified successfully")

	// Post Double-Entry Ledger!
	completedTx, err := s.ledgerEngine.PostApprovedTransaction(ctx, txRecord.ID)
	if err != nil {
		return nil, err
	}

	_ = s.auditSvc.Log(&userID, models.RoleCustomer, "TRANSFER_OTP_VERIFIED", "TRANSACTION", txRecord.ID.String(), ip, "SUCCESS", nil)

	investigation.GlobalSSEHub.Broadcast("transaction_completed", map[string]interface{}{
		"transaction_id": completedTx.ID,
		"reference":      completedTx.Reference,
		"amount":         completedTx.Amount,
		"risk_score":     completedTx.RiskScore,
		"status":         completedTx.Status,
		"created_at":     completedTx.CreatedAt,
	})

	return completedTx, nil
}

func (s *TransferService) CancelTransfer(ctx context.Context, txID, userID uuid.UUID, ip string) error {
	var txRecord models.Transaction
	if err := s.db.WithContext(ctx).Where("id = ?", txID).First(&txRecord).Error; err != nil {
		return ErrTransferNotFound
	}

	if txRecord.Status != models.TxStatusOTPRequired && txRecord.Status != models.TxStatusHeldForReview && txRecord.Status != models.TxStatusInitiated {
		return ErrTransferCannotCancel
	}

	txRecord.Status = models.TxStatusCancelled
	s.db.WithContext(ctx).Model(&txRecord).Update("status", models.TxStatusCancelled)
	s.recordStatusTransition(ctx, txRecord.ID, models.TxStatusCancelled, "Cancelled by user request")

	_ = s.auditSvc.Log(&userID, models.RoleCustomer, "TRANSFER_CANCELLED", "TRANSACTION", txRecord.ID.String(), ip, "SUCCESS", nil)
	return nil
}

// Helpers
func (s *TransferService) recordStatusTransition(ctx context.Context, txID uuid.UUID, status, reason string) {
	history := models.TransactionStatusHistory{
		TransactionID: txID,
		Status:        status,
		Reason:        reason,
		CreatedAt:     time.Now().UTC(),
	}
	_ = s.db.WithContext(ctx).Create(&history)
}

func (s *TransferService) assembleFraudFeatures(
	ctx context.Context,
	srcAcct, dstAcct models.Account,
	customerID uuid.UUID,
	amount decimal.Decimal,
	channel string,
) fraud.TransactionFeatures {
	now := time.Now().UTC()
	hour := now.Hour()
	dayOfWeek := int(now.Weekday())
	isWeekend := dayOfWeek == 0 || dayOfWeek == 6

	// Historical customer average transaction amount
	var avgAmt float64
	var countHistory int64
	s.db.WithContext(ctx).Model(&models.Transaction{}).
		Select("COALESCE(AVG(amount), 0)").
		Where("source_account_id = ? AND status = ?", srcAcct.ID, models.TxStatusCompleted).
		Scan(&avgAmt)

	s.db.WithContext(ctx).Model(&models.Transaction{}).
		Where("source_account_id = ? AND status = ?", srcAcct.ID, models.TxStatusCompleted).
		Count(&countHistory)

	if avgAmt <= 0 {
		avgAmt = 250.0 // Baseline default
	}

	amtFloat := amount.InexactFloat64()
	amtDev := (amtFloat - avgAmt) / avgAmt

	// Beneficiary verification
	var benCount int64
	s.db.WithContext(ctx).Model(&models.Beneficiary{}).
		Where("customer_id = ? AND account_number = ?", customerID, dstAcct.AccountNumber).
		Count(&benCount)
	isNewBen := benCount == 0

	// Velocity from Redis/Cache
	tx1mKey := fmt.Sprintf("velocity:cnt:1m:%s", srcAcct.ID)
	tx1hKey := fmt.Sprintf("velocity:cnt:1h:%s", srcAcct.ID)
	tx24hKey := fmt.Sprintf("velocity:cnt:24h:%s", srcAcct.ID)
	sum1hKey := fmt.Sprintf("velocity:sum:1h:%s", srcAcct.ID)
	sum24hKey := fmt.Sprintf("velocity:sum:24h:%s", srcAcct.ID)

	c1mStr, _ := s.cache.Get(ctx, tx1mKey)
	c1hStr, _ := s.cache.Get(ctx, tx1hKey)
	c24hStr, _ := s.cache.Get(ctx, tx24hKey)
	s1hStr, _ := s.cache.Get(ctx, sum1hKey)
	s24hStr, _ := s.cache.Get(ctx, sum24hKey)

	drainRatio := 0.0
	if srcAcct.Balance.GreaterThan(decimal.Zero) {
		drainRatio = amtFloat / srcAcct.Balance.InexactFloat64()
	}

	return fraud.TransactionFeatures{
		Amount:                amtFloat,
		TransferType:          "INTERNAL",
		TransactionHour:       hour,
		DayOfWeek:             dayOfWeek,
		IsWeekend:             isWeekend,
		TransactionChannel:    channel,
		AvgTransactionAmount:  avgAmt,
		TxAmountDeviation:     amtDev,
		HistoricalTxFrequency: float64(countHistory),
		IsNewBeneficiary:      isNewBen,
		IsNewDevice:           false,
		IsNewIP:               false,
		GeoDistanceKm:         12.5,
		TxCount1m:             parseInt(c1mStr),
		TxCount1h:             parseInt(c1hStr),
		TxCount24h:            parseInt(c24hStr),
		TxSum1h:               parseFloat(s1hStr),
		TxSum24h:              parseFloat(s24hStr),
		BalanceDrainRatio:     drainRatio,
		FailedLoginCount:      0,
	}
}

func (s *TransferService) updateVelocityCounters(ctx context.Context, acctID uuid.UUID, amount decimal.Decimal) {
	tx1mKey := fmt.Sprintf("velocity:cnt:1m:%s", acctID)
	tx1hKey := fmt.Sprintf("velocity:cnt:1h:%s", acctID)
	tx24hKey := fmt.Sprintf("velocity:cnt:24h:%s", acctID)
	sum1hKey := fmt.Sprintf("velocity:sum:1h:%s", acctID)
	sum24hKey := fmt.Sprintf("velocity:sum:24h:%s", acctID)

	_, _ = s.cache.Incr(ctx, tx1mKey)
	_, _ = s.cache.Expire(ctx, tx1mKey, 1*time.Minute)

	_, _ = s.cache.Incr(ctx, tx1hKey)
	_, _ = s.cache.Expire(ctx, tx1hKey, 1*time.Hour)

	_, _ = s.cache.Incr(ctx, tx24hKey)
	_, _ = s.cache.Expire(ctx, tx24hKey, 24*time.Hour)

	amtCents := amount.Mul(decimal.NewFromInt(100)).IntPart()
	_, _ = s.cache.IncrBy(ctx, sum1hKey, amtCents)
	_, _ = s.cache.Expire(ctx, sum1hKey, 1*time.Hour)

	_, _ = s.cache.IncrBy(ctx, sum24hKey, amtCents)
	_, _ = s.cache.Expire(ctx, sum24hKey, 24*time.Hour)
}

func parseInt(s string) int {
	var val int
	fmt.Sscanf(strings.TrimSpace(s), "%d", &val)
	return val
}

func parseFloat(s string) float64 {
	var val float64
	fmt.Sscanf(strings.TrimSpace(s), "%f", &val)
	return val / 100.0 // Converted from cents
}
