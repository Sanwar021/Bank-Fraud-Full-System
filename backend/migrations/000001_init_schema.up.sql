-- Bank Investigation Core Schema Initialization
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id VARCHAR(32) NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);

-- Customers Profile Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    national_id VARCHAR(64) NOT NULL UNIQUE,
    kyc_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED', -- PENDING, VERIFIED, REJECTED
    risk_tier VARCHAR(16) NOT NULL DEFAULT 'STANDARD',  -- LOW, STANDARD, ELEVATED, HIGH
    address TEXT,
    monthly_income NUMERIC(18, 4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_national_id ON customers(national_id);

-- Devices Table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(128) NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(45) NOT NULL,
    is_trusted BOOLEAN NOT NULL DEFAULT FALSE,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_device UNIQUE(user_id, device_fingerprint)
);

CREATE INDEX idx_devices_user ON devices(user_id);

-- Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    refresh_token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(refresh_token_hash);

-- OTP Records Table
CREATE TABLE IF NOT EXISTS otp_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(64) NOT NULL, -- LOGIN, TRANSFER, PASSWORD_RESET
    code_hash VARCHAR(255) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_otp_user_action ON otp_records(user_id, action_type);

-- Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    account_number VARCHAR(32) NOT NULL UNIQUE,
    account_type VARCHAR(32) NOT NULL, -- SAVINGS, CURRENT, FIXED_DEPOSIT, SYSTEM_RESERVE
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DORMANT, FROZEN, CLOSED
    balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    daily_limit NUMERIC(18, 4) NOT NULL DEFAULT 50000.0000,
    per_tx_limit NUMERIC(18, 4) NOT NULL DEFAULT 10000.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_account_balance_non_negative CHECK (
        account_type = 'SYSTEM_RESERVE' OR balance >= 0.0000
    )
);

CREATE INDEX idx_accounts_customer ON accounts(customer_id);
CREATE INDEX idx_accounts_number ON accounts(account_number);

-- Beneficiaries Table
CREATE TABLE IF NOT EXISTS beneficiaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    account_number VARCHAR(32) NOT NULL,
    bank_name VARCHAR(128) NOT NULL,
    routing_number VARCHAR(64),
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_customer_beneficiary UNIQUE(customer_id, account_number, bank_name)
);

CREATE INDEX idx_beneficiaries_customer ON beneficiaries(customer_id);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(64) NOT NULL UNIQUE,
    source_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
    destination_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
    transfer_type VARCHAR(32) NOT NULL, -- INTERNAL, INTERBANK, BILL_PAY, FEE, INTEREST
    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    fee NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (fee >= 0),
    status VARCHAR(32) NOT NULL, -- INITIATED, VALIDATION, RISK_ASSESSMENT, APPROVED, OTP_REQUIRED, UNDER_REVIEW, HELD_FOR_REVIEW, BLOCKED, COMPLETED, REJECTED, CANCELLED
    risk_score NUMERIC(5, 2) DEFAULT 0.00,
    risk_decision VARCHAR(32) DEFAULT 'LOW RISK',
    idempotency_key VARCHAR(128) UNIQUE,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_reference ON transactions(reference);
CREATE INDEX idx_transactions_source ON transactions(source_account_id);
CREATE INDEX idx_transactions_dest ON transactions(destination_account_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- Transaction Status History
CREATE TABLE IF NOT EXISTS transaction_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    reason TEXT,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tx_history_tx ON transaction_status_history(transaction_id);

-- Double-Entry Ledger Entries (Immutable)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    entry_type VARCHAR(16) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    balance_after NUMERIC(18, 4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ledger_tx ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_account ON ledger_entries(account_id);
CREATE INDEX idx_ledger_created ON ledger_entries(created_at);

-- Cards Table
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    card_number_masked VARCHAR(20) NOT NULL,
    card_type VARCHAR(32) NOT NULL DEFAULT 'DEBIT',
    spending_limit NUMERIC(18, 4) NOT NULL DEFAULT 5000.0000,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, BLOCKED, EXPIRED
    expiry_date VARCHAR(7) NOT NULL, -- MM/YYYY
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cards_customer ON cards(customer_id);

-- Loans Table
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    principal_amount NUMERIC(18, 4) NOT NULL,
    interest_rate NUMERIC(5, 2) NOT NULL, -- annual percentage, e.g. 7.50
    term_months INT NOT NULL,
    emi_amount NUMERIC(18, 4) NOT NULL,
    remaining_balance NUMERIC(18, 4) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, ACTIVE, DISBURSED, CLOSED, REJECTED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_loans_customer ON loans(customer_id);

-- Loan Repayments Table
CREATE TABLE IF NOT EXISTS loan_repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    installment_number INT NOT NULL,
    amount_paid NUMERIC(18, 4) NOT NULL,
    principal_component NUMERIC(18, 4) NOT NULL,
    interest_component NUMERIC(18, 4) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_loan_repayments_loan ON loan_repayments(loan_id);

-- Fixed Deposits Table
CREATE TABLE IF NOT EXISTS fixed_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    source_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    principal_amount NUMERIC(18, 4) NOT NULL,
    interest_rate NUMERIC(5, 2) NOT NULL, -- e.g. 6.50
    term_months INT NOT NULL,
    maturity_amount NUMERIC(18, 4) NOT NULL,
    maturity_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, MATURED, LIQUIDATED
    last_accrual_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fixed_deposits_customer ON fixed_deposits(customer_id);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL, -- TRANSACTION, FRAUD_ALERT, SECURITY, SYSTEM
    channel VARCHAR(32) NOT NULL DEFAULT 'IN_APP', -- IN_APP, SMS, EMAIL
    title VARCHAR(128) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- Fraud Scores Table
CREATE TABLE IF NOT EXISTS fraud_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
    xgb_score NUMERIC(5, 2) NOT NULL,
    iforest_score NUMERIC(5, 2) NOT NULL,
    autoencoder_score NUMERIC(5, 2) NOT NULL,
    ensemble_score NUMERIC(5, 2) NOT NULL,
    risk_classification VARCHAR(32) NOT NULL, -- LOW RISK, MEDIUM RISK, HIGH RISK
    top_shap_features JSONB,
    processing_time_ms INT NOT NULL DEFAULT 0,
    model_version VARCHAR(32) NOT NULL DEFAULT 'v1.0.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fraud_scores_tx ON fraud_scores(transaction_id);

-- Fraud Alerts Table
CREATE TABLE IF NOT EXISTS fraud_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
    risk_score NUMERIC(5, 2) NOT NULL,
    severity VARCHAR(16) NOT NULL, -- MEDIUM, HIGH, CRITICAL
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_REVIEW, RESOLVED, DISMISSED
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX idx_fraud_alerts_tx ON fraud_alerts(transaction_id);

-- Fraud Analyst Decisions Table
CREATE TABLE IF NOT EXISTS fraud_analyst_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES fraud_alerts(id) ON DELETE CASCADE,
    analyst_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    decision VARCHAR(32) NOT NULL, -- CONFIRMED_FRAUD, FALSE_POSITIVE, ESCALATED, DISMISSED, RELEASED
    reason TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analyst_decisions_alert ON fraud_analyst_decisions(alert_id);
CREATE INDEX idx_analyst_decisions_analyst ON fraud_analyst_decisions(analyst_id);

-- Model Versions Registry
CREATE TABLE IF NOT EXISTS model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(64) NOT NULL,
    version VARCHAR(32) NOT NULL,
    metrics JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_model_version UNIQUE(model_name, version)
);

-- Scheduled Transfers Table
CREATE TABLE IF NOT EXISTS scheduled_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    destination_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    amount NUMERIC(18, 4) NOT NULL,
    frequency VARCHAR(32) NOT NULL, -- DAILY, WEEKLY, MONTHLY
    next_execution_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, CANCELLED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs Table (Append-Only)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    outcome VARCHAR(32) NOT NULL, -- SUCCESS, FAILED, DENIED
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Initial Roles Seeding
INSERT INTO roles (id, name, description) VALUES
    ('CUSTOMER', 'Customer', 'Retail banking customer with access to own accounts and transfers'),
    ('TELLER', 'Bank Teller', 'Branch staff handling customer service and manual deposits'),
    ('FRAUD_ANALYST', 'Fraud Analyst', 'Operational security and risk investigator adjudicating alerts'),
    ('ADMIN', 'System Administrator', 'Full platform administrative access')
ON CONFLICT (id) DO NOTHING;

-- Initial System Settings
INSERT INTO system_settings (key, value, description) VALUES
    ('FRAUD_WEIGHT_XGBOOST', '0.50', 'Ensemble weight for supervised XGBoost classifier'),
    ('FRAUD_WEIGHT_ISOLATION_FOREST', '0.25', 'Ensemble weight for unsupervised Isolation Forest'),
    ('FRAUD_WEIGHT_AUTOENCODER', '0.25', 'Ensemble weight for sequence autoencoder'),
    ('FRAUD_LOW_THRESHOLD', '30.0', 'Scores below this threshold are auto-approved'),
    ('FRAUD_HIGH_THRESHOLD', '70.0', 'Scores equal or above this threshold are blocked and alerted'),
    ('MAX_FAILED_LOGINS', '5', 'Account locks after this number of failed logins'),
    ('LOCKOUT_DURATION_MINUTES', '15', 'Minutes an account remains locked'),
    ('OTP_EXPIRATION_MINUTES', '5', 'Validity duration for one-time passwords')
ON CONFLICT (key) DO NOTHING;

