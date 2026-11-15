package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/bank-investigation/backend/internal/database"
	"github.com/gin-gonic/gin"
)

func RateLimitMiddleware(cache database.CacheService, limit int64, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		key := fmt.Sprintf("ratelimit:%s:%d", ip, time.Now().Unix()/int64(window.Seconds()))

		ctx := c.Request.Context()
		count, err := cache.Incr(ctx, key)
		if err == nil && count == 1 {
			_, _ = cache.Expire(ctx, key, window)
		}

		if err == nil && count > limit {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":   "Too Many Requests",
				"message": "Rate limit exceeded. Please try again shortly.",
			})
			return
		}

		c.Next()
	}
}

