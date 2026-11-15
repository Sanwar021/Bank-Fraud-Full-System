import React from 'react';
import { ShieldCheck, AlertTriangle, Cpu, Layers, Activity } from 'lucide-react';
import { Badge } from '../common/Badge';

interface ModelBreakdownProps {
  xgbScore: number | string;
  iforestScore: number | string;
  autoencoderScore: number | string;
  ensembleScore: number | string;
  riskClassification: string;
  processingTimeMs?: number;
  modelVersion?: string;
}

export const ModelBreakdown: React.FC<ModelBreakdownProps> = ({
  xgbScore,
  iforestScore,
  autoencoderScore,
  ensembleScore,
  riskClassification,
  processingTimeMs = 42,
  modelVersion = 'v1.0.0',
}) => {
  const xgb = typeof xgbScore === 'string' ? parseFloat(xgbScore) : xgbScore;
  const iforest = typeof iforestScore === 'string' ? parseFloat(iforestScore) : iforestScore;
  const ae = typeof autoencoderScore === 'string' ? parseFloat(autoencoderScore) : autoencoderScore;
  const ens = typeof ensembleScore === 'string' ? parseFloat(ensembleScore) : ensembleScore;

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-rose-600 dark:text-rose-400';
    if (score >= 30) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const getProgressColor = (score: number) => {
    if (score >= 70) return 'bg-rose-500';
    if (score >= 30) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" />
            Tri-Model Fraud Defense Telemetry
          </h3>
          <p className="text-[11px] text-slate-400 font-mono">
            Model version: {modelVersion} • Inference latency: {processingTimeMs}ms
          </p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-black font-mono tracking-tight ${getScoreColor(ens)}`}>
            {ens.toFixed(1)}<span className="text-xs font-normal text-slate-400">/100</span>
          </div>
          <Badge
            variant={ens >= 70 ? 'danger' : ens >= 30 ? 'warning' : 'success'}
            size="sm"
          >
            {riskClassification}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. XGBoost */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              XGBoost
            </span>
            <span className="font-mono font-bold text-xs">{xgb.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div className={`h-full ${getProgressColor(xgb)}`} style={{ width: `${Math.min(xgb, 100)}%` }} />
          </div>
          <p className="text-[10px] text-slate-400">
            Supervised gradient boosted decision trees trained on account velocities and behavioral patterns.
          </p>
        </div>

        {/* 2. Isolation Forest */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-500" />
              Isolation Forest
            </span>
            <span className="font-mono font-bold text-xs">{iforest.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div className={`h-full ${getProgressColor(iforest)}`} style={{ width: `${Math.min(iforest, 100)}%` }} />
          </div>
          <p className="text-[10px] text-slate-400">
            Unsupervised tree-based anomaly isolation detecting spatial outliers and abnormal parameters.
          </p>
        </div>

        {/* 3. PyTorch Autoencoder */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-500" />
              Autoencoder
            </span>
            <span className="font-mono font-bold text-xs">{ae.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div className={`h-full ${getProgressColor(ae)}`} style={{ width: `${Math.min(ae, 100)}%` }} />
          </div>
          <p className="text-[10px] text-slate-400">
            Deep PyTorch bottleneck network computing reconstruction error against normal customer sequences.
          </p>
        </div>
      </div>
    </div>
  );
};
