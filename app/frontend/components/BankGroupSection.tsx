'use client';

import type { Anomaly } from '@/lib/types';
import { AnomalyCard } from './AnomalyCard';

interface Props {
  ticker: string;
  anomalies: Anomaly[];
}

export function BankGroupSection({ ticker, anomalies }: Props) {
  const sevCounts = { high: 0, medium: 0, low: 0 };
  for (const a of anomalies) sevCounts[a.severity]++;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-neutral-900">{ticker}</h2>
        <span className="text-xs text-neutral-400 font-mono">
          {anomalies.length} {anomalies.length === 1 ? 'flag' : 'flags'}
        </span>
        <div className="flex gap-1 text-xs">
          {sevCounts.high > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
              {sevCounts.high} high
            </span>
          )}
          {sevCounts.medium > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
              {sevCounts.medium} med
            </span>
          )}
          {sevCounts.low > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
              {sevCounts.low} low
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {anomalies.map((a, i) => (
          <AnomalyCard key={`${a.category}-${i}`} anomaly={a} />
        ))}
      </div>
    </section>
  );
}
