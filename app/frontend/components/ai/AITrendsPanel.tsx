'use client';

import { useMemo, useState } from 'react';
import type { AIBankBundle, AIEvidenceRecord } from '@/lib/ai-types';
import { ConfidenceBadge, EmptyAIState, EvidenceList, POSTURE_LABELS } from '@/components/ai/AIShared';

const POSTURE_STYLE = {
  absent: 'border-neutral-700 bg-neutral-900 text-neutral-500',
  generic: 'border-slate-400/30 bg-slate-400/10 text-slate-200',
  emerging: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  specific: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  mature: 'border-purple-400/30 bg-purple-400/10 text-purple-200',
} as const;

export function AITrendsPanel({ bundles }: { bundles: AIBankBundle[] }) {
  const [activeTicker, setActiveTicker] = useState(bundles[0]?.score.ticker ?? '');
  const [activePeriod, setActivePeriod] = useState<string | null>(null);

  const active = bundles.find((bundle) => bundle.score.ticker === activeTicker) ?? bundles[0] ?? null;
  const quarters = active?.timeline?.quarters ?? [];
  const selectedQuarter =
    quarters.find((quarter) => quarter.period === activePeriod) ??
    quarters.toReversed().find((quarter) => quarter.disclosure_posture !== 'absent') ??
    quarters[0] ??
    null;

  const evidence = useMemo<AIEvidenceRecord[]>(() => {
    if (!active || !selectedQuarter) return [];
    return active.topEvidence.filter((item) => selectedQuarter.evidence_ids.includes(item.evidence_id));
  }, [active, selectedQuarter]);

  const postureCounts = useMemo(() => {
    const counts = { absent: 0, generic: 0, emerging: 0, specific: 0, mature: 0 };
    for (const bundle of bundles) {
      for (const quarter of bundle.timeline?.quarters ?? []) counts[quarter.disclosure_posture] += 1;
    }
    return counts;
  }, [bundles]);

  if (bundles.length === 0) {
    return <EmptyAIState message="No generated AI timeline data is available." />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
        <div className="text-xs font-mono uppercase tracking-wider text-emerald-300">Eight-quarter AI disclosure timeline</div>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Timeline posture is inferred from cited Stage 1 evidence. Absent quarters are retained explicitly
          so missing disclosure is visible instead of silently omitted.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {Object.entries(postureCounts).map(([posture, count]) => (
          <div key={posture} className={`rounded-xl border p-4 ${POSTURE_STYLE[posture as keyof typeof POSTURE_STYLE]}`}>
            <p className="text-[11px] uppercase tracking-wide opacity-80">{POSTURE_LABELS[posture as keyof typeof POSTURE_LABELS]}</p>
            <p className="mt-1 text-2xl font-semibold">{count}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="mb-3 px-1 text-xs uppercase tracking-wide text-neutral-500">Banks</p>
          <div className="max-h-[560px] space-y-1 overflow-y-auto pr-1">
            {bundles.map((bundle) => (
              <button
                key={bundle.score.ticker}
                type="button"
                onClick={() => {
                  setActiveTicker(bundle.score.ticker);
                  setActivePeriod(null);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  active?.score.ticker === bundle.score.ticker
                    ? 'bg-emerald-300 text-black'
                    : 'text-neutral-300 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <span className="font-mono font-semibold">{bundle.score.ticker}</span>
                <span className="text-[10px] opacity-75">{bundle.score.peer_group}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">{active?.score.bank_name ?? 'Unknown bank'}</h2>
                <p className="text-xs text-neutral-500">Click a quarter for rationale, confidence, events, and evidence.</p>
              </div>
              {active && <ConfidenceBadge confidence={active.score.confidence} />}
            </div>

            <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
              {quarters.map((quarter) => {
                const isActive = selectedQuarter?.period === quarter.period;
                return (
                  <button
                    key={quarter.period}
                    type="button"
                    onClick={() => setActivePeriod(quarter.period)}
                    className={`min-h-28 rounded-lg border p-3 text-left transition ${POSTURE_STYLE[quarter.disclosure_posture]} ${
                      isActive ? 'ring-2 ring-emerald-200' : 'hover:border-emerald-300/40'
                    }`}
                  >
                    <p className="font-mono text-xs font-semibold">{quarter.period}</p>
                    <p className="mt-2 text-sm font-semibold">{POSTURE_LABELS[quarter.disclosure_posture]}</p>
                    <p className="mt-2 text-[10px] opacity-75">{quarter.evidence_ids.length} citations</p>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedQuarter && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
              <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">{selectedQuarter.period} rationale</h3>
                  <ConfidenceBadge confidence={selectedQuarter.confidence} />
                </div>
                <p className="text-sm leading-relaxed text-neutral-300">{selectedQuarter.posture_reason}</p>
                {selectedQuarter.regulatory_events.length > 0 && (
                  <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
                    <p className="text-xs font-semibold text-amber-200">Regulatory events near quarter</p>
                    <ul className="mt-2 space-y-1 text-xs text-neutral-300">
                      {selectedQuarter.regulatory_events.map((event) => (
                        <li key={event}>· {event}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
              <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="mb-3 text-sm font-semibold text-white">Quarter Evidence</h3>
                <EvidenceList evidence={evidence} />
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
