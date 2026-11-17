import React from 'react';
import { Wallet, Copy, Check, Wifi, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Account } from '../../api/banking';
import { Badge } from '../common/Badge';

interface AccountCardProps {
  account: Account;
  onSelect?: () => void;
  isSelected?: boolean;
}

export const AccountCard: React.FC<AccountCardProps> = ({ account, onSelect, isSelected }) => {
  const [copied, setCopied] = React.useState(false);

  const copyNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(account.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const balanceNum = parseFloat(account.balance);
  const dailyLimitNum = parseFloat(account.daily_limit);

  // Card gradient themes based on account type
  const isSavings = account.account_type === 'SAVINGS';
  const isCurrent = account.account_type === 'CURRENT';
  const isFixed = account.account_type === 'FIXED_DEPOSIT';

  return (
    <div
      onClick={onSelect}
      className={`relative p-5 rounded-3xl transition-all duration-300 overflow-hidden shadow-lg ${
        isSelected
          ? 'ring-2 ring-zen-500 scale-[1.01] shadow-zen'
          : 'hover:shadow-xl hover:scale-[1.005]'
      } ${
        isSavings
          ? 'bg-gradient-to-br from-[#2061AE] via-[#164985] to-[#090B28] text-white'
          : isCurrent
          ? 'bg-gradient-to-br from-[#0c2343] via-[#10315c] to-[#090B28] text-white border border-zen-500/20'
          : 'bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#020617] text-white border border-amber-500/20'
      } ${onSelect ? 'cursor-pointer' : ''}`}
    >
      {/* Background Mrraw Bank Decorative Arc Watermark */}
      <svg
        className="absolute -right-8 -bottom-10 w-48 h-48 opacity-10 pointer-events-none text-white"
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" fill="none" />
        <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="6" fill="none" />
      </svg>

      {/* Top Header: Brand & Card Type */}
      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center font-bold text-white border border-white/20">
            <Wallet className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xs tracking-wider uppercase text-white/95">
                Mrraw Bank
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-cyan-200 border border-cyan-400/30">
                {account.account_type}
              </span>
            </div>
            <button
              onClick={copyNumber}
              className="flex items-center gap-1.5 font-mono text-[11px] text-white/70 hover:text-white transition-colors mt-0.5"
              title="Click to copy account number"
            >
              <span>{account.account_number}</span>
              {copied ? <Check className="w-3 h-3 text-cyan-300" /> : <Copy className="w-3 h-3 text-white/50" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-white/60 rotate-90" />
          <span className="text-[10px] font-mono font-bold bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full text-white">
            {account.currency}
          </span>
        </div>
      </div>

      {/* EMV Chip graphic */}
      <div className="mt-4 flex items-center justify-between relative z-10">
        <div className="w-9 h-7 rounded-md bg-gradient-to-tr from-amber-300 via-amber-200 to-amber-400 border border-amber-500/40 shadow-xs flex items-center justify-center p-0.5">
          <div className="w-full h-full border border-amber-600/30 rounded-[3px] flex items-center justify-center">
            <div className="w-2.5 h-2.5 border-r border-b border-amber-700/40" />
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-cyan-300 font-mono">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>AI Guarded</span>
        </div>
      </div>

      {/* Available Balance */}
      <div className="mt-4 relative z-10">
        <div className="text-[10px] font-medium text-white/70 uppercase tracking-widest">
          Available Balance
        </div>
        <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white mt-0.5 flex items-baseline gap-1">
          <span>${balanceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className="text-xs font-normal text-white/60">{account.currency}</span>
        </div>
      </div>

      {/* Card Footer Limits */}
      <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-white/80 relative z-10">
        <div>
          <span className="text-[9px] uppercase tracking-wider text-white/50 block">Daily Limit</span>
          <span className="font-mono font-bold text-white text-xs">
            ${dailyLimitNum.toLocaleString()}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[9px] uppercase tracking-wider text-white/50 block">Per Tx Limit</span>
          <span className="font-mono font-bold text-white text-xs">
            ${parseFloat(account.per_tx_limit).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};
