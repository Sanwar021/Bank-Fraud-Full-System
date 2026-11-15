package accounts

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/bank-investigation/backend/internal/middleware"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AccountHandler struct {
	svc *AccountService
	db  *gorm.DB
}

func NewAccountHandler(svc *AccountService, db *gorm.DB) *AccountHandler {
	return &AccountHandler{svc: svc, db: db}
}

func (h *AccountHandler) GetAccounts(c *gin.Context) {
	userIDVal, exists := c.Get(middleware.CtxUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := userIDVal.(uuid.UUID)

	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer profile not found"})
		return
	}

	summary, err := h.svc.GetCustomerAccounts(c.Request.Context(), cust.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": summary})
}

func (h *AccountHandler) GetAccount(c *gin.Context) {
	accountIDStr := c.Param("id")
	accountID, err := uuid.Parse(accountIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	role := c.MustGet(middleware.CtxUserRoleKey).(string)

	var cust models.Customer
	_ = h.db.Where("user_id = ?", userID).First(&cust)

	acct, err := h.svc.GetAccount(c.Request.Context(), accountID, cust.ID, role)
	if err != nil {
		if errors.Is(err, ErrAccountNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Account not found"})
			return
		}
		if errors.Is(err, ErrUnauthorizedAccount) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized to access this account"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": acct})
}

func (h *AccountHandler) GetTransactions(c *gin.Context) {
	accountIDStr := c.Param("id")
	accountID, err := uuid.Parse(accountIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	role := c.MustGet(middleware.CtxUserRoleKey).(string)

	var cust models.Customer
	_ = h.db.Where("user_id = ?", userID).First(&cust)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	transferType := c.Query("type")
	status := c.Query("status")

	var startDate, endDate *time.Time
	if sDate := c.Query("start_date"); sDate != "" {
		if t, err := time.Parse("2006-01-02", sDate); err == nil {
			startDate = &t
		}
	}
	if eDate := c.Query("end_date"); eDate != "" {
		if t, err := time.Parse("2006-01-02", eDate); err == nil {
			end := t.Add(24*time.Hour - time.Nanosecond)
			endDate = &end
		}
	}

	txs, total, err := h.svc.GetTransactions(c.Request.Context(), accountID, cust.ID, role, limit, offset, transferType, status, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   txs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

type CreateAccountRequest struct {
	AccountType string `json:"account_type" binding:"required"`
	Currency    string `json:"currency"`
}

func (h *AccountHandler) CreateAccount(c *gin.Context) {
	var req CreateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer profile not found"})
		return
	}

	acct, err := h.svc.CreateAccount(c.Request.Context(), cust.ID, req.AccountType, req.Currency, userID, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Account created successfully",
		"data":    acct,
	})
}

func (h *AccountHandler) ExportStatement(c *gin.Context) {
	accountIDStr := c.Param("id")
	accountID, err := uuid.Parse(accountIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	role := c.MustGet(middleware.CtxUserRoleKey).(string)

	var cust models.Customer
	_ = h.db.Where("user_id = ?", userID).First(&cust)

	var startDate, endDate *time.Time
	if sDate := c.Query("start_date"); sDate != "" {
		if t, err := time.Parse("2006-01-02", sDate); err == nil {
			startDate = &t
		}
	}
	if eDate := c.Query("end_date"); eDate != "" {
		if t, err := time.Parse("2006-01-02", eDate); err == nil {
			end := t.Add(24*time.Hour - time.Nanosecond)
			endDate = &end
		}
	}

	csvData, filename, err := h.svc.ExportStatementCSV(c.Request.Context(), accountID, cust.ID, role, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Data(http.StatusOK, "text/csv; charset=utf-8", csvData)
}
