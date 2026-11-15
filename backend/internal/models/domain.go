package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Role constants
const (
	RoleCustomer     = "CUSTOMER"
	RoleTeller       = "TELLER"
	RoleFraudAnalyst = "FRAUD_ANALYST"
	RoleAdmin        = "ADMIN"
)

// Account type constants
const (
	AccountSavings       = "SAVINGS"
	AccountCurrent       = "CURRENT"
	AccountFixedDeposit  = "FIXED_DEPOSIT"
	AccountSystemReserve = "SYSTEM_RESERVE"
)

// Account status
const (
	AccountStatusActive  = "ACTIVE"
	AccountStatusDormant = "DORMANT"
	AccountStatusFrozen  = "FROZEN"
	AccountStatusClosed  = "CLOSED"
)

// Transaction status constants (State Machine)
const (
	TxStatusInitiated      = "INITIATED"
	TxStatusValidation     = "VALIDATION"
	TxStatusRiskAssessment = "RISK_ASSESSMENT"
	TxStatusApproved       = "APPROVED"
	TxStatusOTPRequired    = "OTP_REQUIRED"
	TxStatusUnderReview    = "UNDER_REVIEW"
	TxStatusHeldForReview  = "HELD_FOR_REVIEW"
	TxStatusBlocked        = "BLOCKED"
	TxStatusCompleted      = "COMPLETED"
	TxStatusRejected       = "REJECTED"
	TxStatusCancelled      = "CANCELLED"
)

// Transfer types
const (
	TransferInternal  = "INTERNAL"
	TransferInterbank = "INTERBANK"
	TransferBillPay   = "BILL_PAY"
	TransferFee       = "FEE"
	TransferInterest  = "INTEREST"
)

// Ledger entry types
const (
	EntryDebit  = "DEBIT"
	EntryCredit = "CREDIT"
)

// Risk classifications
const (
	RiskLow    = "LOW RISK"
	RiskMedium = "MEDIUM RISK"
	RiskHigh   = "HIGH RISK"
)

type JWTClaims struct {
	UserID    uuid.UUID `json:"user_id"`
	Email     string    `json:"email"`
	RoleID    string    `json:"role_id"`
	SessionID uuid.UUID `json:"session_id"`
}

type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	TokenType    string    `json:"token_type"`
}

type Role struct {
	ID          string    `gorm:"primaryKey;type:varchar(32)" json:"id"`
	Name        string    `gorm:"uniqueIndex;type:varchar(64)" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type User struct {
	ID                  uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email               string     `gorm:"uniqueIndex;type:varchar(255);not null" json:"email"`
	PasswordHash        string     `gorm:"type:varchar(255);not null" json:"-"`
	RoleID              string     `gorm:"type:varchar(32);not null" json:"role_id"`
	Role                Role       `gorm:"foreignKey:RoleID" json:"role"`
	IsActive            bool       `gorm:"default:true" json:"is_active"`
	FailedLoginAttempts int        `gorm:"default:0" json:"failed_login_attempts"`
	LockedUntil         *time.Time `json:"locked_until,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`

	Customer *Customer `gorm:"foreignKey:UserID" json:"customer,omitempty"`
}

type Customer struct {
	ID            uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID        uuid.UUID       `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	FirstName     string          `gorm:"type:varchar(100);not null" json:"first_name"`
	LastName      string          `gorm:"type:varchar(100);not null" json:"last_name"`
	Phone         string          `gorm:"type:varchar(32);not null" json:"phone"`
	NationalID    string          `gorm:"type:varchar(64);uniqueIndex;not null" json:"national_id"`
	KYCStatus     string          `gorm:"type:varchar(32);default:'VERIFIED'" json:"kyc_status"`
	RiskTier      string          `gorm:"type:varchar(16);default:'STANDARD'" json:"risk_tier"`
	Address       string          `gorm:"type:text" json:"address"`
	MonthlyIncome decimal.Decimal `gorm:"type:numeric(18,4);default:0.0000" json:"monthly_income"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`

	Accounts []Account `gorm:"foreignKey:CustomerID" json:"accounts,omitempty"`
}

type Device struct {
	ID                uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID            uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	DeviceFingerprint string    `gorm:"type:varchar(128);not null" json:"device_fingerprint"`
	UserAgent         string    `gorm:"type:text" json:"user_agent"`
	IPAddress         string    `gorm:"type:varchar(45);not null" json:"ip_address"`
	IsTrusted         bool      `gorm:"default:false" json:"is_trusted"`
	LastActive        time.Time `json:"last_active"`
	CreatedAt         time.Time `json:"created_at"`
}

type Session struct {
	ID               uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID           uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	DeviceID         *uuid.UUID `gorm:"type:uuid" json:"device_id,omitempty"`
	RefreshTokenHash string     `gorm:"type:varchar(255);not null;index" json:"-"`
	ExpiresAt        time.Time  `json:"expires_at"`
	Revoked          bool       `gorm:"default:false" json:"revoked"`
	CreatedAt        time.Time  `json:"created_at"`

	Device *Device `gorm:"foreignKey:DeviceID" json:"device,omitempty"`
}

type OTPRecord struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID     uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	ActionType string    `gorm:"type:varchar(64);not null" json:"action_type"`
	CodeHash   string    `gorm:"type:varchar(255);not null" json:"-"`
	Attempts   int       `gorm:"default:0" json:"attempts"`
	Verified   bool      `gorm:"default:false" json:"verified"`
	ExpiresAt  time.Time `json:"expires_at"`
	CreatedAt  time.Time `json:"created_at"`
}

type Account struct {
	ID            uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CustomerID    uuid.UUID       `gorm:"type:uuid;not null;index" json:"customer_id"`
	AccountNumber string          `gorm:"uniqueIndex;type:varchar(32);not null" json:"account_number"`
	AccountType   string          `gorm:"type:varchar(32);not null" json:"account_type"`
	Currency      string          `gorm:"type:varchar(3);default:'USD'" json:"currency"`
	Status        string          `gorm:"type:varchar(32);default:'ACTIVE'" json:"status"`
	Balance       decimal.Decimal `gorm:"type:numeric(18,4);not null;default:0.0000" json:"balance"`
	DailyLimit    decimal.Decimal `gorm:"type:numeric(18,4);not null;default:50000.0000" json:"daily_limit"`
	PerTxLimit    decimal.Decimal `gorm:"type:numeric(18,4);not null;default:10000.0000" json:"per_tx_limit"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`

	Customer *Customer `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
}

type Beneficiary struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CustomerID    uuid.UUID `gorm:"type:uuid;not null;index" json:"customer_id"`
	Name          string    `gorm:"type:varchar(128);not null" json:"name"`
	AccountNumber string    `gorm:"type:varchar(32);not null" json:"account_number"`
	BankName      string    `gorm:"type:varchar(128);not null" json:"bank_name"`
	RoutingNumber string    `gorm:"type:varchar(64)" json:"routing_number"`
	IsVerified    bool      `gorm:"default:true" json:"is_verified"`
	CreatedAt     time.Time `json:"created_at"`
}

type Transaction struct {
	ID                   uuid.UUID        `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Reference            string           `gorm:"uniqueIndex;type:varchar(64);not null" json:"reference"`
	SourceAccountID      *uuid.UUID       `gorm:"type:uuid;index" json:"source_account_id,omitempty"`
	DestinationAccountID *uuid.UUID       `gorm:"type:uuid;index" json:"destination_account_id,omitempty"`
	TransferType         string           `gorm:"type:varchar(32);not null" json:"transfer_type"`
	Amount               decimal.Decimal  `gorm:"type:numeric(18,4);not null" json:"amount"`
	Fee                  decimal.Decimal  `gorm:"type:numeric(18,4);default:0.0000" json:"fee"`
	Status               string           `gorm:"type:varchar(32);not null;index" json:"status"`
	RiskScore            *decimal.Decimal `gorm:"type:numeric(5,2)" json:"risk_score,omitempty"`
	RiskDecision         string           `gorm:"type:varchar(32);default:'LOW RISK'" json:"risk_decision"`
	IdempotencyKey       *string          `gorm:"uniqueIndex;type:varchar(128)" json:"idempotency_key,omitempty"`
	Description          string           `gorm:"type:text" json:"description"`
	Metadata             string           `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt            time.Time        `gorm:"index" json:"created_at"`
	UpdatedAt            time.Time        `json:"updated_at"`

	SourceAccount      *Account        `gorm:"foreignKey:SourceAccountID" json:"source_account,omitempty"`
	DestinationAccount *Account        `gorm:"foreignKey:DestinationAccountID" json:"destination_account,omitempty"`
	LedgerEntries      []LedgerEntry   `gorm:"foreignKey:TransactionID" json:"ledger_entries,omitempty"`
	FraudScore         *FraudScore     `gorm:"foreignKey:TransactionID" json:"fraud_score,omitempty"`
	FraudAlert         *FraudAlert     `gorm:"foreignKey:TransactionID" json:"fraud_alert,omitempty"`
}

type TransactionStatusHistory struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TransactionID uuid.UUID  `gorm:"type:uuid;not null;index" json:"transaction_id"`
	Status        string     `gorm:"type:varchar(32);not null" json:"status"`
	Reason        string     `gorm:"type:text" json:"reason"`
	ChangedBy     *uuid.UUID `gorm:"type:uuid" json:"changed_by,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

func (TransactionStatusHistory) TableName() string {
	return "transaction_status_history"
}

type LedgerEntry struct {
	ID            uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TransactionID uuid.UUID       `gorm:"type:uuid;not null;index" json:"transaction_id"`
	AccountID     uuid.UUID       `gorm:"type:uuid;not null;index" json:"account_id"`
	EntryType     string          `gorm:"type:varchar(16);not null" json:"entry_type"` // DEBIT or CREDIT
	Amount        decimal.Decimal `gorm:"type:numeric(18,4);not null" json:"amount"`
	BalanceAfter  decimal.Decimal `gorm:"type:numeric(18,4);not null" json:"balance_after"`
	CreatedAt     time.Time       `gorm:"index" json:"created_at"`

	Account *Account `gorm:"foreignKey:AccountID" json:"account,omitempty"`
}

type Card struct {
	ID               uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CustomerID       uuid.UUID       `gorm:"type:uuid;not null;index" json:"customer_id"`
	AccountID        uuid.UUID       `gorm:"type:uuid;not null" json:"account_id"`
	CardNumberMasked string          `gorm:"type:varchar(20);not null" json:"card_number_masked"`
	CardType         string          `gorm:"type:varchar(32);default:'DEBIT'" json:"card_type"`
	SpendingLimit    decimal.Decimal `gorm:"type:numeric(18,4);default:5000.0000" json:"spending_limit"`
	Status           string          `gorm:"type:varchar(32);default:'ACTIVE'" json:"status"`
	ExpiryDate       string          `gorm:"type:varchar(7);not null" json:"expiry_date"`
	CreatedAt        time.Time       `json:"created_at"`

	Account *Account `gorm:"foreignKey:AccountID" json:"account,omitempty"`
}

type Loan struct {
	ID               uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CustomerID       uuid.UUID       `gorm:"type:uuid;not null;index" json:"customer_id"`
	PrincipalAmount  decimal.Decimal `gorm:"type:numeric(18,4);not null" json:"principal_amount"`
	InterestRate     decimal.Decimal `gorm:"type:numeric(5,2);not null" json:"interest_rate"`
	TermMonths       int             `gorm:"not null" json:"term_months"`
	EMIAmount        decimal.Decimal `gorm:"type:numeric(18,4);not null" json:"emi_amount"`
	RemainingBalance decimal.Decimal `gorm:"type:numeric(18,4);not null" json:"remaining_balance"`
	Status           string          `gorm:"type:varchar(32);default:'PENDING'" json:"status"`
	CreatedAt        time.Time       `json:"created_at"`
}

type LoanRepayment struct {
	ID                  uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	LoanID              uuid.UUID       `gorm:"type:uuid;not null;index" json:"loan_id"`
	TransactionID       *uuid.UUID      `gorm:"type:uuid" json:"transaction_id,omitempty"`
	InstallmentNumber   int             `gorm:"not null" json:"installment_number"`
	AmountPaid          decimal.Decimal `gorm:"type:numeric(18,4);not null" json:"amount_paid"`
	PrincipalComponent  decimal.Decimal `gorm:"type:numeric(18,4);not null" json:"principal_component"`
	InterestComponent   decimal.Decimal `gorm:"type:numeric(18,4);not null" json:"interest_component"`
	PaymentDate         time.Time       `json:"payment_date"`
}

type FixedDeposit struct {
	ID               uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CustomerID       uuid.UUID       `gorm:"type:uuid;not null;index" json:"customer_id"`
	SourceAccountID  uuid.UUID       `gorm:"type:uuid;not null" json:"source_account_id"`
	PrincipalAmount  decimal.Decimal `gorm:"type:numeric(18,4);not null" json:"principal_amount"`
	InterestRate     decimal.Decimal `gorm:"type:numeric(5,2);not null" json:"interest_rate"`
	TermMonths       int             `gorm:"not null" json:"term_months"`
	MaturityAmount   decimal.Decimal `gorm:"type:numeric(18,4);not null" json:"maturity_amount"`
	MaturityDate     time.Time       `json:"maturity_date"`
	Status           string          `gorm:"type:varchar(32);default:'ACTIVE'" json:"status"`
	LastAccrualDate  *time.Time      `json:"last_accrual_date,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
}

type Notification struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Type      string    `gorm:"type:varchar(32);not null" json:"type"`
	Channel   string    `gorm:"type:varchar(32);default:'IN_APP'" json:"channel"`
	Title     string    `gorm:"type:varchar(128);not null" json:"title"`
	Message   string    `gorm:"type:text;not null" json:"message"`
	IsRead    bool      `gorm:"default:false" json:"is_read"`
	Metadata  string    `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type FraudScore struct {
	ID                 uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TransactionID      uuid.UUID       `gorm:"type:uuid;uniqueIndex;not null" json:"transaction_id"`
	XGBScore           decimal.Decimal `gorm:"type:numeric(5,2);not null" json:"xgb_score"`
	IForestScore       decimal.Decimal `gorm:"type:numeric(5,2);not null" json:"iforest_score"`
	AutoencoderScore   decimal.Decimal `gorm:"type:numeric(5,2);not null" json:"autoencoder_score"`
	EnsembleScore      decimal.Decimal `gorm:"type:numeric(5,2);not null" json:"ensemble_score"`
	RiskClassification string          `gorm:"type:varchar(32);not null" json:"risk_classification"`
	TopSHAPFeatures    string          `gorm:"type:jsonb" json:"top_shap_features,omitempty"`
	ProcessingTimeMs   int             `gorm:"default:0" json:"processing_time_ms"`
	ModelVersion       string          `gorm:"type:varchar(32);default:'v1.0.0'" json:"model_version"`
	CreatedAt          time.Time       `json:"created_at"`
}

type FraudAlert struct {
	ID            uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TransactionID uuid.UUID       `gorm:"type:uuid;uniqueIndex;not null" json:"transaction_id"`
	RiskScore     decimal.Decimal `gorm:"type:numeric(5,2);not null" json:"risk_score"`
	Severity      string          `gorm:"type:varchar(16);not null" json:"severity"` // MEDIUM, HIGH, CRITICAL
	Status        string          `gorm:"type:varchar(32);default:'PENDING'" json:"status"`
	AssignedTo    *uuid.UUID      `gorm:"type:uuid" json:"assigned_to,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`

	Transaction *Transaction           `gorm:"foreignKey:TransactionID" json:"transaction,omitempty"`
	Decisions   []FraudAnalystDecision `gorm:"foreignKey:AlertID" json:"decisions,omitempty"`
}

type FraudAnalystDecision struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	AlertID   uuid.UUID `gorm:"type:uuid;not null;index" json:"alert_id"`
	AnalystID uuid.UUID `gorm:"type:uuid;not null;index" json:"analyst_id"`
	Decision  string    `gorm:"type:varchar(32);not null" json:"decision"`
	Reason    string    `gorm:"type:text;not null" json:"reason"`
	Notes     string    `gorm:"type:text" json:"notes"`
	CreatedAt time.Time `json:"created_at"`

	Analyst *User `gorm:"foreignKey:AnalystID" json:"analyst,omitempty"`
}

type ModelVersion struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ModelName string    `gorm:"type:varchar(64);not null" json:"model_name"`
	Version   string    `gorm:"type:varchar(32);not null" json:"version"`
	Metrics   string    `gorm:"type:jsonb;not null" json:"metrics"`
	IsActive  bool      `gorm:"default:false" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type AuditLog struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ActorID    *uuid.UUID `gorm:"type:uuid;index" json:"actor_id,omitempty"`
	ActorRole  string     `gorm:"type:varchar(32);not null" json:"actor_role"`
	Action     string     `gorm:"type:varchar(64);not null;index" json:"action"`
	TargetType string     `gorm:"type:varchar(64);not null;index" json:"target_type"`
	TargetID   string     `gorm:"type:varchar(64);not null;index" json:"target_id"`
	IPAddress  string     `gorm:"type:varchar(45)" json:"ip_address"`
	Outcome    string     `gorm:"type:varchar(32);not null" json:"outcome"` // SUCCESS, FAILED, DENIED
	Details    string     `gorm:"type:jsonb" json:"details,omitempty"`
	CreatedAt  time.Time  `gorm:"index" json:"created_at"`

	Actor *User `gorm:"foreignKey:ActorID" json:"actor,omitempty"`
}

type ScheduledTransfer struct {
	ID                   uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SourceAccountID      uuid.UUID       `gorm:"type:uuid;not null" json:"source_account_id"`
	DestinationAccountID uuid.UUID       `gorm:"type:uuid;not null" json:"destination_account_id"`
	Amount               decimal.Decimal `gorm:"type:numeric(18,4);not null" json:"amount"`
	Frequency            string          `gorm:"type:varchar(32);not null" json:"frequency"`
	NextExecutionDate    time.Time       `json:"next_execution_date"`
	Status               string          `gorm:"type:varchar(32);default:'ACTIVE'" json:"status"`
	CreatedAt            time.Time       `json:"created_at"`
}

type SystemSetting struct {
	Key         string    `gorm:"primaryKey;type:varchar(64)" json:"key"`
	Value       string    `gorm:"type:text;not null" json:"value"`
	Description string    `gorm:"type:text" json:"description"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (t *Transaction) BeforeCreate(tx *gorm.DB) error {
	if t.Metadata == "" {
		t.Metadata = "{}"
	}
	return nil
}

func (n *Notification) BeforeCreate(tx *gorm.DB) error {
	if n.Metadata == "" {
		n.Metadata = "{}"
	}
	return nil
}

func (a *AuditLog) BeforeCreate(tx *gorm.DB) error {
	if a.Details == "" {
		a.Details = "{}"
	}
	return nil
}

func (f *FraudScore) BeforeCreate(tx *gorm.DB) error {
	if f.TopSHAPFeatures == "" {
		f.TopSHAPFeatures = "{}"
	}
	return nil
}
