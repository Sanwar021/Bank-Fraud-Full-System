package cards

import (
	"net/http"

	"github.com/bank-investigation/backend/internal/middleware"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type CardHandler struct {
	db *gorm.DB
}

func NewCardHandler(db *gorm.DB) *CardHandler {
	return &CardHandler{db: db}
}

func (h *CardHandler) List(c *gin.Context) {
	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	var cards []models.Card
	err := h.db.Where("customer_id = ?", cust.ID).
		Preload("Account").
		Order("created_at DESC").
		Find(&cards).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": cards})
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"` // ACTIVE or BLOCKED
}

func (h *CardHandler) UpdateStatus(c *gin.Context) {
	cardIDStr := c.Param("id")
	cardID, err := uuid.Parse(cardIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid card ID"})
		return
	}

	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status != "ACTIVE" && req.Status != "BLOCKED" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status must be ACTIVE or BLOCKED"})
		return
	}

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	var card models.Card
	if err := h.db.Where("id = ? AND customer_id = ?", cardID, cust.ID).First(&card).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Card not found"})
		return
	}

	card.Status = req.Status
	h.db.Save(&card)

	c.JSON(http.StatusOK, gin.H{"message": "Card status updated", "data": card})
}

type UpdateLimitRequest struct {
	Limit decimal.Decimal `json:"limit" binding:"required"`
}

func (h *CardHandler) UpdateLimit(c *gin.Context) {
	cardIDStr := c.Param("id")
	cardID, err := uuid.Parse(cardIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid card ID"})
		return
	}

	var req UpdateLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Limit.LessThanOrEqual(decimal.Zero) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Limit must be greater than zero"})
		return
	}

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	var card models.Card
	if err := h.db.Where("id = ? AND customer_id = ?", cardID, cust.ID).First(&card).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Card not found"})
		return
	}

	card.SpendingLimit = req.Limit
	h.db.Save(&card)

	c.JSON(http.StatusOK, gin.H{"message": "Spending limit updated", "data": card})
}
