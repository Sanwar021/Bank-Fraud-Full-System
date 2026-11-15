package auth

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/bank-investigation/backend/internal/audit"
	"github.com/bank-investigation/backend/internal/database"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/bank-investigation/backend/internal/notifications"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

var (
	ErrUserNotFound       = errors.New("invalid email or password")
	ErrAccountLocked      = errors.New("account is temporarily locked due to multiple failed login attempts. Please try again later")
	ErrEmailAlreadyExists = errors.New("email is already registered")
	ErrNationalIDExists   = errors.New("national ID is already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrInvalidSession     = errors.New("invalid or revoked session")
	ErrInvalidOTP         = errors.New("invalid or expired verification code")
	ErrMaxOTPAttempts     = errors.New("maximum verification attempts exceeded")
)

type AuthService struct {
	db          *gorm.DB
	jwtService  *JWTService
	cache       database.CacheService
	auditSvc    *audit.AuditService
	notifSvc    *notifications.NotificationService
}

func NewAuthService(
	db *gorm.DB,
	jwtService *JWTService,
	cache database.CacheService,
	auditSvc *audit.AuditService,
	notifSvc *notifications.NotificationService,
) *AuthService {
	return &AuthService{
		db:         db,
		jwtService: jwtService,
		cache:      cache,
		auditSvc:   auditSvc,
		notifSvc:   notifSvc,
	}
}

type RegisterRequest struct {
	Email         string  `json:"email" binding:"required,email"`
	Password      string  `json:"password" binding:"required,min=8"`
	FirstName     string  `json:"first_name" binding:"required"`
	LastName      string  `json:"last_name" binding:"required"`
	Phone         string  `json:"phone" binding:"required"`
	NationalID    string  `json:"national_id" binding:"required"`
	Address       string  `json:"address"`
	MonthlyIncome float64 `json:"monthly_income"`
}

type RegisterResponse struct {
	User     models.User      `json:"user"`
	Customer models.Customer  `json:"customer"`
	Tokens   models.TokenPair `json:"tokens"`
}

type LoginRequest struct {
	Email             string `json:"email" binding:"required,email"`
	Password          string `json:"password" binding:"required"`
	DeviceFingerprint string `json:"device_fingerprint"`
}

type LoginResponse struct {
	User     models.User      `json:"user"`
	Customer *models.Customer `json:"customer,omitempty"`
	Tokens   models.TokenPair `json:"tokens"`
}

func (s *AuthService) RegisterCustomer(req RegisterRequest, ip, userAgent string) (*RegisterResponse, error) {
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// Check if email exists
	var count int64
	if err := s.db.Model(&models.User{}).Where("email = ?", req.Email).Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, ErrEmailAlreadyExists
	}

	// Check national ID
	if err := s.db.Model(&models.Customer{}).Where("national_id = ?", req.NationalID).Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, ErrNationalIDExists
	}

	// Hash password
	pwdHash, err := HashPassword(req.Password, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	var newUser models.User
	var newCustomer models.Customer
	var newSavingsAccount models.Account
	var newCurrentAccount models.Account
	var tokenPair models.TokenPair

	txErr := s.db.Transaction(func(tx *gorm.DB) error {
		// 1. Create User
		newUser = models.User{
			Email:        req.Email,
			PasswordHash: pwdHash,
			RoleID:       models.RoleCustomer,
			IsActive:     true,
			CreatedAt:    time.Now().UTC(),
			UpdatedAt:    time.Now().UTC(),
		}
		if err := tx.Create(&newUser).Error; err != nil {
			return err
		}

		// 2. Create Customer Profile
		newCustomer = models.Customer{
			UserID:        newUser.ID,
			FirstName:     req.FirstName,
			LastName:      req.LastName,
			Phone:         req.Phone,
			NationalID:    req.NationalID,
			KYCStatus:     "VERIFIED", // Mock KYC automatically verified
			RiskTier:      "STANDARD",
			Address:       req.Address,
			MonthlyIncome: decimal.NewFromFloat(req.MonthlyIncome),
			CreatedAt:     time.Now().UTC(),
			UpdatedAt:     time.Now().UTC(),
		}
		if err := tx.Create(&newCustomer).Error; err != nil {
			return err
		}

		// 3. Create default Savings Account
		savAcctNum := generateAccountNumber("SAV")
		newSavingsAccount = models.Account{
			CustomerID:    newCustomer.ID,
			AccountNumber: savAcctNum,
			AccountType:   models.AccountSavings,
			Currency:      "USD",
			Status:        models.AccountStatusActive,
			Balance:       decimal.NewFromFloat(1000.0000), // Complimentary demo starting balance
			DailyLimit:    decimal.NewFromFloat(25000.0000),
			PerTxLimit:    decimal.NewFromFloat(5000.0000),
			CreatedAt:     time.Now().UTC(),
			UpdatedAt:     time.Now().UTC(),
		}
		if err := tx.Create(&newSavingsAccount).Error; err != nil {
			return err
		}

		// 4. Create default Current Account
		curAcctNum := generateAccountNumber("CUR")
		newCurrentAccount = models.Account{
			CustomerID:    newCustomer.ID,
			AccountNumber: curAcctNum,
			AccountType:   models.AccountCurrent,
			Currency:      "USD",
			Status:        models.AccountStatusActive,
			Balance:       decimal.NewFromFloat(500.0000), // Starting demo current account balance
			DailyLimit:    decimal.NewFromFloat(50000.0000),
			PerTxLimit:    decimal.NewFromFloat(10000.0000),
			CreatedAt:     time.Now().UTC(),
			UpdatedAt:     time.Now().UTC(),
		}
		if err := tx.Create(&newCurrentAccount).Error; err != nil {
			return err
		}

		// 5. Create default Debit Card for Savings Account
		cardNum := generateMaskedCardNumber()
		newCard := models.Card{
			CustomerID:       newCustomer.ID,
			AccountID:        newSavingsAccount.ID,
			CardNumberMasked: cardNum,
			CardType:         "DEBIT",
			SpendingLimit:    decimal.NewFromFloat(3000.0000),
			Status:           "ACTIVE",
			ExpiryDate:       time.Now().AddDate(3, 0, 0).Format("01/2006"),
			CreatedAt:        time.Now().UTC(),
		}
		if err := tx.Create(&newCard).Error; err != nil {
			return err
		}

		// 6. Create Device and Session
		deviceFingerprint := "web-" + uuid.New().String()[:8]
		device := models.Device{
			UserID:            newUser.ID,
			DeviceFingerprint: deviceFingerprint,
			UserAgent:         userAgent,
			IPAddress:         ip,
			IsTrusted:         true,
			LastActive:        time.Now().UTC(),
			CreatedAt:         time.Now().UTC(),
		}
		if err := tx.Create(&device).Error; err != nil {
			return err
		}

		rawRefreshToken, tokenHash, refreshExp, err := s.jwtService.GenerateRefreshToken()
		if err != nil {
			return err
		}

		session := models.Session{
			UserID:           newUser.ID,
			DeviceID:         &device.ID,
			RefreshTokenHash: tokenHash,
			ExpiresAt:        refreshExp,
			Revoked:          false,
			CreatedAt:        time.Now().UTC(),
		}
		if err := tx.Create(&session).Error; err != nil {
			return err
		}

		accessToken, accessExp, err := s.jwtService.GenerateAccessToken(newUser.ID, newUser.Email, newUser.RoleID, session.ID)
		if err != nil {
			return err
		}

		tokenPair = models.TokenPair{
			AccessToken:  accessToken,
			RefreshToken: rawRefreshToken,
			ExpiresAt:    accessExp,
			TokenType:    "Bearer",
		}

		return nil
	})

	if txErr != nil {
		return nil, txErr
	}

	// Audit log
	_ = s.auditSvc.Log(
		&newUser.ID,
		models.RoleCustomer,
		"CUSTOMER_REGISTRATION",
		"CUSTOMER",
		newCustomer.ID.String(),
		ip,
		"SUCCESS",
		map[string]interface{}{
			"email":          req.Email,
			"savings_acct":   newSavingsAccount.AccountNumber,
			"current_acct":   newCurrentAccount.AccountNumber,
		},
	)

	// Send welcome notification
	_, _ = s.notifSvc.Send(
		newUser.ID,
		"SYSTEM",
		"IN_APP",
		"Welcome to Bank Investigation",
		fmt.Sprintf("Your account registration is complete. Welcome, %s!", req.FirstName),
		nil,
	)

	newUser.Customer = &newCustomer
	return &RegisterResponse{
		User:     newUser,
		Customer: newCustomer,
		Tokens:   tokenPair,
	}, nil
}

func (s *AuthService) Login(req LoginRequest, ip, userAgent string) (*LoginResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	err := s.db.Preload("Role").Preload("Customer").Where("email = ?", email).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			_ = s.auditSvc.Log(nil, "UNKNOWN", "LOGIN_FAILED", "USER", email, ip, "FAILED", map[string]string{"reason": "user_not_found"})
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	// Check if account is locked
	now := time.Now().UTC()
	if user.LockedUntil != nil && user.LockedUntil.After(now) {
		_ = s.auditSvc.Log(&user.ID, user.RoleID, "LOGIN_BLOCKED", "USER", user.ID.String(), ip, "DENIED", map[string]interface{}{
			"locked_until": user.LockedUntil,
		})
		return nil, ErrAccountLocked
	}

	// Verify password
	matched, err := VerifyPassword(req.Password, user.PasswordHash)
	if err != nil || !matched {
		// Increment failed attempts
		user.FailedLoginAttempts++
		updateFields := map[string]interface{}{
			"failed_login_attempts": user.FailedLoginAttempts,
		}

		if user.FailedLoginAttempts >= 5 {
			lockTime := now.Add(15 * time.Minute)
			user.LockedUntil = &lockTime
			updateFields["locked_until"] = lockTime

			_ = s.auditSvc.Log(&user.ID, user.RoleID, "ACCOUNT_LOCKED", "USER", user.ID.String(), ip, "SUCCESS", map[string]interface{}{
				"attempts": user.FailedLoginAttempts,
				"duration": "15m",
			})
		}

		_ = s.db.Model(&user).Updates(updateFields)
		_ = s.auditSvc.Log(&user.ID, user.RoleID, "LOGIN_FAILED", "USER", user.ID.String(), ip, "FAILED", map[string]interface{}{
			"attempts": user.FailedLoginAttempts,
		})

		if user.FailedLoginAttempts >= 5 {
			return nil, ErrAccountLocked
		}
		return nil, ErrInvalidCredentials
	}

	// Reset failed attempts on success
	s.db.Model(&user).Updates(map[string]interface{}{
		"failed_login_attempts": 0,
		"locked_until":          nil,
	})

	// Device handling
	deviceFingerprint := req.DeviceFingerprint
	if deviceFingerprint == "" {
		deviceFingerprint = "dev-" + uuid.New().String()[:8]
	}

	var device models.Device
	dErr := s.db.Where("user_id = ? AND device_fingerprint = ?", user.ID, deviceFingerprint).First(&device).Error
	if errors.Is(dErr, gorm.ErrRecordNotFound) {
		device = models.Device{
			UserID:            user.ID,
			DeviceFingerprint: deviceFingerprint,
			UserAgent:         userAgent,
			IPAddress:         ip,
			IsTrusted:         false,
			LastActive:        now,
			CreatedAt:         now,
		}
		s.db.Create(&device)
	} else {
		s.db.Model(&device).Updates(map[string]interface{}{
			"ip_address":  ip,
			"user_agent":  userAgent,
			"last_active": now,
		})
	}

	// Create Session
	rawRefreshToken, tokenHash, refreshExp, err := s.jwtService.GenerateRefreshToken()
	if err != nil {
		return nil, err
	}

	session := models.Session{
		UserID:           user.ID,
		DeviceID:         &device.ID,
		RefreshTokenHash: tokenHash,
		ExpiresAt:        refreshExp,
		Revoked:          false,
		CreatedAt:        now,
	}
	if err := s.db.Create(&session).Error; err != nil {
		return nil, err
	}

	// Generate Access Token
	accessToken, accessExp, err := s.jwtService.GenerateAccessToken(user.ID, user.Email, user.RoleID, session.ID)
	if err != nil {
		return nil, err
	}

	_ = s.auditSvc.Log(&user.ID, user.RoleID, "LOGIN_SUCCESS", "USER", user.ID.String(), ip, "SUCCESS", map[string]interface{}{
		"session_id": session.ID,
	})

	return &LoginResponse{
		User:     user,
		Customer: user.Customer,
		Tokens: models.TokenPair{
			AccessToken:  accessToken,
			RefreshToken: rawRefreshToken,
			ExpiresAt:    accessExp,
			TokenType:    "Bearer",
		},
	}, nil
}

func (s *AuthService) RefreshToken(rawRefreshToken, ip string) (*models.TokenPair, error) {
	tokenHash := HashToken(rawRefreshToken)

	var session models.Session
	err := s.db.Where("refresh_token_hash = ? AND revoked = false AND expires_at > ?", tokenHash, time.Now().UTC()).
		First(&session).Error
	if err != nil {
		return nil, ErrInvalidSession
	}

	var user models.User
	if err := s.db.Where("id = ? AND is_active = true", session.UserID).First(&user).Error; err != nil {
		return nil, ErrInvalidSession
	}

	// Token rotation: generate new refresh token and update session
	newRawRefreshToken, newTokenHash, newRefreshExp, err := s.jwtService.GenerateRefreshToken()
	if err != nil {
		return nil, err
	}

	s.db.Model(&session).Updates(map[string]interface{}{
		"refresh_token_hash": newTokenHash,
		"expires_at":        newRefreshExp,
	})

	newAccessToken, accessExp, err := s.jwtService.GenerateAccessToken(user.ID, user.Email, user.RoleID, session.ID)
	if err != nil {
		return nil, err
	}

	_ = s.auditSvc.Log(&user.ID, user.RoleID, "TOKEN_REFRESH", "SESSION", session.ID.String(), ip, "SUCCESS", nil)

	return &models.TokenPair{
		AccessToken:  newAccessToken,
		RefreshToken: newRawRefreshToken,
		ExpiresAt:    accessExp,
		TokenType:    "Bearer",
	}, nil
}

func (s *AuthService) Logout(sessionID uuid.UUID, userID uuid.UUID, ip string) error {
	err := s.db.Model(&models.Session{}).
		Where("id = ? AND user_id = ?", sessionID, userID).
		Update("revoked", true).Error

	_ = s.auditSvc.Log(&userID, "USER", "LOGOUT", "SESSION", sessionID.String(), ip, "SUCCESS", nil)
	return err
}

func (s *AuthService) RequestOTP(userID uuid.UUID, actionType string) (string, error) {
	// Generate 6-digit code
	n, _ := rand.Int(rand.Reader, big.NewInt(900000))
	code := fmt.Sprintf("%06d", n.Int64()+100000)
	codeHash := HashToken(code)

	// Save record
	otp := models.OTPRecord{
		UserID:     userID,
		ActionType: actionType,
		CodeHash:   codeHash,
		Attempts:   0,
		Verified:   false,
		ExpiresAt:  time.Now().UTC().Add(5 * time.Minute),
		CreatedAt:  time.Now().UTC(),
	}

	if err := s.db.Create(&otp).Error; err != nil {
		return "", err
	}

	// Create notification for customer visibility
	_, _ = s.notifSvc.Send(
		userID,
		"SECURITY",
		"SMS",
		"One-Time Password (OTP)",
		fmt.Sprintf("Your OTP for %s is %s. Valid for 5 minutes. Do not share this code.", actionType, code),
		map[string]string{"code": code},
	)

	return code, nil
}

func (s *AuthService) VerifyOTP(userID uuid.UUID, actionType, code string) (bool, error) {
	var otp models.OTPRecord
	err := s.db.Where("user_id = ? AND action_type = ? AND verified = false AND expires_at > ?", userID, actionType, time.Now().UTC()).
		Order("created_at DESC").
		First(&otp).Error

	if err != nil {
		return false, ErrInvalidOTP
	}

	if otp.Attempts >= 3 {
		return false, ErrMaxOTPAttempts
	}

	codeHash := HashToken(code)
	if otp.CodeHash != codeHash {
		s.db.Model(&otp).Update("attempts", otp.Attempts+1)
		return false, ErrInvalidOTP
	}

	s.db.Model(&otp).Update("verified", true)
	return true, nil
}

func (s *AuthService) GetUserSessions(userID uuid.UUID) ([]models.Session, error) {
	var sessions []models.Session
	err := s.db.Where("user_id = ? AND revoked = false AND expires_at > ?", userID, time.Now().UTC()).
		Preload("Device").
		Order("created_at DESC").
		Find(&sessions).Error
	return sessions, err
}

// Helpers
func generateAccountNumber(prefix string) string {
	n, _ := rand.Int(rand.Reader, big.NewInt(9000000000))
	return fmt.Sprintf("%s-%010d", prefix, n.Int64()+1000000000)
}

func generateMaskedCardNumber() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(9000))
	last4 := fmt.Sprintf("%04d", n.Int64()+1000)
	return fmt.Sprintf("4532-••••-••••-%s", last4)
}
