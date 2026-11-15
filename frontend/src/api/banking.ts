import api from './client';

export interface Account {
  id: string;
  customer_id: string;
  account_number: string;
  account_type: 'SAVINGS' | 'CURRENT' | 'FIXED_DEPOSIT' | 'SYSTEM_RESERVE';
  currency: string;
  status: 'ACTIVE' | 'DORMANT' | 'FROZEN' | 'CLOSED';
  balance: string;
  daily_limit: string;
  per_tx_limit: string;
  created_at: string;
  updated_at: string;
  customer?: {
    first_name: string;
    last_name: string;
    national_id?: string;
    kyc_status?: string;
    risk_tier?: string;
    monthly_income?: string;
  };
}

export interface Transaction {
  id: string;
  reference: string;
  source_account_id?: string;
  destination_account_id?: string;
  transfer_type: string;
  amount: string;
  fee: string;
  status: 'INITIATED' | 'VALIDATION' | 'RISK_ASSESSMENT' | 'APPROVED' | 'OTP_REQUIRED' | 'UNDER_REVIEW' | 'HELD_FOR_REVIEW' | 'BLOCKED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  risk_score?: string;
  risk_decision?: string;
  description: string;
  metadata?: string;
  created_at: string;
  source_account?: Account;
  destination_account?: Account;
  fraud_alert?: any;
  fraud_score?: {
    xgb_score: string;
    iforest_score: string;
    autoencoder_score: string;
    ensemble_score: string;
    risk_classification: string;
    top_shap_features: string;
    processing_time_ms: number;
    model_version: string;
  };
}

export interface Beneficiary {
  id: string;
  name: string;
  account_number: string;
  bank_name: string;
  routing_number?: string;
  is_verified: boolean;
  created_at: string;
}

export interface Card {
  id: string;
  account_id: string;
  card_number_masked: string;
  card_type: string;
  spending_limit: string;
  status: 'ACTIVE' | 'FROZEN' | 'BLOCKED';
  expiry_date: string;
  account?: Account;
}

export interface Loan {
  id: string;
  principal_amount: string;
  interest_rate: string;
  term_months: number;
  emi_amount: string;
  remaining_balance: string;
  status: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'CLOSED' | 'DEFAULTED';
  created_at: string;
}

export interface FixedDeposit {
  id: string;
  source_account_id: string;
  principal_amount: string;
  interest_rate: string;
  term_months: number;
  maturity_amount: string;
  maturity_date: string;
  status: 'ACTIVE' | 'MATURED' | 'PREMATURE_CLOSED';
  created_at: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  channel: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface TransferRequest {
  source_account_id: string;
  destination_account_id?: string;
  destination_account_number?: string;
  transfer_type: 'INTERNAL' | 'INTERBANK' | 'BILL_PAY';
  amount: number;
  description: string;
  idempotency_key?: string;
  channel?: string;
}

export interface TransferResponse {
  transaction: Transaction;
  fraud_score?: {
    ensemble_score: number;
    risk_classification: string;
    xgb_score: number;
    iforest_score: number;
    autoencoder_score: number;
    top_shap_features: Record<string, number>;
  };
  requires_otp: boolean;
  demo_otp?: string;
}

export const bankingApi = {
  // Accounts
  getAccounts: async (): Promise<Account[]> => {
    const res = await api.get('/accounts');
    return res.data?.data?.accounts || res.data?.data || res.data || [];
  },

  getAccount: async (id: string): Promise<Account> => {
    const res = await api.get(`/accounts/${id}`);
    return res.data?.data || res.data;
  },

  createAccount: async (account_type: string, currency: string = 'USD') => {
    const res = await api.post('/accounts', { account_type, currency });
    return res.data?.data || res.data;
  },

  getAccountTransactions: async (id: string, limit: number = 20, offset: number = 0) => {
    const res = await api.get(`/accounts/${id}/transactions?limit=${limit}&offset=${offset}`);
    return res.data?.data || res.data;
  },

  exportStatement: async (id: string, format: string = 'csv') => {
    const res = await api.get(`/accounts/${id}/statement?format=${format}`, {
      responseType: 'blob',
    });
    return res.data;
  },

  // Transfers
  initiateTransfer: async (data: TransferRequest, idempotencyKey?: string): Promise<TransferResponse> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    const res = await api.post('/transfers', data, { headers });
    return res.data?.data || res.data;
  },

  getTransfers: async (): Promise<Transaction[]> => {
    const res = await api.get('/transfers');
    return res.data?.data || res.data || [];
  },

  getTransfer: async (id: string): Promise<Transaction> => {
    const res = await api.get(`/transfers/${id}`);
    return res.data?.data || res.data;
  },

  verifyTransferOTP: async (txId: string, code: string): Promise<Transaction> => {
    const res = await api.post(`/transfers/${txId}/otp`, { code });
    return res.data;
  },

  cancelTransfer: async (txId: string) => {
    const res = await api.post(`/transfers/${txId}/cancel`);
    return res.data;
  },

  // Beneficiaries
  getBeneficiaries: async (): Promise<Beneficiary[]> => {
    const res = await api.get('/beneficiaries');
    return res.data?.data || res.data || [];
  },

  createBeneficiary: async (data: { name: string; account_number: string; bank_name: string; routing_number?: string }) => {
    const res = await api.post('/beneficiaries', data);
    return res.data?.data || res.data;
  },

  deleteBeneficiary: async (id: string) => {
    const res = await api.delete(`/beneficiaries/${id}`);
    return res.data?.data || res.data;
  },

  // Cards
  getCards: async (): Promise<Card[]> => {
    const res = await api.get('/cards');
    return res.data?.data || res.data || [];
  },

  updateCardStatus: async (id: string, status: 'ACTIVE' | 'FROZEN') => {
    const res = await api.patch(`/cards/${id}/status`, { status });
    return res.data?.data || res.data;
  },

  updateCardLimit: async (id: string, limit: number) => {
    const res = await api.patch(`/cards/${id}/limit`, { spending_limit: limit });
    return res.data?.data || res.data;
  },

  // Loans
  getLoans: async (): Promise<Loan[]> => {
    const res = await api.get('/loans');
    return res.data?.data || res.data || [];
  },

  calculateEMI: async (principal: number, interestRate: number, termMonths: number) => {
    const res = await api.post('/loans/calculate', {
      principal_amount: principal,
      interest_rate: interestRate,
      term_months: termMonths,
    });
    return res.data?.data || res.data;
  },

  applyLoan: async (principal: number, interestRate: number, termMonths: number) => {
    const res = await api.post('/loans/apply', {
      principal_amount: principal,
      interest_rate: interestRate,
      term_months: termMonths,
    });
    return res.data?.data || res.data;
  },

  // Deposits
  getDeposits: async (): Promise<FixedDeposit[]> => {
    const res = await api.get('/deposits');
    return res.data?.data || res.data || [];
  },

  createDeposit: async (sourceAccountId: string, principal: number, termMonths: number, interestRate: number) => {
    const res = await api.post('/deposits', {
      source_account_id: sourceAccountId,
      principal_amount: principal,
      term_months: termMonths,
      interest_rate: interestRate,
    });
    return res.data?.data || res.data;
  },

  // Notifications
  getNotifications: async (): Promise<{ data: NotificationItem[]; total: number; unread_count: number }> => {
    const res = await api.get('/notifications');
    return res.data;
  },

  markAllNotificationsRead: async () => {
    const res = await api.post('/notifications/read-all');
    return res.data;
  },
};
