package tests

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bank-investigation/backend/internal/audit"
	"github.com/bank-investigation/backend/internal/auth"
	"github.com/bank-investigation/backend/internal/config"
	"github.com/bank-investigation/backend/internal/database"
	"github.com/bank-investigation/backend/internal/fraud"
	"github.com/bank-investigation/backend/internal/investigation"
	"github.com/bank-investigation/backend/internal/ledger"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/bank-investigation/backend/internal/notifications"
	"github.com/bank-investigation/backend/internal/transfers"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// TestE2EComprehensiveBankingAndFraudPipeline tests all 4 core scenarios end-to-end.
func TestE2EComprehensiveBankingAndFraudPipeline(t *testing.T) {
	cfg, err := config.LoadConfig()
	if err != nil {
		t.Fatalf("config error: %v", err)
	}

	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		t.Fatalf("db connection error: %v", err)
	}

	cache := database.NewCacheService(cfg)
	jwtSvc := auth.NewJWTService(cfg.JWTSecret, cfg.JWTAccessExpiry, cfg.JWTRefreshExpiry)
	auditSvc := audit.NewAuditService(db)
	notifSvc := notifications.NewNotificationService(db)
	authSvc := auth.NewAuthService(db, jwtSvc, cache, auditSvc, notifSvc)
	ledgerEngine := ledger.NewLedgerEngine(db)
	invSvc := investigation.NewInvestigationService(db, ledgerEngine, auditSvc)

	// Mock ML HTTP server that responds with LOW RISK
	mockLowMLServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"transaction_id": "test-tx",
			"customer_id": "test-cust",
			"ensemble_score": 14.5,
			"risk_classification": "LOW RISK",
			"xgb_score": 12.0,
			"iforest_score": 15.0,
			"autoencoder_score": 16.5,
			"top_shap_features": [
				{
					"feature": "amount",
					"value": 50.0,
					"shap_value": -0.42,
					"contribution": "DECREASES_RISK",
					"description": "Routine amount"
				}
			],
			"processing_time_ms": 32,
			"model_version": "v1.0.0"
		}`))
	}))
	defer mockLowMLServer.Close()

	ctx := context.Background()
	suffix := uuid.New().String()[:8]

	// Create test customer & accounts
	user := models.User{
		Email:        "e2e-user-" + suffix + "@bankinvestigation.com",
		PasswordHash: "hashed",
		RoleID:       models.RoleCustomer,
		IsActive:     true,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	analystUser := models.User{
		Email:        "e2e-analyst-" + suffix + "@bankinvestigation.com",
		PasswordHash: "hashed",
		RoleID:       models.RoleFraudAnalyst,
		IsActive:     true,
	}
	if err := db.Create(&analystUser).Error; err != nil {
		t.Fatalf("failed to create analyst: %v", err)
	}

	cust := models.Customer{
		UserID:     user.ID,
		FirstName:  "E2E",
		LastName:   "Tester",
		Phone:      "+1555" + suffix,
		NationalID: "NID-E2E-" + suffix,
		KYCStatus:  "VERIFIED",
	}
	if err := db.Create(&cust).Error; err != nil {
		t.Fatalf("failed to create customer: %v", err)
	}

	srcAcct := models.Account{
		CustomerID:    cust.ID,
		AccountNumber: "ACC-SRC-" + suffix,
		AccountType:   models.AccountSavings,
		Currency:      "USD",
		Status:        models.AccountStatusActive,
		Balance:       decimal.NewFromFloat(10000.00),
		DailyLimit:    decimal.NewFromFloat(50000.00),
		PerTxLimit:    decimal.NewFromFloat(20000.00),
	}
	dstAcct := models.Account{
		CustomerID:    cust.ID,
		AccountNumber: "ACC-DST-" + suffix,
		AccountType:   models.AccountCurrent,
		Currency:      "USD",
		Status:        models.AccountStatusActive,
		Balance:       decimal.NewFromFloat(500.00),
		DailyLimit:    decimal.NewFromFloat(50000.00),
		PerTxLimit:    decimal.NewFromFloat(20000.00),
	}
	if err := db.Create(&srcAcct).Error; err != nil {
		t.Fatalf("failed to create src acct: %v", err)
	}
	if err := db.Create(&dstAcct).Error; err != nil {
		t.Fatalf("failed to create dst acct: %v", err)
	}

	// =========================================================================
	// SCENARIO 1: Normal Low-Risk Transfer ($50.00) -> Auto-Approved & Posted
	// =========================================================================
	t.Run("Scenario1_LowRiskAutoApproval", func(t *testing.T) {
		fraudClient := fraud.NewFraudClient(mockLowMLServer.URL, 2*time.Second)
		transferSvc := transfers.NewTransferService(db, ledgerEngine, fraudClient, cache, auditSvc, notifSvc, authSvc)

		res, err := transferSvc.InitiateTransfer(ctx, transfers.InitiateTransferRequest{
			SourceAccountID:      srcAcct.ID,
			DestinationAccountID: &dstAcct.ID,
			TransferType:         models.TransferInternal,
			Amount:               decimal.NewFromFloat(50.00),
			Description:          "Low risk dinner split",
		}, cust.ID, user.ID, "127.0.0.1", "Chrome")

		if err != nil {
			t.Fatalf("transfer failed: %v", err)
		}
		if res.RequiresOTP {
			t.Fatalf("expected low risk to NOT require OTP")
		}
		if res.Transaction.Status != models.TxStatusCompleted {
			t.Fatalf("expected transaction status COMPLETED, got %s", res.Transaction.Status)
		}

		// Verify double-entry ledger balance
		var entries []models.LedgerEntry
		if err := db.Where("transaction_id = ?", res.Transaction.ID).Find(&entries).Error; err != nil {
			t.Fatalf("failed to find ledger entries: %v", err)
		}
		if len(entries) != 2 {
			t.Fatalf("expected 2 ledger entries, got %d", len(entries))
		}

		var debits, credits decimal.Decimal
		for _, e := range entries {
			if e.EntryType == models.EntryDebit {
				debits = debits.Add(e.Amount)
			} else {
				credits = credits.Add(e.Amount)
			}
		}
		if !debits.Equal(credits) || !debits.Equal(decimal.NewFromFloat(50.00)) {
			t.Fatalf("unbalanced ledger entries: debit=%s, credit=%s", debits, credits)
		}

		// Verify balances
		var updatedSrc models.Account
		_ = db.First(&updatedSrc, srcAcct.ID)
		if !updatedSrc.Balance.Equal(decimal.NewFromFloat(9950.00)) {
			t.Fatalf("expected src balance 9950.00, got %s", updatedSrc.Balance)
		}
	})

	// =========================================================================
	// SCENARIO 2: Medium-Risk Velocity Spike -> Step-up OTP -> Verified -> Posted
	// =========================================================================
	t.Run("Scenario2_MediumRiskStepUpOTP", func(t *testing.T) {
		mediumMLServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"transaction_id": "test-med",
				"customer_id": "test-cust",
				"ensemble_score": 48.5,
				"risk_classification": "MEDIUM RISK",
				"xgb_score": 52.0,
				"iforest_score": 45.0,
				"autoencoder_score": 48.5,
				"top_shap_features": [
					{
						"feature": "velocity_1h",
						"value": 1500.0,
						"shap_value": 0.58,
						"contribution": "INCREASES_RISK",
						"description": "Sudden volume spike"
					}
				],
				"processing_time_ms": 38,
				"model_version": "v1.0.0"
			}`))
		}))
		defer mediumMLServer.Close()

		fraudClient := fraud.NewFraudClient(mediumMLServer.URL, 2*time.Second)
		transferSvc := transfers.NewTransferService(db, ledgerEngine, fraudClient, cache, auditSvc, notifSvc, authSvc)

		res, err := transferSvc.InitiateTransfer(ctx, transfers.InitiateTransferRequest{
			SourceAccountID:      srcAcct.ID,
			DestinationAccountID: &dstAcct.ID,
			TransferType:         models.TransferInternal,
			Amount:               decimal.NewFromFloat(1500.00),
			Description:          "Medium risk electronics purchase",
		}, cust.ID, user.ID, "127.0.0.1", "Chrome")

		if err != nil {
			t.Fatalf("transfer failed: %v", err)
		}
		if !res.RequiresOTP {
			t.Fatalf("expected medium risk to require OTP")
		}
		if res.Transaction.Status != models.TxStatusOTPRequired {
			t.Fatalf("expected status OTP_REQUIRED, got %s", res.Transaction.Status)
		}

		// Ensure no ledger entries were created yet!
		var entriesBefore []models.LedgerEntry
		_ = db.Where("transaction_id = ?", res.Transaction.ID).Find(&entriesBefore)
		if len(entriesBefore) != 0 {
			t.Fatalf("ledger entries must NOT be created before OTP verification, found: %d", len(entriesBefore))
		}

		// Verify OTP with demo OTP code
		if res.DemoOTP == "" {
			t.Fatalf("expected demo OTP to be generated")
		}

		completedTx, err := transferSvc.VerifyTransferOTP(ctx, res.Transaction.ID, user.ID, res.DemoOTP, "127.0.0.1")
		if err != nil {
			t.Fatalf("failed to verify OTP: %v", err)
		}
		if completedTx.Status != models.TxStatusCompleted {
			t.Fatalf("expected status COMPLETED after OTP, got %s", completedTx.Status)
		}

		// Verify ledger entries are now posted
		var entriesAfter []models.LedgerEntry
		_ = db.Where("transaction_id = ?", res.Transaction.ID).Find(&entriesAfter)
		if len(entriesAfter) != 2 {
			t.Fatalf("expected 2 ledger entries after OTP verification, got %d", len(entriesAfter))
		}
	})

	// =========================================================================
	// SCENARIO 3: High-Risk Sudden Drain / ATO -> Automated Block & Fraud Alert
	// =========================================================================
	t.Run("Scenario3_HighRiskAutomatedBlock", func(t *testing.T) {
		highMLServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"transaction_id": "test-high",
				"customer_id": "test-cust",
				"ensemble_score": 88.5,
				"risk_classification": "HIGH RISK",
				"xgb_score": 92.0,
				"iforest_score": 85.0,
				"autoencoder_score": 88.5,
				"top_shap_features": [
					{
						"feature": "balance_drain_ratio",
						"value": 0.95,
						"shap_value": 0.88,
						"contribution": "INCREASES_RISK",
						"description": "Total balance drain"
					}
				],
				"processing_time_ms": 45,
				"model_version": "v1.0.0"
			}`))
		}))
		defer highMLServer.Close()

		fraudClient := fraud.NewFraudClient(highMLServer.URL, 2*time.Second)
		transferSvc := transfers.NewTransferService(db, ledgerEngine, fraudClient, cache, auditSvc, notifSvc, authSvc)

		res, err := transferSvc.InitiateTransfer(ctx, transfers.InitiateTransferRequest{
			SourceAccountID:      srcAcct.ID,
			DestinationAccountID: &dstAcct.ID,
			TransferType:         models.TransferInternal,
			Amount:               decimal.NewFromFloat(5000.00),
			Description:          "Critical attack - Account takeover pattern",
		}, cust.ID, user.ID, "127.0.0.1", "Postman")

		if err != nil {
			t.Fatalf("transfer failed: %v", err)
		}
		if res.Transaction.Status != models.TxStatusBlocked {
			t.Fatalf("expected status BLOCKED, got %s", res.Transaction.Status)
		}

		// Ensure ZERO ledger entries were posted
		var entries []models.LedgerEntry
		_ = db.Where("transaction_id = ?", res.Transaction.ID).Find(&entries)
		if len(entries) != 0 {
			t.Fatalf("blocked transaction must NOT post to ledger, found: %d entries", len(entries))
		}

		// Verify fraud alert was created in database
		var alert models.FraudAlert
		if err := db.Where("transaction_id = ?", res.Transaction.ID).First(&alert).Error; err != nil {
			t.Fatalf("expected fraud alert in database: %v", err)
		}
		if alert.Severity != "HIGH" {
			t.Fatalf("expected HIGH severity alert, got %s", alert.Severity)
		}
	})

	// =========================================================================
	// SCENARIO 4: ML Engine Unavailable -> Fail-Safe HELD_FOR_REVIEW -> Analyst Release
	// =========================================================================
	t.Run("Scenario4_FailSafeHoldAndAnalystRelease", func(t *testing.T) {
		// Offline port to simulate ML engine failure / network timeout
		deadMLClient := fraud.NewFraudClient("http://127.0.0.1:59998", 50*time.Millisecond)
		transferSvc := transfers.NewTransferService(db, ledgerEngine, deadMLClient, cache, auditSvc, notifSvc, authSvc)

		res, err := transferSvc.InitiateTransfer(ctx, transfers.InitiateTransferRequest{
			SourceAccountID:      srcAcct.ID,
			DestinationAccountID: &dstAcct.ID,
			TransferType:         models.TransferInternal,
			Amount:               decimal.NewFromFloat(300.00),
			Description:          "Held for review due to ML timeout",
		}, cust.ID, user.ID, "127.0.0.1", "WebBrowser")

		if err != nil {
			t.Fatalf("transfer failed: %v", err)
		}
		if res.Transaction.Status != models.TxStatusHeldForReview {
			t.Fatalf("expected HELD_FOR_REVIEW status, got %s", res.Transaction.Status)
		}

		// Ensure no ledger entries were created
		var entriesBefore []models.LedgerEntry
		_ = db.Where("transaction_id = ?", res.Transaction.ID).Find(&entriesBefore)
		if len(entriesBefore) != 0 {
			t.Fatalf("held transaction must NOT post to ledger, found: %d entries", len(entriesBefore))
		}

		// Create alert record for analyst triage
		alert := models.FraudAlert{
			TransactionID: res.Transaction.ID,
			RiskScore:     decimal.NewFromFloat(50.0),
			Severity:      "MEDIUM",
			Status:        "PENDING",
			CreatedAt:     time.Now().UTC(),
			UpdatedAt:     time.Now().UTC(),
		}
		if err := db.Create(&alert).Error; err != nil {
			t.Fatalf("failed to create alert: %v", err)
		}

		// Analyst adjudicates alert: RELEASED
		adjReq := investigation.AdjudicateRequest{
			Decision: "RELEASED",
			Reason:   "Analyst manual verification passed during ML outage",
			Notes:    "Customer verified by voice phone code",
		}

		err = invSvc.AdjudicateAlert(ctx, alert.ID, analystUser.ID, adjReq, "127.0.0.1")
		if err != nil {
			t.Fatalf("failed to adjudicate alert: %v", err)
		}

		// Verify transaction is now COMPLETED and ledger entries posted!
		var updatedTx models.Transaction
		_ = db.First(&updatedTx, res.Transaction.ID)
		if updatedTx.Status != models.TxStatusCompleted {
			t.Fatalf("expected transaction status COMPLETED after release, got %s", updatedTx.Status)
		}

		var entriesAfter []models.LedgerEntry
		_ = db.Where("transaction_id = ?", res.Transaction.ID).Find(&entriesAfter)
		if len(entriesAfter) != 2 {
			t.Fatalf("expected 2 ledger entries after analyst release, got %d", len(entriesAfter))
		}
	})
}
