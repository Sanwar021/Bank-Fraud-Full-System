package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bank-investigation/backend/internal/deposits"
	"github.com/bank-investigation/backend/internal/middleware"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

func TestFixedDepositPostsBalancedLedgerAndDebitsSource(t *testing.T) {
	db, _, _, _, source, _ := setupLedgerTestEnv(t)
	handler := deposits.NewDepositHandler(db)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(middleware.CtxUserIDKey, sourceCustomerUserID(t, db, source.CustomerID))
		c.Next()
	})
	router.POST("/deposits", handler.Create)

	payload, _ := json.Marshal(map[string]interface{}{
		"source_account_id": source.ID.String(),
		"principal_amount":  "500.00",
		"term_months":       12,
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/deposits", bytes.NewReader(payload))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var refreshedSource models.Account
	if err := db.First(&refreshedSource, "id = ?", source.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !refreshedSource.Balance.Equal(decimal.NewFromFloat(500)) {
		t.Fatalf("expected source balance 500, got %s", refreshedSource.Balance)
	}

	var transaction models.Transaction
	if err := db.Where("source_account_id = ? AND description LIKE ?", source.ID, "Fixed Deposit placement%").Order("created_at DESC").First(&transaction).Error; err != nil {
		t.Fatal(err)
	}
	if transaction.Status != models.TxStatusCompleted {
		t.Fatalf("expected completed transaction, got %s", transaction.Status)
	}

	var entries []models.LedgerEntry
	if err := db.Where("transaction_id = ?", transaction.ID).Find(&entries).Error; err != nil {
		t.Fatal(err)
	}
	debits, credits := decimal.Zero, decimal.Zero
	for _, entry := range entries {
		if entry.EntryType == models.EntryDebit {
			debits = debits.Add(entry.Amount)
		}
		if entry.EntryType == models.EntryCredit {
			credits = credits.Add(entry.Amount)
		}
	}
	if len(entries) != 2 || !debits.Equal(credits) || !debits.Equal(decimal.NewFromFloat(500)) {
		t.Fatalf("expected balanced $500 entries, got entries=%d debits=%s credits=%s", len(entries), debits, credits)
	}
}

func sourceCustomerUserID(t *testing.T, db *gorm.DB, customerID uuid.UUID) uuid.UUID {
	var customer models.Customer
	if err := db.First(&customer, "id = ?", customerID).Error; err != nil {
		t.Fatal(err)
	}
	return customer.UserID
}
