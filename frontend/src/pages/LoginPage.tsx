import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  KeyRound,
  AlertCircle,
  ArrowRight,
  UserCheck,
  Fingerprint,
  Lock,
  Mail,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { BankAsiaLogo } from '../components/common/BankAsiaLogo';

export const LoginPage: React.FC = () => {
  const { login, loginAsDemo } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('john.doe@bankinvestigation.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricSimulated, setBiometricSimulated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role_id === 'FRAUD_ANALYST' || user.role_id === 'ADMIN') {
        navigate('/investigation');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: 'customer' | 'analyst' | 'teller' | 'admin') => {
    setError('');
    setLoading(true);
    try {
      await loginAsDemo(role);
      if (role === 'analyst' || role === 'admin') {
        navigate('/investigation');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatedBiometric = () => {
    setBiometricSimulated(true);
    setTimeout(() => {
      handleDemoLogin('customer');
    }, 800);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#090B28] via-[#0c1e40] to-[#07091e] relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-zen-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Login Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-6">
          <BankAsiaLogo size="lg" showSubtitle={true} />
        </div>

        {/* Card */}
        <div className="bg-white/95 dark:bg-[#0c152d]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-zen-dark rounded-3xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Sign In to ZEN Smart Banking
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Protected by AI Tri-Model Shield & Double-Entry Ledger
            </p>
          </div>

          {/* Instant 1-Click Demo Personas Selector */}
          <div className="mb-6 p-3.5 rounded-2xl bg-gradient-to-r from-zen-50 to-slate-50 dark:from-[#111e42] dark:to-[#0c152d] border border-zen-200/80 dark:border-zen-900/60">
            <div className="flex items-center justify-between text-xs font-bold text-zen-800 dark:text-cyan-300 mb-2.5">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-zen-500" />
                <span>Instant Demo Sign-in:</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">1-Click</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleDemoLogin('customer')}
                className="p-2.5 rounded-xl bg-white dark:bg-[#090B28] border border-zen-200 dark:border-zen-800/80 text-left hover:border-zen-500 transition-all shadow-2xs group"
              >
                <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-zen-600 dark:group-hover:text-cyan-400 flex items-center justify-between">
                  <span>Customer</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <div className="text-[10px] text-slate-400 truncate">John Doe ($20.7k)</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('analyst')}
                className="p-2.5 rounded-xl bg-white dark:bg-[#090B28] border border-indigo-200 dark:border-indigo-800/80 text-left hover:border-indigo-500 transition-all shadow-2xs group"
              >
                <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center justify-between">
                  <span>Fraud Analyst</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                </div>
                <div className="text-[10px] text-slate-400 truncate">Triage & SHAP AI</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('admin')}
                className="p-2.5 rounded-xl bg-white dark:bg-[#090B28] border border-rose-200 dark:border-rose-800/80 text-left hover:border-rose-500 transition-all shadow-2xs group"
              >
                <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 flex items-center justify-between">
                  <span>Bank Admin</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                </div>
                <div className="text-[10px] text-slate-400 truncate">Audit & Policies</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('teller')}
                className="p-2.5 rounded-xl bg-white dark:bg-[#090B28] border border-sky-200 dark:border-sky-800/80 text-left hover:border-sky-500 transition-all shadow-2xs group"
              >
                <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 flex items-center justify-between">
                  <span>Bank Teller</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                </div>
                <div className="text-[10px] text-slate-400 truncate">Cash & Deposits</div>
              </button>
            </div>
          </div>

          {/* Biometric Touch ID Quick Access */}
          <div className="mb-5">
            <button
              type="button"
              onClick={handleSimulatedBiometric}
              disabled={loading || biometricSimulated}
              className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition-all border border-slate-200 dark:border-slate-700"
            >
              <Fingerprint className={`w-4 h-4 text-zen-500 ${biometricSimulated ? 'animate-pulse text-emerald-500' : ''}`} />
              <span>{biometricSimulated ? 'Biometric Verified! Signing in...' : 'Sign In with Bank Asia Smart Biometrics'}</span>
            </button>
          </div>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white dark:bg-[#0c152d] text-slate-400 font-medium">
                Or enter standard credentials
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email / Customer ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#090B28] text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-zen-500 focus:border-zen-500 outline-none transition-all"
                  placeholder="name@bankinvestigation.com"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <span className="text-[11px] text-zen-600 dark:text-cyan-400 hover:underline cursor-pointer">
                  Forgot PIN?
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#090B28] text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-zen-500 focus:border-zen-500 outline-none transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full py-3 shadow-zen font-extrabold"
              isLoading={loading}
            >
              <span>Sign In to Bank Asia ZEN</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          {/* Footer Register Link */}
          <div className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
            <span>New to Bank Asia ZEN? </span>
            <Link to="/register" className="text-zen-600 dark:text-cyan-400 font-bold hover:underline">
              Open a Smart Account
            </Link>
          </div>
        </div>

        {/* Security badge at bottom */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center text-slate-400 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>256-Bit SSL • Core Banking Double-Entry • Tri-Model AI Shield</span>
        </div>
      </div>
    </div>
  );
};
