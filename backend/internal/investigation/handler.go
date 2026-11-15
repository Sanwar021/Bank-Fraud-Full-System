package investigation

import (
	"net/http"
	"strconv"

	"github.com/bank-investigation/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type InvestigationHandler struct {
	svc *InvestigationService
}

func NewInvestigationHandler(svc *InvestigationService) *InvestigationHandler {
	return &InvestigationHandler{svc: svc}
}

func (h *InvestigationHandler) RegisterRoutes(r *gin.RouterGroup, authMiddleware, roleMiddleware gin.HandlerFunc) {
	admin := r.Group("/admin/investigation")
	{
		// SSE stream (accessible for live updates)
		admin.GET("/events", HandleSSE)

		// Endpoints requiring FRAUD_ANALYST or ADMIN role
		protected := admin.Group("")
		protected.Use(authMiddleware)
		protected.Use(roleMiddleware)
		{
			protected.GET("/overview", h.GetOverview)
			protected.GET("/alerts", h.GetAlerts)
			protected.GET("/alerts/:id", h.GetAlertDetails)
			protected.POST("/alerts/:id/adjudicate", h.AdjudicateAlert)
			protected.GET("/transactions", h.GetLiveTransactions)
			protected.GET("/audit-logs", h.GetAuditLogs)
		}
	}
}

func (h *InvestigationHandler) GetOverview(c *gin.Context) {
	overview, err := h.svc.GetOverviewMetrics(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load overview metrics: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, overview)
}

func (h *InvestigationHandler) GetAlerts(c *gin.Context) {
	status := c.Query("status")
	severity := c.Query("severity")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	alerts, total, err := h.svc.GetFraudAlerts(c.Request.Context(), status, severity, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query alerts: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts": alerts,
		"total":  total,
		"page":   page,
		"limit":  limit,
	})
}

func (h *InvestigationHandler) GetAlertDetails(c *gin.Context) {
	alertID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid alert ID"})
		return
	}

	alert, err := h.svc.GetAlertDetails(c.Request.Context(), alertID)
	if err != nil {
		if err == ErrAlertNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "fraud alert not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve alert: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, alert)
}

func (h *InvestigationHandler) AdjudicateAlert(c *gin.Context) {
	alertID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid alert ID"})
		return
	}

	var req AdjudicateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	analystID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	err = h.svc.AdjudicateAlert(c.Request.Context(), alertID, analystID, req, c.ClientIP())
	if err != nil {
		if err == ErrAlertNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "fraud alert not found"})
			return
		}
		if err == ErrInvalidDecision {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid decision value"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "adjudication failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Fraud alert adjudicated successfully",
		"decision": req.Decision,
	})
}

func (h *InvestigationHandler) GetLiveTransactions(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	txs, err := h.svc.GetLiveTransactions(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve transactions: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"transactions": txs})
}

func (h *InvestigationHandler) GetAuditLogs(c *gin.Context) {
	action := c.Query("action")
	outcome := c.Query("outcome")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "25"))

	logs, total, err := h.svc.GetAuditLogs(c.Request.Context(), action, outcome, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load audit logs: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":  logs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}
