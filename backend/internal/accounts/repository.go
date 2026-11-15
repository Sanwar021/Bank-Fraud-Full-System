package accounts

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/bank-investigation/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

var (
	ErrAccountNotFound     = errors.New("account not found")
	ErrUnauthorizedAccount = errors.New("you are not authorized to access this account")
	ErrInvalidAccountType  = errors.New("invalid account type")
)

type AccountRepository struct {
	db *gorm.DB
}

func NewAccountRepository(db *gorm.DB) *AccountRepository {
	return &AccountRepository{db: db}
}

func (r *AccountRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Account, error) {
	var acct models.Account
	err := r.db.WithContext(ctx).Preload("Customer").Where("id = ?", id).First(&acct).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAccountNotFound
		}
		return nil, err
	}
	return &acct, nil
}

func (r *AccountRepository) GetByAccountNumber(ctx context.Context, accNum string) (*models.Account, error) {
	var acct models.Account
	err := r.db.WithContext(ctx).Preload("Customer").Where("account_number = ?", accNum).First(&acct).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAccountNotFound
		}
		return nil, err
	}
	return &acct, nil
}

func (r *AccountRepository) GetByCustomerID(ctx context.Context, customerID uuid.UUID) ([]models.Account, error) {
	var accounts []models.Account
	err := r.db.WithContext(ctx).
		Where("customer_id = ?", customerID).
		Order("created_at ASC").
		Find(&accounts).Error
	return accounts, err
}

func (r *AccountRepository) GetTransactionsByAccountID(
	ctx context.Context,
	accountID uuid.UUID,
	limit, offset int,
	transferType, status string,
	startDate, endDate *time.Time,
) ([]models.Transaction, int64, error) {
	var transactions []models.Transaction
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Transaction{}).
		Where("source_account_id = ? OR destination_account_id = ?", accountID, accountID)

	if transferType != "" {
		query = query.Where("transfer_type = ?", transferType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if startDate != nil {
		query = query.Where("created_at >= ?", *startDate)
	}
	if endDate != nil {
		query = query.Where("created_at <= ?", *endDate)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if limit <= 0 {
		limit = 20
	}

	err := query.Order("created_at DESC").
		Preload("SourceAccount").
		Preload("DestinationAccount").
		Preload("LedgerEntries").
		Preload("FraudScore").
		Limit(limit).
		Offset(offset).
		Find(&transactions).Error

	return transactions, total, err
}

func (r *AccountRepository) CreateAccount(
	ctx context.Context,
	customerID uuid.UUID,
	accountType, currency string,
	initialDeposit decimal.Decimal,
) (*models.Account, error) {
	prefix := "SAV"
	dailyLimit := decimal.NewFromFloat(25000.0)
	perTxLimit := decimal.NewFromFloat(5000.0)

	if accountType == models.AccountCurrent {
		prefix = "CUR"
		dailyLimit = decimal.NewFromFloat(50000.0)
		perTxLimit = decimal.NewFromFloat(15000.0)
	}

	var newAcct models.Account

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		acctNumber := fmt.Sprintf("ACC-%s-%d", prefix, time.Now().UnixNano()%10000000000)

		newAcct = models.Account{
			CustomerID:    customerID,
			AccountNumber: acctNumber,
			AccountType:   accountType,
			Currency:      currency,
			Status:        models.AccountStatusActive,
			Balance:       initialDeposit,
			DailyLimit:    dailyLimit,
			PerTxLimit:    perTxLimit,
			CreatedAt:     time.Now().UTC(),
			UpdatedAt:     time.Now().UTC(),
		}

		return tx.Create(&newAcct).Error
	})

	if err != nil {
		return nil, err
	}
	return &newAcct, nil
}
