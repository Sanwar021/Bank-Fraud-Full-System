import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ShieldAlert, AlertTriangle, ArrowUpRight, Scale } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { investigationApi, FraudAlert } from '../../api/investigation';

interface AdjudicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: FraudAlert | null;
}

export const AdjudicationModal: React.FC<AdjudicationModalProps> = ({
  isOpen,
  onClose,
  alert,
}) => {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<'CONFIRMED_FRAUD' | 'FALSE_POSITIVE' | 'RELEASED' | 'ESCALATED'>('RELEASED');
  const [reason, setReason] = useState<string>('Customer contacted and verified legitimate transaction intent.');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  const adjudicateMutation = useMutation({
    mutationFn: () => {
      if (!alert) throw new Error('No alert selected');
      return investigationApi.adjudicateAlert(alert.id, {
        decision,
        reason,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fraud-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['investigation-overview'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.message || 'Adjudication failed');
    },
  });

  if (!alert) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adjudicate Fraud Alert" maxWidth="lg">
      <div className="space-y-5 text-xs">
        {/* Summary Card */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              Transaction Ref: <span className="font-mono">{alert.transaction?.reference || alert.transaction_id}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Amount: ${parseFloat(alert.transaction?.amount || '0').toFixed(2)} • Risk: {parseFloat(alert.risk_score).toFixed(1)}
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded uppercase bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
            {alert.severity} SEVERITY
          </span>
        </div>

        {/* Decision Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Select Adjudication Action
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setDecision('RELEASED');
                setReason('Customer verified legitimate intent via secondary channel');
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                decision === 'RELEASED'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Release & Post Ledger
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Approves held transfer and creates balanced double-entry postings.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setDecision('CONFIRMED_FRAUD');
                setReason('Unauthorized access confirmed / Account takeover pattern');
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                decision === 'CONFIRMED_FRAUD'
                  ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 ring-1 ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                Confirm Fraud & Freeze
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Permanently blocks transaction and freezes source account.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setDecision('FALSE_POSITIVE');
                setReason('Legitimate anomalous user behavior tagged false positive');
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                decision === 'FALSE_POSITIVE'
                  ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30 ring-1 ring-sky-500'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5" />
                False Positive
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Resolves alert without account restrictions.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setDecision('ESCALATED');
                setReason('Requires secondary supervisory compliance investigation');
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                decision === 'ESCALATED'
                  ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-500'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Escalate Case
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Routes to Level 2 senior financial crimes investigator.
              </div>
            </button>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Official Regulatory Reason *
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        {/* Analyst Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Internal Investigation Notes (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Document phone contact, IP geo lookup, or law enforcement referral..."
            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {error && (
          <div className="p-2 rounded bg-rose-50 text-rose-600 text-xs font-medium">
            {error}
          </div>
        )}

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => adjudicateMutation.mutate()}
            isLoading={adjudicateMutation.isPending}
            variant={decision === 'CONFIRMED_FRAUD' ? 'danger' : 'primary'}
          >
            Submit Adjudication
          </Button>
        </div>
      </div>
    </Modal>
  );
};
