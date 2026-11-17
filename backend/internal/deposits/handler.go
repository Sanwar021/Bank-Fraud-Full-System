package deposits

import (
	"fmt"
	"net/http"
	"time"

	"github.com/bank-investigation/backend/internal/middleware"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type DepositHandler struct{ db *gorm.DB }

func NewDepositHandler(db *gorm.DB) *DepositHandler { return &DepositHandler{db: db} }

func (h *DepositHandler) List(c *gin.Context) {
	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}
	var list []models.FixedDeposit
	if err := h.db.Where("customer_id = ?", cust.ID).Order("created_at DESC").Find(&list).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

type CreateDepositRequest struct {
	SourceAccountID uuid.UUID       `json:"source_account_id" binding:"required"`
	PrincipalAmount decimal.Decimal `json:"principal_amount" binding:"required"`
	TermMonths      int             `json:"term_months" binding:"required"`
}

func (h *DepositHandler) Create(c *gin.Context) {
	var req CreateDepositRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.PrincipalAmount.LessThan(decimal.NewFromInt(500)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Minimum fixed deposit amount is $500.00"})
		return
	}
	validTerms := map[int]bool{3: true, 6: true, 12: true, 24: true, 36: true}
	if !validTerms[req.TermMonths] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Term must be one of 3, 6, 12, 24, or 36 months"})
		return
	}

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	rate := decimal.NewFromFloat(5.50)
	if req.TermMonths >= 12 {
		rate = decimal.NewFromFloat(6.50)
	}
	if req.TermMonths >= 24 {
		rate = decimal.NewFromFloat(7.25)
	}
	interest := req.PrincipalAmount.Mul(rate.Div(decimal.NewFromInt(100))).Mul(decimal.NewFromFloat(float64(req.TermMonths) / 12.0))
	maturityAmount := req.PrincipalAmount.Add(interest)

	var fdr models.FixedDeposit
	err := h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var source models.Account
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND customer_id = ?", req.SourceAccountID, cust.ID).First(&source).Error; err != nil {
			return fmt.Errorf("source account not found or unauthorized: %w", err)
		}
		if source.Status != models.AccountStatusActive {
			return fmt.Errorf("source account is not active")
		}
		if source.Balance.LessThan(req.PrincipalAmount) {
			return fmt.Errorf("insufficient funds in source account")
		}

		now := time.Now().UTC()
		fdrAccount := models.Account{
			CustomerID: cust.ID, AccountNumber: fmt.Sprintf("ACC-FDR-%d", now.UnixNano()%100000000),
			AccountType: models.AccountFixedDeposit, Currency: source.Currency, Status: models.AccountStatusActive,
			Balance: decimal.Zero, DailyLimit: decimal.Zero, PerTxLimit: decimal.Zero, CreatedAt: now, UpdatedAt: now,
		}
		if err := tx.Create(&fdrAccount).Error; err != nil {
			return err
		}

		fdr = models.FixedDeposit{
			CustomerID: cust.ID, SourceAccountID: source.ID, PrincipalAmount: req.PrincipalAmount,
			InterestRate: rate, TermMonths: req.TermMonths, MaturityAmount: maturityAmount,
			MaturityDate: now.AddDate(0, req.TermMonths, 0), Status: "ACTIVE", CreatedAt: now,
		}
		if err := tx.Create(&fdr).Error; err != nil {
			return err
		}

		transaction := models.Transaction{
			Reference:       fmt.Sprintf("FDR-%s-%d", now.Format("20060102"), now.UnixNano()%100000),
			SourceAccountID: &source.ID, DestinationAccountID: &fdrAccount.ID, TransferType: models.TransferInternal,
			Amount: req.PrincipalAmount, Fee: decimal.Zero, Status: models.TxStatusCompleted, RiskDecision: models.RiskLow,
			Description: fmt.Sprintf("Fixed Deposit placement for %d months", req.TermMonths), Metadata: "{}", CreatedAt: now, UpdatedAt: now,
		}
		if err := tx.Create(&transaction).Error; err != nil {
			return err
		}

		newSourceBalance := source.Balance.Sub(req.PrincipalAmount)
		entries := []models.LedgerEntry{
			{TransactionID: transaction.ID, AccountID: source.ID, EntryType: models.EntryDebit, Amount: req.PrincipalAmount, BalanceAfter: newSourceBalance, CreatedAt: now},
			{TransactionID: transaction.ID, AccountID: fdrAccount.ID, EntryType: models.EntryCredit, Amount: req.PrincipalAmount, BalanceAfter: req.PrincipalAmount, CreatedAt: now},
		}
		if err := tx.Create(&entries).Error; err != nil {
			return fmt.Errorf("failed to write fixed-deposit ledger entries: %w", err)
		}

		source.Balance, source.UpdatedAt = newSourceBalance, now
		if err := tx.Save(&source).Error; err != nil {
			return err
		}
		fdrAccount.Balance, fdrAccount.UpdatedAt = req.PrincipalAmount, now
		if err := tx.Save(&fdrAccount).Error; err != nil {
			return err
		}

		history := models.TransactionStatusHistory{TransactionID: transaction.ID, Status: models.TxStatusCompleted, Reason: "Fixed deposit funded through balanced double-entry posting", CreatedAt: now}
		return tx.Create(&history).Error
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Fixed Deposit opened successfully", "data": fdr})
}
