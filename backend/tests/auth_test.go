package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bank-investigation/backend/internal/audit"
	"github.com/bank-investigation/backend/internal/auth"
	"github.com/bank-investigation/backend/internal/config"
	"github.com/bank-investigation/backend/internal/database"
	"github.com/bank-investigation/backend/internal/middleware"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/bank-investigation/backend/internal/notifications"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupTestEnvironment(t *testing.T) (*gorm.DB, database.CacheService, *auth.JWTService, *auth.AuthService, *gin.Engine) {
	gin.SetMode(gin.TestMode)

	cfg, err := config.LoadConfig()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		t.Fatalf("Failed to connect to test DB: %v", err)
	}

	cache := database.NewInMemoryCache()
	jwtSvc := auth.NewJWTService("test-secret-key-32-chars-long!", 15*time.Minute, 24*time.Hour)
	auditSvc := audit.NewAuditService(db)
	notifSvc := notifications.NewNotificationService(db)
	authSvc := auth.NewAuthService(db, jwtSvc, cache, auditSvc, notifSvc)

	handler := auth.NewAuthHandler(authSvc, db)

	r := gin.New()
	r.Use(gin.Recovery())

	v1 := r.Group("/api/v1")
	{
		authGroup := v1.Group("/auth")
		{
			authGroup.POST("/register", handler.Register)
			authGroup.POST("/login", handler.Login)
			authGroup.POST("/refresh", handler.Refresh)

			authProtected := authGroup.Group("")
			authProtected.Use(middleware.AuthMiddleware(jwtSvc))
			{
				authProtected.POST("/logout", handler.Logout)
				authProtected.GET("/me", handler.Me)
				authProtected.GET("/sessions", handler.GetSessions)
				authProtected.POST("/otp/request", handler.RequestOTP)
				authProtected.POST("/otp/verify", handler.VerifyOTP)
			}
		}

		adminGroup := v1.Group("/admin")
		adminGroup.Use(middleware.AuthMiddleware(jwtSvc))
		adminGroup.Use(middleware.RequireRoles(models.RoleAdmin, models.RoleFraudAnalyst))
		{
			adminGroup.GET("/restricted", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "authorized"})
			})
		}
	}

	return db, cache, jwtSvc, authSvc, r
}

func TestArgon2idPasswordHashing(t *testing.T) {
	rawPassword := "SecurePass123!$"

	hash, err := auth.HashPassword(rawPassword, nil)
	if err != nil {
		t.Fatalf("Failed to hash password: %v", err)
	}

	if len(hash) == 0 {
		t.Fatal("Expected non-empty password hash")
	}

	// Verify correct password
	matched, err := auth.VerifyPassword(rawPassword, hash)
	if err != nil {
		t.Fatalf("Password verification error: %v", err)
	}
	if !matched {
		t.Fatalf("Expected password to match hash")
	}

	// Verify wrong password
	matchedWrong, err := auth.VerifyPassword("WrongPass!", hash)
	if err != nil {
		t.Fatalf("Password verification error on wrong password: %v", err)
	}
	if matchedWrong {
		t.Fatalf("Expected wrong password not to match")
	}
}

func TestJWTTokenGenerationAndValidation(t *testing.T) {
	jwtSvc := auth.NewJWTService("test-secret-key-32-chars-long!", 15*time.Minute, 24*time.Hour)
	userID := uuid.New()
	sessionID := uuid.New()
	email := "testuser@bankinvestigation.com"
	role := models.RoleCustomer

	token, exp, err := jwtSvc.GenerateAccessToken(userID, email, role, sessionID)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	if exp.Before(time.Now()) {
		t.Fatalf("Token expiration should be in the future")
	}

	claims, err := jwtSvc.ValidateToken(token)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}

	if claims.UserID != userID || claims.Email != email || claims.RoleID != role || claims.SessionID != sessionID {
		t.Fatalf("Claims mismatch: got %+v", claims)
	}
}

func TestCustomerRegistrationAndLogin(t *testing.T) {
	db, _, _, _, r := setupTestEnvironment(t)

	uniqueSuffix := uuid.New().String()[:8]
	email := fmt.Sprintf("reg-%s@bankinvestigation.com", uniqueSuffix)
	nid := fmt.Sprintf("NID-%s", uniqueSuffix)

	regPayload := auth.RegisterRequest{
		Email:         email,
		Password:      "SecurePassword123!",
		FirstName:     "Testing",
		LastName:      "User",
		Phone:         "+15551234567",
		NationalID:    nid,
		Address:       "123 Test Street",
		MonthlyIncome: 7500.0,
	}

	body, _ := json.Marshal(regPayload)
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected status 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var regResp struct {
		Data auth.RegisterResponse `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &regResp)

	if regResp.Data.User.Email != email {
		t.Fatalf("Expected registered email %s, got %s", email, regResp.Data.User.Email)
	}

	// Verify accounts created in database
	var accounts []models.Account
	db.Where("customer_id = ?", regResp.Data.Customer.ID).Find(&accounts)
	if len(accounts) < 2 {
		t.Fatalf("Expected at least 2 default accounts (Savings and Current), got %d", len(accounts))
	}

	// Test Login with same credentials
	loginPayload := auth.LoginRequest{
		Email:             email,
		Password:          "SecurePassword123!",
		DeviceFingerprint: "fingerprint-test-001",
	}
	loginBody, _ := json.Marshal(loginPayload)
	loginReq, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBuffer(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()
	r.ServeHTTP(loginW, loginReq)

	if loginW.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK on login, got %d: %s", loginW.Code, loginW.Body.String())
	}

	var loginResp struct {
		Data auth.LoginResponse `json:"data"`
	}
	_ = json.Unmarshal(loginW.Body.Bytes(), &loginResp)

	if loginResp.Data.Tokens.AccessToken == "" {
		t.Fatal("Expected non-empty access token")
	}

	// Test Me endpoint with token
	meReq, _ := http.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+loginResp.Data.Tokens.AccessToken)
	meW := httptest.NewRecorder()
	r.ServeHTTP(meW, meReq)

	if meW.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK on /auth/me, got %d: %s", meW.Code, meW.Body.String())
	}
}

func TestFailedLoginAndAccountLockout(t *testing.T) {
	_, _, _, _, r := setupTestEnvironment(t)

	uniqueSuffix := uuid.New().String()[:8]
	email := fmt.Sprintf("lockout-%s@bankinvestigation.com", uniqueSuffix)
	nid := fmt.Sprintf("NID-LOCK-%s", uniqueSuffix)

	// Register user first
	regPayload := auth.RegisterRequest{
		Email:         email,
		Password:      "CorrectPassword123!",
		FirstName:     "Lockout",
		LastName:      "Candidate",
		Phone:         "+15559876543",
		NationalID:    nid,
		MonthlyIncome: 5000.0,
	}
	body, _ := json.Marshal(regPayload)
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("Failed to create user for lockout test: %s", w.Body.String())
	}

	// Attempt 4 wrong logins -> should return 401 Unauthorized
	for i := 1; i <= 4; i++ {
		loginPayload := auth.LoginRequest{
			Email:    email,
			Password: "WrongPassword!",
		}
		b, _ := json.Marshal(loginPayload)
		lReq, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBuffer(b))
		lReq.Header.Set("Content-Type", "application/json")
		lW := httptest.NewRecorder()
		r.ServeHTTP(lW, lReq)

		if lW.Code != http.StatusUnauthorized {
			t.Fatalf("Attempt %d: expected status 401 Unauthorized, got %d", i, lW.Code)
		}
	}

	// Attempt 5th wrong login -> should lock account (423 Locked)
	loginPayload := auth.LoginRequest{
		Email:    email,
		Password: "WrongPassword!",
	}
	b, _ := json.Marshal(loginPayload)
	lReq, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBuffer(b))
	lReq.Header.Set("Content-Type", "application/json")
	lW := httptest.NewRecorder()
	r.ServeHTTP(lW, lReq)

	if lW.Code != http.StatusLocked {
		t.Fatalf("Attempt 5: expected status 423 Locked, got %d: %s", lW.Code, lW.Body.String())
	}

	// Even correct password should now be rejected because account is locked
	loginPayloadCorrect := auth.LoginRequest{
		Email:    email,
		Password: "CorrectPassword123!",
	}
	bCorrect, _ := json.Marshal(loginPayloadCorrect)
	lReqCorrect, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBuffer(bCorrect))
	lReqCorrect.Header.Set("Content-Type", "application/json")
	lWCorrect := httptest.NewRecorder()
	r.ServeHTTP(lWCorrect, lReqCorrect)

	if lWCorrect.Code != http.StatusLocked {
		t.Fatalf("Locked user with correct password: expected status 423 Locked, got %d", lWCorrect.Code)
	}
}

func TestRBACAccessControl(t *testing.T) {
	_, _, jwtSvc, _, r := setupTestEnvironment(t)

	// 1. Customer Token trying to access Admin endpoint -> Expect 403 Forbidden
	customerUserID := uuid.New()
	customerSessionID := uuid.New()
	customerToken, _, _ := jwtSvc.GenerateAccessToken(customerUserID, "cust@bank.com", models.RoleCustomer, customerSessionID)

	reqForbidden, _ := http.NewRequest(http.MethodGet, "/api/v1/admin/restricted", nil)
	reqForbidden.Header.Set("Authorization", "Bearer "+customerToken)
	wForbidden := httptest.NewRecorder()
	r.ServeHTTP(wForbidden, reqForbidden)

	if wForbidden.Code != http.StatusForbidden {
		t.Fatalf("Customer accessing admin route: expected 403 Forbidden, got %d", wForbidden.Code)
	}

	// 2. Fraud Analyst Token trying to access Admin endpoint -> Expect 200 OK
	analystUserID := uuid.New()
	analystSessionID := uuid.New()
	analystToken, _, _ := jwtSvc.GenerateAccessToken(analystUserID, "analyst@bank.com", models.RoleFraudAnalyst, analystSessionID)

	reqAllowed, _ := http.NewRequest(http.MethodGet, "/api/v1/admin/restricted", nil)
	reqAllowed.Header.Set("Authorization", "Bearer "+analystToken)
	wAllowed := httptest.NewRecorder()
	r.ServeHTTP(wAllowed, reqAllowed)

	if wAllowed.Code != http.StatusOK {
		t.Fatalf("Fraud Analyst accessing admin route: expected 200 OK, got %d", wAllowed.Code)
	}
}

func TestMockOTPGenerationAndVerification(t *testing.T) {
	db, _, _, authSvc, _ := setupTestEnvironment(t)

	var user models.User
	if err := db.Where("email = ?", "john.doe@bankinvestigation.com").First(&user).Error; err != nil {
		t.Fatalf("Failed to find seeded user: %v", err)
	}

	testUserID := user.ID

	code, err := authSvc.RequestOTP(testUserID, "TRANSFER")
	if err != nil {
		t.Fatalf("Failed to request OTP: %v", err)
	}

	if len(code) != 6 {
		t.Fatalf("Expected 6-digit OTP code, got %s", code)
	}

	// Test invalid code
	validWrong, _ := authSvc.VerifyOTP(testUserID, "TRANSFER", "000000")
	if validWrong {
		t.Fatal("Expected invalid code to fail verification")
	}

	// Test valid code
	validCorrect, err := authSvc.VerifyOTP(testUserID, "TRANSFER", code)
	if err != nil || !validCorrect {
		t.Fatalf("Expected correct code to pass verification: %v", err)
	}
}
