import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, ArrowUpRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { investigationApi } from '../../api/investigation';
import { Badge } from '../common/Badge';

interface LiveEvent {
  id: string;
  type: string;
  reference?: string;
  amount?: string | number;
  risk_score?: number | string;
  status?: string;
  timestamp: string;
}

export const LiveTransactionFeed: React.FC = () => {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    // Initial fetch of recent live transactions
    investigationApi.getLiveTransactions(8).then((res) => {
      const initial = res.transactions.map((tx) => ({
        id: tx.id,
        type: tx.fraud_alert ? 'fraud_alert' : 'transaction_completed',
        reference: tx.reference,
        amount: tx.amount,
        risk_score: tx.risk_score ? parseFloat(tx.risk_score) : 10.0,
        status: tx.status,
        timestamp: tx.created_at,
      }));
      setEvents(initial);
    });

    // Connect SSE
    const cleanup = investigationApi.connectSSE(
      (type, data) => {
        setConnected(true);
        const newEv: LiveEvent = {
          id: data.transaction_id || data.alert_id || Math.random().toString(),
          type,
          reference: data.reference || `TXN-${(data.transaction_id || '').slice(0, 8)}`,
          amount: data.amount,
          risk_score: data.risk_score,
          status: data.status || type,
          timestamp: new Date().toISOString(),
        };

        setEvents((prev) => [newEv, ...prev.slice(0, 19)]);
      },
      () => setConnected(false)
    );

    return cleanup;
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 font-mono">
            Live Gateway & Fraud Event Stream
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Real-time SSE Active</span>
        </div>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
        {events.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            Awaiting live transaction events from gateway...
          </div>
        ) : (
          events.map((ev, i) => {
            const isAlert = ev.type === 'fraud_alert' || ev.status === 'BLOCKED';
            const riskNum = ev.risk_score ? parseFloat(ev.risk_score.toString()) : 0;

            return (
              <div
                key={`${ev.id}-${i}`}
                className={`pt-2 flex items-center justify-between transition-all ${
                  i === 0 ? 'animate-fade-in' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isAlert
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                        : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                    }`}
                  >
                    {isAlert ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {ev.reference}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Event: {ev.type.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    ${ev.amount ? parseFloat(ev.amount.toString()).toFixed(2) : '0.00'}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    {riskNum > 0 && (
                      <span
                        className={`text-[10px] font-mono px-1 rounded ${
                          riskNum >= 70
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 font-bold'
                            : riskNum >= 30
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        }`}
                      >
                        Risk: {riskNum.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
