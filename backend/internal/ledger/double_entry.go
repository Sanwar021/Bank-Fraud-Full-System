package ledger

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/bank-investigation/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrInsufficientBalance    = errors.New("insufficient available account balance")
	ErrPerTxLimitExceeded     = errors.New("transaction amount exceeds per-transaction limit")
	ErrDailyLimitExceeded     = errors.New("transaction amount exceeds remaining daily limit")
	ErrAccountInactive        = errors.New("one or more participating accounts are not active")
	ErrSameAccountTransfer    = errors.New("source and destination accounts cannot be identical")
	ErrLedgerUnbalanced       = errors.New("fatal accounting invariant violation: debits do not equal credits")
	ErrTransactionNotApproved = errors.New("transaction has not reached approved state for ledger posting")
)

type LedgerEngine struct {
	db *gorm.DB
}

func NewLedgerEngine(db *gorm.DB) *LedgerEngine {
	return &LedgerEngine{db: db}
}

// PostApprovedTransaction atomically executes the double-entry posting for an approved transaction.
// Row-level locks (SELECT FOR UPDATE) are acquired in deterministic order to prevent deadlocks.
func (e *LedgerEngine) PostApprovedTransaction(ctx context.Context, txID uuid.UUID) (*models.Transaction, error) {
	var completedTx *models.Transaction

	err := e.db.WithContext(ctx).Transaction(func(dbTx *gorm.DB) error {
		// 1. Fetch transaction with lock
		var tx models.Transaction
		if err := dbTx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", txID).First(&tx).Error; err != nil {
			return fmt.Errorf("transaction not found: %w", err)
		}

		if tx.Status != models.TxStatusApproved {
			return ErrTransactionNotApproved
		}

		if tx.SourceAccountID == nil || tx.DestinationAccountID == nil {
			return errors.New("missing source or destination account ID")
		}

		srcID := *tx.SourceAccountID
		dstID := *tx.DestinationAccountID

		if srcID == dstID {
			return ErrSameAccountTransfer
		}

		// 2. Deterministic locking order (ordered by UUID string ASC) to prevent concurrent deadlocks
		var firstID, secondID uuid.UUID
		if strings.Compare(srcID.String(), dstID.String()) < 0 {
			firstID, secondID = srcID, dstID
		} else {
			firstID, secondID = dstID, srcID
		}

		var firstAcct, secondAcct models.Account
		if err := dbTx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", firstID).First(&firstAcct).Error; err != nil {
			return fmt.Errorf("failed to lock account %s: %w", firstID, err)
		}
		if err := dbTx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", secondID).First(&secondAcct).Error; err != nil {
			return fmt.Errorf("failed to lock account %s: %w", secondID, err)
		}

		var srcAcct, dstAcct *models.Account
		if firstAcct.ID == srcID {
			srcAcct = &firstAcct
			dstAcct = &secondAcct
		} else {
			srcAcct = &secondAcct
			dstAcct = &firstAcct
		}

		// 3. Status checks
		if srcAcct.Status != models.AccountStatusActive || dstAcct.Status != models.AccountStatusActive {
			return ErrAccountInactive
		}

		// 4. Limit checks (System accounts are exempt)
		if srcAcct.AccountType != models.AccountSystemReserve {
			if tx.Amount.GreaterThan(srcAcct.PerTxLimit) && srcAcct.PerTxLimit.GreaterThan(decimal.Zero) {
				return ErrPerTxLimitExceeded
			}

			// Calculate daily transferred sum for source account
			startOfDay := time.Now().UTC().Truncate(24 * time.Hour)
			var dailySum decimal.Decimal
			var dailySumFloat float64
			dbTx.Model(&models.Transaction{}).
				Select("COALESCE(SUM(amount), 0)").
				Where("source_account_id = ? AND status = ? AND created_at >= ?", srcAcct.ID, models.TxStatusCompleted, startOfDay).
				Scan(&dailySumFloat)

			dailySum = decimal.NewFromFloat(dailySumFloat)
			if dailySum.Add(tx.Amount).GreaterThan(srcAcct.DailyLimit) && srcAcct.DailyLimit.GreaterThan(decimal.Zero) {
				return ErrDailyLimitExceeded
			}
		}

		// 5. Balance check
		totalDeduction := tx.Amount.Add(tx.Fee)
		if srcAcct.AccountType != models.AccountSystemReserve {
			if srcAcct.Balance.LessThan(totalDeduction) {
				return ErrInsufficientBalance
			}
		}

		// 6. Calculate new balances
		newSrcBal := srcAcct.Balance.Sub(totalDeduction)
		newDstBal := dstAcct.Balance.Add(tx.Amount)

		now := time.Now().UTC()

		// 7. Double-entry ledger postings
		var entries []models.LedgerEntry

		// Entry 1: Debit source account for principal amount
		entries = append(entries, models.LedgerEntry{
			TransactionID: tx.ID,
			AccountID:     srcAcct.ID,
			EntryType:     models.EntryDebit,
			Amount:        tx.Amount,
			BalanceAfter:  srcAcct.Balance.Sub(tx.Amount),
			CreatedAt:     now,
		})

		// Entry 2: Credit destination account for principal amount
		entries = append(entries, models.LedgerEntry{
			TransactionID: tx.ID,
			AccountID:     dstAcct.ID,
			EntryType:     models.EntryCredit,
			Amount:        tx.Amount,
			BalanceAfter:  newDstBal,
			CreatedAt:     now,
		})

		// Handling fee if applicable (Credit treasury reserve)
		if tx.Fee.GreaterThan(decimal.Zero) {
			var treasuryAcct models.Account
			if err := dbTx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("account_type = ?", models.AccountSystemReserve).
				First(&treasuryAcct).Error; err == nil {

				newTreasuryBal := treasuryAcct.Balance.Add(tx.Fee)

				// Debit source for fee
				entries = append(entries, models.LedgerEntry{
					TransactionID: tx.ID,
					AccountID:     srcAcct.ID,
					EntryType:     models.EntryDebit,
					Amount:        tx.Fee,
					BalanceAfter:  newSrcBal,
					CreatedAt:     now,
				})

				// Credit treasury for fee
				entries = append(entries, models.LedgerEntry{
					TransactionID: tx.ID,
					AccountID:     treasuryAcct.ID,
					EntryType:     models.EntryCredit,
					Amount:        tx.Fee,
					BalanceAfter:  newTreasuryBal,
					CreatedAt:     now,
				})

				treasuryAcct.Balance = newTreasuryBal
				treasuryAcct.UpdatedAt = now
				if err := dbTx.Save(&treasuryAcct).Error; err != nil {
					return err
				}
			}
		}

		// 8. Invariant verification: Total Debits == Total Credits
		totalDebits := decimal.Zero
		totalCredits := decimal.Zero
		for _, e := range entries {
			if e.EntryType == models.EntryDebit {
				totalDebits = totalDebits.Add(e.Amount)
			} else if e.EntryType == models.EntryCredit {
				totalCredits = totalCredits.Add(e.Amount)
			}
		}

		if !totalDebits.Equal(totalCredits) {
			return ErrLedgerUnbalanced
		}

		// 9. Persist ledger entries
		if err := dbTx.Create(&entries).Error; err != nil {
			return fmt.Errorf("failed to write immutable ledger entries: %w", err)
		}

		// 10. Update account balances
		srcAcct.Balance = newSrcBal
		srcAcct.UpdatedAt = now
		if err := dbTx.Save(srcAcct).Error; err != nil {
			return err
		}

		dstAcct.Balance = newDstBal
		dstAcct.UpdatedAt = now
		if err := dbTx.Save(dstAcct).Error; err != nil {
			return err
		}

		// 11. Transition transaction to COMPLETED
		tx.Status = models.TxStatusCompleted
		tx.UpdatedAt = now
		if err := dbTx.Save(&tx).Error; err != nil {
			return err
		}

		// 12. Record status history
		history := models.TransactionStatusHistory{
			TransactionID: tx.ID,
			Status:        models.TxStatusCompleted,
			Reason:        "Double-entry ledger posting confirmed and balanced",
			CreatedAt:     now,
		}
		if err := dbTx.Create(&history).Error; err != nil {
			return err
		}

		completedTx = &tx
		return nil
	})

	if err != nil {
		return nil, err
	}

	return completedTx, nil
}

