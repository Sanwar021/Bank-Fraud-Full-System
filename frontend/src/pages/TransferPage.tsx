import React from 'react';
import { TransferWizard } from '../components/banking/TransferWizard';
import { ArrowRightLeft, ShieldAlert, Cpu, GitCommit, ShieldCheck } from 'lucide-react';

export const TransferPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-zen-600 dark:text-cyan-400 uppercase tracking-wider">
            Mrraw Bank Instant Transfer
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
          <ArrowRightLeft className="w-6 h-6 text-zen-500" />
          <span>Fund Transfer & Real-Time AI Fraud Evaluation</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Every transaction passes through our sub-50ms tri-model machine learning defense pipeline before double-entry posting.
        </p>
      </div>

      {/* Main Wizard */}
      <TransferWizard />

      {/* State Machine Architectural Diagram */}
      <div className="bg-white dark:bg-[#090B28] p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono mb-3.5 flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-zen-500" />
          <span>Mrraw Bank Transaction State Machine</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0c152d] border border-slate-200/80 dark:border-slate-800">
            <span className="font-extrabold text-slate-800 dark:text-slate-200 block">1. INITIATED</span>
            <p className="text-[10px] text-slate-400 mt-1">
              Verifies balances, destination validity & assigns reference.
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0c152d] border border-slate-200/80 dark:border-slate-800">
            <span className="font-extrabold text-zen-600 dark:text-cyan-400 block">2. RISK ASSESSMENT</span>
            <p className="text-[10px] text-slate-400 mt-1">
              Assembles velocity telemetry & queries Python tri-model ensemble.
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0c152d] border border-slate-200/80 dark:border-slate-800">
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block">3. APPROVED</span>
            <p className="text-[10px] text-slate-400 mt-1">
              Low risk (&lt;30.0). Writes balanced atomic ledger entries.
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0c152d] border border-slate-200/80 dark:border-slate-800">
            <span className="font-extrabold text-rose-600 dark:text-rose-400 block">4. BLOCKED / OTP</span>
            <p className="text-[10px] text-slate-400 mt-1">
              Elevated risk challenges for OTP or blocks with zero balance debit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
