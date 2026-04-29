'use client';

import type {
  AnomalyCategoryKey,
  AnomalySentiment,
  AnomalySeverity,
} from '@/lib/types';
import { CATEGORY_META } from './CategorySection';

const SEVERITIES: AnomalySeverity[] = ['high', 'medium', 'low'];

const SENTIMENTS: AnomalySentiment[] = ['negative', 'positive', 'inconclusive'];

const SENT_ACTIVE: Record<AnomalySentiment, string> = {
  negative: 'bg-rose-500 text-white border-rose-500',
  positive: 'bg-emerald-500 text-white border-emerald-500',
  inconclusive: 'bg-neutral-400 text-white border-neutral-400',
};

const SENT_LABEL: Record<AnomalySentiment, string> = {
  negative: 'Negative',
  positive: 'Positive',
  inconclusive: 'Inconclusive',
};

const CATEGORIES: AnomalyCategoryKey[] = [
  'exposure',
  'credit_quality',
  'peer_deviation',
  'disclosure_nlp',
  'events_8k',
  'valuation_marks',
  'structural',
  'macro_divergence',
];

const SEV_ACTIVE: Record<AnomalySeverity, string> = {
  high: 'bg-rose-600 text-white border-rose-600',
  medium: 'bg-amber-500 text-white border-amber-500',
  low: 'bg-neutral-700 text-white border-neutral-700',
};

export type ViewMode = 'category' | 'bank';

interface Props {
  view: ViewMode;
  onView: (v: ViewMode) => void;
  selectedSeverities: Set<AnomalySeverity>;
  onToggleSeverity: (s: AnomalySeverity) => void;
  selectedCategories: Set<AnomalyCategoryKey>;
  onToggleCategory: (c: AnomalyCategoryKey) => void;
  selectedSentiments: Set<AnomalySentiment>;
  onToggleSentiment: (s: AnomalySentiment) => void;
  bankOptions: string[];
  selectedBank: string | null;
  onBank: (b: string | null) => void;
}

function Pill({
  active,
  activeClass,
  children,
  onClick,
}: {
  active: boolean;
  activeClass?: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const cls = active
    ? activeClass ?? 'bg-indigo-600 text-white border-indigo-600'
    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}

export function AnomalyFilters({
  view,
  onView,
  selectedSeverities,
  onToggleSeverity,
  selectedCategories,
  onToggleCategory,
  selectedSentiments,
  onToggleSentiment,
  bankOptions,
  selectedBank,
  onBank,
}: Props) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            View
          </div>
          <div className="flex gap-1 mt-1">
            <Pill active={view === 'category'} onClick={() => onView('category')}>
              By category
            </Pill>
            <Pill active={view === 'bank'} onClick={() => onView('bank')}>
              By bank
            </Pill>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 block">
            Bank
          </label>
          <select
            value={selectedBank ?? ''}
            onChange={(e) => onBank(e.target.value || null)}
            className="mt-1 text-xs border border-neutral-200 rounded px-2 py-1 bg-white"
          >
            <option value="">All banks</option>
            {bankOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Severity
        </div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {SEVERITIES.map((s) => (
            <Pill
              key={s}
              active={selectedSeverities.has(s)}
              activeClass={SEV_ACTIVE[s]}
              onClick={() => onToggleSeverity(s)}
            >
              {s[0].toUpperCase() + s.slice(1)}
            </Pill>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Sentiment
        </div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {SENTIMENTS.map((s) => (
            <Pill
              key={s}
              active={selectedSentiments.has(s)}
              activeClass={SENT_ACTIVE[s]}
              onClick={() => onToggleSentiment(s)}
            >
              {SENT_LABEL[s]}
            </Pill>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Category
        </div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {CATEGORIES.map((c) => (
            <Pill
              key={c}
              active={selectedCategories.has(c)}
              onClick={() => onToggleCategory(c)}
            >
              {CATEGORY_META[c].label}
            </Pill>
          ))}
        </div>
      </div>
    </div>
  );
}
