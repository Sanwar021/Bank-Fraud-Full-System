import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { authApi } from '../api/auth';
import { Button } from '../components/common/Button';
import { BankAsiaLogo } from '../components/common/BankAsiaLogo';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '+88017',
    national_id: 'NID-BD-902',
    monthly_income: 6500,
    address: 'Bank Asia Tower, Rangs Fortune Square, Dhanmondi, Dhaka',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.register(formData);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#090B28] via-[#0c1e40] to-[#07091e] relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-zen-500/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-6">
          <BankAsiaLogo size="lg" showSubtitle={true} />
        </div>

        <div className="bg-white/95 dark:bg-[#0c152d]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-zen-dark rounded-3xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Open a Bank Asia ZEN Account
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Automated e-KYC Verification & Instant Dual-Account Setup
            </p>
          </div>

          {success ? (
            <div className="text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Account Approved & KYC Verified!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Created Savings & Current accounts with initial starter funds. Redirecting to login...
              </p>
            </div>
          ) : (
            <form className="space-y-3.5 text-xs" onSubmit={handleSubmit}>
              {error && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="mt-1 w-full text-xs bg-slate-50 dark:bg-[#090B28] border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-zen-500 outline-none"
                    placeholder="Tanvir"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Last Name</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="mt-1 w-full text-xs bg-slate-50 dark:bg-[#090B28] border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-zen-500 outline-none"
                    placeholder="Ahmed"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 w-full text-xs bg-slate-50 dark:bg-[#090B28] border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-zen-500 outline-none"
                  placeholder="tanvir.ahmed@bankinvestigation.com"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Password</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="mt-1 w-full text-xs bg-slate-50 dark:bg-[#090B28] border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-zen-500 outline-none"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Phone</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 w-full text-xs bg-slate-50 dark:bg-[#090B28] border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-zen-500 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">National ID</label>
                  <input
                    type="text"
                    required
                    value={formData.national_id}
                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                    className="mt-1 w-full text-xs bg-slate-50 dark:bg-[#090B28] border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-zen-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Residential Address</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1 w-full text-xs bg-slate-50 dark:bg-[#090B28] border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-zen-500 outline-none"
                />
              </div>

              <Button
                type="submit"
                className="w-full py-3 shadow-zen font-extrabold mt-2"
                isLoading={loading}
              >
                <span>Complete e-KYC & Open Account</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>
          )}

          <div className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
            <span>Already have an account? </span>
            <Link to="/login" className="text-zen-600 dark:text-cyan-400 font-bold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
