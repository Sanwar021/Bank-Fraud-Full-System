import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  TrendingDown,
  Filter,
  Eye,
  Sliders,
} from 'lucide-react';
import { investigationApi, InvestigationOverview, FraudAlert } from '../api/investigation';
import { LiveTransactionFeed } from '../components/investigation/LiveTransactionFeed';
import { AdjudicationModal } from '../components/investigation/AdjudicationModal';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

export const InvestigationDashboard: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // Queries
  const { data: overview } = useQuery({
    queryKey: ['investigation-overview'],
    queryFn: investigationApi.getOverview,
    refetchInterval: 5000,
  });

  const { data: alertData, isLoading: alertsLoading } = useQuery({
    queryKey: ['fraud-alerts', statusFilter, severityFilter],
    queryFn: () => investigationApi.getAlerts(statusFilter, severityFilter, 1, 20),
    refetchInterval: 5000,
  });

  const alerts = alertData?.alerts || [];

  const handleOpenAdjudicate = (alert: FraudAlert) => {
    setSelectedAlert(alert);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Telemetry Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-mono font-bold tracking-wider text-indigo-500 uppercase">
              Financial Crimes Intelligence Center
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mt-1">
            Fraud Operations & Real-Time Triage
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/investigation/audit">
            <Button variant="outline" size="sm">
              Audit Trail
            </Button>
          </Link>
          <Link to="/transfer">
            <Button size="sm">
              Simulate Attack
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Telemetry Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Volume</span>
          <span className="font-mono text-lg font-black text-slate-900 dark:text-slate-100 mt-1 block">
            ${parseFloat(overview?.total_volume || '0').toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
            {overview?.total_transactions || 0} Transactions
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-amber-500 block">Pending Alerts</span>
          <span className="font-mono text-lg font-black text-amber-600 dark:text-amber-400 mt-1 block">
            {overview?.pending_alerts || 0}
          </span>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
            Awaiting Analyst
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-rose-500 block">Confirmed Fraud</span>
          <span className="font-mono text-lg font-black text-rose-600 dark:text-rose-400 mt-1 block">
            {overview?.confirmed_fraud_count || 0}
          </span>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
            Malicious Intent
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-sky-500 block">False Positives</span>
          <span className="font-mono text-lg font-black text-sky-600 dark:text-sky-400 mt-1 block">
            {overview?.false_positive_count || 0}
          </span>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
            Tagged Legitimate
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-emerald-500 block">Released & Posted</span>
          <span className="font-mono text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
            {overview?.released_count || 0}
          </span>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
            Override Posted
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg Risk Score</span>
          <span className="font-mono text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
            {(overview?.avg_risk_score || 0).toFixed(1)}/100
          </span>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
            Tri-Model Ensemble
          </span>
        </div>
      </div>

      {/* Main Grid: Alert Queue (2 cols) & Live SSE Feed (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts Triage Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Fraud Alert Triage Queue
              </h2>
              <span className="text-xs font-mono text-slate-400">
                ({alerts.length} Records)
              </span>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 text-xs">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs font-mono"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="ESCALATED">ESCALATED</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs font-mono"
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
              </select>
            </div>
          </div>

          {/* Alert Cards List */}
          <div className="space-y-3">
            {alertsLoading ? (
              <div className="space-y-3">
                <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
                <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                No fraud alerts matching active filter criteria.
              </div>
            ) : (
              alerts.map((alert: FraudAlert) => {
                const tx = alert.transaction;
                const riskVal = parseFloat(alert.risk_score);

                return (
                  <div
                    key={alert.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold font-mono text-xs ${
                            alert.severity === 'HIGH' || alert.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                          }`}
                        >
                          {alert.severity[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                              Ref: {tx?.reference || alert.transaction_id.slice(0, 12)}
                            </span>
                            <Badge
                              variant={
                                alert.severity === 'HIGH' || alert.severity === 'CRITICAL'
                                  ? 'danger'
                                  : 'warning'
                              }
                              size="sm"
                            >
                              {alert.severity}
                            </Badge>
                            <Badge variant={alert.status === 'PENDING' ? 'warning' : 'success'} size="sm">
                              {alert.status}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Customer: {tx?.source_account?.customer?.first_name || 'N/A'}{' '}
                            {tx?.source_account?.customer?.last_name || ''} ({tx?.source_account?.account_number})
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                          ${parseFloat(tx?.amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] font-mono text-rose-600 dark:text-rose-400 font-semibold">
                          Risk: {riskVal.toFixed(1)}/100
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="text-[10px] text-slate-400 font-mono">
                        Logged: {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>

                      <div className="flex items-center gap-2">
                        <Link to={`/investigation/alerts/${alert.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="w-3.5 h-3.5 mr-1" /> Inspect Models
                          </Button>
                        </Link>
                        {alert.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleOpenAdjudicate(alert)}
                          >
                            Adjudicate
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live SSE Transaction Stream */}
        <div className="space-y-4">
          <LiveTransactionFeed />
        </div>
      </div>

      {/* Adjudication Modal */}
      <AdjudicationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        alert={selectedAlert}
      />
    </div>
  );
};
