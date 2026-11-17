package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strconv"
	"time"

	"github.com/bank-investigation/backend/internal/config"
	"github.com/bank-investigation/backend/internal/database"
	"github.com/bank-investigation/backend/internal/ledger"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

var activities = []string{
	"bKash merchant payment • Aarong Dhanmondi",
	"Nagad wallet transfer",
	"DESCO electricity bill",
	"Dhaka WASA water bill",
	"Grocery purchase • Shwapno",
	"Internet bill • Link3",
	"Pathao ride payment",
	"Restaurant payment • Sultan's Dine",
	"Mobile recharge • Grameenphone",
	"Tuition fee • North South University",
	"House rent • Bashundhara R/A",
	"Salary credit • Dhaka Tech Solutions",
}

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatal(err)
	}
	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Fatal(err)
	}

	interval := 20 * time.Second
	if raw := os.Getenv("SIMULATOR_INTERVAL_SECONDS"); raw != "" {
		if seconds, parseErr := strconv.Atoi(raw); parseErr == nil && seconds >= 5 {
			interval = time.Duration(seconds) * time.Second
		}
	}
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	log.Printf("[Simulator] Synthetic Bangladesh activity enabled; interval=%s", interval)

	// A short warm-up makes a newly seeded dashboard immediately feel active.
	for i := 0; i < 8; i++ {
		if err := simulate(db, rng, i); err != nil {
			log.Printf("[Simulator] warm-up skipped: %v", err)
		}
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	sequence := 8
	for range ticker.C {
		if err := simulate(db, rng, sequence); err != nil {
			log.Printf("[Simulator] tick skipped: %v", err)
		}
		sequence++
	}
}

func simulate(db *gorm.DB, rng *rand.Rand, sequence int) error {
	var accounts []models.Account
	if err := db.Where("status = ? AND account_type IN ?", models.AccountStatusActive, []string{models.AccountSavings, models.AccountCurrent}).Find(&accounts).Error; err != nil {
		return err
	}
	if len(accounts) < 2 {
		return fmt.Errorf("seeded accounts are not available yet")
	}

	// Include the primary demo customer in every other event so activity is visible after login.
	var demo models.Account
	db.Joins("JOIN customers ON customers.id = accounts.customer_id").
		Joins("JOIN users ON users.id = customers.user_id").
		Where("users.email = ? AND accounts.account_type IN ? AND accounts.status = ?", "john.doe@bankinvestigation.com", []string{models.AccountSavings, models.AccountCurrent}, models.AccountStatusActive).
		First(&demo)

	source := accounts[rng.Intn(len(accounts))]
	destination := accounts[rng.Intn(len(accounts))]
	if demo.ID != uuid.Nil {
		if sequence%2 == 0 {
			source = demo
		} else {
			destination = demo
		}
	}
	for destination.ID == source.ID {
		destination = accounts[rng.Intn(len(accounts))]
	}

	amount := decimal.NewFromInt(int64(350 + rng.Intn(7651)))
	if source.Balance.LessThan(amount.Add(decimal.NewFromInt(10000))) {
		source, destination = destination, source
	}
	if source.Balance.LessThan(amount.Add(decimal.NewFromInt(10000))) {
		for _, candidate := range accounts {
			if candidate.ID != destination.ID && candidate.Balance.GreaterThan(amount.Add(decimal.NewFromInt(10000))) {
				source = candidate
				break
			}
		}
	}
	if source.ID == destination.ID || source.Balance.LessThan(amount) {
		return fmt.Errorf("no suitably funded source account")
	}

	now := time.Now().UTC()
	tx := models.Transaction{
		Reference:       fmt.Sprintf("SIM-BD-%s-%04d", now.Format("20060102-150405"), rng.Intn(10000)),
		SourceAccountID: &source.ID, DestinationAccountID: &destination.ID,
		TransferType: models.TransferInternal, Amount: amount, Fee: decimal.Zero,
		Status: models.TxStatusApproved, RiskDecision: models.RiskLow,
		Description: activities[rng.Intn(len(activities))],
		Metadata:    `{"synthetic":true,"country":"BD","currency":"BDT","channel":"MOBILE_APP"}`,
		CreatedAt:   now, UpdatedAt: now,
	}
	if err := db.Create(&tx).Error; err != nil {
		return err
	}
	posted, err := ledger.NewLedgerEngine(db).PostApprovedTransaction(context.Background(), tx.ID)
	if err != nil {
		db.Model(&tx).Updates(map[string]interface{}{"status": models.TxStatusRejected, "updated_at": time.Now().UTC()})
		return err
	}
	log.Printf("[Simulator] %s | %s | BDT %s", posted.Reference, posted.Description, posted.Amount.StringFixed(2))
	return nil
}
