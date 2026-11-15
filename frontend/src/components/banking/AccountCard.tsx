import React from 'react';
import { Wallet, Copy, Check, ArrowUpRight } from 'lucide-react';
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

  return (
    <div
      onClick={onSelect}
      className={`relative p-5 rounded-2xl border transition-all ${
        isSelected
          ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      } ${onSelect ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                {account.account_type} ACCOUNT
              </span>
              <Badge variant={account.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">
                {account.status}
              </Badge>
            </div>
            <button
              onClick={copyNumber}
              className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <span>{account.account_number}</span>
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <span className="text-xs font-mono font-medium text-slate-400">
          {account.currency}
        </span>
      </div>

      <div className="mt-5">
        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          Available Balance
        </div>
        <div className="text-2xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
          ${balanceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div>
          <span className="text-[10px] uppercase text-slate-400 block">Daily Limit</span>
          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
            ${dailyLimitNum.toLocaleString()}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase text-slate-400 block">Per Transaction</span>
          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
            ${parseFloat(account.per_tx_limit).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};
