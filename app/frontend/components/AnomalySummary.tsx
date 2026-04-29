'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Anomaly, AnomalyCategoryKey, AnomalySeverity } from '@/lib/types';
import { CATEGORY_META } from './CategorySection';

const SEV_COLOR: Record<AnomalySeverity, string> = {
  high: '#e11d48',
  medium: '#f59e0b',
  low: '#94a3b8',
};

// Use the -100 family so dark-mode remaps in globals.css kick in
// (rgba translucent over the dark surface). -50 is not remapped and
// renders as harsh light pastel blocks against the black background.
const SEV_BG: Record<AnomalySeverity, string> = {
  high: 'bg-rose-100 border-rose-200 text-rose-700',
  medium: 'bg-amber-100 border-amber-200 text-amber-700',
  low: 'bg-white/[0.04] border-white/10 text-neutral-400',
};

interface Props {
  anomalies: Anomaly[];
  total: number;
  counts: Record<AnomalyCategoryKey, number>;
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${className ?? 'bg-white border-neutral-200'}`}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

export function AnomalySummary({ anomalies, total, counts }: Props) {
  const sevCounts: Record<AnomalySeverity, number> = { high: 0, medium: 0, low: 0 };
  const bankSev: Record<string, Record<AnomalySeverity, number>> = {};
  for (const a of anomalies) {
    sevCounts[a.severity]++;
    if (a.bank_ticker && a.bank_ticker !== '-') {
      bankSev[a.bank_ticker] ??= { high: 0, medium: 0, low: 0 };
      bankSev[a.bank_ticker][a.severity]++;
    }
  }

  const categoryData = (Object.keys(counts) as AnomalyCategoryKey[]).map((k) => ({
    key: k,
    label: CATEGORY_META[k].label,
    count: counts[k],
  }));

  const bankData = Object.entries(bankSev)
    .map(([ticker, s]) => ({
      ticker,
      total: s.high + s.medium + s.low,
      high: s.high,
      medium: s.medium,
      low: s.low,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total flags" value={total} />
        <StatCard label="High" value={sevCounts.high} className={`border ${SEV_BG.high}`} />
        <StatCard label="Medium" value={sevCounts.medium} className={`border ${SEV_BG.medium}`} />
        <StatCard label="Low" value={sevCounts.low} className={`border ${SEV_BG.low}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-sm font-semibold text-neutral-800">By category</div>
          <div className="text-xs text-neutral-500 mt-0.5 mb-3">
            Where the signal is concentrated.
          </div>
          <ResponsiveContainer width="100%" height={Math.max(220, categoryData.length * 28)}>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11 }}
                width={140}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {categoryData.map((d) => (
                  <Cell key={d.key} fill={d.count >= 20 ? '#6366f1' : d.count >= 5 ? '#818cf8' : '#cbd5e1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-sm font-semibold text-neutral-800">Top banks by flag count</div>
          <div className="text-xs text-neutral-500 mt-0.5 mb-3">
            Stacked by severity. Hover for detail.
          </div>
          {bankData.length === 0 ? (
            <div className="text-xs text-neutral-400 italic h-[220px] flex items-center justify-center">
              No bank-level flags.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, bankData.length * 24)}>
              <BarChart data={bankData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="ticker" tick={{ fontSize: 11 }} width={56} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                />
                <Bar dataKey="high" stackId="s" fill={SEV_COLOR.high} />
                <Bar dataKey="medium" stackId="s" fill={SEV_COLOR.medium} />
                <Bar dataKey="low" stackId="s" fill={SEV_COLOR.low} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
