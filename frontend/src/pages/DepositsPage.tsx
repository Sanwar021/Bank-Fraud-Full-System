import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PiggyBank, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
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
  const [interestRate, setInterestRate] = useState<number>(5.25);
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
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-emerald-600" />
          High-Yield Term Deposits & Fixed Returns
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Lock synthetic capital with guaranteed APY. Funds are transferred into deposit accounts via double-entry ledger.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deposit Creation Form */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100 dark:border-slate-800">
            Open New Fixed Term Deposit
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Funding Account
              </label>
              <select
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-mono"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_type} - {a.account_number} (Bal: ${parseFloat(a.balance).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Principal Amount</span>
                <span className="font-mono text-emerald-600 font-bold">${principal.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="25000"
                step="500"
                value={principal}
                onChange={(e) => setPrincipal(parseFloat(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Lock Duration</span>
                <span className="font-mono text-emerald-600 font-bold">{termMonths} Months</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[6, 12, 24, 36].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setTermMonths(m);
                      setInterestRate(m === 6 ? 4.5 : m === 12 ? 5.25 : m === 24 ? 5.75 : 6.2);
                    }}
                    className={`py-2 text-xs font-medium rounded-xl border transition-all ${
                      termMonths === m
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {m} Months
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Maturity Preview */}
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Rate (APY)</span>
              <span className="font-mono text-base font-extrabold text-slate-900 dark:text-slate-100">
                {interestRate.toFixed(2)}%
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Earned Interest</span>
              <span className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                +${interestEarned.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Maturity Payout</span>
              <span className="font-mono text-base font-extrabold text-slate-900 dark:text-slate-100">
                ${maturityAmount.toFixed(2)}
              </span>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => createMutation.mutate()}
            isLoading={createMutation.isPending}
            disabled={!sourceAccountId}
          >
            Create Term Deposit (${principal.toLocaleString()})
          </Button>

          {success && (
            <p className="text-center text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Deposit Active & Initialized on Double-Entry Ledger!
            </p>
          )}
        </div>

        {/* Existing Deposits List */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Active Term Deposits
          </h3>

          <div className="space-y-3">
            {deposits.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No active term deposits.
              </div>
            ) : (
              deposits.map((fd: FixedDeposit) => (
                <div
                  key={fd.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold">
                      ${parseFloat(fd.principal_amount).toLocaleString()}
                    </span>
                    <Badge variant="success" size="sm">
                      {fd.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-slate-500 font-mono text-[11px]">
                    <span>APY: {parseFloat(fd.interest_rate)}%</span>
                    <span>Matures: ${parseFloat(fd.maturity_amount).toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Term: {fd.term_months} Months
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

