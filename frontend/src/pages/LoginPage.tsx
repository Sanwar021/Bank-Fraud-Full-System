import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, KeyRound, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';

export const LoginPage: React.FC = () => {
  const { login, loginAsDemo } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('john.doe@bankinvestigation.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-emerald-500/20">
          <Shield className="w-7 h-7" />
        </div>
        <h2 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Bank Investigation
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Simulated Core Banking Platform & AI Fraud Defense System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Fast Demo One-Click Personas */}
        <div className="mb-6 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2.5">
            <UserCheck className="w-4 h-4" />
            <span>Select Demo Persona (Instant Sign-in):</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => handleDemoLogin('customer')}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-left hover:border-emerald-500 transition-all font-medium"
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">Customer</div>
              <div className="text-[10px] text-slate-400">John Doe (Standard)</div>
            </button>
            <button
              onClick={() => handleDemoLogin('analyst')}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-left hover:border-indigo-500 transition-all font-medium"
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">Fraud Analyst</div>
              <div className="text-[10px] text-slate-400">Triage & Investigation</div>
            </button>
            <button
              onClick={() => handleDemoLogin('admin')}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-left hover:border-rose-500 transition-all font-medium"
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">Bank Admin</div>
              <div className="text-[10px] text-slate-400">System Telemetry & Audit</div>
            </button>
            <button
              onClick={() => handleDemoLogin('teller')}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 text-left hover:border-sky-500 transition-all font-medium"
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">Bank Teller</div>
              <div className="text-[10px] text-slate-400">Account Operations</div>
            </button>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-900 py-8 px-6 shadow-sm border border-slate-200 dark:border-slate-800 rounded-2xl sm:px-10">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <Button type="submit" isLoading={loading} className="w-full mt-2">
              Sign In to Account <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Need an account?{' '}
            <Link to="/register" className="font-semibold text-emerald-600 hover:underline">
              Register Customer & Mock KYC
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

