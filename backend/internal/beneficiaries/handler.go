package beneficiaries

import (
	"net/http"
	"time"

	"github.com/bank-investigation/backend/internal/middleware"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BeneficiaryHandler struct {
	db *gorm.DB
}

func NewBeneficiaryHandler(db *gorm.DB) *BeneficiaryHandler {
	return &BeneficiaryHandler{db: db}
}

func (h *BeneficiaryHandler) List(c *gin.Context) {
	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer profile not found"})
		return
	}

	var list []models.Beneficiary
	err := h.db.Where("customer_id = ?", cust.ID).
		Order("name ASC").
		Find(&list).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

type AddBeneficiaryRequest struct {
	Name          string `json:"name" binding:"required"`
	AccountNumber string `json:"account_number" binding:"required"`
	BankName      string `json:"bank_name" binding:"required"`
	RoutingNumber string `json:"routing_number"`
}

func (h *BeneficiaryHandler) Create(c *gin.Context) {
	var req AddBeneficiaryRequest
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

	ben := models.Beneficiary{
		CustomerID:    cust.ID,
		Name:          req.Name,
		AccountNumber: req.AccountNumber,
		BankName:      req.BankName,
		RoutingNumber: req.RoutingNumber,
		IsVerified:    true,
		CreatedAt:     time.Now().UTC(),
	}

	if err := h.db.Create(&ben).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to add beneficiary (may already exist)", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Beneficiary saved", "data": ben})
}

func (h *BeneficiaryHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	benID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
	var cust models.Customer
	if err := h.db.Where("user_id = ?", userID).First(&cust).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	if err := h.db.Where("id = ? AND customer_id = ?", benID, cust.ID).Delete(&models.Beneficiary{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Beneficiary deleted"})
}

