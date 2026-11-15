import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PiggyBank, CheckCircle2, ShieldCheck, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import { bankingApi, Account, FixedDeposit } from '../api/banking';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const DepositsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: bankingApi.getAccounts,
  });

  const { data: deposits = [], isLoading } = useQuery({
    queryKey: ['deposits'],
    queryFn: bankingApi.getDeposits,
  });

  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [principal, setPrincipal] = useState<number>(5000);
  const [termMonths, setTermMonths] = useState<number>(12);
  const [interestRate, setInterestRate] = useState<number>(8.5);
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
    if (accounts.length > 0 && !sourceAccountId) {
      setSourceAccountId(accounts[0].id);
    }
  }, [accounts, sourceAccountId]);

  const interestEarned = principal * (interestRate / 100) * (termMonths / 12);
  const maturityAmount = principal + interestEarned;

  const createMutation = useMutation({
    mutationFn: () =>
      bankingApi.createDeposit(sourceAccountId, principal, termMonths, interestRate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-zen-600 dark:text-cyan-400 uppercase tracking-wider">
            Bank Asia ZEN Wealth
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
          <PiggyBank className="w-6 h-6 text-zen-500" />
          <span>ZEN FDR & DPS Deposit Schemes</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Lock capital with Bank Asia guaranteed high returns (up to 8.5% - 9.0% APY). Debited from savings and posted atomically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deposit Creation Form */}
        <div className="lg:col-span-2 bg-white dark:bg-[#090B28] p-6 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-5 shadow-xs">
          <h3 className="text-sm font-black text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-zen-500" />
            <span>Open a Bank Asia ZEN Term Deposit (FDR)</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Funding Account
              </label>
              <select
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-[#0c152d] border border-slate-300 dark:border-slate-700 rounded-xl p-3 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-zen-500 outline-none"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    Bank Asia {a.account_type} - {a.account_number} (Bal: ${parseFloat(a.balance).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Principal Investment</span>
                <span className="font-mono text-zen-600 dark:text-cyan-400 font-black text-sm">${principal.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="25000"
                step="500"
                value={principal}
                onChange={(e) => setPrincipal(parseFloat(e.target.value))}
                className="w-full accent-zen-500 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Deposit Tenure / Duration
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[3, 6, 12, 24].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setTermMonths(m);
                      setInterestRate(m === 3 ? 7.25 : m === 6 ? 7.75 : m === 12 ? 8.5 : 9.0);
                    }}
                    className={`py-2 px-3 rounded-xl border text-center transition-all ${
                      termMonths === m
                        ? 'border-zen-500 bg-zen-50 dark:bg-zen-950/40 text-zen-700 dark:text-cyan-300 ring-2 ring-zen-500/30 font-bold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-black">{m} Months</div>
                    <div className="text-[10px] text-slate-400">
                      {m === 3 ? '7.25%' : m === 6 ? '7.75%' : m === 12 ? '8.50%' : '9.00%'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Calculations Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c152d] border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-slate-500">
                <span>Annual Percentage Rate (APY)</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{interestRate.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Estimated Interest Return</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+${interestEarned.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-black text-sm text-slate-900 dark:text-white">
                <span>Maturity Yield Value</span>
                <span className="font-mono text-zen-600 dark:text-cyan-400">${maturityAmount.toFixed(2)}</span>
              </div>
            </div>

            {success && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Deposit successfully opened and confirmed on core ledger!</span>
              </div>
            )}

            <Button
              onClick={() => createMutation.mutate()}
              isLoading={createMutation.isPending}
              className="w-full py-3 shadow-zen font-black"
            >
              <span>Confirm & Lock FDR Certificate</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>

        {/* Benefits Sidebar */}
        <div className="space-y-4">
          <div className="zen-gradient-card p-6 rounded-3xl text-white shadow-zen space-y-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300 bg-white/10 px-2.5 py-0.5 rounded-full">
              Bank Asia Guaranteed
            </span>
            <h4 className="text-lg font-black tracking-tight">ZEN Smart Wealth Growth</h4>
            <p className="text-xs text-white/80 leading-relaxed">
              Enjoy tax-compliant, guaranteed high yields backed by Bank Asia’s digital security framework.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-cyan-300 font-mono">
              <ShieldCheck className="w-4 h-4" />
              <span>Full Double-Entry Protection</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
