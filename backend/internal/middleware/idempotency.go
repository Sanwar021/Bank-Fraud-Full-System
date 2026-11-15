package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/bank-investigation/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type cachedResponse struct {
	Status int               `json:"status"`
	Header map[string]string `json:"header"`
	Body   string            `json:"body"`
}

type responseBodyWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w responseBodyWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func IdempotencyMiddleware(cache database.CacheService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idempotencyKey := c.GetHeader("Idempotency-Key")
		if idempotencyKey == "" || c.Request.Method == http.MethodGet {
			c.Next()
			return
		}

		ctx := c.Request.Context()
		cacheKey := fmt.Sprintf("idempotency:%s", idempotencyKey)

		// Check if key already processed
		cachedStr, err := cache.Get(ctx, cacheKey)
		if err == nil && cachedStr != "" {
			var resp cachedResponse
			if jsonErr := json.Unmarshal([]byte(cachedStr), &resp); jsonErr == nil {
				for k, v := range resp.Header {
					c.Writer.Header().Set(k, v)
				}
				c.Writer.Header().Set("X-Cache-Lookup", "HIT-Idempotent")
				c.Data(resp.Status, "application/json; charset=utf-8", []byte(resp.Body))
				c.Abort()
				return
			}
		}

		// Intercept response
		w := &responseBodyWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = w

		c.Next()

		// If success status code, cache response for 24 hours
		if c.Writer.Status() >= 200 && c.Writer.Status() < 300 {
			resp := cachedResponse{
				Status: c.Writer.Status(),
				Header: map[string]string{
					"Content-Type": "application/json; charset=utf-8",
				},
				Body: w.body.String(),
			}
			if b, marshalErr := json.Marshal(resp); marshalErr == nil {
				_ = cache.Set(ctx, cacheKey, string(b), 24*time.Hour)
			}
		}
	}
}

