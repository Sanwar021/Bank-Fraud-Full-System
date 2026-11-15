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
  Headphones,
  Cpu,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { role } = useAuth();
  const isAnalystOrAdmin = role === 'FRAUD_ANALYST' || role === 'ADMIN';

  const customerNav = [
    { to: '/', label: 'ZEN Dashboard', icon: LayoutDashboard },
    { to: '/accounts', label: 'Accounts & E-Statements', icon: Wallet },
    { to: '/transfer', label: 'Fund Transfer (NPSB)', icon: ArrowRightLeft },
    { to: '/cards', label: 'Cards & Spending Limits', icon: CreditCard },
    { to: '/deposits', label: 'ZEN FDR & DPS Schemes', icon: PiggyBank },
    { to: '/loans', label: 'Loans & EMI Planner', icon: Banknote },
  ];

  const adminNav = [
    { to: '/investigation', label: 'Investigation Hub', icon: ShieldAlert },
    { to: '/investigation/alerts', label: 'Alert Triage Queue', icon: ListTree },
    { to: '/investigation/live', label: 'Live Risk Stream', icon: Activity },
    { to: '/investigation/audit', label: 'Security Audit Trail', icon: History },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
      isActive
        ? 'bg-zen-500 text-white shadow-md shadow-zen-500/25'
        : 'text-slate-600 dark:text-slate-400 hover:text-zen-600 dark:hover:text-white hover:bg-zen-50/80 dark:hover:bg-slate-800/60'
    }`;

  const adminLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
      isActive
        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
        : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-indigo-50/80 dark:hover:bg-slate-800/60'
    }`;

  return (
    <aside className="w-64 shrink-0 hidden md:flex flex-col bg-white dark:bg-[#090B28] border-r border-slate-200/80 dark:border-slate-800 min-h-[calc(100vh-4rem)] p-4 justify-between transition-colors">
      <div className="space-y-6">
        {/* Core Banking Section */}
        <div>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-slate-400 dark:text-slate-500 px-3.5 mb-2 font-mono flex items-center justify-between">
            <span>ZEN Core Banking</span>
            <span className="text-[9px] bg-zen-50 dark:bg-zen-950 text-zen-600 dark:text-cyan-400 px-1.5 py-0.2 rounded font-bold">SMART</span>
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

        {/* AI Fraud Detection Section */}
        {isAnalystOrAdmin && (
          <div>
            <div className="text-[10px] font-extrabold tracking-wider uppercase text-indigo-500 dark:text-indigo-400 px-3.5 mb-2 font-mono flex items-center justify-between">
              <span>AI Shield & Fraud Center</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
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

      {/* System Telemetry & Bank Asia 24/7 Helpline */}
      <div className="space-y-3">
        {/* Real-time Telemetry */}
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3 text-[11px] space-y-2">
          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-zen-500" />
              <span>Engine Status</span>
            </span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
              <CheckCircle2 className="w-3 h-3" />
              Live
            </span>
          </div>
          <div className="space-y-1 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
            <div className="flex justify-between">
              <span>Double-Entry:</span>
              <span className="text-slate-700 dark:text-slate-300 font-semibold">ACID Balanced</span>
            </div>
            <div className="flex justify-between">
              <span>AI Fraud Guard:</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">Tri-Model Ensemble</span>
            </div>
          </div>
        </div>

        {/* Bank Asia 24/7 Contact Helpline */}
        <div className="px-3 py-2 rounded-xl bg-gradient-to-r from-zen-50 to-slate-100 dark:from-zenNavy-900 dark:to-slate-900 border border-zen-200/50 dark:border-slate-800 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-zen-500 flex items-center justify-center text-white shrink-0">
            <Headphones className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-none">
              24/7 Zen Helpline
            </div>
            <div className="text-[11px] font-black text-zen-600 dark:text-cyan-400 font-mono mt-0.5">
              16205 / +880 96170 16205
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
