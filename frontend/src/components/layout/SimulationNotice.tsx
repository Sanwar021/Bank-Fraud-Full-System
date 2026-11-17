import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const SimulationNotice: React.FC = () => {
  return (
    <div className="simulation-notice">
      <div className="simulation-notice-inner">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-zen-500 text-white font-mono">
            MRRAW BANK
          </span>
          <span className="simulation-copy">
            Simulated Sandbox Environment • Synthetic Data Exclusively • No Real Currency
          </span>
        </div>
        <div className="simulation-status">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-semibold">Double-Entry Balanced • AI Tri-Model Shield Active</span>
        </div>
      </div>
    </div>
  );
};
