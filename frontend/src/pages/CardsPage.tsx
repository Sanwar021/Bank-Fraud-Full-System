import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, ShieldCheck, Lock, Unlock, Sliders, Wifi, Sparkles, Check } from 'lucide-react';
import { bankingApi, Card } from '../api/banking';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const CardsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['cards'],
    queryFn: bankingApi.getCards,
  });

  const [selectedLimit, setSelectedLimit] = useState<{ [id: string]: number }>({});
  const [savedLimitNotice, setSavedLimitNotice] = useState<{ [id: string]: boolean }>({});

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'BLOCKED' }) =>
      bankingApi.updateCardStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });

  const updateLimitMutation = useMutation({
    mutationFn: ({ id, limit }: { id: string; limit: number }) =>
      bankingApi.updateCardLimit(id, limit),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      setSavedLimitNotice((prev) => ({ ...prev, [variables.id]: true }));
      setTimeout(() => {
        setSavedLimitNotice((prev) => ({ ...prev, [variables.id]: false }));
      }, 2000);
    },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-zen-600 dark:text-cyan-400 uppercase tracking-wider">
            Mrraw Bank Card Center
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
          <CreditCard className="w-6 h-6 text-zen-500" />
          <span>MRRAW Platinum Cards & Spending Controls</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your virtual & physical debit cards. Instantly freeze lost cards or adjust daily POS/ATM limits.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card: Card) => {
          const isFrozen = card.status === 'BLOCKED';
          const currentLimit = selectedLimit[card.id] ?? parseFloat(card.spending_limit);

          return (
            <div
              key={card.id}
              className="bg-white dark:bg-[#090B28] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-5 shadow-xs"
            >
              {/* Virtual Plastic Card Art with Mrraw Bank Aesthetic */}
              <div
                className={`relative h-48 rounded-3xl p-5 text-white flex flex-col justify-between shadow-xl transition-all overflow-hidden ${
                  isFrozen
                    ? 'bg-gradient-to-tr from-slate-700 to-slate-950 grayscale'
                    : 'bg-gradient-to-br from-[#2061AE] via-[#164379] to-[#090B28] shadow-zen'
                }`}
              >
                {/* Decorative curves watermark */}
                <svg
                  className="absolute -right-6 -bottom-10 w-44 h-44 opacity-15 pointer-events-none text-white"
                  viewBox="0 0 100 100"
                  fill="currentColor"
                >
                  <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="none" />
                </svg>

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-xs tracking-wider">Mrraw Bank</span>
                    <span className="bg-white/20 text-[10px] font-black px-1.5 py-0.2 rounded-full uppercase">
                      MRRAW
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-white/70 rotate-90" />
                    <Badge variant={isFrozen ? 'warning' : 'success'} size="sm">
                      {card.status}
                    </Badge>
                  </div>
                </div>

                {/* EMV Chip & NFC */}
                <div className="flex items-center gap-2 my-auto relative z-10">
                  <div className="w-9 h-7 rounded bg-gradient-to-tr from-amber-300 to-amber-400 border border-amber-500/40 shadow-xs" />
                  <div className="font-mono text-base tracking-widest font-bold ml-2">
                    {card.card_number_masked}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono relative z-10">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider block opacity-70">EXPIRES</span>
                    <span className="font-bold">{card.expiry_date}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider block opacity-70">TIER</span>
                    <span className="font-bold">{card.card_type}</span>
                  </div>
                </div>
              </div>

              {/* Actions & Spending Limit Slider */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Daily Spending Limit
                    </span>
                    <span className="font-mono text-base font-black text-slate-900 dark:text-white">
                      ${currentLimit.toLocaleString()}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={isFrozen ? 'primary' : 'danger'}
                    onClick={() =>
                      toggleStatusMutation.mutate({
                        id: card.id,
                        status: isFrozen ? 'ACTIVE' : 'BLOCKED',
                      })
                    }
                    isLoading={toggleStatusMutation.isPending}
                    className="font-bold"
                  >
                    {isFrozen ? (
                      <>
                        <Unlock className="w-3.5 h-3.5 mr-1" /> Unfreeze Card
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 mr-1" /> Freeze Card
                      </>
                    )}
                  </Button>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1 font-mono">
                    <span>$500</span>
                    <span>$10,000</span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="10000"
                    step="250"
                    value={currentLimit}
                    onChange={(e) =>
                      setSelectedLimit({
                        ...selectedLimit,
                        [card.id]: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-zen-500 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="mt-2.5 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateLimitMutation.mutate({ id: card.id, limit: currentLimit })
                      }
                      isLoading={updateLimitMutation.isPending}
                      className="font-bold text-xs"
                    >
                      {savedLimitNotice[card.id] ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Saved!
                        </>
                      ) : (
                        'Save Limit'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
