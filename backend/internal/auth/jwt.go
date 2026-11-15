package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/bank-investigation/backend/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidToken = errors.New("invalid or expired token")
)

type customJWTClaims struct {
	UserID    uuid.UUID `json:"user_id"`
	Email     string    `json:"email"`
	RoleID    string    `json:"role_id"`
	SessionID uuid.UUID `json:"session_id"`
	jwt.RegisteredClaims
}

type JWTService struct {
	secret        []byte
	accessExpiry  time.Duration
	refreshExpiry time.Duration
}

func NewJWTService(secret string, accessExpiry, refreshExpiry time.Duration) *JWTService {
	return &JWTService{
		secret:        []byte(secret),
		accessExpiry:  accessExpiry,
		refreshExpiry: refreshExpiry,
	}
}

func (j *JWTService) GenerateAccessToken(userID uuid.UUID, email, roleID string, sessionID uuid.UUID) (string, time.Time, error) {
	expiresAt := time.Now().Add(j.accessExpiry)
	claims := customJWTClaims{
		UserID:    userID,
		Email:     email,
		RoleID:    roleID,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "bank-investigation-api",
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString(j.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to sign access token: %w", err)
	}

	return tokenStr, expiresAt, nil
}

func (j *JWTService) GenerateRefreshToken() (string, string, time.Time, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", time.Time{}, err
	}
	token := hex.EncodeToString(bytes)
	tokenHash := HashToken(token)
	expiresAt := time.Now().Add(j.refreshExpiry)
	return token, tokenHash, expiresAt, nil
}

func (j *JWTService) ValidateToken(tokenStr string) (*models.JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &customJWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return j.secret, nil
	})

	if err != nil {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*customJWTClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return &models.JWTClaims{
		UserID:    claims.UserID,
		Email:     claims.Email,
		RoleID:    claims.RoleID,
		SessionID: claims.SessionID,
	}, nil
}

func HashToken(token string) string {
	h := sha256.New()
	h.Write([]byte(token))
	return hex.EncodeToString(h.Sum(nil))
}
