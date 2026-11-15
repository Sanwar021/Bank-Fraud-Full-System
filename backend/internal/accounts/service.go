package accounts

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"time"

	"github.com/bank-investigation/backend/internal/audit"
	"github.com/bank-investigation/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type AccountService struct {
	repo     *AccountRepository
	auditSvc *audit.AuditService
	db       *gorm.DB
}

func NewAccountService(repo *AccountRepository, auditSvc *audit.AuditService, db *gorm.DB) *AccountService {
	return &AccountService{
		repo:     repo,
		auditSvc: auditSvc,
		db:       db,
	}
}

type AccountSummary struct {
	TotalBalance  decimal.Decimal  `json:"total_balance"`
	SavingsTotal  decimal.Decimal  `json:"savings_total"`
	CurrentTotal  decimal.Decimal  `json:"current_total"`
	FixedDepTotal decimal.Decimal  `json:"fixed_deposit_total"`
	Accounts      []models.Account `json:"accounts"`
}

func (s *AccountService) GetCustomerAccounts(ctx context.Context, customerID uuid.UUID) (*AccountSummary, error) {
	accounts, err := s.repo.GetByCustomerID(ctx, customerID)
	if err != nil {
		return nil, err
	}

	total := decimal.Zero
	savings := decimal.Zero
	current := decimal.Zero
	fdr := decimal.Zero

	for _, a := range accounts {
		total = total.Add(a.Balance)
		switch a.AccountType {
		case models.AccountSavings:
			savings = savings.Add(a.Balance)
		case models.AccountCurrent:
			current = current.Add(a.Balance)
		case models.AccountFixedDeposit:
			fdr = fdr.Add(a.Balance)
		}
	}

	return &AccountSummary{
		TotalBalance:  total,
		SavingsTotal:  savings,
		CurrentTotal:  current,
		FixedDepTotal: fdr,
		Accounts:      accounts,
	}, nil
}

func (s *AccountService) GetAccount(ctx context.Context, accountID, customerID uuid.UUID, role string) (*models.Account, error) {
	acct, err := s.repo.GetByID(ctx, accountID)
	if err != nil {
		return nil, err
	}

	if role != models.RoleAdmin && role != models.RoleFraudAnalyst && role != models.RoleTeller {
		if acct.CustomerID != customerID {
			return nil, ErrUnauthorizedAccount
		}
	}

	return acct, nil
}

func (s *AccountService) GetTransactions(
	ctx context.Context,
	accountID, customerID uuid.UUID,
	role string,
	limit, offset int,
	transferType, status string,
	startDate, endDate *time.Time,
) ([]models.Transaction, int64, error) {
	_, err := s.GetAccount(ctx, accountID, customerID, role)
	if err != nil {
		return nil, 0, err
	}

	return s.repo.GetTransactionsByAccountID(ctx, accountID, limit, offset, transferType, status, startDate, endDate)
}

func (s *AccountService) CreateAccount(
	ctx context.Context,
	customerID uuid.UUID,
	accountType, currency string,
	actorID uuid.UUID,
	ip string,
) (*models.Account, error) {
	if accountType != models.AccountSavings && accountType != models.AccountCurrent {
		return nil, ErrInvalidAccountType
	}
	if currency == "" {
		currency = "USD"
	}

	acct, err := s.repo.CreateAccount(ctx, customerID, accountType, currency, decimal.Zero)
	if err != nil {
		return nil, err
	}

	_ = s.auditSvc.Log(
		&actorID,
		models.RoleCustomer,
		"ACCOUNT_CREATED",
		"ACCOUNT",
		acct.ID.String(),
		ip,
		"SUCCESS",
		map[string]interface{}{
			"account_number": acct.AccountNumber,
			"account_type":   acct.AccountType,
		},
	)

	return acct, nil
}

func (s *AccountService) ExportStatementCSV(
	ctx context.Context,
	accountID, customerID uuid.UUID,
	role string,
	startDate, endDate *time.Time,
) ([]byte, string, error) {
	acct, err := s.GetAccount(ctx, accountID, customerID, role)
	if err != nil {
		return nil, "", err
	}

	txs, _, err := s.repo.GetTransactionsByAccountID(ctx, accountID, 1000, 0, "", "", startDate, endDate)
	if err != nil {
		return nil, "", err
	}

	buf := new(bytes.Buffer)
	writer := csv.NewWriter(buf)

	// CSV Header
	_ = writer.Write([]string{
		"Date (UTC)",
		"Reference",
		"Type",
		"Amount",
		"Fee",
		"Direction",
		"Status",
		"Counterparty Account",
		"Description",
	})

	for _, tx := range txs {
		direction := "DEBIT"
		counterparty := "N/A"
		if tx.DestinationAccountID != nil && *tx.DestinationAccountID == accountID {
			direction = "CREDIT"
			if tx.SourceAccount != nil {
				counterparty = tx.SourceAccount.AccountNumber
			}
		} else {
			if tx.DestinationAccount != nil {
				counterparty = tx.DestinationAccount.AccountNumber
			}
		}

		_ = writer.Write([]string{
			tx.CreatedAt.Format("2006-01-02 15:04:05"),
			tx.Reference,
			tx.TransferType,
			tx.Amount.StringFixed(4),
			tx.Fee.StringFixed(4),
			direction,
			tx.Status,
			counterparty,
			tx.Description,
		})
	}

	writer.Flush()
	filename := fmt.Sprintf("statement-%s-%s.csv", acct.AccountNumber, time.Now().Format("20060102"))
	return buf.Bytes(), filename, nil
}

