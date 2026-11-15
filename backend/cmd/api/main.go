package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/bank-investigation/backend/internal/accounts"
	"github.com/bank-investigation/backend/internal/audit"
	"github.com/bank-investigation/backend/internal/auth"
	"github.com/bank-investigation/backend/internal/beneficiaries"
	"github.com/bank-investigation/backend/internal/cards"
	"github.com/bank-investigation/backend/internal/config"
	"github.com/bank-investigation/backend/internal/database"
	"github.com/bank-investigation/backend/internal/deposits"
	"github.com/bank-investigation/backend/internal/fraud"
	"github.com/bank-investigation/backend/internal/investigation"
	"github.com/bank-investigation/backend/internal/ledger"
	"github.com/bank-investigation/backend/internal/loans"
	"github.com/bank-investigation/backend/internal/middleware"
	"github.com/bank-investigation/backend/internal/notifications"
	"github.com/bank-investigation/backend/internal/transfers"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func main() {
	log.Println("==========================================================")
	log.Println("   BANK INVESTIGATION: Core Banking Platform Gateway      ")
	log.Println("==========================================================")

	// 1. Load Configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("[Config] Failed to load configuration: %v", err)
	}

	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 2. Initialize Database
	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Fatalf("[Database] PostgreSQL connection failed: %v", err)
	}

	// 3. Initialize Cache
	cache := database.NewCacheService(cfg)

	// 4. Initialize Core Infrastructure Services
	jwtSvc := auth.NewJWTService(cfg.JWTSecret, cfg.JWTAccessExpiry, cfg.JWTRefreshExpiry)
	auditSvc := audit.NewAuditService(db)
	notifSvc := notifications.NewNotificationService(db)
	authSvc := auth.NewAuthService(db, jwtSvc, cache, auditSvc, notifSvc)

	// 5. Initialize Financial & Fraud Engines
	ledgerEngine := ledger.NewLedgerEngine(db)
	fraudClient := fraud.NewFraudClient(cfg.MLServiceURL, cfg.MLInferenceTimeout)
	transferSvc := transfers.NewTransferService(db, ledgerEngine, fraudClient, cache, auditSvc, notifSvc, authSvc)

	// 6. Initialize Repositories & Domain Services
	accountRepo := accounts.NewAccountRepository(db)
	accountSvc := accounts.NewAccountService(accountRepo, auditSvc, db)

	// 7. Initialize Handlers
	authHandler := auth.NewAuthHandler(authSvc, db)
	accountHandler := accounts.NewAccountHandler(accountSvc, db)
	transferHandler := transfers.NewTransferHandler(transferSvc, db)
	beneficiaryHandler := beneficiaries.NewBeneficiaryHandler(db)
	cardHandler := cards.NewCardHandler(db)
	loanHandler := loans.NewLoanHandler(db)
	depositHandler := deposits.NewDepositHandler(db, ledgerEngine)
	investigationSvc := investigation.NewInvestigationService(db, ledgerEngine, auditSvc)
	investigationHandler := investigation.NewInvestigationHandler(investigationSvc)

	// 8. Router Setup
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORSMiddleware(cfg.AllowedOrigins))

	// Health and Status Endpoints
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   cfg.AppName,
			"env":       cfg.AppEnv,
			"timestamp": time.Now().UTC(),
		})
	})

	r.GET("/ready", func(c *gin.Context) {
		sqlDB, err := db.DB()
		if err != nil || sqlDB.Ping() != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "db_unhealthy"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	// API v1 Group
	v1 := r.Group("/api/v1")
	{
		// Auth Endpoints (Public)
		authGroup := v1.Group("/auth")
		{
			authGroup.POST("/register", authHandler.Register)
			authGroup.POST("/login", authHandler.Login)
			authGroup.POST("/refresh", authHandler.Refresh)

			// Protected Auth Endpoints
			authProtected := authGroup.Group("")
			authProtected.Use(middleware.AuthMiddleware(jwtSvc))
			{
				authProtected.POST("/logout", authHandler.Logout)
				authProtected.GET("/me", authHandler.Me)
				authProtected.GET("/sessions", authHandler.GetSessions)
				authProtected.POST("/otp/request", authHandler.RequestOTP)
				authProtected.POST("/otp/verify", authHandler.VerifyOTP)
			}
		}

		// Protected Customer Banking Endpoints
		banking := v1.Group("")
		banking.Use(middleware.AuthMiddleware(jwtSvc))
		{
			// Accounts
			banking.GET("/accounts", accountHandler.GetAccounts)
			banking.POST("/accounts", accountHandler.CreateAccount)
			banking.GET("/accounts/:id", accountHandler.GetAccount)
			banking.GET("/accounts/:id/transactions", accountHandler.GetTransactions)
			banking.GET("/accounts/:id/statement", accountHandler.ExportStatement)

			// Transfers (Idempotency protected)
			banking.POST("/transfers", middleware.IdempotencyMiddleware(cache), transferHandler.Initiate)
			banking.GET("/transfers", transferHandler.List)
			banking.GET("/transfers/:id", transferHandler.GetByID)
			banking.POST("/transfers/:id/otp", transferHandler.VerifyOTP)
			banking.POST("/transfers/:id/cancel", transferHandler.Cancel)

			// Beneficiaries
			banking.GET("/beneficiaries", beneficiaryHandler.List)
			banking.POST("/beneficiaries", beneficiaryHandler.Create)
			banking.DELETE("/beneficiaries/:id", beneficiaryHandler.Delete)

			// Cards
			banking.GET("/cards", cardHandler.List)
			banking.PATCH("/cards/:id/status", cardHandler.UpdateStatus)
			banking.PATCH("/cards/:id/limit", cardHandler.UpdateLimit)

			// Loans
			banking.GET("/loans", loanHandler.List)
			banking.POST("/loans/calculate", loanHandler.CalculateEMI)
			banking.POST("/loans/apply", loanHandler.Apply)

			// Fixed Deposits
			banking.GET("/deposits", depositHandler.List)
			banking.POST("/deposits", depositHandler.Create)

			// Notifications
			banking.GET("/notifications", func(c *gin.Context) {
				userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
				list, total, unread, err := notifSvc.GetUserNotifications(userID, 50, 0)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, gin.H{
					"data":         list,
					"total":        total,
					"unread_count": unread,
				})
			})
			banking.POST("/notifications/read-all", func(c *gin.Context) {
				userID := c.MustGet(middleware.CtxUserIDKey).(uuid.UUID)
				_ = notifSvc.MarkAllAsRead(userID)
				c.JSON(http.StatusOK, gin.H{"message": "All marked as read"})
			})
		}

		// Admin & Investigation Endpoints (ADMIN, FRAUD_ANALYST)
		adminGroup := v1.Group("/admin")
		adminGroup.Use(middleware.AuthMiddleware(jwtSvc))
		adminGroup.Use(middleware.RequireRoles("ADMIN", "FRAUD_ANALYST"))
		{
			adminGroup.GET("/audit-logs", func(c *gin.Context) {
				action := c.Query("action")
				targetType := c.Query("target_type")
				logs, total, err := auditSvc.ListLogs(50, 0, action, targetType)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, gin.H{
					"data":  logs,
					"total": total,
				})
			})
		}

		// Register Investigation & Fraud Center Routes
		investigationHandler.RegisterRoutes(v1, middleware.AuthMiddleware(jwtSvc), middleware.RequireRoles("ADMIN", "FRAUD_ANALYST"))
	}

	// 9. Server Initialization with Graceful Shutdown
	srv := &http.Server{
		Addr:    fmt.Sprintf("%s:%s", cfg.ServerHost, cfg.ServerPort),
		Handler: r,
	}

	go func() {
		log.Printf("[Server] Bank Investigation API Gateway listening on http://%s:%s", cfg.ServerHost, cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Server] Listen error: %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[Server] Shutting down gateway gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("[Server] Server forced to shutdown: %v", err)
	}

	log.Println("[Server] Gateway exited gracefully.")
}
