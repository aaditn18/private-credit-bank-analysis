'use client';

import { useMemo, useState } from 'react';
import type { AIBankBundle, AIEvidenceRecord, AIMethodology, AIQuadrantRecord } from '@/lib/ai-types';
import {
  ConfidenceBadge,
  DEPLOYMENT_LABELS,
  EmptyAIState,
  EvidenceList,
  FACTOR_DEFINITIONS,
  FactorBars,
  formatPercent,
  GOVERNANCE_LABELS,
  InfoTip,
  QuadrantMap,
} from '@/components/ai/AIShared';
import { getAIEvidenceByIds } from '@/lib/ai-data';

type PeerFilter = 'all' | string;

function strongestFactor(bundle: AIBankBundle) {
  return [...(bundle.bars?.factors ?? [])].sort((a, b) => (b.peer_percentile ?? 0) - (a.peer_percentile ?? 0))[0] ?? null;
}

function factorPercentile(bundle: AIBankBundle, factorId: string): number {
  return bundle.bars?.factors.find((factor) => factor.factor_id === factorId)?.peer_percentile ?? 0;
}

function weightedAverage(values: Array<[number, number]>): number {
  const totalWeight = values.reduce((total, [, weight]) => total + weight, 0);
  if (totalWeight === 0) return 0;
  return values.reduce((total, [value, weight]) => total + value * weight, 0) / totalWeight;
}

function quadrantStrength(bundle: AIBankBundle) {
  return {
    deployment: weightedAverage([
      [factorPercentile(bundle, 'strategic_implementation'), 0.6],
      [factorPercentile(bundle, 'growth_profitability'), 0.25],
      [factorPercentile(bundle, 'leadership_acumen'), 0.15],
    ]),
    governance: weightedAverage([
      [factorPercentile(bundle, 'board_governance'), 0.6],
      [factorPercentile(bundle, 'risk_management'), 0.25],
      [factorPercentile(bundle, 'compliance'), 0.15],
    ]),
    citations: bundle.quadrant?.evidence_ids.length ?? bundle.score.evidence_ids.length,
  };
}

function factorEvidenceCount(bundle: AIBankBundle): number {
  const ids = bundle.bars?.factors.flatMap((factor) => factor.evidence_ids) ?? bundle.score.evidence_ids;
  return new Set(ids).size;
}

export function AIRankingsPanel({
  bundles,
  quadrants,
}: {
  bundles: AIBankBundle[];
  quadrants: AIQuadrantRecord[];
  methodology: AIMethodology;
}) {
  const [peerFilter, setPeerFilter] = useState<PeerFilter>('all');
  const [activeTicker, setActiveTicker] = useState(bundles[0]?.score.ticker ?? '');
  const [focusedEvidence, setFocusedEvidence] = useState<AIEvidenceRecord[] | null>(null);

  const peerGroups = useMemo(
    () => ['all', ...Array.from(new Set(bundles.map((bundle) => bundle.score.peer_group))).sort()],
    [bundles],
  );

  const filtered = useMemo(
    () =>
      bundles
        .filter((bundle) => peerFilter === 'all' || bundle.score.peer_group === peerFilter)
        .sort((a, b) => (strongestFactor(b)?.peer_percentile ?? 0) - (strongestFactor(a)?.peer_percentile ?? 0)),
    [bundles, peerFilter],
  );

  const filteredQuadrants = useMemo(
    () => quadrants.filter((record) => peerFilter === 'all' || record.peer_group === peerFilter),
    [peerFilter, quadrants],
  );

  const strengthByTicker = useMemo(
    () => Object.fromEntries(filtered.map((bundle) => [bundle.score.ticker, quadrantStrength(bundle)])),
    [filtered],
  );

  const active = filtered.find((bundle) => bundle.score.ticker === activeTicker) ?? filtered[0] ?? null;
  const activeEvidence = focusedEvidence ?? active?.topEvidence ?? [];

  const rankingStats = useMemo(() => {
    const topFactorCounts = new Map<string, { name: string; count: number }>();
    filtered.forEach((bundle) => {
      const factor = strongestFactor(bundle);
      const key = factor?.factor_id ?? 'none';
      const current = topFactorCounts.get(key) ?? { name: factor?.factor_name ?? 'No factor evidence', count: 0 };
      topFactorCounts.set(key, { ...current, count: current.count + 1 });
    });

    const densityLeaders = [...filtered]
      .sort((a, b) => factorEvidenceCount(b) - factorEvidenceCount(a))
      .slice(0, 5)
      .map((bundle) => ({ ticker: bundle.score.ticker, count: factorEvidenceCount(bundle), bankName: bundle.score.bank_name }));

    const peerProfiles = Array.from(new Set(filtered.map((bundle) => bundle.score.peer_group))).sort().map((peer) => {
      const peerBundles = filtered.filter((bundle) => bundle.score.peer_group === peer);
      const peerQuadrants = filteredQuadrants.filter((record) => record.peer_group === peer);
      const denominator = Math.max(peerBundles.length, 1);
      return {
        peer,
        count: peerBundles.length,
        boardShare: (peerQuadrants.filter((record) => record.governance_maturity === 'board_level').length / denominator) * 100,
        productionShare: (peerQuadrants.filter((record) => record.deployment_stage === 'production_scaled').length / denominator) * 100,
      };
    });

    return {
      topFactorCounts: Array.from(topFactorCounts.values()).sort((a, b) => b.count - a.count),
      densityLeaders,
      peerProfiles,
      boardLevel: filteredQuadrants.filter((record) => record.governance_maturity === 'board_level').length,
      productionScaled: filteredQuadrants.filter((record) => record.deployment_stage === 'production_scaled').length,
      averageTopPercentile: filtered.length
        ? filtered.reduce((total, bundle) => total + (strongestFactor(bundle)?.peer_percentile ?? 0), 0) / filtered.length
        : 0,
    };
  }, [filtered, filteredQuadrants]);

  if (bundles.length === 0) {
    return <EmptyAIState message="No AI evidence data is available." />;
  }

  const leadingFactor = rankingStats.topFactorCounts[0];

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
        <div className="text-xs font-mono uppercase tracking-wider text-emerald-300">AI evidence overview</div>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Primary finding: {leadingFactor?.name ?? 'AI factor evidence'} is the most common leading factor in this view,
          but disclosed AI posture is spread across multiple pillars rather than one simple league table.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">
          Rows are sorted by strongest peer-relative factor percentile. High AI involvement is not automatically high AI risk.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Banks in view</p>
          <p className="mt-1 text-2xl font-semibold text-white">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Board-level governance</p>
          <p className="mt-1 text-2xl font-semibold text-white">{rankingStats.boardLevel}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Production scaled</p>
          <p className="mt-1 text-2xl font-semibold text-white">{rankingStats.productionScaled}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Avg strongest factor</p>
          <p className="mt-1 text-2xl font-semibold text-white">{formatPercent(rankingStats.averageTopPercentile)}</p>
          <p className="mt-1 text-[11px] text-neutral-500">Peer-relative percentile</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-white">Strongest Factor Mix</h2>
            <p className="text-xs text-neutral-500">Which evidence pillar most often leads each bank.</p>
          </div>
          <div className="space-y-3">
            {rankingStats.topFactorCounts.slice(0, 5).map((item) => {
              const width = filtered.length ? (item.count / filtered.length) * 100 : 0;
              return (
                <div key={item.name}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-neutral-200">{item.name}</span>
                    <span className="font-mono text-neutral-500">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-emerald-300" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-white">Peer-Group Shape</h2>
            <p className="text-xs text-neutral-500">Board and deployment classifications by peer lens.</p>
          </div>
          <div className="space-y-3">
            {rankingStats.peerProfiles.map((peer) => (
              <div key={peer.peer} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{peer.peer}</span>
                  <span className="font-mono text-neutral-500">{peer.count} banks</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="mb-1 flex justify-between text-[10px] text-neutral-500">
                      <span>Board level</span>
                      <span>{formatPercent(peer.boardShare)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div className="h-1.5 rounded-full bg-teal-300" style={{ width: `${peer.boardShare}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[10px] text-neutral-500">
                      <span>Production scaled</span>
                      <span>{formatPercent(peer.productionShare)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div className="h-1.5 rounded-full bg-amber-300" style={{ width: `${peer.productionShare}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-white">Evidence Density Leaders</h2>
            <p className="text-xs text-neutral-500">Banks with the most unique factor citations in this view.</p>
          </div>
          <div className="space-y-2">
            {rankingStats.densityLeaders.map((item, index) => (
              <button
                key={item.ticker}
                type="button"
                onClick={() => {
                  setActiveTicker(item.ticker);
                  setFocusedEvidence(null);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:border-emerald-300/40 hover:bg-emerald-300/5"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="font-mono text-[11px] text-neutral-500">#{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block font-mono text-sm font-semibold text-emerald-200">{item.ticker}</span>
                    <span className="block truncate text-[11px] text-neutral-500">{item.bankName}</span>
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[11px] text-neutral-300">
                  {item.count} citations
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]">
          <div className="shrink-0 border-b border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Peer-Relative AI Factor Posture</h2>
                <p className="text-xs text-neutral-500">Sorted by strongest individual factor percentile, not composite score.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {peerGroups.map((peer) => (
                  <button
                    key={peer}
                    type="button"
                    onClick={() => setPeerFilter(peer)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      peerFilter === peer
                        ? 'border-emerald-300 bg-emerald-300 text-black'
                        : 'border-white/10 text-neutral-400 hover:border-emerald-300/50 hover:text-emerald-100'
                    }`}
                  >
                    {peer === 'all' ? 'All peers' : peer}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="min-h-0 overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3 text-left">Bank</th>
                  <th className="px-4 py-3 text-left">Peer</th>
                  <th className="px-4 py-3 text-left">Strongest factor</th>
                  <th className="px-4 py-3 text-left">2x2 placement</th>
                  <th className="px-4 py-3 text-left">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bundle) => {
                  const factor = strongestFactor(bundle);
                  const isActive = bundle.score.ticker === active?.score.ticker;
                  return (
                    <tr
                      key={bundle.score.ticker}
                      onClick={() => {
                        setActiveTicker(bundle.score.ticker);
                        setFocusedEvidence(null);
                      }}
                      className={`cursor-pointer border-b border-white/5 transition last:border-0 ${
                        isActive ? 'bg-emerald-400/10' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-emerald-300">{bundle.score.ticker}</div>
                        <div className="flex max-w-[260px] items-center gap-2">
                          <div className="truncate text-xs text-neutral-400">{bundle.score.bank_name}</div>
                          <a
                            href={`/timeline/${bundle.score.ticker}`}
                            onClick={(event) => event.stopPropagation()}
                            className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-neutral-300 transition hover:border-emerald-300/50 hover:text-emerald-100"
                          >
                            Profile
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-300">{bundle.score.peer_group}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-100">
                          <span>{factor?.factor_name ?? 'No factor evidence'}</span>
                          {factor && <InfoTip label={factor.factor_name} description={FACTOR_DEFINITIONS[factor.factor_id]} />}
                        </div>
                        <div className="text-[11px] text-neutral-500">Peer percentile {formatPercent(factor?.peer_percentile)}</div>
                        <div className="mt-1 h-1.5 w-32 rounded-full bg-white/10">
                          <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
                            style={{ width: `${Math.max(factor?.peer_percentile ? 4 : 0, factor?.peer_percentile ?? 0)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-neutral-100">
                          {bundle.quadrant ? DEPLOYMENT_LABELS[bundle.quadrant.deployment_stage] : 'Missing'}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {bundle.quadrant ? GOVERNANCE_LABELS[bundle.quadrant.governance_maturity] : 'No quadrant output'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ConfidenceBadge confidence={bundle.score.confidence} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="min-w-0 space-y-5">
          {active && (
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">{active.score.ticker} factor bars</h2>
                  <p className="text-xs text-neutral-500">{active.score.bank_name}</p>
                </div>
                <ConfidenceBadge confidence={active.score.confidence} />
              </div>
              {active.bars ? (
                <FactorBars
                  factors={active.bars.factors}
                  onEvidenceClick={(ids) => {
                    const evidence = getAIEvidenceByIds(ids);
                    setFocusedEvidence(evidence.length > 0 ? evidence : null);
                  }}
                />
              ) : (
                <EmptyAIState message="No factor-bar record exists for this bank." />
              )}
              {active.quadrant && (
                <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-xs font-semibold text-white">2x2 rationale</p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-400">{active.quadrant.overall_justification}</p>
                  {active.quadrant.missing_evidence.length > 0 && (
                    <p className="mt-2 text-[11px] text-amber-200">
                      Missing evidence: {active.quadrant.missing_evidence.join('; ')}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="mb-3 text-base font-semibold text-white">Cited Evidence</h2>
            <EvidenceList evidence={activeEvidence} />
          </section>
        </aside>
      </div>

      <QuadrantMap
        quadrants={filteredQuadrants}
        strengthByTicker={strengthByTicker}
        activeTicker={active?.score.ticker}
        onSelectTicker={(ticker) => {
          setActiveTicker(ticker);
          setFocusedEvidence(null);
        }}
      />
    </div>
  );
}
