import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, Calculator, CheckCircle2, TrendingUp } from 'lucide-react';
import { bankingApi, Loan } from '../api/banking';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const LoansPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['loans'],
    queryFn: bankingApi.getLoans,
  });

  const [principal, setPrincipal] = useState<number>(10000);
  const [interestRate, setInterestRate] = useState<number>(7.5);
  const [termMonths, setTermMonths] = useState<number>(24);
  const [applicationSuccess, setApplicationSuccess] = useState(false);

  // EMI Math Formula
  const monthlyRate = interestRate / 12 / 100;
  const emi =
    monthlyRate > 0
      ? (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1)
      : principal / termMonths;

  const totalPayable = emi * termMonths;
  const totalInterest = totalPayable - principal;

  const applyMutation = useMutation({
    mutationFn: () => bankingApi.applyLoan(principal, interestRate, termMonths),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setApplicationSuccess(true);
      setTimeout(() => setApplicationSuccess(false), 4000);
    },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Banknote className="w-5 h-5 text-emerald-600" />
          Consumer Loans & Interactive EMI Simulator
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Calculate monthly amortized payments and submit synthetic credit requests.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* EMI Calculator */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Calculator className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Loan Calculator & Amortization
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            {/* Principal slider */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Principal Amount</span>
                <span className="font-mono text-emerald-600 font-bold">${principal.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="50000"
                step="500"
                value={principal}
                onChange={(e) => setPrincipal(parseFloat(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </div>

            {/* Term Months slider */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Loan Term</span>
                <span className="font-mono text-emerald-600 font-bold">{termMonths} Months ({termMonths / 12} yrs)</span>
              </div>
              <input
                type="range"
                min="6"
                max="60"
                step="6"
                value={termMonths}
                onChange={(e) => setTermMonths(parseInt(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </div>

            {/* Interest Rate slider */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Annual Interest Rate</span>
                <span className="font-mono text-emerald-600 font-bold">{interestRate.toFixed(1)}% APR</span>
              </div>
              <input
                type="range"
                min="3.0"
                max="18.0"
                step="0.5"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </div>
          </div>

          {/* EMI Output Box */}
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Monthly EMI</span>
              <span className="font-mono text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                ${emi.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Interest</span>
              <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
                ${totalInterest.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Repayment</span>
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                ${totalPayable.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              className="w-full"
              onClick={() => applyMutation.mutate()}
              isLoading={applyMutation.isPending}
            >
              Apply for Loan (${principal.toLocaleString()})
            </Button>
            {applicationSuccess && (
              <p className="mt-2 text-center text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Loan Application Approved & Disbursed!
              </p>
            )}
          </div>
        </div>

        {/* Active Loans Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Active Loan Facilities
          </h3>

          <div className="space-y-3">
            {loans.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No active loans found.
              </div>
            ) : (
              loans.map((loan: Loan) => (
                <div
                  key={loan.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono">
                      ${parseFloat(loan.principal_amount).toLocaleString()}
                    </span>
                    <Badge variant={loan.status === 'ACTIVE' || loan.status === 'APPROVED' ? 'success' : 'neutral'} size="sm">
                      {loan.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-slate-500 font-mono text-[11px]">
                    <span>Monthly: ${parseFloat(loan.emi_amount).toFixed(2)}</span>
                    <span>Rate: {parseFloat(loan.interest_rate)}%</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Remaining: ${parseFloat(loan.remaining_balance).toLocaleString()} • {loan.term_months} mo
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
