package middleware

import (
	"net/http"
	"strings"

	"github.com/bank-investigation/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	CtxUserIDKey    = "userID"
	CtxUserEmailKey = "userEmail"
	CtxUserRoleKey  = "userRole"
	CtxSessionIDKey = "sessionID"
)

type TokenValidator interface {
	ValidateToken(tokenStr string) (*models.JWTClaims, error)
}

func AuthMiddleware(validator TokenValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		var token string
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
				token = parts[1]
			}
		} else if cookieToken, err := c.Cookie("access_token"); err == nil {
			token = cookieToken
		}
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "Unauthorized",
				"message": "A valid authenticated session is required",
			})
			return
		}

		claims, err := validator.ValidateToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "Unauthorized",
				"message": "Token is invalid or expired",
			})
			return
		}

		// Inject into Gin context
		c.Set(CtxUserIDKey, claims.UserID)
		c.Set(CtxUserEmailKey, claims.Email)
		c.Set(CtxUserRoleKey, claims.RoleID)
		c.Set(CtxSessionIDKey, claims.SessionID)

		c.Next()
	}
}

func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	val, exists := c.Get(CtxUserIDKey)
	if !exists {
		return [16]byte{}, false
	}
	id, ok := val.(uuid.UUID)
	return id, ok
}

func GetUserRole(c *gin.Context) (string, bool) {
	val, exists := c.Get(CtxUserRoleKey)
	if !exists {
		return "", false
	}
	role, ok := val.(string)
	return role, ok
}
