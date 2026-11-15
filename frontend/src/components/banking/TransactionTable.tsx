import React from 'react';
import { Transaction } from '../../api/banking';
import { Badge } from '../common/Badge';
import { ArrowUpRight, ArrowDownLeft, ShieldAlert, Clock } from 'lucide-react';

interface TransactionTableProps {
  transactions: Transaction[];
  currentAccountId?: string;
  onSelectTransaction?: (tx: Transaction) => void;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  currentAccountId,
  onSelectTransaction,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'APPROVED':
        return <Badge variant="success">{status}</Badge>;
      case 'BLOCKED':
      case 'REJECTED':
        return <Badge variant="danger">{status}</Badge>;
      case 'OTP_REQUIRED':
      case 'UNDER_REVIEW':
      case 'HELD_FOR_REVIEW':
        return <Badge variant="warning">{status}</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getRiskBadge = (decision?: string, score?: string) => {
    if (!decision) return null;
    const num = score ? parseFloat(score) : 0;
    if (decision.includes('HIGH') || num >= 70) {
      return <Badge variant="danger" size="sm">Risk: {num.toFixed(1)}</Badge>;
    } else if (decision.includes('MEDIUM') || num >= 30) {
      return <Badge variant="warning" size="sm">Risk: {num.toFixed(1)}</Badge>;
    } else {
      return <Badge variant="success" size="sm">Risk: {num.toFixed(1)}</Badge>;
    }
  };

  if (!transactions || transactions.length === 0) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
        No transactions found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-mono tracking-wider bg-slate-50/50 dark:bg-slate-800/30">
            <th className="py-3 px-4">Reference & Description</th>
            <th className="py-3 px-4">Transfer Type</th>
            <th className="py-3 px-4">Status & Risk</th>
            <th className="py-3 px-4">Date</th>
            <th className="py-3 px-4 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
          {transactions.map((tx) => {
            const isDebit = currentAccountId ? tx.source_account_id === currentAccountId : true;
            const amt = parseFloat(tx.amount);

            return (
              <tr
                key={tx.id}
                onClick={() => onSelectTransaction && onSelectTransaction(tx)}
                className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                  onSelectTransaction ? 'cursor-pointer' : ''
                }`}
              >
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isDebit
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                      }`}
                    >
                      {isDebit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-xs">
                        {tx.description || (isDebit ? 'Outgoing Transfer' : 'Incoming Transfer')}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {tx.reference}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  {tx.transfer_type}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(tx.status)}
                    {getRiskBadge(tx.risk_decision, tx.risk_score)}
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                  {new Date(tx.created_at).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div
                    className={`font-mono font-bold text-sm ${
                      isDebit ? 'text-slate-900 dark:text-slate-100' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isDebit ? '-' : '+'}${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  {parseFloat(tx.fee) > 0 && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      Fee: ${parseFloat(tx.fee).toFixed(2)}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
