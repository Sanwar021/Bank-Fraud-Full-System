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
	Email      string
	Password   string
	FirstName  string
	LastName   string
	Phone      string
	NationalID string
	KYCStatus  string
	RiskTier   string
	Address    string
	Income     float64
	SavingsBal float64
	CurrentBal float64
	CardMasked string
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
			Currency:      "BDT",
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

	// 4. Seed 10 synthetic Bangladeshi customers with 30 BDT accounts.
	customers := []SeedCustomerDef{
		{Email: "john.doe@bankinvestigation.com", Password: "Password123!", FirstName: "Jannat", LastName: "Dewan", Phone: "+8801711000101", NationalID: "SYN-BD-90101", KYCStatus: "VERIFIED", RiskTier: "STANDARD", Address: "Dhanmondi, Dhaka", Income: 95000, SavingsBal: 485000, CurrentBal: 126500, CardMasked: "4532-XXXX-XXXX-1088"},
		{Email: "alice.smith@bankinvestigation.com", Password: "Password123!", FirstName: "Ayesha", LastName: "Rahman", Phone: "+8801811000102", NationalID: "SYN-BD-90102", KYCStatus: "VERIFIED", RiskTier: "LOW", Address: "Gulshan, Dhaka", Income: 145000, SavingsBal: 920000, CurrentBal: 248000, CardMasked: "4532-XXXX-XXXX-2041"},
		{Email: "robert.johnson@bankinvestigation.com", Password: "Password123!", FirstName: "Tanvir", LastName: "Hasan", Phone: "+8801911000103", NationalID: "SYN-BD-90103", KYCStatus: "VERIFIED", RiskTier: "STANDARD", Address: "Agrabad, Chattogram", Income: 78000, SavingsBal: 312000, CurrentBal: 98500, CardMasked: "4532-XXXX-XXXX-3092"},
		{Email: "emily.davis@bankinvestigation.com", Password: "Password123!", FirstName: "Nusrat", LastName: "Jahan", Phone: "+8801611000104", NationalID: "SYN-BD-90104", KYCStatus: "VERIFIED", RiskTier: "LOW", Address: "Uttara, Dhaka", Income: 118000, SavingsBal: 675000, CurrentBal: 189000, CardMasked: "4532-XXXX-XXXX-4105"},
		{Email: "michael.wilson@bankinvestigation.com", Password: "Password123!", FirstName: "Mahmudul", LastName: "Islam", Phone: "+8801511000105", NationalID: "SYN-BD-90105", KYCStatus: "VERIFIED", RiskTier: "ELEVATED", Address: "Zindabazar, Sylhet", Income: 62000, SavingsBal: 175000, CurrentBal: 54000, CardMasked: "4532-XXXX-XXXX-5118"},
		{Email: "sarah.brown@bankinvestigation.com", Password: "Password123!", FirstName: "Farzana", LastName: "Akter", Phone: "+8801311000106", NationalID: "SYN-BD-90106", KYCStatus: "VERIFIED", RiskTier: "STANDARD", Address: "Sonadanga, Khulna", Income: 87000, SavingsBal: 408000, CurrentBal: 114000, CardMasked: "4532-XXXX-XXXX-6229"},
		{Email: "david.taylor@bankinvestigation.com", Password: "Password123!", FirstName: "Arif", LastName: "Hossain", Phone: "+8801711000107", NationalID: "SYN-BD-90107", KYCStatus: "VERIFIED", RiskTier: "STANDARD", Address: "Boalia, Rajshahi", Income: 72000, SavingsBal: 286000, CurrentBal: 83000, CardMasked: "4532-XXXX-XXXX-7330"},
		{Email: "jessica.anderson@bankinvestigation.com", Password: "Password123!", FirstName: "Sadia", LastName: "Chowdhury", Phone: "+8801811000108", NationalID: "SYN-BD-90108", KYCStatus: "VERIFIED", RiskTier: "LOW", Address: "Banani, Dhaka", Income: 175000, SavingsBal: 1250000, CurrentBal: 355000, CardMasked: "4532-XXXX-XXXX-8441"},
		{Email: "daniel.thomas@bankinvestigation.com", Password: "Password123!", FirstName: "Rakib", LastName: "Ahmed", Phone: "+8801911000109", NationalID: "SYN-BD-90109", KYCStatus: "VERIFIED", RiskTier: "HIGH", Address: "Sadar, Cumilla", Income: 48000, SavingsBal: 92000, CurrentBal: 31500, CardMasked: "4532-XXXX-XXXX-9552"},
		{Email: "laura.martinez@bankinvestigation.com", Password: "Password123!", FirstName: "Tanjila", LastName: "Sultana", Phone: "+8801611000110", NationalID: "SYN-BD-90110", KYCStatus: "VERIFIED", RiskTier: "STANDARD", Address: "Sadar, Barishal", Income: 81000, SavingsBal: 348000, CurrentBal: 106000, CardMasked: "4532-XXXX-XXXX-0663"},
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
		db.Model(&customer).Updates(map[string]interface{}{
			"first_name": c.FirstName, "last_name": c.LastName, "phone": c.Phone,
			"national_id": c.NationalID, "kyc_status": c.KYCStatus, "risk_tier": c.RiskTier,
			"address": c.Address, "monthly_income": decimal.NewFromFloat(c.Income),
		})

		// Account 1: Savings Account
		savNum := fmt.Sprintf("ACC-SAV-%06d", 100000+idx*10+1)
		var savAcct models.Account
		if err := db.Where("account_number = ?", savNum).First(&savAcct).Error; err != nil {
			savAcct = models.Account{
				CustomerID:    customer.ID,
				AccountNumber: savNum,
				AccountType:   models.AccountSavings,
				Currency:      "BDT",
				Status:        models.AccountStatusActive,
				Balance:       decimal.NewFromFloat(c.SavingsBal),
				DailyLimit:    decimal.NewFromFloat(500000),
				PerTxLimit:    decimal.NewFromFloat(250000),
				CreatedAt:     time.Now().UTC(),
				UpdatedAt:     time.Now().UTC(),
			}
			db.Create(&savAcct)
			postInitialLedger(db, sysReserve.ID, savAcct.ID, savAcct.Balance, "Initial Savings Capital Deposit")
		}
		db.Model(&savAcct).Updates(map[string]interface{}{"currency": "BDT", "daily_limit": 500000, "per_tx_limit": 250000})

		// Account 2: Current Account
		curNum := fmt.Sprintf("ACC-CUR-%06d", 100000+idx*10+2)
		var curAcct models.Account
		if err := db.Where("account_number = ?", curNum).First(&curAcct).Error; err != nil {
			curAcct = models.Account{
				CustomerID:    customer.ID,
				AccountNumber: curNum,
				AccountType:   models.AccountCurrent,
				Currency:      "BDT",
				Status:        models.AccountStatusActive,
				Balance:       decimal.NewFromFloat(c.CurrentBal),
				DailyLimit:    decimal.NewFromFloat(1000000),
				PerTxLimit:    decimal.NewFromFloat(500000),
				CreatedAt:     time.Now().UTC(),
				UpdatedAt:     time.Now().UTC(),
			}
			db.Create(&curAcct)
			postInitialLedger(db, sysReserve.ID, curAcct.ID, curAcct.Balance, "Initial Current Account Capital Deposit")
		}
		db.Model(&curAcct).Updates(map[string]interface{}{"currency": "BDT", "daily_limit": 1000000, "per_tx_limit": 500000})

		// Account 3: Fixed Deposit Account (for 10 customers = 30 accounts total)
		fdrNum := fmt.Sprintf("ACC-FDR-%06d", 100000+idx*10+3)
		var fdrAcct models.Account
		if err := db.Where("account_number = ?", fdrNum).First(&fdrAcct).Error; err != nil {
			fdrBal := decimal.NewFromFloat(5000.0 * float64(idx+1))
			fdrAcct = models.Account{
				CustomerID:    customer.ID,
				AccountNumber: fdrNum,
				AccountType:   models.AccountFixedDeposit,
				Currency:      "BDT",
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
					BankName:      "Mrraw Bank PLC",
					RoutingNumber: "SYN-BD-001",
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
				Title:     "Welcome to Mrraw Banking",
				Message:   fmt.Sprintf("স্বাগতম %s! Your synthetic BDT accounts are ready for the Bangladesh banking demo.", c.FirstName),
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
