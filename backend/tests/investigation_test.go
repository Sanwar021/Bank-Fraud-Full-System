package tests

import (
	"context"
	"testing"
	"time"

	"github.com/bank-investigation/backend/internal/audit"
	"github.com/bank-investigation/backend/internal/config"
	"github.com/bank-investigation/backend/internal/database"
	"github.com/bank-investigation/backend/internal/investigation"
	"github.com/bank-investigation/backend/internal/ledger"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

func TestInvestigationMetricsAndAdjudication(t *testing.T) {
	cfg, err := config.LoadConfig()
	if err != nil {
		t.Fatalf("config error: %v", err)
	}

	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		t.Fatalf("db connection error: %v", err)
	}

	auditSvc := audit.NewAuditService(db)
	ledgerEngine := ledger.NewLedgerEngine(db)
	invSvc := investigation.NewInvestigationService(db, ledgerEngine, auditSvc)

	ctx := context.Background()

	// 1. Test Overview Metrics
	overview, err := invSvc.GetOverviewMetrics(ctx)
	if err != nil {
		t.Fatalf("failed to get overview: %v", err)
	}
	if overview == nil || overview.TotalTransactions < 0 {
		t.Fatalf("invalid overview metrics: %+v", overview)
	}

	// 2. Setup a test transaction & alert that is HELD_FOR_REVIEW
	suffix := uuid.New().String()[:8]
	analystUser := models.User{
		Email:        "test-analyst-" + suffix + "@bankinvestigation.com",
		PasswordHash: "hashed",
		RoleID:       models.RoleFraudAnalyst,
		IsActive:     true,
	}
	if err := db.Create(&analystUser).Error; err != nil {
		t.Fatalf("failed to create analyst: %v", err)
	}

	custUser := models.User{
		Email:        "test-inv-cust-" + suffix + "@bankinvestigation.com",
		PasswordHash: "hashed",
		RoleID:       models.RoleCustomer,
		IsActive:     true,
	}
	if err := db.Create(&custUser).Error; err != nil {
		t.Fatalf("failed to create cust user: %v", err)
	}

	customer := models.Customer{
		UserID:     custUser.ID,
		FirstName:  "Invest",
		LastName:   "Customer",
		Phone:      "+1555" + suffix,
		NationalID: "NID-" + suffix,
		KYCStatus:  "VERIFIED",
	}
	if err := db.Create(&customer).Error; err != nil {
		t.Fatalf("failed to create customer: %v", err)
	}

	srcAcct := models.Account{
		CustomerID:    customer.ID,
		AccountNumber: "ACC-SRC-" + suffix,
		AccountType:   models.AccountSavings,
		Currency:      "USD",
		Status:        models.AccountStatusActive,
		Balance:       decimal.NewFromFloat(5000),
		DailyLimit:    decimal.NewFromFloat(50000),
		PerTxLimit:    decimal.NewFromFloat(10000),
	}
	dstAcct := models.Account{
		CustomerID:    customer.ID,
		AccountNumber: "ACC-DST-" + suffix,
		AccountType:   models.AccountCurrent,
		Currency:      "USD",
		Status:        models.AccountStatusActive,
		Balance:       decimal.NewFromFloat(100),
		DailyLimit:    decimal.NewFromFloat(50000),
		PerTxLimit:    decimal.NewFromFloat(10000),
	}
	if err := db.Create(&srcAcct).Error; err != nil {
		t.Fatalf("failed to create src acct: %v", err)
	}
	if err := db.Create(&dstAcct).Error; err != nil {
		t.Fatalf("failed to create dst acct: %v", err)
	}

	riskScore := decimal.NewFromFloat(78.5)
	txRecord := models.Transaction{
		Reference:            "TXN-INV-" + suffix,
		SourceAccountID:      &srcAcct.ID,
		DestinationAccountID: &dstAcct.ID,
		TransferType:         models.TransferInternal,
		Amount:               decimal.NewFromFloat(750),
		Fee:                  decimal.Zero,
		Status:               models.TxStatusHeldForReview,
		RiskScore:            &riskScore,
		RiskDecision:         models.RiskHigh,
		Description:          "Held for review test transaction",
		CreatedAt:            time.Now().UTC(),
		UpdatedAt:            time.Now().UTC(),
	}
	if err := db.Create(&txRecord).Error; err != nil {
		t.Fatalf("failed to create tx: %v", err)
	}

	alert := models.FraudAlert{
		TransactionID: txRecord.ID,
		RiskScore:     riskScore,
		Severity:      "HIGH",
		Status:        "PENDING",
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}
	if err := db.Create(&alert).Error; err != nil {
		t.Fatalf("failed to create alert: %v", err)
	}

	// 3. Test GetAlertDetails
	details, err := invSvc.GetAlertDetails(ctx, alert.ID)
	if err != nil {
		t.Fatalf("failed to get alert details: %v", err)
	}
	if details.ID != alert.ID || details.TransactionID != txRecord.ID || details.Severity != "HIGH" {
		t.Fatalf("unexpected alert details: %+v", details)
	}

	// 4. Test AdjudicateAlert: RELEASED
	adjReq := investigation.AdjudicateRequest{
		Decision: "RELEASED",
		Reason:   "Customer phoned in and confirmed legitimate transaction",
		Notes:    "Customer verified by security passphrase",
	}
	err = invSvc.AdjudicateAlert(ctx, alert.ID, analystUser.ID, adjReq, "127.0.0.1")
	if err != nil {
		t.Fatalf("failed to adjudicate alert: %v", err)
	}

	// Verify alert is marked RESOLVED
	var updatedAlert models.FraudAlert
	if err := db.First(&updatedAlert, alert.ID).Error; err != nil {
		t.Fatalf("failed to load updated alert: %v", err)
	}
	if updatedAlert.Status != "RESOLVED" {
		t.Fatalf("expected alert status RESOLVED, got %s", updatedAlert.Status)
	}

	// Verify transaction is now COMPLETED
	var updatedTx models.Transaction
	if err := db.First(&updatedTx, txRecord.ID).Error; err != nil {
		t.Fatalf("failed to load updated tx: %v", err)
	}
	if updatedTx.Status != models.TxStatusCompleted {
		t.Fatalf("expected tx status COMPLETED, got %s", updatedTx.Status)
	}

	// Verify ledger entries were created and balanced
	var entries []models.LedgerEntry
	if err := db.Where("transaction_id = ?", txRecord.ID).Find(&entries).Error; err != nil {
		t.Fatalf("failed to load ledger entries: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 ledger entries, got %d", len(entries))
	}

	var debits, credits decimal.Decimal
	for _, entry := range entries {
		if entry.EntryType == models.EntryDebit {
			debits = debits.Add(entry.Amount)
		} else if entry.EntryType == models.EntryCredit {
			credits = credits.Add(entry.Amount)
		}
	}
	if !debits.Equal(credits) || !debits.Equal(decimal.NewFromFloat(750)) {
		t.Fatalf("ledger entries unbalanced: debits=%s, credits=%s", debits, credits)
	}

	// Verify updated account balances
	var updatedSrc, updatedDst models.Account
	_ = db.First(&updatedSrc, srcAcct.ID).Error
	_ = db.First(&updatedDst, dstAcct.ID).Error
	if !updatedSrc.Balance.Equal(decimal.NewFromFloat(4250)) {
		t.Fatalf("source account balance incorrect: expected 4250, got %s", updatedSrc.Balance)
	}
	if !updatedDst.Balance.Equal(decimal.NewFromFloat(850)) {
		t.Fatalf("destination account balance incorrect: expected 850, got %s", updatedDst.Balance)
	}
}
