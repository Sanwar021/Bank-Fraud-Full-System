import api from './client';
import { Transaction } from './banking';

export interface InvestigationOverview {
  total_transactions: number;
  total_volume: string;
  pending_alerts: number;
  confirmed_fraud_count: number;
  false_positive_count: number;
  released_count: number;
  blocked_count: number;
  held_count: number;
  avg_risk_score: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
}

export interface FraudDecision {
  id: string;
  alert_id: string;
  analyst_id: string;
  decision: 'CONFIRMED_FRAUD' | 'FALSE_POSITIVE' | 'RELEASED' | 'ESCALATED';
  reason: string;
  notes?: string;
  created_at: string;
  analyst?: {
    id: string;
    email: string;
    role_id: string;
  };
}

export interface FraudAlert {
  id: string;
  transaction_id: string;
  risk_score: string;
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'RESOLVED' | 'ESCALATED';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  transaction?: Transaction;
  decisions?: FraudDecision[];
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  ip_address?: string;
  outcome: string;
  details?: string;
  created_at: string;
  actor?: {
    id: string;
    email: string;
    role_id: string;
  };
}

export interface AdjudicatePayload {
  decision: 'CONFIRMED_FRAUD' | 'FALSE_POSITIVE' | 'RELEASED' | 'ESCALATED';
  reason: string;
  notes?: string;
}

export const investigationApi = {
  getOverview: async (): Promise<InvestigationOverview> => {
    const res = await api.get('/admin/investigation/overview');
    return res.data;
  },

  getAlerts: async (status?: string, severity?: string, page: number = 1, limit: number = 20) => {
    let url = `/admin/investigation/alerts?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    if (severity) url += `&severity=${severity}`;
    const res = await api.get(url);
    return res.data as { alerts: FraudAlert[]; total: number; page: number; limit: number };
  },

  getAlertDetails: async (id: string): Promise<FraudAlert> => {
    const res = await api.get(`/admin/investigation/alerts/${id}`);
    return res.data;
  },

  adjudicateAlert: async (id: string, payload: AdjudicatePayload) => {
    const res = await api.post(`/admin/investigation/alerts/${id}/adjudicate`, payload);
    return res.data;
  },

  getLiveTransactions: async (limit: number = 25): Promise<{ transactions: Transaction[] }> => {
    const res = await api.get(`/admin/investigation/transactions?limit=${limit}`);
    return res.data;
  },

  getAuditLogs: async (action?: string, outcome?: string, page: number = 1, limit: number = 25) => {
    let url = `/admin/investigation/audit-logs?page=${page}&limit=${limit}`;
    if (action) url += `&action=${action}`;
    if (outcome) url += `&outcome=${outcome}`;
    const res = await api.get(url);
    return res.data as { logs: AuditLog[]; total: number; page: number; limit: number };
  },

  connectSSE: (
    onEvent: (event: string, data: any) => void,
    onError?: (err: any) => void
  ): (() => void) => {
    const eventSource = new EventSource('/api/v1/admin/investigation/events');

    eventSource.addEventListener('fraud_alert', (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent('fraud_alert', data);
      } catch (err) {
        console.error('Failed to parse SSE fraud_alert data', err);
      }
    });

    eventSource.addEventListener('transaction_completed', (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent('transaction_completed', data);
      } catch (err) {
        console.error('Failed to parse SSE transaction_completed data', err);
      }
    });

    eventSource.addEventListener('transaction_held', (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent('transaction_held', data);
      } catch (err) {
        console.error('Failed to parse SSE transaction_held data', err);
      }
    });

    eventSource.addEventListener('alert_adjudicated', (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent('alert_adjudicated', data);
      } catch (err) {
        console.error('Failed to parse SSE alert_adjudicated data', err);
      }
    });

    eventSource.onerror = (err) => {
      if (onError) onError(err);
    };

    return () => {
      eventSource.close();
    };
  },
};
