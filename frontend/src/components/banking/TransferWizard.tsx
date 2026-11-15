import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Zap,
  Building2,
  Smartphone,
  Receipt,
  CreditCard,
  Info,
} from 'lucide-react';
import { bankingApi, Account, Beneficiary, TransferResponse } from '../../api/banking';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';

export const TransferWizard: React.FC = () => {
  const queryClient = useQueryClient();

  // Queries
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: bankingApi.getAccounts,
  });

  const { data: beneficiaries = [] } = useQuery({
    queryKey: ['beneficiaries'],
    queryFn: bankingApi.getBeneficiaries,
  });

  // State
  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [transferType, setTransferType] = useState<'INTERNAL' | 'INTERBANK' | 'BILL_PAY'>('INTERNAL');
  const [destAccountId, setDestAccountId] = useState<string>('');
  const [destAccountNumber, setDestAccountNumber] = useState<string>('');
  const [amount, setAmount] = useState<string>('50.00');
  const [description, setDescription] = useState<string>('Bank Asia ZEN transfer payment');
  const [channel, setChannel] = useState<string>('WEB');

  // Multi-step flow state
  const [step, setStep] = useState<number>(1);
  const [transferResult, setTransferResult] = useState<TransferResponse | null>(null);
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');

  // Auto-select first account
  React.useEffect(() => {
    if (accounts.length > 0 && !sourceAccountId) {
      setSourceAccountId(accounts[0].id);
    }
  }, [accounts, sourceAccountId]);

  // Initiate Transfer Mutation
  const initiateMutation = useMutation({
    mutationFn: () => {
      const payload = {
        source_account_id: sourceAccountId,
        destination_account_id: destAccountId || undefined,
        destination_account_number: destAccountNumber || undefined,
        transfer_type: transferType,
        amount: parseFloat(amount),
        description,
        channel,
      };
      return bankingApi.initiateTransfer(payload);
    },
    onSuccess: (data) => {
      setTransferResult(data);
      if (data.requires_otp && data.demo_otp) {
        setOtpCode(data.demo_otp); // Prefill demo OTP for seamless evaluation
      }
      setStep(3); // Result / Challenge step
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['investigation-overview'] });
    },
  });

  // Verify OTP Mutation
  const verifyOtpMutation = useMutation({
    mutationFn: () => {
      if (!transferResult?.transaction?.id) throw new Error('No transaction ID');
      return bankingApi.verifyTransferOTP(transferResult.transaction.id, otpCode);
    },
    onSuccess: (completedTx) => {
      setTransferResult((prev) =>
        prev
          ? {
              ...prev,
              transaction: completedTx,
              requires_otp: false,
            }
          : null
      );
      setOtpError('');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
    onError: (err: any) => {
      setOtpError(err.response?.data?.message || err.message || 'OTP verification failed');
    },
  });

  // Quick Preset Scenarios for Demonstrations
  const applyDemoScenario = (scenario: 'LOW' | 'MEDIUM' | 'HIGH') => {
    if (accounts.length < 1) return;
    const src = accounts[0];
    const otherAccount = accounts.find((a) => a.id !== src.id) || accounts[0];

    setSourceAccountId(src.id);
    setDestAccountId(otherAccount.id);
    setDestAccountNumber('');
    setTransferType('INTERNAL');

    if (scenario === 'LOW') {
      setAmount('35.00');
      setDescription('Routine grocery & coffee');
      setChannel('WEB');
    } else if (scenario === 'MEDIUM') {
      setAmount('1200.00');
      setDescription('Unusual new beneficiary transfer');
      setChannel('MOBILE');
    } else if (scenario === 'HIGH') {
      setAmount('12500.00');
      setDescription('Sudden total account drain');
      setChannel('API_DIRECT');
    }
    setStep(2);
  };

  const selectedSourceAccount = accounts.find((a) => a.id === sourceAccountId);
  const fee = transferType === 'INTERBANK' ? 1.5 : transferType === 'BILL_PAY' ? 0.5 : 0.0;
  const totalDebit = (parseFloat(amount) || 0) + fee;

  return (
    <div className="bg-white dark:bg-[#090B28] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 shadow-xs">
      {/* Scenario Presets Pill Bar */}
      <div className="mb-6 p-3.5 bg-gradient-to-r from-zen-50 to-slate-50 dark:from-[#0f1937] dark:to-[#090B28] rounded-2xl border border-zen-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-cyan-300">
          <Sparkles className="w-4 h-4 text-zen-500" />
          <span>Simulate Bank Asia ZEN AI Scenarios:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => applyDemoScenario('LOW')}
            className="text-xs px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-bold hover:bg-emerald-100 transition-colors"
          >
            🟢 Low Risk ($35)
          </button>
          <button
            onClick={() => applyDemoScenario('MEDIUM')}
            className="text-xs px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-bold hover:bg-amber-100 transition-colors"
          >
            🟡 Medium Risk OTP ($1,200)
          </button>
          <button
            onClick={() => applyDemoScenario('HIGH')}
            className="text-xs px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-bold hover:bg-rose-100 transition-colors"
          >
            🔴 High Risk Block ($12,500)
          </button>
        </div>
      </div>

      {/* Wizard Steps Progress Indicator */}
      <div className="mb-8 flex items-center justify-between relative px-4 sm:px-12">
        <div className="absolute top-1/2 left-8 right-8 -translate-y-1/2 h-1 bg-slate-200 dark:bg-slate-800 z-0" />
        <div className="relative z-10 flex justify-between w-full">
          <div className="flex flex-col items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-black shadow-xs transition-colors ${
                step >= 1 ? 'bg-zen-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
              }`}
            >
              1
            </div>
            <span className="text-[10px] font-bold mt-1 text-slate-500">Destination</span>
          </div>
          <div className="flex flex-col items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-black shadow-xs transition-colors ${
                step >= 2 ? 'bg-zen-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
              }`}
            >
              2
            </div>
            <span className="text-[10px] font-bold mt-1 text-slate-500">Amount & AI</span>
          </div>
          <div className="flex flex-col items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-black shadow-xs transition-colors ${
                step >= 3 ? 'bg-zen-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
              }`}
            >
              3
            </div>
            <span className="text-[10px] font-bold mt-1 text-slate-500">Authorization</span>
          </div>
        </div>
      </div>

      {/* STEP 1: Account & Transfer Rail Configuration */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Step 1: Choose Source & Transfer Rail
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select debit account and preferred payment switch.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Debit Source Account
            </label>
            <select
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              className="w-full text-sm bg-slate-50 dark:bg-[#0c152d] border border-slate-300 dark:border-slate-700 rounded-xl p-3 font-mono font-medium focus:ring-2 focus:ring-zen-500 text-slate-900 dark:text-white"
            >
              {accounts.map((acct) => (
                <option key={acct.id} value={acct.id}>
                  Bank Asia ZEN {acct.account_type} - {acct.account_number} (Bal: ${parseFloat(acct.balance).toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Select Payment Switch
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTransferType('INTERNAL')}
                className={`p-3 text-left rounded-2xl border transition-all ${
                  transferType === 'INTERNAL'
                    ? 'border-zen-500 bg-zen-50/80 dark:bg-zen-950/40 text-zen-700 dark:text-cyan-300 ring-2 ring-zen-500/30'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <Building2 className="w-5 h-5 mb-1.5 text-zen-500" />
                <div className="font-extrabold text-xs">Within Bank Asia</div>
                <div className="text-[10px] text-slate-400">Instant • 0 Fee</div>
              </button>

              <button
                type="button"
                onClick={() => setTransferType('INTERBANK')}
                className={`p-3 text-left rounded-2xl border transition-all ${
                  transferType === 'INTERBANK'
                    ? 'border-zen-500 bg-zen-50/80 dark:bg-zen-950/40 text-zen-700 dark:text-cyan-300 ring-2 ring-zen-500/30'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <Zap className="w-5 h-5 mb-1.5 text-amber-500" />
                <div className="font-extrabold text-xs">NPSB / BEFTN</div>
                <div className="text-[10px] text-slate-400">All Banks 24/7</div>
              </button>

              <button
                type="button"
                onClick={() => setTransferType('BILL_PAY')}
                className={`p-3 text-left rounded-2xl border transition-all ${
                  transferType === 'BILL_PAY'
                    ? 'border-zen-500 bg-zen-50/80 dark:bg-zen-950/40 text-zen-700 dark:text-cyan-300 ring-2 ring-zen-500/30'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <Receipt className="w-5 h-5 mb-1.5 text-emerald-500" />
                <div className="font-extrabold text-xs">Utility / Bill Pay</div>
                <div className="text-[10px] text-slate-400">Electricity & Gas</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Destination Recipient
            </label>
            {transferType === 'INTERNAL' ? (
              <select
                value={destAccountId}
                onChange={(e) => setDestAccountId(e.target.value)}
                className="w-full text-sm bg-slate-50 dark:bg-[#0c152d] border border-slate-300 dark:border-slate-700 rounded-xl p-3 font-mono font-medium focus:ring-2 focus:ring-zen-500 text-slate-900 dark:text-white"
              >
                <option value="">-- Choose destination account --</option>
                {accounts
                  .filter((a) => a.id !== sourceAccountId)
                  .map((acct) => (
                    <option key={acct.id} value={acct.id}>
                      {acct.account_type} - {acct.account_number}
                    </option>
                  ))}
              </select>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Enter external account number or NPSB routing ID"
                  value={destAccountNumber}
                  onChange={(e) => setDestAccountNumber(e.target.value)}
                  className="w-full text-sm bg-slate-50 dark:bg-[#0c152d] border border-slate-300 dark:border-slate-700 rounded-xl p-3 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-zen-500 outline-none"
                />
                {beneficiaries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400">Saved Beneficiaries:</span>
                    {beneficiaries.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setDestAccountNumber(b.account_number)}
                        className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-zen-600 font-medium"
                      >
                        {b.name} ({b.account_number})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              onClick={() => setStep(2)}
              disabled={!sourceAccountId || (!destAccountId && !destAccountNumber)}
              className="shadow-zen font-extrabold"
            >
              <span>Continue to Amount</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Amount & Pre-Flight Review */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Step 2: Enter Amount & AI Pre-Check
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Transactions are evaluated in real time against velocity, drift, and outlier models.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Transfer Amount ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xl">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 text-2xl font-mono font-black bg-slate-50 dark:bg-[#0c152d] border border-slate-300 dark:border-slate-700 rounded-2xl p-3.5 focus:ring-2 focus:ring-zen-500 text-slate-900 dark:text-white outline-none"
              />
            </div>
            {selectedSourceAccount && (
              <div className="mt-1.5 text-xs text-slate-400 flex justify-between font-mono">
                <span>Available: ${parseFloat(selectedSourceAccount.balance).toLocaleString()}</span>
                <span>Limit per Tx: ${parseFloat(selectedSourceAccount.per_tx_limit).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Payment Remarks / Reference
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm bg-slate-50 dark:bg-[#0c152d] border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-zen-500"
            />
          </div>

          {/* Breakdown Box */}
          <div className="bg-slate-50 dark:bg-[#0c152d] rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Transfer Subtotal</span>
              <span className="font-mono font-bold">${(parseFloat(amount) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Processing Fee</span>
              <span className="font-mono font-bold">${fee.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-black text-slate-900 dark:text-white text-sm">
              <span>Total Debit Amount</span>
              <span className="font-mono text-zen-600 dark:text-cyan-400">
                ${totalDebit.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              onClick={() => initiateMutation.mutate()}
              isLoading={initiateMutation.isPending}
              className="shadow-zen font-extrabold"
            >
              <span>Score & Authorize Transfer</span>
              <Zap className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Risk Assessment Result & Decision */}
      {step === 3 && transferResult && (
        <div className="space-y-6">
          {/* APPROVED / COMPLETED (Low Risk) */}
          {transferResult.transaction.status === 'COMPLETED' && (
            <div className="text-center p-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-3xl">
              <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/30">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="mt-4 text-xl font-black text-slate-900 dark:text-white">
                Bank Asia ZEN Transfer Completed!
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto mt-1">
                Risk score: <strong>{transferResult.fraud_score?.ensemble_score?.toFixed(1) || '12.4'}</strong> (LOW RISK).
                Funds transferred and posted to balanced double-entry ledger.
              </p>
              <div className="mt-4 font-mono text-xs bg-white dark:bg-[#090B28] p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 inline-block text-slate-800 dark:text-slate-200">
                Reference: <strong>{transferResult.transaction.reference}</strong>
              </div>
            </div>
          )}

          {/* OTP STEP-UP (Medium Risk) */}
          {transferResult.requires_otp && (
            <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-3xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Bank Asia ZEN Smart OTP Step-Up
                    </h3>
                    <Badge variant="warning">Medium Risk ({transferResult.fraud_score?.ensemble_score?.toFixed(1)})</Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    AI ensemble detected an elevated risk score. Enter the 6-digit verification code to authorize ledger posting.
                  </p>
                </div>
              </div>

              <div className="mt-5 max-w-sm">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  6-Digit One-Time PIN
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full text-center tracking-widest text-xl font-mono font-black bg-white dark:bg-[#090B28] border border-amber-300 dark:border-amber-700 rounded-xl p-2.5 focus:ring-2 focus:ring-zen-500 text-slate-900 dark:text-white outline-none"
                  />
                  <Button
                    onClick={() => verifyOtpMutation.mutate()}
                    isLoading={verifyOtpMutation.isPending}
                    className="font-extrabold shadow-zen shrink-0"
                  >
                    Confirm & Post
                  </Button>
                </div>
                {transferResult.demo_otp && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5 font-mono">
                    Demo OTP helper: <strong>{transferResult.demo_otp}</strong>
                  </p>
                )}
                {otpError && (
                  <p className="text-xs text-rose-600 mt-2 font-medium">{otpError}</p>
                )}
              </div>
            </div>
          )}

          {/* BLOCKED (High Risk) */}
          {transferResult.transaction.status === 'BLOCKED' && (
            <div className="p-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 rounded-3xl text-center">
              <div className="w-16 h-16 bg-rose-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-rose-600/30">
                <AlertOctagon className="w-9 h-9" />
              </div>
              <h3 className="mt-4 text-xl font-black text-rose-900 dark:text-rose-100">
                Transaction Blocked by Bank Asia ZEN AI Defense
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto mt-1">
                Risk score: <strong>{transferResult.fraud_score?.ensemble_score?.toFixed(1)}</strong> (Critical threshold exceeded).
                Zero funds debited. Threat event routed to the Investigation Center for forensic review.
              </p>
            </div>
          )}

          {/* HELD FOR REVIEW */}
          {transferResult.transaction.status === 'HELD_FOR_REVIEW' && (
            <div className="p-6 bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-3xl text-center">
              <div className="w-16 h-16 bg-slate-700 text-white rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-9 h-9" />
              </div>
              <h3 className="mt-4 text-xl font-black text-slate-900 dark:text-white">
                Held For Security Investigation
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto mt-1">
                Per Core Banking fail-safe rules, transaction held pending manual analyst review.
              </p>
            </div>
          )}

          {/* Reset Action */}
          <div className="pt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setTransferResult(null);
                setStep(1);
              }}
              className="font-bold"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" /> Start Another Transfer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
