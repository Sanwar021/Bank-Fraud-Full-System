-- Down Migration
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS scheduled_transfers;
DROP TABLE IF EXISTS model_versions;
DROP TABLE IF EXISTS fraud_analyst_decisions;
DROP TABLE IF EXISTS fraud_alerts;
DROP TABLE IF EXISTS fraud_scores;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS fixed_deposits;
DROP TABLE IF EXISTS loan_repayments;
DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS ledger_entries;
DROP TABLE IF EXISTS transaction_status_history;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS beneficiaries;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS otp_records;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

