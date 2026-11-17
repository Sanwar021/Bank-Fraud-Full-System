package auth

import (
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/bank-investigation/backend/internal/config"
	"github.com/bank-investigation/backend/internal/middleware"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthHandler struct {
	authSvc *AuthService
	db      *gorm.DB
}

func setAuthCookies(c *gin.Context, tokens *models.TokenPair) {
	secure := strings.EqualFold(os.Getenv("APP_ENV"), "production")
	c.SetSameSite(http.SameSiteStrictMode)
	accessMaxAge := int(time.Until(tokens.ExpiresAt).Seconds())
	if accessMaxAge < 1 {
		accessMaxAge = 900
	}
	c.SetCookie("access_token", tokens.AccessToken, accessMaxAge, "/", "", secure, true)
	c.SetCookie("refresh_token", tokens.RefreshToken, int((7 * 24 * time.Hour).Seconds()), "/api/v1/auth", "", secure, true)
}

func clearAuthCookies(c *gin.Context) {
	secure := strings.EqualFold(os.Getenv("APP_ENV"), "production")
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie("access_token", "", -1, "/", "", secure, true)
	c.SetCookie("refresh_token", "", -1, "/api/v1/auth", "", secure, true)
}

func NewAuthHandler(authSvc *AuthService, db *gorm.DB) *AuthHandler {
	return &AuthHandler{authSvc: authSvc, db: db}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": err.Error(),
		})
		return
	}

	ip := c.ClientIP()
	userAgent := c.Request.UserAgent()

	resp, err := h.authSvc.RegisterCustomer(req, ip, userAgent)
	if err != nil {
		if errors.Is(err, ErrEmailAlreadyExists) || errors.Is(err, ErrNationalIDExists) {
			c.JSON(http.StatusConflict, gin.H{
				"error":   "Conflict",
				"message": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": err.Error(),
		})
		return
	}
	setAuthCookies(c, &resp.Tokens)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Registration successful",
		"data":    resp,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": err.Error(),
		})
		return
	}

	ip := c.ClientIP()
	userAgent := c.Request.UserAgent()

	resp, err := h.authSvc.Login(req, ip, userAgent)
	if err != nil {
		if errors.Is(err, ErrAccountLocked) {
			c.JSON(http.StatusLocked, gin.H{
				"error":   "Account Locked",
				"message": err.Error(),
			})
			return
		}
		if errors.Is(err, ErrInvalidCredentials) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "Unauthorized",
				"message": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": err.Error(),
		})
		return
	}
	setAuthCookies(c, &resp.Tokens)

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"data":    resp,
	})
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req RefreshRequest
	_ = c.ShouldBindJSON(&req)
	if req.RefreshToken == "" {
		req.RefreshToken, _ = c.Cookie("refresh_token")
	}
	if req.RefreshToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Refresh token is required"})
		return
	}

	tokens, err := h.authSvc.RefreshToken(req.RefreshToken, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "Unauthorized",
			"message": err.Error(),
		})
		return
	}
	setAuthCookies(c, tokens)

	c.JSON(http.StatusOK, gin.H{
		"message": "Token refreshed successfully",
		"data":    tokens,
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	sessionIDVal, exists := c.Get(middleware.CtxSessionIDKey)
	userIDVal, uExists := c.Get(middleware.CtxUserIDKey)
	if !exists || !uExists {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "No active session in context",
		})
		return
	}

	sessionID := sessionIDVal.(uuid.UUID)
	userID := userIDVal.(uuid.UUID)

	_ = h.authSvc.Logout(sessionID, userID, c.ClientIP())
	clearAuthCookies(c)

	c.JSON(http.StatusOK, gin.H{
		"message": "Logged out successfully",
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userIDVal, exists := c.Get(middleware.CtxUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := userIDVal.(uuid.UUID)

	var user models.User
	err := h.db.Preload("Role").
		Preload("Customer").
		Preload("Customer.Accounts").
		Where("id = ?", userID).First(&user).Error

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": user,
	})
}

type OTPRequestPayload struct {
	ActionType string `json:"action_type" binding:"required"`
}

func (h *AuthHandler) RequestOTP(c *gin.Context) {
	userIDVal, _ := c.Get(middleware.CtxUserIDKey)
	userID := userIDVal.(uuid.UUID)

	var req OTPRequestPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	code, err := h.authSvc.RequestOTP(userID, req.ActionType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := gin.H{
		"message":     "Verification code dispatched to simulated phone/email",
		"action_type": req.ActionType,
	}
	if config.DemoCodesEnabled() {
		response["demo_code"] = code
	}
	c.JSON(http.StatusOK, response)
}

type OTPVerifyPayload struct {
	ActionType string `json:"action_type" binding:"required"`
	Code       string `json:"code" binding:"required"`
}

func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	userIDVal, _ := c.Get(middleware.CtxUserIDKey)
	userID := userIDVal.(uuid.UUID)

	var req OTPVerifyPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ok, err := h.authSvc.VerifyOTP(userID, req.ActionType, req.Code)
	if err != nil || !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Verification Failed",
			"message": "Invalid or expired OTP code",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "OTP verified successfully",
		"status":  "VERIFIED",
	})
}

func (h *AuthHandler) GetSessions(c *gin.Context) {
	userIDVal, _ := c.Get(middleware.CtxUserIDKey)
	userID := userIDVal.(uuid.UUID)

	sessions, err := h.authSvc.GetUserSessions(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": sessions,
	})
}
