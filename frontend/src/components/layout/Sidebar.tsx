import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  CreditCard,
  Banknote,
  PiggyBank,
  ShieldAlert,
  ListTree,
  Activity,
  History,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { role } = useAuth();
  const isAnalystOrAdmin = role === 'FRAUD_ANALYST' || role === 'ADMIN';

  const customerNav = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/accounts', label: 'Accounts & Statements', icon: Wallet },
    { to: '/transfer', label: 'Send Money', icon: ArrowRightLeft },
    { to: '/cards', label: 'Debit Cards', icon: CreditCard },
    { to: '/loans', label: 'Loans & EMI', icon: Banknote },
    { to: '/deposits', label: 'Fixed Deposits', icon: PiggyBank },
  ];

  const adminNav = [
    { to: '/investigation', label: 'Investigation Hub', icon: ShieldAlert },
    { to: '/investigation/alerts', label: 'Alert Triage Queue', icon: ListTree },
    { to: '/investigation/live', label: 'Live Transactions', icon: Activity },
    { to: '/investigation/audit', label: 'Security Audit Trail', icon: History },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
      isActive
        ? 'bg-emerald-600 text-white shadow-xs'
        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;

  const adminLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
      isActive
        ? 'bg-indigo-600 text-white shadow-xs'
        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;

  return (
    <aside className="w-64 shrink-0 hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 min-h-[calc(100vh-4rem)] p-4 justify-between">
      <div className="space-y-6">
        {/* Customer Section */}
        <div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400 px-3.5 mb-2 font-mono">
            Core Banking
          </div>
          <nav className="space-y-1">
            {customerNav.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass} end={item.to === '/'}>
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Investigation / Fraud Detection Section */}
        {isAnalystOrAdmin && (
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-indigo-500 px-3.5 mb-2 font-mono flex items-center justify-between">
              <span>Fraud Investigation</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <nav className="space-y-1">
              {adminNav.map((item) => (
                <NavLink key={item.to} to={item.to} className={adminLinkClass}>
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </div>

      {/* System Status / Telemetry badge */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 text-[11px] space-y-2">
        <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>Engine Status</span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono">
            <CheckCircle2 className="w-3 h-3" />
            Operational
          </span>
        </div>
        <div className="space-y-1 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
          <div className="flex justify-between">
            <span>Ledger:</span>
            <span className="text-slate-700 dark:text-slate-200">Balanced</span>
          </div>
          <div className="flex justify-between">
            <span>Models:</span>
            <span className="text-slate-700 dark:text-slate-200">XGB + IF + AE</span>
          </div>
          <div className="flex justify-between">
            <span>Inference:</span>
            <span className="text-slate-700 dark:text-slate-200">Fail-Safe Active</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

