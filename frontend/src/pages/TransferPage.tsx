import React from 'react';
import { TransferWizard } from '../components/banking/TransferWizard';
import { ArrowRightLeft, ShieldAlert, Cpu, GitCommit } from 'lucide-react';

export const TransferPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
          Transfer Funds & Intelligent Fraud Evaluation
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Every transaction passes through our real-time 3-model machine learning defense pipeline before double-entry posting.
        </p>
      </div>

      {/* Main Wizard */}
      <TransferWizard />

      {/* State Machine Architectural Diagram */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono mb-3 flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-emerald-600" />
          Controlled Transaction State Machine
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
            <span className="font-bold text-slate-800 dark:text-slate-200 block">1. INITIATED</span>
            <p className="text-[10px] text-slate-400 mt-1">
              Validates balances, ownership & generates unique reference.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
            <span className="font-bold text-indigo-600 dark:text-indigo-400 block">2. RISK ASSESSMENT</span>
            <p className="text-[10px] text-slate-400 mt-1">
              Assembles velocity features & invokes XGBoost + IF + PyTorch AE.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 block">3. APPROVED</span>
            <p className="text-[10px] text-slate-400 mt-1">
              Low risk score (&lt;30.0). Writes balanced atomic ledger entries.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
            <span className="font-bold text-rose-600 dark:text-rose-400 block">4. BLOCKED / OTP</span>
            <p className="text-[10px] text-slate-400 mt-1">
              Elevated risk requires 2FA or triggers automated block & alert.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

