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
  const [amount, setAmount] = useState<string>('150.00');
  const [description, setDescription] = useState<string>('Monthly utility & savings');
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
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
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
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (err: any) => {
      setOtpError(err.response?.data?.message || err.message || 'OTP verification failed');
    },
  });

  // Quick Preset Scenarios for Demonstrations
  const applyDemoScenario = (scenario: 'LOW' | 'MEDIUM' | 'HIGH' | 'HOLD') => {
    if (accounts.length < 1) return;
    const src = accounts[0];
    const otherAccount = accounts.find((a) => a.id !== src.id) || accounts[0];

    setSourceAccountId(src.id);
    setDestAccountId(otherAccount.id);
    setDestAccountNumber('');
    setTransferType('INTERNAL');

    if (scenario === 'LOW') {
      setAmount('45.00');
      setDescription('Routine grocery reimbursement');
      setChannel('WEB');
    } else if (scenario === 'MEDIUM') {
      setAmount('1850.00');
      setDescription('Unusual electronics payment - Step-up challenge');
      setChannel('MOBILE');
    } else if (scenario === 'HIGH') {
      setAmount('12500.00');
      setDescription('Sudden total account drain - ATO pattern');
      setChannel('API_DIRECT');
    }
    setStep(2);
  };

  const selectedSourceAccount = accounts.find((a) => a.id === sourceAccountId);
  const fee = transferType === 'INTERBANK' ? 1.5 : transferType === 'BILL_PAY' ? 0.5 : 0.0;
  const totalDebit = (parseFloat(amount) || 0) + fee;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
      {/* Scenario Presets Pill Bar */}
      <div className="mb-6 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Quick Demo Scenarios:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => applyDemoScenario('LOW')}
            className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-medium hover:bg-emerald-100 transition-colors"
          >
            🟢 Low Risk ($45)
          </button>
          <button
            onClick={() => applyDemoScenario('MEDIUM')}
            className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-medium hover:bg-amber-100 transition-colors"
          >
            🟡 Medium Risk OTP ($1,850)
          </button>
          <button
            onClick={() => applyDemoScenario('HIGH')}
            className="text-xs px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-medium hover:bg-rose-100 transition-colors"
          >
            🔴 High Risk Block ($12,500)
          </button>
        </div>
      </div>

      {/* Wizard Steps Progress */}
      <div className="mb-8 flex items-center justify-between relative">
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-0.5 bg-slate-200 dark:bg-slate-800 z-0" />
        <div className="relative z-10 flex justify-between w-full">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
              step >= 1
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}
          >
            1
          </div>
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
              step >= 2
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}
          >
            2
          </div>
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
              step >= 3
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}
          >
            3
          </div>
        </div>
      </div>

      {/* STEP 1: Account & Transfer Configuration */}
      {step === 1 && (
        <div className="space-y-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Step 1: Choose Source & Transfer Type
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Source Account
            </label>
            <select
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-mono focus:ring-2 focus:ring-emerald-500"
            >
              {accounts.map((acct) => (
                <option key={acct.id} value={acct.id}>
                  {acct.account_type} - {acct.account_number} (Bal: ${parseFloat(acct.balance).toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Transfer Rail / Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['INTERNAL', 'INTERBANK', 'BILL_PAY'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTransferType(t)}
                  className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all ${
                    transferType === t
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Destination Account
            </label>
            {transferType === 'INTERNAL' ? (
              <select
                value={destAccountId}
                onChange={(e) => setDestAccountId(e.target.value)}
                className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-mono focus:ring-2 focus:ring-emerald-500"
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
                  placeholder="Enter external account or IBAN"
                  value={destAccountNumber}
                  onChange={(e) => setDestAccountNumber(e.target.value)}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-mono"
                />
                {beneficiaries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400">Saved:</span>
                    {beneficiaries.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setDestAccountNumber(b.account_number)}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-emerald-600"
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
            >
              Continue to Amount <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Amount & Pre-Flight Review */}
      {step === 2 && (
        <div className="space-y-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Step 2: Enter Amount & Review
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Transfer Amount ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 text-xl font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {selectedSourceAccount && (
              <div className="mt-1 text-xs text-slate-400 flex justify-between font-mono">
                <span>Available: ${parseFloat(selectedSourceAccount.balance).toLocaleString()}</span>
                <span>Max per tx: ${parseFloat(selectedSourceAccount.per_tx_limit).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Payment Memo / Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5"
            />
          </div>

          {/* Breakdown Box */}
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Transfer Subtotal</span>
              <span className="font-mono">${(parseFloat(amount) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Processing Fee</span>
              <span className="font-mono">${fee.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-slate-900 dark:text-slate-100 text-sm">
              <span>Total Debit</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
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
            >
              Assess Risk & Send Transfer <Zap className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Risk Assessment Result & Decision */}
      {step === 3 && transferResult && (
        <div className="space-y-6">
          {/* APPROVED (Low Risk) */}
          {transferResult.transaction.status === 'COMPLETED' && (
            <div className="text-center p-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl">
              <div className="w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/20">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">
                Transfer Approved & Posted to Ledger!
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto mt-1">
                Risk score: <strong>{transferResult.fraud_score?.ensemble_score?.toFixed(1) || '12.4'}</strong> (LOW RISK).
                Double-entry balanced entries written atomically.
              </p>
              <div className="mt-4 font-mono text-xs bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 inline-block">
                Reference: {transferResult.transaction.reference}
              </div>
            </div>
          )}

          {/* OTP STEP-UP (Medium Risk) */}
          {transferResult.requires_otp && (
            <div className="p-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Step-Up Verification Required
                    </h3>
                    <Badge variant="warning">Medium Risk</Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Risk score: <strong>{transferResult.fraud_score?.ensemble_score?.toFixed(1)}</strong>. Elevated velocity or unusual amount detected. A 6-digit confirmation code was dispatched.
                  </p>
                </div>
              </div>

              <div className="mt-5 max-w-sm">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enter 6-Digit One-Time Passcode (OTP)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full text-center tracking-widest text-lg font-mono font-bold bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl p-2 focus:ring-2 focus:ring-amber-500"
                  />
                  <Button
                    onClick={() => verifyOtpMutation.mutate()}
                    isLoading={verifyOtpMutation.isPending}
                    variant="primary"
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
            <div className="p-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 rounded-2xl text-center">
              <div className="w-14 h-14 bg-rose-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-rose-600/20">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-rose-900 dark:text-rose-100">
                Transaction Blocked by Automated Fraud Defense
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto mt-1">
                Risk score: <strong>{transferResult.fraud_score?.ensemble_score?.toFixed(1)}</strong> (CRITICAL THRESHOLD EXCEEDED).
                No funds were debited. An alert has been dispatched to the Investigation Center.
              </p>
            </div>
          )}

          {/* HELD FOR REVIEW (ML Service Timeout Fallback) */}
          {transferResult.transaction.status === 'HELD_FOR_REVIEW' && (
            <div className="p-6 bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl text-center">
              <div className="w-14 h-14 bg-slate-700 text-white rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">
                Held For Security Review
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto mt-1">
                The ML scoring engine was unreachable within 150ms. Per core banking safety guidelines, the transfer was held rather than auto-approved.
              </p>
            </div>
          )}

          {/* New Transfer Button */}
          <div className="pt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setTransferResult(null);
                setStep(1);
              }}
            >
              <RefreshCw className="w-4 h-4 mr-1.5" /> Start Another Transfer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
