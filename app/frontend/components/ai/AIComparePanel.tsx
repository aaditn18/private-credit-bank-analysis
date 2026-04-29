'use client';

import { useMemo, useState } from 'react';
import type { AIBankBundle } from '@/lib/ai-types';
import {
  ConfidenceBadge,
  DEPLOYMENT_LABELS,
  EmptyAIState,
  EvidenceList,
  FactorBars,
  formatPercent,
  GOVERNANCE_LABELS,
  POSTURE_LABELS,
} from '@/components/ai/AIShared';

const MAX_SELECTED = 4;

export function AIComparePanel({ bundles }: { bundles: AIBankBundle[] }) {
  const [selected, setSelected] = useState<string[]>(bundles.slice(0, 3).map((bundle) => bundle.score.ticker));

  const selectedBundles = useMemo(
    () => selected.map((ticker) => bundles.find((bundle) => bundle.score.ticker === ticker)).filter((bundle): bundle is AIBankBundle => Boolean(bundle)),
    [bundles, selected],
  );

  function toggle(ticker: string) {
    setSelected((current) => {
      if (current.includes(ticker)) return current.filter((item) => item !== ticker);
      if (current.length >= MAX_SELECTED) return current;
      return [...current, ticker];
    });
  }

  if (bundles.length === 0) {
    return <EmptyAIState message="No generated AI comparison data is available." />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
        <div className="text-xs font-mono uppercase tracking-wider text-emerald-300">AI peer comparison</div>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Compare banks by factor evidence, 2x2 placement, disclosure timeline, confidence, and missing evidence.
          No composite AI ranking is calculated here.
        </p>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Select up to {MAX_SELECTED} banks</p>
          <p className="font-mono text-xs text-neutral-500">{selected.length} selected</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bundles.map((bundle) => {
            const isSelected = selected.includes(bundle.score.ticker);
            return (
              <button
                key={bundle.score.ticker}
                type="button"
                onClick={() => toggle(bundle.score.ticker)}
                disabled={!isSelected && selected.length >= MAX_SELECTED}
                className={`rounded-full border px-3 py-1.5 text-xs font-mono transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  isSelected
                    ? 'border-emerald-300 bg-emerald-300 text-black'
                    : 'border-white/10 text-neutral-400 hover:border-emerald-300/50 hover:text-emerald-100'
                }`}
              >
                {bundle.score.ticker}
              </button>
            );
          })}
        </div>
      </section>

      {selectedBundles.length < 2 ? (
        <EmptyAIState message="Select at least two banks to compare." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {selectedBundles.map((bundle) => {
            const latestPosture = bundle.timeline?.quarters.toReversed().find((quarter) => quarter.disclosure_posture !== 'absent');
            return (
              <article key={bundle.score.ticker} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{bundle.score.ticker}</h2>
                    <p className="text-xs text-neutral-500">{bundle.score.bank_name} · {bundle.score.peer_group}</p>
                  </div>
                  <ConfidenceBadge confidence={bundle.score.confidence} />
                </div>

                {bundle.quadrant && (
                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-neutral-500">Deployment</p>
                      <p className="mt-1 text-sm font-semibold text-white">{DEPLOYMENT_LABELS[bundle.quadrant.deployment_stage]}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-neutral-500">Governance</p>
                      <p className="mt-1 text-sm font-semibold text-white">{GOVERNANCE_LABELS[bundle.quadrant.governance_maturity]}</p>
                    </div>
                  </div>
                )}

                <div className="mb-4 rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500">Latest non-absent posture</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {latestPosture ? `${latestPosture.period}: ${POSTURE_LABELS[latestPosture.disclosure_posture]}` : 'No AI disclosure evidence'}
                  </p>
                </div>

                {bundle.bars ? (
                  <FactorBars factors={bundle.bars.factors} />
                ) : (
                  <EmptyAIState message="No factor bars are available for this bank." />
                )}

                <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="mb-2 text-xs font-semibold text-white">Referenced evidence</p>
                  <EvidenceList evidence={bundle.topEvidence.slice(0, 3)} />
                </div>

                {bundle.quadrant?.missing_evidence.length ? (
                  <p className="mt-3 text-[11px] leading-relaxed text-amber-200">
                    Missing evidence: {bundle.quadrant.missing_evidence.join('; ')}
                  </p>
                ) : null}

                <p className="mt-3 text-[11px] text-neutral-500">
                  Max factor percentile: {formatPercent(bundle.score.peer_percentile)}. This field supports schema compatibility and is not used as a composite rank.
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
