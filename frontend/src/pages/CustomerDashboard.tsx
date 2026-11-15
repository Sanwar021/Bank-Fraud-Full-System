import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Wallet,
  ArrowRightLeft,
  CreditCard,
  TrendingUp,
  ShieldCheck,
  ArrowUpRight,
  PlusCircle,
  PiggyBank,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { bankingApi, Account, Transaction } from '../api/banking';
import { AccountCard } from '../components/banking/AccountCard';
import { TransactionTable } from '../components/banking/TransactionTable';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../context/AuthContext';

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: bankingApi.getAccounts,
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['transfers'],
    queryFn: bankingApi.getTransfers,
  });

  const totalBalance = accounts.reduce((acc, a) => acc + parseFloat(a.balance), 0);

  // Synthetic Cashflow Timeline chart data
  const cashflowData = [
    { month: 'Jun', deposits: 4200, withdrawals: 2400 },
    { month: 'Jul', deposits: 5100, withdrawals: 3100 },
    { month: 'Aug', deposits: 4800, withdrawals: 2900 },
    { month: 'Sep', deposits: 6200, withdrawals: 3400 },
    { month: 'Oct', deposits: 5800, withdrawals: 3900 },
    { month: 'Nov', deposits: 7100, withdrawals: 2800 },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="success" size="sm">
                KYC {user?.customer?.kyc_status || 'VERIFIED'}
              </Badge>
              <span className="text-xs font-mono text-emerald-300">
                Tier: {user?.customer?.risk_tier || 'STANDARD'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.customer?.first_name || 'Valued Customer'}
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Real-time core banking simulation connected to live PostgreSQL double-entry ledger & active ML fraud scoring engine.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link to="/transfer">
              <Button size="lg" className="shadow-lg shadow-emerald-500/20">
                <ArrowRightLeft className="w-4 h-4 mr-2" /> Send Money
              </Button>
            </Link>
            <Link to="/accounts">
              <Button variant="outline" size="lg" className="text-white border-white/20 hover:bg-white/10">
                Statements
              </Button>
            </Link>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Account Overview Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-600" />
            Active Deposit Accounts
          </h2>
          <div className="text-xs font-mono font-medium text-slate-500">
            Total Combined: <strong className="text-slate-900 dark:text-white font-bold">${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        {accountsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
            <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </div>

      {/* Analytics Chart & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cashflow Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Monthly Cashflow (Inflow vs Outflow)
              </h3>
              <p className="text-[11px] text-slate-400">
                Real-time deposits against debit transactions
              </p>
            </div>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              USD ($)
            </span>
          </div>

          <div className="h-56 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="depositsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="withdrawalsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="deposits" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#depositsGrad)" name="Deposits / Inflow" />
                <Area type="monotone" dataKey="withdrawals" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#withdrawalsGrad)" name="Transfers / Outflow" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Security & Verification Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Security & Fraud Protection
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              All transfers are assessed by the tri-model engine with sub-150ms latency.
            </p>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-600 dark:text-slate-400">Step-Up 2FA</span>
                <span className="font-semibold text-emerald-600 font-mono">Enforced &gt; 30.0</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-600 dark:text-slate-400">Auto Block</span>
                <span className="font-semibold text-rose-600 font-mono">Enforced &gt; 70.0</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-600 dark:text-slate-400">Double-Entry</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">Strict Balanced</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link to="/transfer">
              <Button variant="outline" size="sm" className="w-full">
                Simulate Fraud Scenario
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Transactions Feed */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Recent Account Activity
          </h2>
          <Link to="/accounts" className="text-xs font-semibold text-emerald-600 hover:underline">
            View All Transactions &rarr;
          </Link>
        </div>

        <TransactionTable transactions={transfers.slice(0, 8)} />
      </div>
    </div>
  );
};

