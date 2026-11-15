import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, Calculator, CheckCircle2, TrendingUp, Sparkles, ArrowRight } from 'lucide-react';
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
  const [interestRate, setInterestRate] = useState<number>(9.5);
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-zen-600 dark:text-cyan-400 uppercase tracking-wider">
            Bank Asia ZEN Credit
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
          <Banknote className="w-6 h-6 text-zen-500" />
          <span>ZEN Personal & SME Loan Simulator</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Calculate monthly amortized EMI payments and submit instant pre-qualified loan requests.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* EMI Calculator */}
        <div className="lg:col-span-2 bg-white dark:bg-[#090B28] p-6 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-5 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Calculator className="w-4 h-4 text-zen-500" />
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Bank Asia Smart EMI Amortization Planner
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            {/* Principal slider */}
            <div>
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Loan Principal</span>
                <span className="font-mono text-zen-600 dark:text-cyan-400 font-black text-sm">${principal.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="50000"
                step="500"
                value={principal}
                onChange={(e) => setPrincipal(parseFloat(e.target.value))}
                className="w-full accent-zen-500 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Term Months slider */}
            <div>
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Repayment Tenure</span>
                <span className="font-mono text-slate-900 dark:text-white font-bold">{termMonths} Months ({termMonths / 12} yrs)</span>
              </div>
              <input
                type="range"
                min="6"
                max="60"
                step="6"
                value={termMonths}
                onChange={(e) => setTermMonths(parseInt(e.target.value))}
                className="w-full accent-zen-500 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Interest Rate slider */}
            <div>
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Annual Interest Rate</span>
                <span className="font-mono text-slate-900 dark:text-white font-bold">{interestRate}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="18"
                step="0.25"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                className="w-full accent-zen-500 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Live Calculation Output Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#0c152d] border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="text-center pb-2 border-b border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly EMI Due</div>
                <div className="text-3xl font-black font-mono text-zen-600 dark:text-cyan-400 mt-0.5">
                  ${emi.toFixed(2)}
                </div>
              </div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Total Principal:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">${principal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Total Interest Payable:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">+${totalInterest.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs font-bold pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Total Amount Repayable:</span>
                <span className="font-mono text-slate-900 dark:text-white">${totalPayable.toFixed(2)}</span>
              </div>
            </div>

            {applicationSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Credit application approved and disbursed to primary account!</span>
              </div>
            )}

            <Button
              onClick={() => applyMutation.mutate()}
              isLoading={applyMutation.isPending}
              className="w-full py-3 shadow-zen font-black"
            >
              <span>Apply for Bank Asia ZEN Smart Credit</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>

        {/* Info card */}
        <div>
          <div className="zen-gradient-card p-6 rounded-3xl text-white shadow-zen space-y-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300 bg-white/10 px-2.5 py-0.5 rounded-full">
              Pre-Approved Facility
            </span>
            <h4 className="text-lg font-black tracking-tight">ZEN Express Disbursal</h4>
            <p className="text-xs text-white/80 leading-relaxed">
              Approved funds are directly credited to your Bank Asia ZEN current or savings account with zero hidden processing charges.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
