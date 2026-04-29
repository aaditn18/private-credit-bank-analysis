'use client';

import { useEffect, useMemo, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';
import type {
  AnomaliesResponse,
  Anomaly,
  AnomalyCategoryKey,
  AnomalySentiment,
  AnomalySeverity,
} from '@/lib/types';
import { CategorySection } from '@/components/CategorySection';
import { BankGroupSection } from '@/components/BankGroupSection';
import { AnomalySummary } from '@/components/AnomalySummary';
import { AnomalyFilters, type ViewMode } from '@/components/AnomalyFilters';

export const VALID_SLUGS = ['private-credit', 'ai', 'digital-assets'] as const;
export type ThemeSlug = (typeof VALID_SLUGS)[number];

const CATEGORY_ORDER: AnomalyCategoryKey[] = [
  'exposure',
  'credit_quality',
  'peer_deviation',
  'disclosure_nlp',
  'events_8k',
  'valuation_marks',
  'structural',
  'macro_divergence',
];

const ALL_SEVERITIES: AnomalySeverity[] = ['high', 'medium', 'low'];

const ALL_SENTIMENTS: AnomalySentiment[] = ['negative', 'positive', 'inconclusive'];

const DEFAULT_CATEGORIES: AnomalyCategoryKey[] = ['exposure', 'credit_quality'];

export function AnomaliesPanel({ slug }: { slug: ThemeSlug }) {
  const router = useRouter();

  const [data, setData] = useState<AnomaliesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<ViewMode>('category');
  const [sevFilter, setSevFilter] = useState<Set<AnomalySeverity>>(
    () => new Set(ALL_SEVERITIES),
  );
  const [catFilter, setCatFilter] = useState<Set<AnomalyCategoryKey>>(
    () => new Set(DEFAULT_CATEGORIES),
  );
  const [sentFilter, setSentFilter] = useState<Set<AnomalySentiment>>(
    () => new Set(ALL_SENTIMENTS),
  );
  const [bank, setBank] = useState<string | null>(null);

  useEffect(() => {
    if (!VALID_SLUGS.includes(slug)) {
      notFound();
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/backend/anomalies/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as AnomaliesResponse;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const allAnomalies: Anomaly[] = useMemo(() => {
    if (!data) return [];
    return CATEGORY_ORDER.flatMap((c) => data.categories[c] ?? []);
  }, [data]);

  const bankOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of allAnomalies) {
      if (a.bank_ticker && a.bank_ticker !== '-') set.add(a.bank_ticker);
    }
    return Array.from(set).sort();
  }, [allAnomalies]);

  const filtered = useMemo(() => {
    return allAnomalies.filter((a) => {
      if (!sevFilter.has(a.severity)) return false;
      if (!catFilter.has(a.category)) return false;
      if (!sentFilter.has(a.sentiment)) return false;
      if (bank && a.bank_ticker !== bank) return false;
      return true;
    });
  }, [allAnomalies, sevFilter, catFilter, sentFilter, bank]);

  const filteredCounts = useMemo(() => {
    const out: Record<AnomalyCategoryKey, number> = {
      exposure: 0,
      credit_quality: 0,
      peer_deviation: 0,
      disclosure_nlp: 0,
      events_8k: 0,
      valuation_marks: 0,
      structural: 0,
      macro_divergence: 0,
    };
    for (const a of filtered) out[a.category]++;
    return out;
  }, [filtered]);

  const filteredByCategory = useMemo(() => {
    const out: Record<AnomalyCategoryKey, Anomaly[]> = {
      exposure: [],
      credit_quality: [],
      peer_deviation: [],
      disclosure_nlp: [],
      events_8k: [],
      valuation_marks: [],
      structural: [],
      macro_divergence: [],
    };
    for (const a of filtered) out[a.category].push(a);
    return out;
  }, [filtered]);

  const filteredByBank = useMemo(() => {
    const out: Record<string, Anomaly[]> = {};
    for (const a of filtered) {
      if (!a.bank_ticker || a.bank_ticker === '-') continue;
      (out[a.bank_ticker] ??= []).push(a);
    }
    return Object.entries(out).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  if (!VALID_SLUGS.includes(slug)) return null;

  const toggleSev = (s: AnomalySeverity) => {
    setSevFilter((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next.size === 0 ? new Set(ALL_SEVERITIES) : next;
    });
  };
  const toggleCat = (c: AnomalyCategoryKey) => {
    setCatFilter((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next.size === 0 ? new Set(CATEGORY_ORDER) : next;
    });
  };
  const toggleSent = (s: AnomalySentiment) => {
    setSentFilter((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next.size === 0 ? new Set(ALL_SENTIMENTS) : next;
    });
  };

  // The sector hub layout (app/[sector]/layout.tsx) renders the section
  // header + sub-tab nav + sector switcher, so this panel just renders the
  // anomaly content.
  void router; // silence unused-var lint until we wire deep-links

  return (
    <div className="space-y-6">
      {data?.quarter && (
        <div className="text-xs text-neutral-500 font-mono">
          Latest quarter {data.quarter} · {data.total} total flags
        </div>
      )}

      {loading && (
        <div className="text-sm text-neutral-500 py-8 text-center">
          Loading anomalies…
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-600 border border-rose-200 bg-rose-50 rounded p-4">
          Failed to load anomalies: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <AnomalySummary
            anomalies={filtered}
            total={filtered.length}
            counts={filteredCounts}
          />

          <AnomalyFilters
            view={view}
            onView={setView}
            selectedSeverities={sevFilter}
            onToggleSeverity={toggleSev}
            selectedCategories={catFilter}
            onToggleCategory={toggleCat}
            selectedSentiments={sentFilter}
            onToggleSentiment={toggleSent}
            bankOptions={bankOptions}
            selectedBank={bank}
            onBank={setBank}
          />

          <div className="flex items-baseline justify-between">
            <div className="text-xs text-neutral-500">
              Showing {filtered.length} of {allAnomalies.length} flags
            </div>
            {(sevFilter.size < ALL_SEVERITIES.length ||
              catFilter.size < CATEGORY_ORDER.length ||
              sentFilter.size < ALL_SENTIMENTS.length ||
              bank) && (
              <button
                type="button"
                onClick={() => {
                  setSevFilter(new Set(ALL_SEVERITIES));
                  setCatFilter(new Set(CATEGORY_ORDER));
                  setSentFilter(new Set(ALL_SENTIMENTS));
                  setBank(null);
                }}
                className="text-xs text-indigo-600 hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center text-sm text-neutral-400 italic border border-dashed border-neutral-200 rounded-lg p-12">
              No anomalies match the current filters.
            </div>
          ) : view === 'category' ? (
            <div className="space-y-8">
              {CATEGORY_ORDER.filter((c) => catFilter.has(c)).map((cat) => (
                <CategorySection
                  key={cat}
                  category={cat}
                  anomalies={filteredByCategory[cat] ?? []}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {filteredByBank.map(([ticker, list]) => (
                <BankGroupSection key={ticker} ticker={ticker} anomalies={list} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
