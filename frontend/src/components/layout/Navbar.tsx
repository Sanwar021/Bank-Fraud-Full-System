import React from 'react';
import { Shield, Moon, Sun, LogOut, ChevronDown, UserCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NotificationDropdown } from './NotificationDropdown';
import { Badge } from '../common/Badge';

export const Navbar: React.FC = () => {
  const { user, role, logout, loginAsDemo } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const getRoleBadgeVariant = (r?: string | null) => {
    switch (r) {
      case 'ADMIN': return 'danger';
      case 'FRAUD_ANALYST': return 'purple';
      case 'TELLER': return 'info';
      default: return 'success';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
                Bank Investigation
              </span>
              <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded uppercase">
                v1.0
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-none">
              Core Banking & AI Fraud Defense
            </p>
          </div>
        </div>

        {/* Center / Fast Demo Switcher */}
        <div className="hidden md:flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/60 p-1 rounded-xl text-xs">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2">
            Switch Demo Persona:
          </span>
          <button
            onClick={() => loginAsDemo('customer')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              role === 'CUSTOMER'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Customer
          </button>
          <button
            onClick={() => loginAsDemo('analyst')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              role === 'FRAUD_ANALYST'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Fraud Analyst
          </button>
          <button
            onClick={() => loginAsDemo('admin')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              role === 'ADMIN'
                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Admin
          </button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <NotificationDropdown />

          {/* Dark / Light Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {/* User Profile Info */}
          {user && (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-end gap-1.5">
                  {user.customer ? `${user.customer.first_name} ${user.customer.last_name}` : user.email.split('@')[0]}
                  <Badge variant={getRoleBadgeVariant(role)} size="sm">
                    {role}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {user.email}
                </div>
              </div>

              <button
                onClick={logout}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
