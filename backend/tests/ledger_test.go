package tests

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/bank-investigation/backend/internal/audit"
	"github.com/bank-investigation/backend/internal/auth"
	"github.com/bank-investigation/backend/internal/config"
	"github.com/bank-investigation/backend/internal/database"
	"github.com/bank-investigation/backend/internal/fraud"
	"github.com/bank-investigation/backend/internal/ledger"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/bank-investigation/backend/internal/notifications"
	"github.com/bank-investigation/backend/internal/transfers"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

func setupLedgerTestEnv(t *testing.T) (*gorm.DB, *ledger.LedgerEngine, *transfers.TransferService, *models.Customer, *models.Account, *models.Account) {
	cfg, err := config.LoadConfig()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		t.Fatalf("Failed to connect to test DB: %v", err)
	}

	cache := database.NewInMemoryCache()
	jwtSvc := auth.NewJWTService("test-secret-key-32-chars-long!", 15*time.Minute, 24*time.Hour)
	auditSvc := audit.NewAuditService(db)
	notifSvc := notifications.NewNotificationService(db)
	authSvc := auth.NewAuthService(db, jwtSvc, cache, auditSvc, notifSvc)

	ledgerEngine := ledger.NewLedgerEngine(db)
	// Point to dummy address so ML fails safe (or times out)
	fraudClient := fraud.NewFraudClient("http://127.0.0.1:59999", 50*time.Millisecond)
	transferSvc := transfers.NewTransferService(db, ledgerEngine, fraudClient, cache, auditSvc, notifSvc, authSvc)

	// Create test customer
	custUserID := uuid.New()
	user := models.User{
		ID:           custUserID,
		Email:        fmt.Sprintf("ledger-%s@bankinvestigation.com", custUserID.String()[:8]),
		PasswordHash: "hashed",
		RoleID:       models.RoleCustomer,
		IsActive:     true,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	db.Create(&user)

	cust := models.Customer{
		UserID:        user.ID,
		FirstName:     "Ledger",
		LastName:      "Tester",
		Phone:         "+15550009999",
		NationalID:    fmt.Sprintf("NID-LT-%s", custUserID.String()[:8]),
		KYCStatus:     "VERIFIED",
		RiskTier:      "STANDARD",
		MonthlyIncome: decimal.NewFromFloat(5000.0),
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}
	db.Create(&cust)

	// Create Account A ($1,000.00)
	acctA := models.Account{
		CustomerID:    cust.ID,
		AccountNumber: fmt.Sprintf("ACC-A-%s", custUserID.String()[:8]),
		AccountType:   models.AccountSavings,
		Currency:      "USD",
		Status:        models.AccountStatusActive,
		Balance:       decimal.NewFromFloat(1000.0000),
		DailyLimit:    decimal.NewFromFloat(2000.0000),
		PerTxLimit:    decimal.NewFromFloat(1000.0000),
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}
	db.Create(&acctA)

	// Create Account B ($200.00)
	acctB := models.Account{
		CustomerID:    cust.ID,
		AccountNumber: fmt.Sprintf("ACC-B-%s", custUserID.String()[:8]),
		AccountType:   models.AccountCurrent,
		Currency:      "USD",
		Status:        models.AccountStatusActive,
		Balance:       decimal.NewFromFloat(200.0000),
		DailyLimit:    decimal.NewFromFloat(5000.0000),
		PerTxLimit:    decimal.NewFromFloat(2000.0000),
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}
	db.Create(&acctB)

	return db, ledgerEngine, transferSvc, &cust, &acctA, &acctB
}

func TestDoubleEntryLedgerBalancing(t *testing.T) {
	db, ledgerEngine, _, _, acctA, acctB := setupLedgerTestEnv(t)
	ctx := context.Background()

	transferAmount := decimal.NewFromFloat(250.0000)

	// Create an approved transaction
	tx := models.Transaction{
		Reference:            fmt.Sprintf("TEST-BAL-%s", uuid.New().String()[:8]),
		SourceAccountID:      &acctA.ID,
		DestinationAccountID: &acctB.ID,
		TransferType:         models.TransferInternal,
		Amount:               transferAmount,
		Fee:                  decimal.Zero,
		Status:               models.TxStatusApproved,
		RiskDecision:         models.RiskLow,
		Description:          "Double-entry balancing test transfer",
		Metadata:             "{}",
		CreatedAt:            time.Now().UTC(),
		UpdatedAt:            time.Now().UTC(),
	}
	if err := db.Create(&tx).Error; err != nil {
		t.Fatalf("Failed to create test transaction: %v", err)
	}

	// Post the transaction via double-entry engine
	completedTx, err := ledgerEngine.PostApprovedTransaction(ctx, tx.ID)
	if err != nil {
		t.Fatalf("Failed to post approved transaction: %v", err)
	}

	if completedTx.Status != models.TxStatusCompleted {
		t.Fatalf("Expected transaction status COMPLETED, got %s", completedTx.Status)
	}

	// Verify ledger entries
	var entries []models.LedgerEntry
	if err := db.Where("transaction_id = ?", tx.ID).Find(&entries).Error; err != nil {
		t.Fatalf("Failed to fetch ledger entries: %v", err)
	}

	if len(entries) != 2 {
		t.Fatalf("Expected exactly 2 ledger entries (1 Debit, 1 Credit), got %d", len(entries))
	}

	totalDebits := decimal.Zero
	totalCredits := decimal.Zero

	for _, e := range entries {
		if e.EntryType == models.EntryDebit {
			totalDebits = totalDebits.Add(e.Amount)
			if e.AccountID != acctA.ID {
				t.Fatalf("Debit entry should belong to source account A, got %s", e.AccountID)
			}
		} else if e.EntryType == models.EntryCredit {
			totalCredits = totalCredits.Add(e.Amount)
			if e.AccountID != acctB.ID {
				t.Fatalf("Credit entry should belong to destination account B, got %s", e.AccountID)
			}
		}
	}

	// Accounting invariant: Debits == Credits
	if !totalDebits.Equal(totalCredits) {
		t.Fatalf("FATAL: Debits (%s) != Credits (%s)", totalDebits, totalCredits)
	}

	if !totalDebits.Equal(transferAmount) {
		t.Fatalf("Expected total debits %s, got %s", transferAmount, totalDebits)
	}

	// Verify account balances
	var updatedA, updatedB models.Account
	db.Where("id = ?", acctA.ID).First(&updatedA)
	db.Where("id = ?", acctB.ID).First(&updatedB)

	expectedA := decimal.NewFromFloat(750.0000) // 1000 - 250
	expectedB := decimal.NewFromFloat(450.0000) // 200 + 250

	if !updatedA.Balance.Equal(expectedA) {
		t.Fatalf("Expected Account A balance %s, got %s", expectedA, updatedA.Balance)
	}
	if !updatedB.Balance.Equal(expectedB) {
		t.Fatalf("Expected Account B balance %s, got %s", expectedB, updatedB.Balance)
	}
}

func TestConcurrentTransfersNoDoubleSpending(t *testing.T) {
	db, ledgerEngine, _, _, acctA, acctB := setupLedgerTestEnv(t)
	ctx := context.Background()

	// Initial balance of A is $1,000.00.
	// We launch 10 concurrent goroutines each attempting to transfer $600.00.
	// Only 1 transfer can succeed ($600 <= $1,000). The second would require $1,200 which exceeds $1,000.
	numGoroutines := 10
	transferAmount := decimal.NewFromFloat(600.0000)

	var wg sync.WaitGroup
	var successCount int64
	var failCount int64
	var mu sync.Mutex

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			// Create transaction
			tx := models.Transaction{
				Reference:            fmt.Sprintf("CONC-%s-%d", uuid.New().String()[:8], idx),
				SourceAccountID:      &acctA.ID,
				DestinationAccountID: &acctB.ID,
				TransferType:         models.TransferInternal,
				Amount:               transferAmount,
				Fee:                  decimal.Zero,
				Status:               models.TxStatusApproved,
				RiskDecision:         models.RiskLow,
				Description:          fmt.Sprintf("Concurrent transfer attempt %d", idx),
				Metadata:             "{}",
				CreatedAt:            time.Now().UTC(),
				UpdatedAt:            time.Now().UTC(),
			}
			_ = db.Create(&tx)

			_, err := ledgerEngine.PostApprovedTransaction(ctx, tx.ID)

			mu.Lock()
			if err == nil {
				successCount++
			} else {
				failCount++
			}
			mu.Unlock()
		}(i)
	}

	wg.Wait()

	if successCount != 1 {
		t.Fatalf("CRITICAL CONCURRENCY FAILURE: Expected exactly 1 transfer to succeed, but %d succeeded! (Double-spend occurred)", successCount)
	}

	if failCount != int64(numGoroutines-1) {
		t.Fatalf("Expected %d transfers to fail, got %d", numGoroutines-1, failCount)
	}

	// Verify final balance is exactly $400.00 ($1000 - $600)
	var finalA models.Account
	db.Where("id = ?", acctA.ID).First(&finalA)

	expectedFinal := decimal.NewFromFloat(400.0000)
	if !finalA.Balance.Equal(expectedFinal) {
		t.Fatalf("Expected final balance %s, got %s", expectedFinal, finalA.Balance)
	}
}

func TestInsufficientBalanceRejection(t *testing.T) {
	db, ledgerEngine, _, _, acctA, acctB := setupLedgerTestEnv(t)
	ctx := context.Background()

	// Ensure per-transaction limit is high enough so balance check triggers
	db.Model(acctA).Update("per_tx_limit", decimal.NewFromFloat(5000.0000))

	// Balance of A is $1,000. Attempt to transfer $1,500.
	overdraftAmount := decimal.NewFromFloat(1500.0000)

	tx := models.Transaction{
		Reference:            fmt.Sprintf("INSUF-%s", uuid.New().String()[:8]),
		SourceAccountID:      &acctA.ID,
		DestinationAccountID: &acctB.ID,
		TransferType:         models.TransferInternal,
		Amount:               overdraftAmount,
		Fee:                  decimal.Zero,
		Status:               models.TxStatusApproved,
		RiskDecision:         models.RiskLow,
		Description:          "Insufficient balance test",
		Metadata:             "{}",
		CreatedAt:            time.Now().UTC(),
		UpdatedAt:            time.Now().UTC(),
	}
	db.Create(&tx)

	_, err := ledgerEngine.PostApprovedTransaction(ctx, tx.ID)
	if err == nil {
		t.Fatal("Expected insufficient balance error, but transaction was approved!")
	}

	if err != ledger.ErrInsufficientBalance {
		t.Fatalf("Expected ErrInsufficientBalance, got %v", err)
	}
}

func TestFailSafeMLTimeoutHoldsTransaction(t *testing.T) {
	_, _, transferSvc, cust, acctA, acctB := setupLedgerTestEnv(t)
	ctx := context.Background()

	// In setupLedgerTestEnv, fraudClient points to an unroutable port (127.0.0.1:59999).
	// Under system architecture rules, ML timeout or failure MUST transition the transaction to HELD_FOR_REVIEW!
	req := transfers.InitiateTransferRequest{
		SourceAccountID:      acctA.ID,
		DestinationAccountID: &acctB.ID,
		TransferType:         models.TransferInternal,
		Amount:               decimal.NewFromFloat(100.0000),
		Description:          "ML timeout fallback test",
	}

	res, err := transferSvc.InitiateTransfer(ctx, req, cust.ID, cust.UserID, "127.0.0.1", "test-agent")
	if err != nil {
		t.Fatalf("Unexpected error initiating transfer: %v", err)
	}

	if res.Transaction.Status != models.TxStatusHeldForReview {
		t.Fatalf("Expected status HELD_FOR_REVIEW upon ML failure, got %s", res.Transaction.Status)
	}

	// Verify no ledger entries were posted for held transaction
	var count int64
	setupDb, _, _, _, _, _ := setupLedgerTestEnv(t)
	setupDb.Model(&models.LedgerEntry{}).Where("transaction_id = ?", res.Transaction.ID).Count(&count)
	if count > 0 {
		t.Fatalf("Held transaction MUST NOT post ledger entries, found %d", count)
	}
}
