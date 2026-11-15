import React from 'react';
import { Moon, Sun, LogOut, ChevronDown, UserCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NotificationDropdown } from './NotificationDropdown';
import { Badge } from '../common/Badge';
import { BankAsiaLogo } from '../common/BankAsiaLogo';

export const Navbar: React.FC = () => {
  const { user, role, logout, loginAsDemo } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const getRoleBadgeVariant = (r?: string | null) => {
    switch (r) {
      case 'ADMIN': return 'danger';
      case 'FRAUD_ANALYST': return 'purple';
      case 'TELLER': return 'info';
      default: return 'zen';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#090B28]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <BankAsiaLogo size="md" />
        </div>

        {/* Center / Fast Demo Persona Switcher */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-2xl text-xs border border-slate-200/60 dark:border-slate-700/60">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-zen-500" />
            <span>Demo Mode:</span>
          </span>
          <button
            onClick={() => loginAsDemo('customer')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              role === 'CUSTOMER'
                ? 'bg-zen-500 text-white shadow-sm shadow-zen-500/30'
                : 'text-slate-600 dark:text-slate-300 hover:text-zen-600 dark:hover:text-white'
            }`}
          >
            Customer
          </button>
          <button
            onClick={() => loginAsDemo('analyst')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              role === 'FRAUD_ANALYST'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white'
            }`}
          >
            Fraud Analyst
          </button>
          <button
            onClick={() => loginAsDemo('admin')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              role === 'ADMIN'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                : 'text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-white'
            }`}
          >
            Admin
          </button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Security AI Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zen-50 dark:bg-zen-950/60 border border-zen-200 dark:border-zen-800 text-[11px] font-semibold text-zen-700 dark:text-cyan-400">
            <ShieldCheck className="w-3.5 h-3.5 text-zen-500" />
            <span className="font-mono">AI Shield Active</span>
          </div>

          {/* Notifications */}
          <NotificationDropdown />

          {/* Dark / Light Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {/* User Profile Info */}
          {user && (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="hidden md:block text-right">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-end gap-1.5">
                  <span>{user.customer ? `${user.customer.first_name} ${user.customer.last_name}` : user.email.split('@')[0]}</span>
                  <Badge variant={getRoleBadgeVariant(role)} size="sm">
                    {role || 'USER'}
                  </Badge>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {user.email}
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-zen-600 to-cyan-500 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                {user.customer ? `${user.customer.first_name[0]}${user.customer.last_name[0]}` : user.email[0].toUpperCase()}
              </div>

              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
