package main

import (
	"fmt"
	"log"
	"time"

	"github.com/bank-investigation/backend/internal/auth"
	"github.com/bank-investigation/backend/internal/config"
	"github.com/bank-investigation/backend/internal/database"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type SeedCustomerDef struct {
	Email        string
	Password     string
	FirstName    string
	LastName     string
	Phone        string
	NationalID   string
	KYCStatus    string
	RiskTier     string
	Address      string
	Income       float64
	SavingsBal   float64
	CurrentBal   float64
	CardMasked   string
}

func main() {
	log.Println("==========================================================")
	log.Println("       BANK INVESTIGATION: Database Seeding Engine         ")
	log.Println("==========================================================")

	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("[Seed] Failed to load configuration: %v", err)
	}

	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Fatalf("[Seed] PostgreSQL connection failed: %v", err)
	}

	// 1. Seed Roles (Idempotent)
	roles := []models.Role{
		{ID: models.RoleCustomer, Name: "Customer", Description: "Retail banking customer"},
		{ID: models.RoleTeller, Name: "Bank Teller", Description: "Branch operational staff"},
		{ID: models.RoleFraudAnalyst, Name: "Fraud Analyst", Description: "Risk and compliance investigator"},
		{ID: models.RoleAdmin, Name: "System Administrator", Description: "Full administrative access"},
	}
	for _, r := range roles {
		db.FirstOrCreate(&r, models.Role{ID: r.ID})
	}
	log.Println("[Seed] Roles verified.")

	// 2. Seed Internal Staff Users
	staffUsers := []struct {
		Email    string
		Password string
		RoleID   string
	}{
		{"admin@bankinvestigation.com", "Admin123!", models.RoleAdmin},
		{"analyst@bankinvestigation.com", "Analyst123!", models.RoleFraudAnalyst},
		{"teller@bankinvestigation.com", "Teller123!", models.RoleTeller},
	}

	for _, s := range staffUsers {
		var u models.User
		if err := db.Where("email = ?", s.Email).First(&u).Error; err != nil {
			pwdHash, _ := auth.HashPassword(s.Password, nil)
			user := models.User{
				Email:        s.Email,
				PasswordHash: pwdHash,
				RoleID:       s.RoleID,
				IsActive:     true,
				CreatedAt:    time.Now().UTC(),
				UpdatedAt:    time.Now().UTC(),
			}
			if err := db.Create(&user).Error; err != nil {
				log.Fatalf("[Seed] Failed to seed staff user %s: %v", s.Email, err)
			}
			log.Printf("[Seed] Staff user created: %s (%s)", s.Email, s.RoleID)
		} else {
			log.Printf("[Seed] Staff user exists: %s", s.Email)
		}
	}

	// 3. Create or Get System Reserve Account (for Double-Entry Balancing of Initial Capital)
	var sysReserve models.Account
	err = db.Where("account_number = ?", "ACC-SYS-RESERVE-01").First(&sysReserve).Error
	if err != nil {
		// Need a placeholder customer for system reserve
		var sysCust models.Customer
		if err := db.Where("national_id = ?", "SYS-RESERVE-NID").First(&sysCust).Error; err != nil {
			var adminUser models.User
			db.Where("email = ?", "admin@bankinvestigation.com").First(&adminUser)
			sysCust = models.Customer{
				UserID:        adminUser.ID,
				FirstName:     "Central",
				LastName:      "Reserve",
				Phone:         "+10000000000",
				NationalID:    "SYS-RESERVE-NID",
				KYCStatus:     "VERIFIED",
				RiskTier:      "LOW",
				Address:       "Bank Investigation Central Treasury",
				MonthlyIncome: decimal.Zero,
			}
			db.Create(&sysCust)
		}

		sysReserve = models.Account{
			CustomerID:    sysCust.ID,
			AccountNumber: "ACC-SYS-RESERVE-01",
			AccountType:   models.AccountSystemReserve,
			Currency:      "USD",
			Status:        models.AccountStatusActive,
			Balance:       decimal.NewFromFloat(10000000.0000), // $10,000,000 Initial Treasury Reserve
			DailyLimit:    decimal.NewFromFloat(10000000.0000),
			PerTxLimit:    decimal.NewFromFloat(10000000.0000),
			CreatedAt:     time.Now().UTC(),
			UpdatedAt:     time.Now().UTC(),
		}
		db.Create(&sysReserve)
		log.Println("[Seed] System Central Reserve Account created.")
	}

	// 4. Seed 10 Fictional Customers with 30 Accounts
	customers := []SeedCustomerDef{
		{
			Email: "john.doe@bankinvestigation.com", Password: "Password123!",
			FirstName: "John", LastName: "Doe", Phone: "+1-555-0101", NationalID: "NID-US-90101",
			KYCStatus: "VERIFIED", RiskTier: "STANDARD", Address: "742 Evergreen Terrace, Springfield",
			Income: 6500.0, SavingsBal: 12500.0, CurrentBal: 3200.0, CardMasked: "4532-••••-••••-1088",
		},
		{
			Email: "alice.smith@bankinvestigation.com", Password: "Password123!",
			FirstName: "Alice", LastName: "Smith", Phone: "+1-555-0102", NationalID: "NID-US-90102",
			KYCStatus: "VERIFIED", RiskTier: "LOW", Address: "10880 Wilshire Blvd, Los Angeles",
			Income: 9200.0, SavingsBal: 45000.0, CurrentBal: 8500.0, CardMasked: "4532-••••-••••-2041",
		},
		{
			Email: "robert.johnson@bankinvestigation.com", Password: "Password123!",
			FirstName: "Robert", LastName: "Johnson", Phone: "+1-555-0103", NationalID: "NID-US-90103",
			KYCStatus: "VERIFIED", RiskTier: "STANDARD", Address: "450 Lexington Ave, New York",
			Income: 5400.0, SavingsBal: 8400.0, CurrentBal: 1950.0, CardMasked: "4532-••••-••••-3092",
		},
		{
			Email: "emily.davis@bankinvestigation.com", Password: "Password123!",
			FirstName: "Emily", LastName: "Davis", Phone: "+1-555-0104", NationalID: "NID-US-90104",
			KYCStatus: "VERIFIED", RiskTier: "LOW", Address: "200 E Randolph St, Chicago",
			Income: 8800.0, SavingsBal: 31000.0, CurrentBal: 6200.0, CardMasked: "4532-••••-••••-4105",
		},
		{
			Email: "michael.wilson@bankinvestigation.com", Password: "Password123!",
			FirstName: "Michael", LastName: "Wilson", Phone: "+1-555-0105", NationalID: "NID-US-90105",
			KYCStatus: "VERIFIED", RiskTier: "ELEVATED", Address: "100 Congress Ave, Austin",
			Income: 4200.0, SavingsBal: 3500.0, CurrentBal: 850.0, CardMasked: "4532-••••-••••-5118",
		},
		{
			Email: "sarah.brown@bankinvestigation.com", Password: "Password123!",
			FirstName: "Sarah", LastName: "Brown", Phone: "+1-555-0106", NationalID: "NID-US-90106",
			KYCStatus: "VERIFIED", RiskTier: "STANDARD", Address: "555 California St, San Francisco",
			Income: 7600.0, SavingsBal: 19500.0, CurrentBal: 4100.0, CardMasked: "4532-••••-••••-6229",
		},
		{
			Email: "david.taylor@bankinvestigation.com", Password: "Password123!",
			FirstName: "David", LastName: "Taylor", Phone: "+1-555-0107", NationalID: "NID-US-90107",
			KYCStatus: "VERIFIED", RiskTier: "STANDARD", Address: "1201 3rd Ave, Seattle",
			Income: 6900.0, SavingsBal: 14200.0, CurrentBal: 2800.0, CardMasked: "4532-••••-••••-7330",
		},
		{
			Email: "jessica.anderson@bankinvestigation.com", Password: "Password123!",
			FirstName: "Jessica", LastName: "Anderson", Phone: "+1-555-0108", NationalID: "NID-US-90108",
			KYCStatus: "VERIFIED", RiskTier: "LOW", Address: "1111 Lincoln Rd, Miami Beach",
			Income: 11500.0, SavingsBal: 68000.0, CurrentBal: 12400.0, CardMasked: "4532-••••-••••-8441",
		},
		{
			Email: "daniel.thomas@bankinvestigation.com", Password: "Password123!",
			FirstName: "Daniel", LastName: "Thomas", Phone: "+1-555-0109", NationalID: "NID-US-90109",
			KYCStatus: "VERIFIED", RiskTier: "HIGH", Address: "800 N Glebe Rd, Arlington",
			Income: 3800.0, SavingsBal: 2100.0, CurrentBal: 450.0, CardMasked: "4532-••••-••••-9552",
		},
		{
			Email: "laura.martinez@bankinvestigation.com", Password: "Password123!",
			FirstName: "Laura", LastName: "Martinez", Phone: "+1-555-0110", NationalID: "NID-US-90110",
			KYCStatus: "VERIFIED", RiskTier: "STANDARD", Address: "1000 Louisiana St, Houston",
			Income: 7100.0, SavingsBal: 16800.0, CurrentBal: 3750.0, CardMasked: "4532-••••-••••-0663",
		},
	}

	for idx, c := range customers {
		var user models.User
		if err := db.Where("email = ?", c.Email).First(&user).Error; err != nil {
			pwdHash, _ := auth.HashPassword(c.Password, nil)
			user = models.User{
				Email:        c.Email,
				PasswordHash: pwdHash,
				RoleID:       models.RoleCustomer,
				IsActive:     true,
				CreatedAt:    time.Now().UTC(),
				UpdatedAt:    time.Now().UTC(),
			}
			if err := db.Create(&user).Error; err != nil {
				log.Fatalf("[Seed] Failed to create user %s: %v", c.Email, err)
			}
		}

		var customer models.Customer
		if err := db.Where("user_id = ?", user.ID).First(&customer).Error; err != nil {
			customer = models.Customer{
				UserID:        user.ID,
				FirstName:     c.FirstName,
				LastName:      c.LastName,
				Phone:         c.Phone,
				NationalID:    c.NationalID,
				KYCStatus:     c.KYCStatus,
				RiskTier:      c.RiskTier,
				Address:       c.Address,
				MonthlyIncome: decimal.NewFromFloat(c.Income),
				CreatedAt:     time.Now().UTC(),
				UpdatedAt:     time.Now().UTC(),
			}
			db.Create(&customer)
		}

		// Account 1: Savings Account
		savNum := fmt.Sprintf("ACC-SAV-%06d", 100000+idx*10+1)
		var savAcct models.Account
		if err := db.Where("account_number = ?", savNum).First(&savAcct).Error; err != nil {
			savAcct = models.Account{
				CustomerID:    customer.ID,
				AccountNumber: savNum,
				AccountType:   models.AccountSavings,
				Currency:      "USD",
				Status:        models.AccountStatusActive,
				Balance:       decimal.NewFromFloat(c.SavingsBal),
				DailyLimit:    decimal.NewFromFloat(25000.0),
				PerTxLimit:    decimal.NewFromFloat(10000.0),
				CreatedAt:     time.Now().UTC(),
				UpdatedAt:     time.Now().UTC(),
			}
			db.Create(&savAcct)
			postInitialLedger(db, sysReserve.ID, savAcct.ID, savAcct.Balance, "Initial Savings Capital Deposit")
		}

		// Account 2: Current Account
		curNum := fmt.Sprintf("ACC-CUR-%06d", 100000+idx*10+2)
		var curAcct models.Account
		if err := db.Where("account_number = ?", curNum).First(&curAcct).Error; err != nil {
			curAcct = models.Account{
				CustomerID:    customer.ID,
				AccountNumber: curNum,
				AccountType:   models.AccountCurrent,
				Currency:      "USD",
				Status:        models.AccountStatusActive,
				Balance:       decimal.NewFromFloat(c.CurrentBal),
				DailyLimit:    decimal.NewFromFloat(50000.0),
				PerTxLimit:    decimal.NewFromFloat(15000.0),
				CreatedAt:     time.Now().UTC(),
				UpdatedAt:     time.Now().UTC(),
			}
			db.Create(&curAcct)
			postInitialLedger(db, sysReserve.ID, curAcct.ID, curAcct.Balance, "Initial Current Account Capital Deposit")
		}

		// Account 3: Fixed Deposit Account (for 10 customers = 30 accounts total)
		fdrNum := fmt.Sprintf("ACC-FDR-%06d", 100000+idx*10+3)
		var fdrAcct models.Account
		if err := db.Where("account_number = ?", fdrNum).First(&fdrAcct).Error; err != nil {
			fdrBal := decimal.NewFromFloat(5000.0 * float64(idx+1))
			fdrAcct = models.Account{
				CustomerID:    customer.ID,
				AccountNumber: fdrNum,
				AccountType:   models.AccountFixedDeposit,
				Currency:      "USD",
				Status:        models.AccountStatusActive,
				Balance:       fdrBal,
				DailyLimit:    decimal.Zero,
				PerTxLimit:    decimal.Zero,
				CreatedAt:     time.Now().UTC(),
				UpdatedAt:     time.Now().UTC(),
			}
			db.Create(&fdrAcct)
			postInitialLedger(db, sysReserve.ID, fdrAcct.ID, fdrBal, "Fixed Deposit Placement")

			// Create Fixed Deposit record
			fdrRec := models.FixedDeposit{
				CustomerID:      customer.ID,
				SourceAccountID: savAcct.ID,
				PrincipalAmount: fdrBal,
				InterestRate:    decimal.NewFromFloat(6.50),
				TermMonths:      12,
				MaturityAmount:  fdrBal.Mul(decimal.NewFromFloat(1.065)),
				MaturityDate:    time.Now().AddDate(1, 0, 0),
				Status:          "ACTIVE",
				CreatedAt:       time.Now().UTC(),
			}
			db.Create(&fdrRec)
		}

		// Debit Card
		var card models.Card
		if err := db.Where("customer_id = ?", customer.ID).First(&card).Error; err != nil {
			card = models.Card{
				CustomerID:       customer.ID,
				AccountID:        savAcct.ID,
				CardNumberMasked: c.CardMasked,
				CardType:         "DEBIT",
				SpendingLimit:    decimal.NewFromFloat(5000.0),
				Status:           "ACTIVE",
				ExpiryDate:       "12/2028",
				CreatedAt:        time.Now().UTC(),
			}
			db.Create(&card)
		}

		// Beneficiaries (linking to other customers)
		if idx > 0 {
			prevCust := customers[idx-1]
			var ben models.Beneficiary
			benAcct := fmt.Sprintf("ACC-SAV-%06d", 100000+(idx-1)*10+1)
			if err := db.Where("customer_id = ? AND account_number = ?", customer.ID, benAcct).First(&ben).Error; err != nil {
				ben = models.Beneficiary{
					CustomerID:    customer.ID,
					Name:          fmt.Sprintf("%s %s", prevCust.FirstName, prevCust.LastName),
					AccountNumber: benAcct,
					BankName:      "Bank Investigation",
					RoutingNumber: "021000021",
					IsVerified:    true,
					CreatedAt:     time.Now().UTC(),
				}
				db.Create(&ben)
			}
		}

		// Welcome Notification
		var notif models.Notification
		if err := db.Where("user_id = ? AND type = 'SYSTEM'", user.ID).First(&notif).Error; err != nil {
			notif = models.Notification{
				UserID:    user.ID,
				Type:      "SYSTEM",
				Channel:   "IN_APP",
				Title:     "Welcome to Bank Investigation",
				Message:   fmt.Sprintf("Welcome %s! Your accounts and debit cards are fully active and ready for simulated transactions.", c.FirstName),
				IsRead:    false,
				Metadata:  "{}",
				CreatedAt: time.Now().UTC(),
			}
			db.Create(&notif)
		}
	}

	log.Println("[Seed] Successfully seeded 10 customers, 30 accounts, cards, and double-entry initial ledger entries.")
	log.Println("==========================================================")
	log.Println("DEMO CREDENTIALS:")
	log.Println("  Customer:      john.doe@bankinvestigation.com    | Password123!")
	log.Println("  Fraud Analyst: analyst@bankinvestigation.com     | Analyst123!")
	log.Println("  Bank Teller:   teller@bankinvestigation.com      | Teller123!")
	log.Println("  Administrator: admin@bankinvestigation.com       | Admin123!")
	log.Println("==========================================================")
}

func postInitialLedger(db *gorm.DB, reserveAcctID, targetAcctID uuid.UUID, amount decimal.Decimal, desc string) {
	if amount.LessThanOrEqual(decimal.Zero) {
		return
	}

	tx := models.Transaction{
		Reference:            fmt.Sprintf("SEED-INIT-%s", uuid.New().String()[:8]),
		SourceAccountID:      &reserveAcctID,
		DestinationAccountID: &targetAcctID,
		TransferType:         models.TransferInternal,
		Amount:               amount,
		Fee:                  decimal.Zero,
		Status:               models.TxStatusCompleted,
		RiskDecision:         models.RiskLow,
		Description:          desc,
		Metadata:             "{}",
		CreatedAt:            time.Now().UTC(),
		UpdatedAt:            time.Now().UTC(),
	}
	if err := db.Create(&tx).Error; err != nil {
		log.Printf("[Seed] Failed to create seed transaction: %v", err)
		return
	}

	// Balanced double-entry entries:
	// DEBIT target account (asset increases)
	db.Create(&models.LedgerEntry{
		TransactionID: tx.ID,
		AccountID:     targetAcctID,
		EntryType:     models.EntryDebit,
		Amount:        amount,
		BalanceAfter:  amount,
		CreatedAt:     time.Now().UTC(),
	})

	// CREDIT reserve account
	db.Create(&models.LedgerEntry{
		TransactionID: tx.ID,
		AccountID:     reserveAcctID,
		EntryType:     models.EntryCredit,
		Amount:        amount,
		BalanceAfter:  decimal.NewFromFloat(10000000.0).Sub(amount),
		CreatedAt:     time.Now().UTC(),
	})
}
