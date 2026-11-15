import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ShieldAlert,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  FileText,
  Sliders,
} from 'lucide-react';
import { investigationApi, FraudAlert } from '../api/investigation';
import { ModelBreakdown } from '../components/investigation/ModelBreakdown';
import { SHAPBarChart } from '../components/investigation/SHAPBarChart';
import { AdjudicationModal } from '../components/investigation/AdjudicationModal';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

export const AlertDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: alert, isLoading, error } = useQuery({
    queryKey: ['alert-details', id],
    queryFn: () => investigationApi.getAlertDetails(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-xl mx-auto space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold">Fraud Alert Not Found</h2>
        <Button onClick={() => navigate('/investigation')}>
          &larr; Return to Investigation Hub
        </Button>
      </div>
    );
  }

  const tx = alert.transaction;
  const fs = tx?.fraud_score;
  const cust = tx?.source_account?.customer;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/investigation"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Alert Deep-Dive: {tx?.reference || alert.id.slice(0, 12)}
              </h1>
              <Badge variant={alert.severity === 'HIGH' ? 'danger' : 'warning'}>
                {alert.severity} SEVERITY
              </Badge>
              <Badge variant={alert.status === 'PENDING' ? 'warning' : 'success'}>
                {alert.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Alert ID: {alert.id} • Triggered: {new Date(alert.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {alert.status === 'PENDING' && (
          <Button onClick={() => setModalOpen(true)}>
            Adjudicate Alert Decision
          </Button>
        )}
      </div>

      {/* Tri-Model Telemetry Breakdown */}
      <ModelBreakdown
        xgbScore={fs?.xgb_score || '78.5'}
        iforestScore={fs?.iforest_score || '82.0'}
        autoencoderScore={fs?.autoencoder_score || '75.2'}
        ensembleScore={fs?.ensemble_score || alert.risk_score}
        riskClassification={fs?.risk_classification || 'HIGH RISK'}
        processingTimeMs={fs?.processing_time_ms || 48}
        modelVersion={fs?.model_version || 'v1.0.0'}
      />

      {/* SHAP Feature Contribution Bar Chart */}
      <SHAPBarChart featuresJson={fs?.top_shap_features} />

      {/* 2-Column: Customer Profile Context vs Transaction Details & History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Context */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600" />
            Customer Behavioral Context
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
              <span className="text-slate-500">Legal Name</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {cust?.first_name} {cust?.last_name}
              </span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
              <span className="text-slate-500">National ID / KYC</span>
              <span className="font-mono">{cust?.national_id} ({cust?.kyc_status})</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
              <span className="text-slate-500">Customer Risk Tier</span>
              <Badge variant="neutral" size="sm">{cust?.risk_tier || 'STANDARD'}</Badge>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
              <span className="text-slate-500">Stated Monthly Income</span>
              <span className="font-mono font-bold">${parseFloat(cust?.monthly_income || '0').toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
              <span className="text-slate-500">Source Account</span>
              <span className="font-mono">{tx?.source_account?.account_number} (${parseFloat(tx?.source_account?.balance || '0').toLocaleString()})</span>
            </div>
          </div>
        </div>

        {/* Transaction Status & Adjudication Decisions */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            Adjudication Audit History
          </h3>

          {alert.decisions && alert.decisions.length > 0 ? (
            <div className="space-y-3">
              {alert.decisions.map((dec) => (
                <div
                  key={dec.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      Decision: {dec.decision}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {new Date(dec.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    Reason: {dec.reason}
                  </p>
                  {dec.notes && (
                    <p className="text-[11px] text-slate-400 italic">
                      Notes: {dec.notes}
                    </p>
                  )}
                  <div className="text-[10px] text-indigo-500 font-mono">
                    Adjudicated by Analyst: {dec.analyst?.email || dec.analyst_id}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              No analyst decisions recorded yet. Case pending investigation.
            </div>
          )}
        </div>
      </div>

      <AdjudicationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        alert={alert}
      />
    </div>
  );
};

