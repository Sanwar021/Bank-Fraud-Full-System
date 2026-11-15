package deposits

import (
	"fmt"
	"net/http"
	"time"

	"github.com/bank-investigation/backend/internal/ledger"
	"github.com/bank-investigation/backend/internal/middleware"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type DepositHandler struct {
	db           *gorm.DB
	ledgerEngine *ledger.LedgerEngine
}

func NewDepositHandler(db *gorm.DB, ledgerEngine *ledger.LedgerEngine) *DepositHandler {
	return &DepositHandler{db: db, ledgerEngine: ledgerEngine}
}

func (h *DepositHandler) List(c *gin.Context) {
	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	var list []models.FixedDeposit
	err := h.db.Where("customer_id = ?", cust.ID).
		Order("created_at DESC").
		Find(&list).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

type CreateDepositRequest struct {
	SourceAccountID uuid.UUID       `json:"source_account_id" binding:"required"`
	PrincipalAmount decimal.Decimal `json:"principal_amount" binding:"required"`
	TermMonths      int             `json:"term_months" binding:"required"` // 3, 6, 12, 24, 36
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

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	// Verify source account belongs to customer and has balance
	var srcAcct models.Account
	if err := h.db.Where("id = ? AND customer_id = ?", req.SourceAccountID, cust.ID).First(&srcAcct).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Source account not found or unauthorized"})
		return
	}

	if srcAcct.Balance.LessThan(req.PrincipalAmount) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient funds in source account"})
		return
	}

	// Interest rate lookup
	rate := decimal.NewFromFloat(5.50)
	if req.TermMonths >= 12 {
		rate = decimal.NewFromFloat(6.50)
	}
	if req.TermMonths >= 24 {
		rate = decimal.NewFromFloat(7.25)
	}

	// Maturity amount calculation: P * (1 + (r/100)*(months/12))
	monthsRatio := decimal.NewFromFloat(float64(req.TermMonths) / 12.0)
	rateFactor := rate.Div(decimal.NewFromInt(100))
	interest := req.PrincipalAmount.Mul(rateFactor).Mul(monthsRatio)
	maturityAmt := req.PrincipalAmount.Add(interest)

	var fdrAcct models.Account
	var fdr models.FixedDeposit

	txErr := h.db.Transaction(func(dbTx *gorm.DB) error {
		// Create FDR dedicated account
		fdrNum := fmt.Sprintf("ACC-FDR-%d", time.Now().UnixNano()%100000000)
		fdrAcct = models.Account{
			CustomerID:    cust.ID,
			AccountNumber: fdrNum,
			AccountType:   models.AccountFixedDeposit,
			Currency:      "USD",
			Status:        models.AccountStatusActive,
			Balance:       req.PrincipalAmount,
			DailyLimit:    decimal.Zero,
			PerTxLimit:    decimal.Zero,
			CreatedAt:     time.Now().UTC(),
			UpdatedAt:     time.Now().UTC(),
		}
		if err := dbTx.Create(&fdrAcct).Error; err != nil {
			return err
		}

		// Create Fixed Deposit entity
		fdr = models.FixedDeposit{
			CustomerID:      cust.ID,
			SourceAccountID: req.SourceAccountID,
			PrincipalAmount: req.PrincipalAmount,
			InterestRate:    rate,
			TermMonths:      req.TermMonths,
			MaturityAmount:  maturityAmt,
			MaturityDate:    time.Now().AddDate(0, req.TermMonths, 0),
			Status:          "ACTIVE",
			CreatedAt:       time.Now().UTC(),
		}
		if err := dbTx.Create(&fdr).Error; err != nil {
			return err
		}

		// Create approved transaction between source account and FDR account
		txRecord := models.Transaction{
			Reference:            fmt.Sprintf("FDR-%s-%d", time.Now().Format("20060102"), time.Now().UnixNano()%100000),
			SourceAccountID:      &srcAcct.ID,
			DestinationAccountID: &fdrAcct.ID,
			TransferType:         models.TransferInternal,
			Amount:               req.PrincipalAmount,
			Fee:                  decimal.Zero,
			Status:               models.TxStatusApproved,
			RiskDecision:         models.RiskLow,
			Description:          fmt.Sprintf("Fixed Deposit placement for %d months", req.TermMonths),
			Metadata:             "{}",
			CreatedAt:            time.Now().UTC(),
			UpdatedAt:            time.Now().UTC(),
		}
		if err := dbTx.Create(&txRecord).Error; err != nil {
			return err
		}

		return nil
	})

	if txErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": txErr.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Fixed Deposit opened successfully",
		"data":    fdr,
	})
}

