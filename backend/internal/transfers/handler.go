package transfers

import (
	"net/http"
	"strconv"

	"github.com/bank-investigation/backend/internal/middleware"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TransferHandler struct {
	svc *TransferService
	db  *gorm.DB
}

func NewTransferHandler(svc *TransferService, db *gorm.DB) *TransferHandler {
	return &TransferHandler{svc: svc, db: db}
}

func (h *TransferHandler) Initiate(c *gin.Context) {
	var req InitiateTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "message": err.Error()})
		return
	}

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer profile not found"})
		return
	}

	result, err := h.svc.InitiateTransfer(c.Request.Context(), req, cust.ID, userID, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Transfer failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Transfer processed",
		"data":    result,
	})
}

func (h *TransferHandler) GetByID(c *gin.Context) {
	txIDStr := c.Param("id")
	txID, err := uuid.Parse(txIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
		return
	}

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	role := c.MustGet(middleware.CtxUserRoleKey).(string)

	var cust models.Customer
	_ = h.db.Where("user_id = ?", userID).First(&cust)

	var tx models.Transaction
	query := h.db.Preload("SourceAccount").
		Preload("DestinationAccount").
		Preload("LedgerEntries").
		Preload("FraudScore").
		Preload("FraudAlert").
		Where("id = ?", txID)

	if role != models.RoleAdmin && role != models.RoleFraudAnalyst && role != models.RoleTeller {
		// Ensure transaction belongs to customer
		query = query.Where("source_account_id IN (SELECT id FROM accounts WHERE customer_id = ?) OR destination_account_id IN (SELECT id FROM accounts WHERE customer_id = ?)", cust.ID, cust.ID)
	}

	if err := query.First(&tx).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found or unauthorized"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": tx})
}

func (h *TransferHandler) List(c *gin.Context) {
	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	role := c.MustGet(middleware.CtxUserRoleKey).(string)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	status := c.Query("status")

	query := h.db.Model(&models.Transaction{})

	if role != models.RoleAdmin && role != models.RoleFraudAnalyst && role != models.RoleTeller {
		var cust models.Customer
		if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		query = query.Where("source_account_id IN (SELECT id FROM accounts WHERE customer_id = ?) OR destination_account_id IN (SELECT id FROM accounts WHERE customer_id = ?)", cust.ID, cust.ID)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var txs []models.Transaction
	err := query.Order("created_at DESC").
		Preload("SourceAccount").
		Preload("DestinationAccount").
		Limit(limit).
		Offset(offset).
		Find(&txs).Error

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

type OTPVerifyRequest struct {
	Code string `json:"code" binding:"required"`
}

func (h *TransferHandler) VerifyOTP(c *gin.Context) {
	txIDStr := c.Param("id")
	txID, err := uuid.Parse(txIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
		return
	}

	var req OTPVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)

	completedTx, err := h.svc.VerifyTransferOTP(c.Request.Context(), txID, userID, req.Code, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "OTP verification failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Transfer verified and posted to ledger",
		"data":    completedTx,
	})
}

func (h *TransferHandler) Cancel(c *gin.Context) {
	txIDStr := c.Param("id")
	txID, err := uuid.Parse(txIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
		return
	}

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)

	if err := h.svc.CancelTransfer(c.Request.Context(), txID, userID, c.ClientIP()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cancellation failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Transfer cancelled successfully"})
}
