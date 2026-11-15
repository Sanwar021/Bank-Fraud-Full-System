# Bank Investigation
### AI-Powered Core Banking Platform & Intelligent Fraud Detection System

> **⚠️ SIMULATED DEMONSTRATION ENVIRONMENT**  
> *This platform is built exclusively for educational, research, and technical portfolio demonstration purposes. All customer records, account identifiers, transactions, and fraud classifications are synthetically generated. No connection to live payment rails or real-world money processing exists.*

---

## 1. Executive Summary

**Bank Investigation** is a production-inspired, full-stack digital banking platform and automated fraud investigation center. It couples a high-throughput, ACID-compliant double-entry ledger backend with a tri-model machine learning fraud scoring microservice and an operations dashboard.

### Core Architectural Capabilities
1. **Financial Precision & Double-Entry Accounting**: Immutably balanced `ledger_entries` where $\sum \text{Debits} \equiv \sum \text{Credits}$. Balances are computed in `NUMERIC(18,4)` with zero floating-point arithmetic.
2. **ACID Transaction Safety & Deadlock Prevention**: Deterministic, ordered row-level locks (`SELECT ... FOR UPDATE` ordered by `min(src, dst)` then `max(src, dst)`) eliminating race conditions and double-spending across concurrent goroutines.
3. **Controlled State Machine**:
   $$\text{INITIATED} \longrightarrow \text{VALIDATION} \longrightarrow \text{RISK\_ASSESSMENT} \longrightarrow \begin{cases} \text{APPROVED} & (\text{Risk} < 30.0) \\ \text{OTP\_REQUIRED} & (30.0 \le \text{Risk} < 70.0) \\ \text{BLOCKED} & (\text{Risk} \ge 70.0) \\ \text{HELD\_FOR\_REVIEW} & (\text{ML Timeout} > 150\text{ms}) \end{cases}$$
4. **Tri-Model ML Fraud Defense Microservice**:
   - **XGBoost Classifier**: Supervised gradient-boosted decision trees with **SHAP TreeExplainer** feature attribution.
   - **Isolation Forest**: Unsupervised spatial anomaly isolation.
   - **PyTorch Sequence Autoencoder**: Deep bottleneck reconstruction error against historical sequences.
5. **Real-Time Fraud Investigation Operations Center**:
   - Real-time Server-Sent Events (SSE) streaming gateway transaction feed.
   - Multi-tier alert triage queue with analyst adjudication workflow.
   - Interactive SHAP waterfall/bar charts explaining every model prediction.
   - Overriding release mechanism that posts approved transactions to the ledger.

---

## 2. System Architecture

```
               +-------------------------------------------------------+
               |              React 18 + Vite + TypeScript             |
               |         Customer Portal & Investigation Center         |
               +---------------------------+---------------------------+
                                           |
                                  REST API / SSE Stream
                                           |
                                           v
               +-------------------------------------------------------+
               |              Go 1.24+ Monolithic Backend              |
               |              (Gin Framework + GORM Engine)            |
               +---+-----------------------+-----------------------+---+
                   |                       |                       |
       ACID Double-Entry             Cache & Velocity          150ms HTTP
         Transactions                    Counters              Inference
                   |                       |                       |
                   v                       v                       v
        +--------------------+   +-------------------+   +--------------------+
        |   PostgreSQL 16    |   |     Redis 7       |   |   Python FastAPI   |
        |  (23 Relational    |   | (Token Blacklist, |   |    ML Microservice |
        |   Tables & Locks)  |   |  OTPs, Fallback)  |   | (XGB + IF + PyTorch)|
        +--------------------+   +-------------------+   +--------------------+
```

---

## 3. Technology Stack

| Domain | Technologies |
| :--- | :--- |
| **Backend** | Go 1.24+, Gin HTTP Framework, GORM ORM, raw transactional locks, Argon2id, dual JWT (Access + Refresh Rotation) |
| **Database** | PostgreSQL 16/17 (`NUMERIC(18,4)` financial precision, check constraints, immutable ledger tables) |
| **Cache & Speed** | Redis 7 (Token blacklisting, velocity counters, OTP storage with resilient in-memory fallback) |
| **Machine Learning**| Python 3.11+, FastAPI, XGBoost, SHAP TreeExplainer, scikit-learn Isolation Forest, PyTorch Autoencoder |
| **Frontend UI** | React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, Recharts, Lucide Icons, React Hook Form, Zod |
| **Orchestration** | Docker, Docker Compose, Multi-Stage Dockerfiles, Nginx SPA proxy, Makefile |
| **Automated Tests**| Go standard unit/integration testing suite, Pytest inference suite, E2E 4-path pipeline tests |

---

## 4. Demo Personas & Pre-Configured Credentials

The platform includes seed personas to test every role:

| Role | Email Address | Password | Permissions & Dashboard |
| :--- | :--- | :--- | :--- |
| **Customer** | `john.doe@bankinvestigation.com` | `Password123!` | Personal accounts, transfers, statements, card controls, loan calculator |
| **Fraud Analyst** | `analyst@bankinvestigation.com` | `Analyst123!` | Investigation Center, live alert triage, SHAP drilldown, adjudication |
| **Bank Admin** | `admin@bankinvestigation.com` | `Admin123!` | System-wide overview, security audit trail, model telemetry |
| **Bank Teller** | `teller@bankinvestigation.com` | `Teller123!` | Account servicing, transaction lookup, customer management |

*Quick login buttons are available on the login screen to switch personas instantly.*

---

## 5. Transaction Safety State Machine

Every financial movement follows an explicit, unskippable lifecycle:

```
[INITIATED]
    │
    ▼
[VALIDATION] ── (Balance < Amount + Fee) ──► [REJECTED]
    │
    ▼
[RISK_ASSESSMENT] ── (ML Timeout > 150ms) ──► [HELD_FOR_REVIEW] (Never auto-approved)
    │
    ├── (Score < 30.0)  ────────► [APPROVED] ──► Atomic Ledger Posting ──► [COMPLETED]
    │
    ├── (30.0 ≤ Score < 70.0) ──► [OTP_REQUIRED] ──► (Verify OTP) ───────► [APPROVED] ──► [COMPLETED]
    │
    └── (Score ≥ 70.0)  ────────► [BLOCKED] ──► Dispatches Urgent Alert to Analyst Queue
```

### Safety Guarantees
- **No Early Debits**: Account balances are **never** decremented before a transaction reaches the `APPROVED` state.
- **Fail-Safe ML Rule**: If the ML service times out or crashes, the transaction is **held for investigation**; it is never auto-approved.
- **Atomic Balance Updates**: Ledgers write debits and credits in the same database transaction that updates account balances.

---

## 6. One-Click Interactive Demo Scenarios

On the **Send Money** (`/transfer`) screen, the platform provides one-click scenario presets:

1. **🟢 Low-Risk Transfer ($45.00)**: Normal daylight hours, standard amount. Evaluated at score ~14.5. Instantly approved and posted to the double-entry ledger.
2. **🟡 Medium-Risk Transfer ($1,850.00)**: Unusual velocity spike. Evaluated at score ~48.5. Challenges the customer with step-up Two-Factor Authentication (OTP). Once verified, atomically posts to the ledger.
3. **🔴 High-Risk Attack ($12,500.00)**: Sudden total balance drain / Account Takeover (ATO) signature. Evaluated at score ~88.5. Automatically blocked, zero funds debited, and an alert dispatched to the Investigation Center.
4. **⚠️ ML Service Failure Hold**: Demonstrates how transactions are held for review if the inference service is unreachable, protecting the bank against bypass attempts.

---

## 7. Investigation Center Features

Analysts access the **Investigation Hub** (`/investigation`):
- **Live SSE Event Stream**: Real-time push stream showing transactions, alerts, and system state transitions.
- **Model Explainability (XGBoost + SHAP)**: Visual horizontal bar chart detailing how specific features (e.g., `balance_drain_ratio`, `velocity_1h`, `geo_distance_km`) increased or decreased the risk score.
- **Tri-Model Breakdown**:
  - Supervised XGBoost Probability Score
  - Unsupervised Isolation Forest Outlier Score
  - Deep PyTorch Sequence Autoencoder Reconstruction Error
- **Analyst Adjudication Actions**:
  - `Release & Post Ledger`: Overrides the hold/challenge, approving the transaction and executing atomic ledger postings.
  - `Confirm Fraud & Freeze`: Formally confirms fraud, blocks the transaction, and freezes the compromised source account.
  - `False Positive`: Tags the pattern as legitimate anomalous behavior.
  - `Escalate`: Routes the incident to senior financial crimes compliance officers.
- **Immutable Security Audit Trail**: Complete log of authentication attempts, lockout triggers, and financial decisions.

---

## 8. Quickstart & Installation

### Option A: Complete Docker Compose (Recommended)

1. Clone repository and navigate to the project root:
   ```bash
   cd "bank fraud"
   ```
2. Build and launch all five containerized services:
   ```bash
   docker compose up -d --build
   ```
3. Run the synthetic database seed:
   ```bash
   make seed
   ```
4. Access the applications:
   - **Customer Web Portal & Investigation Hub**: [http://localhost:3000](http://localhost:3000)
   - **Go Core Banking API Gateway**: [http://localhost:8080](http://localhost:8080)
   - **FastAPI ML Inference Service Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option B: Native Development Setup

#### 1. PostgreSQL & Redis
Ensure PostgreSQL is running (configured on port `5433` in `.env`) and Redis is active (or rely on the automated in-memory fallback):
```bash
# Verify database connection
psql -U postgres -h localhost -p 5433 -d bank_investigation
```

#### 2. Seed Database
```bash
cd backend
go run ./cmd/seed
```

#### 3. Start Python ML Microservice
```bash
cd ml-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 4. Start Go Backend API Gateway
```bash
cd backend
go run ./cmd/api
```

#### 5. Start React Frontend SPA
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173`.

---

## 9. Automated Testing Suite

### Run Go Backend Unit, Integration & Concurrency Tests:
```bash
cd backend
go test -v ./tests/...
```
*Tests verified: password hashing, JWT rotation, KYC onboarding, account lockout after 5 failed logins, OTP verification, double-entry ledger zero-sum balancing, 10-goroutine concurrent transfer race condition prevention, and ML timeout fallback.*

### Run E2E 4-Scenario Pipeline Integration Test:
```bash
cd backend
go test -v -run TestE2EComprehensiveBankingAndFraudPipeline ./tests/...
```

### Run Python ML Pytest Suite:
```bash
cd ml-service
pytest -v
```

---

## 10. Database Schema Overview

The database contains 23 normalized tables enforcing relational integrity:
- `users`: Authentication identities, password hashes (Argon2id), lockout timestamps, roles.
- `customers`: Verified customer profiles, KYC status, risk tier, monthly income.
- `accounts`: Savings, current, and reserve accounts with `NUMERIC(18,4)` balances and limit constraints.
- `transactions`: Finite state machine records (`INITIATED` $\to$ `COMPLETED` / `BLOCKED`).
- `transaction_status_history`: Complete state transition audit trail with timestamps and analyst IDs.
- `ledger_entries`: Immutable zero-sum double-entry ledger table ($\sum \text{Debit} \equiv \sum \text{Credit}$).
- `cards`: Debit cards with masked numbers, status toggles, and limits.
- `loans` & `loan_repayments`: Fixed-rate consumer loans and installment schedules.
- `fixed_deposits`: Term deposit principal, APY interest accrual, and maturity dates.
- `fraud_scores`: Tri-model scores (XGB, IF, AE), ensemble score, and serialized SHAP feature values.
- `fraud_alerts`: Analyst triage queue with severities (`MEDIUM`, `HIGH`, `CRITICAL`).
- `fraud_analyst_decisions`: Official analyst adjudication records with reasons and notes.
- `audit_logs`: System-wide immutable security audit trail.

---

## 11. Ethical & Compliance Notice

This system does not connect to real financial networks (Fedwire, ACH, SWIFT, Visa, Mastercard). All money movements are simulated via internal double-entry accounting records. The project demonstrates financial software engineering, ML explainability, and cybersecurity defense architecture.

