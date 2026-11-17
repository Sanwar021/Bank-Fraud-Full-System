package loans

import (
	"math"
	"net/http"
	"time"

	"github.com/bank-investigation/backend/internal/middleware"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type LoanHandler struct {
	db *gorm.DB
}

func NewLoanHandler(db *gorm.DB) *LoanHandler {
	return &LoanHandler{db: db}
}

func (h *LoanHandler) List(c *gin.Context) {
	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	var list []models.Loan
	err := h.db.Where("customer_id = ?", cust.ID).
		Order("created_at DESC").
		Find(&list).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

type EMICalculateRequest struct {
	PrincipalAmount float64 `json:"principal_amount" binding:"required"`
	InterestRate    float64 `json:"interest_rate" binding:"required"` // e.g. 7.50
	TermMonths      int     `json:"term_months" binding:"required"`   // e.g. 12, 24, 36
}

type ScheduleItem struct {
	Month              int     `json:"month"`
	EMI                float64 `json:"emi"`
	PrincipalComponent float64 `json:"principal_component"`
	InterestComponent  float64 `json:"interest_component"`
	RemainingBalance   float64 `json:"remaining_balance"`
}

func (h *LoanHandler) CalculateEMI(c *gin.Context) {
	var req EMICalculateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.PrincipalAmount <= 0 || req.InterestRate <= 0 || req.TermMonths <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Principal, interest rate, and term must be strictly positive"})
		return
	}

	// Monthly interest rate
	r := (req.InterestRate / 100.0) / 12.0
	n := float64(req.TermMonths)
	p := req.PrincipalAmount

	// EMI formula: P * r * (1 + r)^n / ((1 + r)^n - 1)
	factor := math.Pow(1+r, n)
	emi := p * r * factor / (factor - 1)
	totalPayment := emi * n
	totalInterest := totalPayment - p

	// Generate amortization schedule
	var schedule []ScheduleItem
	balance := p
	for month := 1; month <= req.TermMonths; month++ {
		interestComp := balance * r
		principalComp := emi - interestComp
		balance -= principalComp
		if balance < 0 {
			balance = 0
		}
		schedule = append(schedule, ScheduleItem{
			Month:              month,
			EMI:                math.Round(emi*100) / 100,
			PrincipalComponent: math.Round(principalComp*100) / 100,
			InterestComponent:  math.Round(interestComp*100) / 100,
			RemainingBalance:   math.Round(balance*100) / 100,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"emi":            math.Round(emi*100) / 100,
		"total_payment":  math.Round(totalPayment*100) / 100,
		"total_interest": math.Round(totalInterest*100) / 100,
		"schedule":       schedule,
	})
}

type ApplyLoanRequest struct {
	PrincipalAmount decimal.Decimal `json:"principal_amount" binding:"required"`
	InterestRate    decimal.Decimal `json:"interest_rate" binding:"required"`
	TermMonths      int             `json:"term_months" binding:"required"`
}

func (h *LoanHandler) Apply(c *gin.Context) {
	var req ApplyLoanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.PrincipalAmount.LessThan(decimal.NewFromInt(1000)) || req.PrincipalAmount.GreaterThan(decimal.NewFromInt(50000)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Principal amount must be between $1,000 and $50,000"})
		return
	}
	if req.InterestRate.LessThan(decimal.NewFromInt(5)) || req.InterestRate.GreaterThan(decimal.NewFromInt(18)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Interest rate must be between 5% and 18%"})
		return
	}
	if req.TermMonths < 6 || req.TermMonths > 60 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Loan term must be between 6 and 60 months"})
		return
	}

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}
	if cust.KYCStatus != "VERIFIED" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Verified KYC is required before applying for credit"})
		return
	}

	p := req.PrincipalAmount.InexactFloat64()
	rate := req.InterestRate.InexactFloat64()
	r := (rate / 100.0) / 12.0
	n := float64(req.TermMonths)
	factor := math.Pow(1+r, n)
	emiFloat := p * r * factor / (factor - 1)
	if cust.MonthlyIncome.LessThanOrEqual(decimal.Zero) || decimal.NewFromFloat(emiFloat).GreaterThan(cust.MonthlyIncome.Mul(decimal.NewFromFloat(0.40))) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Requested loan exceeds the maximum 40% debt-to-income threshold"})
		return
	}

	loan := models.Loan{
		CustomerID:       cust.ID,
		PrincipalAmount:  req.PrincipalAmount,
		InterestRate:     req.InterestRate,
		TermMonths:       req.TermMonths,
		EMIAmount:        decimal.NewFromFloat(emiFloat),
		RemainingBalance: req.PrincipalAmount,
		Status:           "PENDING",
		CreatedAt:        time.Now().UTC(),
	}

	if err := h.db.Create(&loan).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Loan application submitted for underwriting review",
		"data":    loan,
	})
}

