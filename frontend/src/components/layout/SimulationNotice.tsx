import React from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';

export const SimulationNotice: React.FC = () => {
  return (
    <div className="bg-zen-50/70 dark:bg-[#070b1e] border-b border-zen-200/60 dark:border-slate-800/80 px-4 py-1.5 text-xs text-slate-600 dark:text-slate-400">
      <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-zen-500 text-white font-mono">
            Bank Asia ZEN
          </span>
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
            Simulated Sandbox Environment • Synthetic Data Exclusively • No Real Currency
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-zen-600 dark:text-cyan-400 font-mono text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-semibold">Double-Entry Balanced • AI Tri-Model Shield Active</span>
        </div>
      </div>
    </div>
  );
};
