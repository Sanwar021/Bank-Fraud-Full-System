import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Wallet,
  ArrowRightLeft,
  CreditCard,
  ShieldCheck,
  ArrowUpRight,
  PlusCircle,
  PiggyBank,
  Eye,
  EyeOff,
  Smartphone,
  Zap,
  Receipt,
  QrCode,
  Banknote,
  Sparkles,
  TrendingUp,
  Activity,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { bankingApi, Account, Transaction } from '../api/banking';
import { AccountCard } from '../components/banking/AccountCard';
import { TransactionTable } from '../components/banking/TransactionTable';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../context/AuthContext';

export const CustomerDashboard: React.FC = () => {
  const { user, role } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'BDT'>('USD');
  const [copiedAccount, setCopiedAccount] = useState(false);

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: bankingApi.getAccounts,
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['transfers'],
    queryFn: bankingApi.getTransfers,
  });

  const totalBalanceUSD = accounts.reduce((acc, a) => acc + parseFloat(a.balance), 0);
  const totalBalance = currencyMode === 'BDT' ? totalBalanceUSD * 110 : totalBalanceUSD;
  const currencySymbol = currencyMode === 'BDT' ? '৳' : '$';

  // Primary Savings Account
  const primaryAccount = accounts.find((a) => a.account_type === 'SAVINGS') || accounts[0];

  const copyPrimaryAccount = () => {
    if (primaryAccount) {
      navigator.clipboard.writeText(primaryAccount.account_number);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    }
  };

  // Cashflow timeline
  const cashflowData = [
    { month: 'Jun', deposits: 4200, withdrawals: 2400 },
    { month: 'Jul', deposits: 5100, withdrawals: 3100 },
    { month: 'Aug', deposits: 4800, withdrawals: 2900 },
    { month: 'Sep', deposits: 6200, withdrawals: 3400 },
    { month: 'Oct', deposits: 5800, withdrawals: 3900 },
    { month: 'Nov', deposits: 7100, withdrawals: 2800 },
  ];

  // Bank Asia ZEN Quick Action Services
  const zenQuickActions = [
    {
      title: 'Send Money',
      subtitle: 'NPSB 24/7 / BEFTN',
      icon: ArrowRightLeft,
      color: 'bg-zen-500 text-white',
      link: '/transfer',
    },
    {
      title: 'Mobile Top-up',
      subtitle: 'GP, Robi, Banglalink',
      icon: Smartphone,
      color: 'bg-emerald-600 text-white',
      link: '/transfer?mode=topup',
    },
    {
      title: 'Utility Bills',
      subtitle: 'DESCO, WASA, Gas',
      icon: Zap,
      color: 'bg-amber-600 text-white',
      link: '/transfer?mode=bill',
    },
    {
      title: 'Credit Cards',
      subtitle: 'Manage & Bill Pay',
      icon: CreditCard,
      color: 'bg-indigo-600 text-white',
      link: '/cards',
    },
    {
      title: 'ZEN FDR & DPS',
      subtitle: 'Up to 9.0% APY',
      icon: PiggyBank,
      color: 'bg-purple-600 text-white',
      link: '/deposits',
    },
    {
      title: 'Loans & EMI',
      subtitle: 'Instant Calculator',
      icon: Banknote,
      color: 'bg-sky-600 text-white',
      link: '/loans',
    },
    {
      title: 'E-Statements',
      subtitle: 'PDF & Tax Reports',
      icon: Receipt,
      color: 'bg-slate-700 text-white',
      link: '/accounts',
    },
    {
      title: 'AI Threat Guard',
      subtitle: 'Tri-Model Shield',
      icon: ShieldCheck,
      color: 'bg-rose-600 text-white',
      link: '/investigation',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Welcome & Notification Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#090B28] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zen-600 dark:text-cyan-400 font-mono uppercase tracking-wider">
              Bank Asia ZEN SMART PORTAL
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-400 font-mono">KYC: VERIFIED</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
            Welcome, {user?.customer ? `${user.customer.first_name} ${user.customer.last_name}` : 'Valued Customer'}!
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Currency Toggle */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center text-xs font-bold font-mono">
            <button
              onClick={() => setCurrencyMode('USD')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currencyMode === 'USD'
                  ? 'bg-zen-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              USD ($)
            </button>
            <button
              onClick={() => setCurrencyMode('BDT')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currencyMode === 'BDT'
                  ? 'bg-zen-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              BDT (৳)
            </button>
          </div>

          <Link to="/transfer">
            <Button size="sm" className="shadow-zen">
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" /> Transfer
            </Button>
          </Link>
        </div>
      </div>

      {/* Flagship Bank Asia ZEN Master Hero Card */}
      <div className="zen-gradient-card rounded-3xl p-6 sm:p-8 text-white shadow-zen-lg relative overflow-hidden">
        {/* Subtle geometric circles overlay */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full border-[16px] border-white/5 pointer-events-none" />
        <div className="absolute right-20 -bottom-20 w-60 h-60 rounded-full border-[10px] border-white/5 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            {/* Tagline & Balance Hide Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-cyan-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15">
                Bank Asia ZEN SMART Account
              </span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors bg-black/20 hover:bg-black/30 px-2.5 py-0.5 rounded-full"
                title={showBalance ? 'Hide balance' : 'Show balance'}
              >
                {showBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="font-mono text-[10px]">{showBalance ? 'Hide' : 'Reveal'}</span>
              </button>
            </div>

            {/* Total Balance Display */}
            <div>
              <div className="text-xs text-white/70 font-medium">Combined Net Available Portfolio</div>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-white mt-1 flex items-baseline gap-2">
                {showBalance ? (
                  <>
                    <span>
                      {currencySymbol}
                      {totalBalance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-sm font-semibold text-white/60 font-sans">{currencyMode}</span>
                  </>
                ) : (
                  <span className="tracking-widest">••••••••••</span>
                )}
              </div>
            </div>

            {/* Primary Account pill */}
            {primaryAccount && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-white/70">Primary:</span>
                <button
                  onClick={copyPrimaryAccount}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-mono transition-colors text-white"
                >
                  <span>{primaryAccount.account_number}</span>
                  {copiedAccount ? <Check className="w-3 h-3 text-cyan-300" /> : <Copy className="w-3 h-3 text-white/60" />}
                </button>
                <span className="text-xs font-mono text-cyan-300">
                  (${parseFloat(primaryAccount.balance).toLocaleString()})
                </span>
              </div>
            )}
          </div>

          {/* Quick Transfer Actions embedded on card */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
            <Link to="/transfer">
              <button className="w-full px-5 py-3 rounded-2xl bg-white text-zen-700 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg hover:bg-slate-50 transition-all active:scale-[0.98]">
                <ArrowRightLeft className="w-4 h-4 text-zen-600" />
                <span>NPSB Instant Transfer</span>
              </button>
            </Link>
            <Link to="/accounts">
              <button className="w-full px-5 py-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all">
                <Receipt className="w-4 h-4 text-cyan-300" />
                <span>Download E-Statement</span>
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Bank Asia ZEN Quick Actions Grid */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-zen-500" />
            <span>Bank Asia ZEN Services</span>
          </h2>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Instant 24/7 Digital Rails
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {zenQuickActions.map((action, idx) => (
            <Link
              key={idx}
              to={action.link}
              className="group p-3.5 rounded-2xl bg-white dark:bg-[#090B28] border border-slate-200/80 dark:border-slate-800 hover:border-zen-500 dark:hover:border-zen-400 shadow-xs hover:shadow-zen transition-all text-center flex flex-col items-center justify-center"
            >
              <div
                className={`w-11 h-11 rounded-2xl ${action.color} flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform`}
              >
                <action.icon className="w-5 h-5" />
              </div>
              <div className="font-extrabold text-xs text-slate-900 dark:text-slate-100 group-hover:text-zen-600 dark:group-hover:text-cyan-400 transition-colors leading-tight">
                {action.title}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 leading-none">
                {action.subtitle}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Active Deposit Accounts Carousel / Grid */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Wallet className="w-4 h-4 text-zen-500" />
            <span>Active Deposit Accounts ({accounts.length})</span>
          </h2>
          <Link
            to="/accounts"
            className="text-xs font-bold text-zen-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {accountsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-3xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <AccountCard key={acc.id} account={acc} />
            ))}
          </div>
        )}
      </div>

      {/* Bank Asia AI Fraud Shield Status Banner */}
      <div className="bg-gradient-to-r from-zen-50 via-white to-slate-50 dark:from-[#0d1633] dark:via-[#090B28] dark:to-[#060818] p-5 rounded-3xl border border-zen-200/80 dark:border-zen-900/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zen-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-zen-500/30">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-slate-900 dark:text-white">
                Bank Asia ZEN AI Tri-Model Shield
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Active & Protecting
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Every transaction evaluated in ~40ms across XGBoost (Velocity), Isolation Forest (Outlier), and PyTorch Autoencoder (Deep Anomaly).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="text-right font-mono text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
            <div>Engine Latency: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">~40ms</strong></div>
            <div>SHAP Explainability: <strong className="text-zen-600 dark:text-cyan-400 font-bold">Online</strong></div>
          </div>
          <Link to="/investigation">
            <Button variant="outline" size="sm" className="font-bold">
              <Activity className="w-3.5 h-3.5 mr-1 text-zen-500" />
              <span>Inspect AI Shield</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Two Column Layout: Cashflow Timeline + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cashflow Trends (1 col) */}
        <div className="bg-white dark:bg-[#090B28] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-zen-500" />
                <span>Monthly Cashflow</span>
              </h3>
              <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                2026
              </span>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflowData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="depositsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2061AE" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2061AE" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090B28',
                      borderRadius: '12px',
                      border: '1px solid #1e293b',
                      fontSize: '11px',
                      color: '#fff',
                    }}
                  />
                  <Area type="monotone" dataKey="deposits" stroke="#2061AE" strokeWidth={2.5} fill="url(#depositsGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs font-mono">
            <span className="text-slate-500">Inflows: <strong className="text-zen-600 dark:text-cyan-400">$33,200</strong></span>
            <span className="text-slate-500">Outflows: <strong className="text-slate-700 dark:text-slate-300">$18,500</strong></span>
          </div>
        </div>

        {/* Live Transaction Ledger (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#090B28] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-zen-500" />
              <span>Recent Activity & Transfers</span>
            </h3>
            <Link
              to="/accounts"
              className="text-xs font-bold text-zen-600 dark:text-cyan-400 hover:underline"
            >
              Full Ledger History
            </Link>
          </div>

          <TransactionTable transactions={transfers.slice(0, 5)} />
        </div>
      </div>
    </div>
  );
};
