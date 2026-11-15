import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, ShieldCheck, Lock, Unlock, Sliders } from 'lucide-react';
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

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'FROZEN' }) =>
      bankingApi.updateCardStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });

  const updateLimitMutation = useMutation({
    mutationFn: ({ id, limit }: { id: string; limit: number }) =>
      bankingApi.updateCardLimit(id, limit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-emerald-600" />
          Debit Cards & Controls
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Instantly freeze compromised cards or adjust daily point-of-sale spending limits.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card: Card) => {
          const isFrozen = card.status === 'FROZEN';
          const currentLimit = selectedLimit[card.id] ?? parseFloat(card.spending_limit);

          return (
            <div
              key={card.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5"
            >
              {/* Virtual Plastic Card Art */}
              <div
                className={`relative h-44 rounded-2xl p-5 text-white flex flex-col justify-between shadow-xl transition-all ${
                  isFrozen
                    ? 'bg-gradient-to-tr from-slate-700 to-slate-900 grayscale'
                    : 'bg-gradient-to-tr from-emerald-800 via-emerald-950 to-slate-950 shadow-emerald-900/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm tracking-wider">BANK INVESTIGATION</span>
                  <Badge variant={isFrozen ? 'warning' : 'success'} size="sm">
                    {card.status}
                  </Badge>
                </div>

                <div className="font-mono text-base tracking-widest font-bold my-auto">
                  {card.card_number_masked}
                </div>

                <div className="flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider block opacity-70">EXPIRES</span>
                    <span>{card.expiry_date}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider block opacity-70">CARD TYPE</span>
                    <span>{card.card_type}</span>
                  </div>
                </div>
              </div>

              {/* Actions & Spending Limit */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Daily Spending Limit
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                      ${currentLimit.toLocaleString()}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateLimitMutation.mutate({ id: card.id, limit: currentLimit })}
                    isLoading={updateLimitMutation.isPending}
                  >
                    Save Limit
                  </Button>
                </div>

                <input
                  type="range"
                  min="500"
                  max="10000"
                  step="250"
                  value={currentLimit}
                  onChange={(e) =>
                    setSelectedLimit({ ...selectedLimit, [card.id]: parseFloat(e.target.value) })
                  }
                  className="w-full accent-emerald-600"
                />

                <div className="pt-2 flex gap-3">
                  <Button
                    variant={isFrozen ? 'primary' : 'danger'}
                    className="w-full"
                    onClick={() =>
                      toggleStatusMutation.mutate({
                        id: card.id,
                        status: isFrozen ? 'ACTIVE' : 'FROZEN',
                      })
                    }
                    isLoading={toggleStatusMutation.isPending}
                  >
                    {isFrozen ? (
                      <>
                        <Unlock className="w-4 h-4 mr-1.5" /> Unfreeze Card
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-1.5" /> Freeze Card
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
