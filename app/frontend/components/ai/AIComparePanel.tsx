'use client';

import { useMemo, useState } from 'react';
import type { AIBankBundle } from '@/lib/ai-types';
import {
  ConfidenceBadge,
  DEPLOYMENT_LABELS,
  EmptyAIState,
  EvidenceList,
  FACTOR_DEFINITIONS,
  FACTOR_ORDER,
  FactorBars,
  formatPercent,
  GOVERNANCE_LABELS,
  InfoTip,
  POSTURE_LABELS,
} from '@/components/ai/AIShared';

const MAX_SELECTED = 4;

function factorPercentile(bundle: AIBankBundle, factorId: string): number {
  return bundle.bars?.factors.find((factor) => factor.factor_id === factorId)?.peer_percentile ?? 0;
}

function weightedAverage(values: Array<[number, number]>): number {
  const totalWeight = values.reduce((total, [, weight]) => total + weight, 0);
  if (totalWeight === 0) return 0;
  return values.reduce((total, [value, weight]) => total + value * weight, 0) / totalWeight;
}

function deploymentStrength(bundle: AIBankBundle): number {
  return weightedAverage([
    [factorPercentile(bundle, 'strategic_implementation'), 0.6],
    [factorPercentile(bundle, 'growth_profitability'), 0.25],
    [factorPercentile(bundle, 'leadership_acumen'), 0.15],
  ]);
}

function governanceStrength(bundle: AIBankBundle): number {
  return weightedAverage([
    [factorPercentile(bundle, 'board_governance'), 0.6],
    [factorPercentile(bundle, 'risk_management'), 0.25],
    [factorPercentile(bundle, 'compliance'), 0.15],
  ]);
}

function evidenceCount(bundle: AIBankBundle): number {
  const ids = bundle.bars?.factors.flatMap((factor) => factor.evidence_ids) ?? bundle.score.evidence_ids;
  return new Set(ids).size;
}

function strongestFactor(bundle: AIBankBundle) {
  return [...(bundle.bars?.factors ?? [])].sort((a, b) => (b.peer_percentile ?? 0) - (a.peer_percentile ?? 0))[0] ?? null;
}

function latestNonAbsentPosture(bundle: AIBankBundle) {
  return bundle.timeline?.quarters.slice().reverse().find((quarter) => quarter.disclosure_posture !== 'absent') ?? null;
}

function heatmapCellClass(value: number): string {
  if (value >= 75) return 'border-emerald-300/40 bg-emerald-300/25 text-emerald-50';
  if (value >= 50) return 'border-teal-300/30 bg-teal-300/15 text-teal-50';
  if (value > 0) return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  return 'border-white/10 bg-white/[0.03] text-neutral-500';
}

export function AIComparePanel({ bundles }: { bundles: AIBankBundle[] }) {
  const [selected, setSelected] = useState<string[]>(bundles.slice(0, 3).map((bundle) => bundle.score.ticker));

  const selectedBundles = useMemo(
    () => selected.map((ticker) => bundles.find((bundle) => bundle.score.ticker === ticker)).filter((bundle): bundle is AIBankBundle => Boolean(bundle)),
    [bundles, selected],
  );

  const compareStats = useMemo(() => {
    const byDeployment = [...selectedBundles].sort((a, b) => deploymentStrength(b) - deploymentStrength(a))[0] ?? null;
    const byGovernance = [...selectedBundles].sort((a, b) => governanceStrength(b) - governanceStrength(a))[0] ?? null;
    const byEvidence = [...selectedBundles].sort((a, b) => evidenceCount(b) - evidenceCount(a))[0] ?? null;
    const widestGap = [...selectedBundles]
      .map((bundle) => ({
        bundle,
        gap: Math.abs(deploymentStrength(bundle) - governanceStrength(bundle)),
      }))
      .sort((a, b) => b.gap - a.gap)[0] ?? null;

    return { byDeployment, byGovernance, byEvidence, widestGap };
  }, [selectedBundles]);

  function toggle(ticker: string) {
    setSelected((current) => {
      if (current.includes(ticker)) return current.filter((item) => item !== ticker);
      if (current.length >= MAX_SELECTED) return current;
      return [...current, ticker];
    });
  }

  if (bundles.length === 0) {
    return <EmptyAIState message="No AI comparison data is available." />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
        <div className="text-xs font-mono uppercase tracking-wider text-emerald-300">AI peer comparison</div>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Primary finding: in the current selection, {compareStats.widestGap?.bundle.score.ticker ?? 'one bank'} has the largest
          deployment-governance spread and {compareStats.byEvidence?.score.ticker ?? 'one bank'} has the deepest citation base.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">
          Use this tab to compare factor evidence, 2x2 placement, disclosure posture, confidence, and cited support side by side.
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
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">Deployment leader</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-white">{compareStats.byDeployment?.score.ticker ?? '--'}</p>
              <p className="text-[11px] text-neutral-500">{formatPercent(compareStats.byDeployment ? deploymentStrength(compareStats.byDeployment) : null)} strength</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">Governance leader</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-white">{compareStats.byGovernance?.score.ticker ?? '--'}</p>
              <p className="text-[11px] text-neutral-500">{formatPercent(compareStats.byGovernance ? governanceStrength(compareStats.byGovernance) : null)} strength</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">Most cited</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-white">{compareStats.byEvidence?.score.ticker ?? '--'}</p>
              <p className="text-[11px] text-neutral-500">{compareStats.byEvidence ? evidenceCount(compareStats.byEvidence) : 0} unique citations</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">Largest deployment-governance gap</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-white">{compareStats.widestGap?.bundle.score.ticker ?? '--'}</p>
              <p className="text-[11px] text-neutral-500">{formatPercent(compareStats.widestGap?.gap ?? null)} spread</p>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-white">Selected Bank Matrix</h2>
                <p className="text-xs text-neutral-500">A compact side-by-side read on posture, placement, and citation support.</p>
              </div>
              <div className="space-y-3">
                {selectedBundles.map((bundle) => {
                  const latestPosture = latestNonAbsentPosture(bundle);
                  const strongest = strongestFactor(bundle);
                  return (
                    <div key={bundle.score.ticker} className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-sm font-semibold text-emerald-200">{bundle.score.ticker}</p>
                          <p className="text-[11px] text-neutral-500">{bundle.score.peer_group}</p>
                        </div>
                        <ConfidenceBadge confidence={bundle.score.confidence} />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="mb-1 flex justify-between text-[10px] text-neutral-500">
                            <span>Deployment</span>
                            <span>{formatPercent(deploymentStrength(bundle))}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10">
                            <div className="h-2 rounded-full bg-emerald-300" style={{ width: `${deploymentStrength(bundle)}%` }} />
                          </div>
                          <p className="mt-1 text-[11px] text-neutral-300">
                            {bundle.quadrant ? DEPLOYMENT_LABELS[bundle.quadrant.deployment_stage] : 'No quadrant output'}
                          </p>
                        </div>
                        <div>
                          <div className="mb-1 flex justify-between text-[10px] text-neutral-500">
                            <span>Governance</span>
                            <span>{formatPercent(governanceStrength(bundle))}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10">
                            <div className="h-2 rounded-full bg-teal-300" style={{ width: `${governanceStrength(bundle)}%` }} />
                          </div>
                          <p className="mt-1 text-[11px] text-neutral-300">
                            {bundle.quadrant ? GOVERNANCE_LABELS[bundle.quadrant.governance_maturity] : 'No quadrant output'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-[11px] text-neutral-400 sm:grid-cols-3">
                        <span>Posture: {latestPosture ? `${latestPosture.period} ${POSTURE_LABELS[latestPosture.disclosure_posture]}` : 'No disclosure evidence'}</span>
                        <span>Strongest: {strongest?.factor_name ?? 'No factor evidence'}</span>
                        <span>Citations: {evidenceCount(bundle)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-white">Factor Heatmap</h2>
                <p className="text-xs text-neutral-500">Peer percentiles by factor. Dark cells mean limited or no cited evidence.</p>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[520px]">
                  <div
                    className="grid gap-1 text-[10px]"
                    style={{ gridTemplateColumns: `minmax(170px, 1.35fr) repeat(${selectedBundles.length}, minmax(72px, 1fr))` }}
                  >
                    <div />
                    {selectedBundles.map((bundle) => (
                      <div key={bundle.score.ticker} className="rounded-md bg-white/[0.03] px-2 py-2 text-center font-mono text-xs font-semibold text-emerald-200">
                        {bundle.score.ticker}
                      </div>
                    ))}
                    {FACTOR_ORDER.map((factorId) => {
                      const factorName = selectedBundles[0]?.bars?.factors.find((factor) => factor.factor_id === factorId)?.factor_name ?? factorId;
                      return (
                        <div key={factorId} className="contents">
                          <div className="flex min-w-0 items-center gap-1.5 rounded-md bg-white/[0.03] px-2 py-2 text-neutral-300">
                            <span className="truncate">{factorName}</span>
                            <InfoTip label={factorName} description={FACTOR_DEFINITIONS[factorId]} />
                          </div>
                          {selectedBundles.map((bundle) => {
                            const value = factorPercentile(bundle, factorId);
                            return (
                              <div
                                key={`${factorId}-${bundle.score.ticker}`}
                                className={`rounded-md border px-2 py-2 text-center font-mono text-xs ${heatmapCellClass(value)}`}
                              >
                                {formatPercent(value)}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            {selectedBundles.map((bundle) => {
              const latestPosture = latestNonAbsentPosture(bundle);
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
                  Strongest peer-relative factor percentile: {formatPercent(bundle.score.peer_percentile)}.
                </p>
              </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
