import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from 'recharts';

interface SHAPBarChartProps {
  featuresJson?: string | Record<string, number>;
}

export const SHAPBarChart: React.FC<SHAPBarChartProps> = ({ featuresJson }) => {
  let featuresMap: Record<string, number> = {};

  if (typeof featuresJson === 'string') {
    try {
      featuresMap = JSON.parse(featuresJson || '{}');
    } catch {
      featuresMap = {};
    }
  } else if (featuresJson) {
    featuresMap = featuresJson;
  }

  const data = Object.entries(featuresMap)
    .map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value: Number(value.toFixed(4)),
      absVal: Math.abs(value),
    }))
    .sort((a, b) => b.absVal - a.absVal)
    .slice(0, 6);

  if (data.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
        No SHAP feature contributions available for this score.
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
          SHAP Feature Contributions (XGBoost Explainability)
        </h4>
        <div className="flex items-center gap-3 text-[10px] font-medium">
          <span className="flex items-center gap-1 text-rose-500">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> + Increases Fraud Risk
          </span>
          <span className="flex items-center gap-1 text-emerald-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> - Legitimate Pattern
          </span>
        </div>
      </div>

      <div className="h-56 w-full text-xs">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
            <Tooltip
              formatter={(val: number) => [`${val > 0 ? '+' : ''}${val}`, 'SHAP Value']}
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }}
            />
            <ReferenceLine x={0} stroke="#64748b" strokeDasharray="3 3" />
            <Bar dataKey="value" radius={[4, 4, 4, 4]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#f43f5e' : '#10b981'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
