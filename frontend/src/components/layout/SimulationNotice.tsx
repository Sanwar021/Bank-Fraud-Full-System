import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export const SimulationNotice: React.FC = () => {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
      <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="font-medium tracking-tight">
          <strong>SIMULATED BANKING DEMONSTRATION</strong> — Educational & research platform. Synthetic data exclusively. Never connect real credentials or real money.
        </span>
        <div className="hidden sm:flex items-center gap-1.5 ml-auto text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Double-Entry Balanced • ML Fraud Protection Active</span>
        </div>
      </div>
    </div>
  );
};
