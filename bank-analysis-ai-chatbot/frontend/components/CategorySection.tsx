'use client';

import type { Anomaly, AnomalyCategoryKey } from '@/lib/types';
import { AnomalyCard } from './AnomalyCard';

interface CategoryMeta {
  label: string;
  blurb: string;
}

export const CATEGORY_META: Record<AnomalyCategoryKey, CategoryMeta> = {
  exposure: {
    label: 'Exposure & Concentration',
    blurb:
      'Magnitude shifts in theme-related balance-sheet exposure or concentration language.',
  },
  credit_quality: {
    label: 'Credit Quality',
    blurb:
      'Directional deterioration signals: NBFI growth ahead of total book, distress vocabulary, charge-off / non-accrual mentions.',
  },
  peer_deviation: {
    label: 'Peer Deviation',
    blurb:
      'Banks sitting in the top or bottom 5% of their peer group on theme-relevant metrics.',
  },
  disclosure_nlp: {
    label: 'Disclosure / Language NLP',
    blurb:
      'Year-over-year sentiment drops and uncertainty-density spikes in theme-tagged narrative.',
  },
  events_8k: {
    label: 'Event-Driven (8-K)',
    blurb:
      'Item-coded 8-K events filed by banks whose disclosure also touches this theme.',
  },
  valuation_marks: {
    label: 'Valuation / Marks',
    blurb:
      'Fair-value, Level 3, impairment, or markdown language in theme-tagged chunks.',
  },
  structural: {
    label: 'Structural',
    blurb:
      'Loan structure language: covenant tone, leverage multiples, tenor mismatch, reserve composition.',
  },
  macro_divergence: {
    label: 'Macro Divergence',
    blurb:
      'Bank-level theme metric vs. macro reference series (HY OAS, BDC index, BTC, AI equity basket).',
  },
};

interface Props {
  category: AnomalyCategoryKey;
  anomalies: Anomaly[];
}

export function CategorySection({ category, anomalies }: Props) {
  const meta = CATEGORY_META[category];
  return (
    <section className="space-y-3">
      <div>
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold text-neutral-900">
            {meta.label}
          </h2>
          <span className="text-xs text-neutral-400 font-mono">
            {anomalies.length} {anomalies.length === 1 ? 'flag' : 'flags'}
          </span>
        </div>
        <p className="text-xs text-neutral-500 mt-0.5">{meta.blurb}</p>
      </div>

      {anomalies.length === 0 ? (
        <div className="text-xs text-neutral-400 italic border border-dashed border-neutral-200 rounded-lg p-4">
          No anomalies flagged for this category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {anomalies.map((a, i) => (
            <AnomalyCard key={`${a.bank_ticker}-${i}`} anomaly={a} />
          ))}
        </div>
      )}
    </section>
  );
}
