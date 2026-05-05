'use client';

import { useMemo, useState } from 'react';
import type { AIBankBundle, AIEvidenceRecord, AIFactorId } from '@/lib/ai-types';
import {
  ConfidenceBadge,
  EmptyAIState,
  EvidenceList,
  InfoTip,
  POSTURE_DEFINITIONS,
  POSTURE_LABELS,
} from '@/components/ai/AIShared';
import { getAIEvidenceByIds } from '@/lib/ai-data';

const POSTURE_STYLE = {
  absent: 'border-neutral-700 bg-neutral-900 text-neutral-500',
  generic: 'border-slate-400/30 bg-slate-400/10 text-slate-200',
  emerging: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  specific: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  mature: 'border-purple-400/30 bg-purple-400/10 text-purple-200',
} as const;

const POSTURE_BAR_STYLE = {
  absent: 'bg-neutral-700',
  generic: 'bg-slate-400',
  emerging: 'bg-sky-400',
  specific: 'bg-emerald-400',
  mature: 'bg-purple-400',
} as const;

const FACTOR_SHORT_LABELS = {
  board_governance: 'Board governance',
  strategic_implementation: 'Deployment',
  risk_management: 'Risk controls',
  leadership_acumen: 'Leadership',
  growth_profitability: 'Growth / efficiency',
  compliance: 'Compliance',
  strategic_risk: 'Strategic risk',
} as const;

function formatShare(numerator: number, denominator: number): string {
  if (denominator === 0) return '0%';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function percentValue(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function AITrendsPanel({ bundles }: { bundles: AIBankBundle[] }) {
  const [activeTicker, setActiveTicker] = useState(bundles[0]?.score.ticker ?? '');
  const [activePeriod, setActivePeriod] = useState<string | null>(null);
  const [showAbsentInPosture, setShowAbsentInPosture] = useState(true);

  const active = bundles.find((bundle) => bundle.score.ticker === activeTicker) ?? bundles[0] ?? null;
  const quarters = active?.timeline?.quarters ?? [];
  const selectedQuarter =
    quarters.find((quarter) => quarter.period === activePeriod) ??
    quarters.slice().reverse().find((quarter) => quarter.disclosure_posture !== 'absent') ??
    quarters[0] ??
    null;

  const evidence = useMemo<AIEvidenceRecord[]>(() => {
    if (!selectedQuarter) return [];
    return getAIEvidenceByIds(selectedQuarter.evidence_ids);
  }, [selectedQuarter]);
  const selectedQuarterCitationCount = evidence.length;

  const postureCounts = useMemo(() => {
    const counts = { absent: 0, generic: 0, emerging: 0, specific: 0, mature: 0 };
    for (const bundle of bundles) {
      for (const quarter of bundle.timeline?.quarters ?? []) counts[quarter.disclosure_posture] += 1;
    }
    return counts;
  }, [bundles]);

  const findings = useMemo(() => {
    const factorCitationCounts: Record<AIFactorId, number> = {
      board_governance: 0,
      strategic_implementation: 0,
      risk_management: 0,
      leadership_acumen: 0,
      growth_profitability: 0,
      compliance: 0,
      strategic_risk: 0,
    };
    let totalFactorCitations = 0;
    let boardLevelBanks = 0;
    let productionScaledBanks = 0;
    let boardLevelExperimentingBanks = 0;
    let banksWithSpecificOrMatureDisclosure = 0;
    let totalQuarters = 0;
    const periodCounts = new Map<string, { absent: number; generic: number; emerging: number; specific: number; mature: number }>();
    const peerGroups = new Map<
      string,
      { banks: number; production: number; board: number; specificBanks: number; citations: number; strongestTotal: number }
    >();
    const citationLeaders: Array<{ ticker: string; peerGroup: string; citations: number; strongestFactor: string }> = [];
    const anomalyCounts = {
      strategicRisk: 0,
      governanceGap: 0,
      genericDisclosure: 0,
      lowConfidence: 0,
    };
    const quadrantCounts = {
      productionBoard: 0,
      experimentingBoard: 0,
      productionOperational: 0,
      experimentingOperational: 0,
    };

    for (const bundle of bundles) {
      const peerGroup = bundle.score.peer_group;
      if (!peerGroups.has(peerGroup)) {
        peerGroups.set(peerGroup, { banks: 0, production: 0, board: 0, specificBanks: 0, citations: 0, strongestTotal: 0 });
      }
      const peer = peerGroups.get(peerGroup)!;
      peer.banks += 1;

      let bankFactorCitationCount = 0;
      for (const factor of bundle.bars?.factors ?? []) {
        factorCitationCounts[factor.factor_id] += factor.evidence_ids.length;
        totalFactorCitations += factor.evidence_ids.length;
        bankFactorCitationCount += factor.evidence_ids.length;
      }
      peer.citations += bankFactorCitationCount;

      const strongestFactor = [...(bundle.bars?.factors ?? [])].sort((a, b) => (b.peer_percentile ?? 0) - (a.peer_percentile ?? 0))[0] ?? null;
      peer.strongestTotal += strongestFactor?.peer_percentile ?? 0;
      citationLeaders.push({
        ticker: bundle.score.ticker,
        peerGroup,
        citations: bankFactorCitationCount,
        strongestFactor: strongestFactor?.factor_name ?? 'No factor evidence',
      });

      if (bundle.quadrant?.governance_maturity === 'board_level') {
        boardLevelBanks += 1;
        peer.board += 1;
      }
      if (bundle.quadrant?.deployment_stage === 'production_scaled') {
        productionScaledBanks += 1;
        peer.production += 1;
      }
      if (
        bundle.quadrant?.governance_maturity === 'board_level' &&
        bundle.quadrant.deployment_stage === 'experimenting_piloting'
      ) {
        boardLevelExperimentingBanks += 1;
      }
      if (bundle.quadrant?.deployment_stage === 'production_scaled' && bundle.quadrant.governance_maturity === 'board_level') {
        quadrantCounts.productionBoard += 1;
      }
      if (bundle.quadrant?.deployment_stage === 'experimenting_piloting' && bundle.quadrant.governance_maturity === 'board_level') {
        quadrantCounts.experimentingBoard += 1;
      }
      if (bundle.quadrant?.deployment_stage === 'production_scaled' && bundle.quadrant.governance_maturity === 'operational_ownership_only') {
        quadrantCounts.productionOperational += 1;
      }
      if (bundle.quadrant?.deployment_stage === 'experimenting_piloting' && bundle.quadrant.governance_maturity === 'operational_ownership_only') {
        quadrantCounts.experimentingOperational += 1;
      }

      const quartersForBank = bundle.timeline?.quarters ?? [];
      totalQuarters += quartersForBank.length;
      for (const quarter of quartersForBank) {
        if (!periodCounts.has(quarter.period)) {
          periodCounts.set(quarter.period, { absent: 0, generic: 0, emerging: 0, specific: 0, mature: 0 });
        }
        periodCounts.get(quarter.period)![quarter.disclosure_posture] += 1;
      }
      if (quartersForBank.some((quarter) => quarter.disclosure_posture === 'specific' || quarter.disclosure_posture === 'mature')) {
        banksWithSpecificOrMatureDisclosure += 1;
        peer.specificBanks += 1;
      }

      const strategicRisk = bundle.bars?.factors.find((factor) => factor.factor_id === 'strategic_risk');
      const governance = bundle.bars?.factors.find((factor) => factor.factor_id === 'board_governance');
      if ((strategicRisk?.peer_percentile ?? 0) >= 75 && (strategicRisk?.evidence_ids.length ?? 0) > 0) {
        anomalyCounts.strategicRisk += 1;
      }
      if (bundle.score.confidence === 'low' || bundle.quadrant?.confidence === 'low') {
        anomalyCounts.lowConfidence += 1;
      }
      if (
        bundle.quadrant &&
        bundle.quadrant.deployment_stage !== 'insufficient_evidence' &&
        bundle.quadrant.governance_maturity === 'operational_ownership_only' &&
        (governance?.peer_percentile ?? 0) < 50
      ) {
        anomalyCounts.governanceGap += 1;
      }
      if (quartersForBank.some((quarter) => quarter.disclosure_posture === 'generic')) {
        anomalyCounts.genericDisclosure += 1;
      }
    }

    const concreteQuarterCount = postureCounts.specific + postureCounts.mature;
    const factorBars = Object.entries(factorCitationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([factorId, count]) => ({
        label: FACTOR_SHORT_LABELS[factorId as keyof typeof FACTOR_SHORT_LABELS],
        count,
        share: formatShare(count, totalFactorCitations),
      }));
    const postureKeys = showAbsentInPosture
      ? (['absent', 'generic', 'emerging', 'specific', 'mature'] as const)
      : (['generic', 'emerging', 'specific', 'mature'] as const);
    const postureDenominator = postureKeys.reduce((total, posture) => total + postureCounts[posture], 0);
    const postureBars = postureKeys.map((posture) => ({
      posture,
      count: postureCounts[posture],
      share: formatShare(postureCounts[posture], postureDenominator),
    }));
    const peerRows = Array.from(peerGroups.entries())
      .map(([peerGroup, value]) => ({
        peerGroup,
        banks: value.banks,
        productionPct: percentValue(value.production, value.banks),
        boardPct: percentValue(value.board, value.banks),
        citationsPerBank: Math.round(value.citations / value.banks),
      }))
      .sort((a, b) => b.citationsPerBank - a.citationsPerBank);
    const topCitationLeaders = citationLeaders.sort((a, b) => b.citations - a.citations).slice(0, 6);
    const top10CitationCount = citationLeaders.slice(0, 10).reduce((total, item) => total + item.citations, 0);
    const periodRows = Array.from(periodCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, value]) => {
        const concrete = value.specific + value.mature;
        const nonAbsent = concrete + value.generic + value.emerging;
        return {
          period,
          concrete,
          nonAbsent,
          concretePct: percentValue(concrete, bundles.length),
        };
      });
    const peakPeriod = [...periodRows].sort((a, b) => b.concrete - a.concrete)[0] ?? null;
    const anomalyRows = [
      { label: 'Generic disclosure', count: anomalyCounts.genericDisclosure, tone: 'bg-slate-300' },
      { label: 'Strategic-risk signal', count: anomalyCounts.strategicRisk, tone: 'bg-amber-300' },
      { label: 'Governance gap', count: anomalyCounts.governanceGap, tone: 'bg-rose-300' },
      { label: 'Low confidence', count: anomalyCounts.lowConfidence, tone: 'bg-purple-300' },
    ];

    return [
      {
        eyebrow: 'Factor mix',
        title: 'AI is disclosed most often through risk and control language.',
        body: `Risk-management evidence accounts for ${factorCitationCounts.risk_management.toLocaleString()} of ${totalFactorCitations.toLocaleString()} factor-tagged citations, far above deployment or profitability language.`,
        metric: `${formatShare(factorCitationCounts.risk_management, totalFactorCitations)} risk-management linked`,
        visual: 'factorBars',
        factorBars,
      },
      {
        eyebrow: 'Governance vs deployment',
        title: 'Governance language often appears before full-scale deployment.',
        body: `${boardLevelBanks} banks show board-level governance evidence, while ${productionScaledBanks} are classified as production-scaled. ${boardLevelExperimentingBanks} banks pair board-level governance with experimenting or piloting language.`,
        metric: `${boardLevelBanks} board-level governance banks`,
        visual: 'quadrantGrid',
        quadrantCounts,
      },
      {
        eyebrow: 'Disclosure continuity',
        title: 'Concrete AI disclosure is broad, but not continuous.',
        body: showAbsentInPosture
          ? `${banksWithSpecificOrMatureDisclosure} banks have at least one specific or mature quarter, yet ${postureCounts.absent} of ${totalQuarters} bank-quarters remain absent. The pattern is episodic rather than a steady quarterly disclosure cadence.`
          : `With absent quarters removed, specific and mature disclosure make up ${formatShare(concreteQuarterCount, postureDenominator)} of quarters where banks said something meaningful about AI.`,
        metric: showAbsentInPosture
          ? `${formatShare(concreteQuarterCount, totalQuarters)} specific or mature quarters`
          : `${formatShare(concreteQuarterCount, postureDenominator)} of non-absent quarters`,
        visual: 'postureStack',
        postureBars,
      },
      {
        eyebrow: 'Peer-group contrast',
        title: 'Peer groups show different AI posture profiles.',
        body: 'Trust/IB and GSIB banks show denser governance evidence per bank, while regional banks contribute most of the total population and a wider deployment spread.',
        metric: `${peerRows[0]?.citationsPerBank ?? 0} citations per bank in highest-density peer group`,
        visual: 'peerProfile',
        peerRows,
      },
      {
        eyebrow: 'Citation concentration',
        title: 'AI evidence is concentrated, but not only in GSIBs.',
        body: `The top 10 banks by factor-linked citations account for ${formatShare(top10CitationCount, totalFactorCitations)} of all factor citations, and the leader list includes regional, GSIB, and Trust/IB banks.`,
        metric: `${formatShare(top10CitationCount, totalFactorCitations)} of citations in top 10 banks`,
        visual: 'citationLeaders',
        topCitationLeaders,
      },
      {
        eyebrow: 'Anomaly mix',
        title: 'Review flags cluster around disclosure quality and governance alignment.',
        body: 'The anomaly view is not just missing data: generic disclosures, strategic-risk concentration, and governance gaps are the main review categories that analysts should inspect.',
        metric: `${anomalyCounts.genericDisclosure + anomalyCounts.strategicRisk + anomalyCounts.governanceGap} review flags across three main patterns`,
        visual: 'anomalyBars',
        anomalyRows,
      },
      {
        eyebrow: 'Reporting-window spike',
        title: 'AI disclosure spikes around one reporting window.',
        body: peakPeriod
          ? `${peakPeriod.period} is the clearest disclosure surge, with ${peakPeriod.concrete} banks showing specific or mature posture. That makes the timeline more like an event-sensitive disclosure signal than a smooth maturity curve.`
          : 'Specific and mature disclosure appears unevenly across the eight-quarter window.',
        metric: peakPeriod ? `${peakPeriod.concrete} concrete disclosures in ${peakPeriod.period}` : 'Quarterly signal unavailable',
        visual: 'periodSpark',
        periodRows,
      },
    ];
  }, [bundles, postureCounts, showAbsentInPosture]);

  if (bundles.length === 0) {
    return <EmptyAIState message="No AI timeline data is available." />;
  }

  const totalTimelineQuarters = Object.values(postureCounts).reduce((total, count) => total + count, 0);
  const concreteTimelineQuarters = postureCounts.specific + postureCounts.mature;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
        <div className="text-xs font-mono uppercase tracking-wider text-emerald-300">Eight-quarter AI disclosure timeline</div>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Primary finding: concrete AI disclosure is broad but episodic, with {formatShare(concreteTimelineQuarters, totalTimelineQuarters)} of
          bank-quarters labeled specific or mature across the eight-quarter window.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">
          Timeline posture is inferred from cited evidence. Absent quarters remain visible so silence is part of the signal.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {findings.map((finding) => (
          <article
            key={`${finding.eyebrow}-${finding.title}`}
            className={`rounded-xl border border-white/10 bg-white/[0.02] p-4 ${
              finding.visual === 'periodSpark' ? 'md:col-span-2 xl:col-span-3' : ''
            }`}
          >
            <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-300">{finding.eyebrow}</p>
            <h2 className="mt-2 text-base font-semibold leading-snug text-white">{finding.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-300">{finding.body}</p>
            {finding.visual === 'factorBars' && finding.factorBars && (
              <div className="mt-4 space-y-2">
                {finding.factorBars.map((bar) => (
                  <div key={bar.label} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-[10px] text-neutral-400">
                      <span>{bar.label}</span>
                      <span>{bar.count.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div className="h-1.5 rounded-full bg-emerald-300" style={{ width: bar.share }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {finding.visual === 'quadrantGrid' && finding.quadrantCounts && (
              <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid grid-cols-[88px_1fr_1fr] gap-2 text-center text-[10px] text-neutral-400">
                  <div />
                  <div>Experimenting</div>
                  <div>Production</div>
                  <div className="flex items-center justify-end pr-1 text-right">Board level</div>
                  <div className="rounded-md border border-emerald-300/25 bg-emerald-300/10 py-3 text-lg font-semibold text-emerald-100">
                    {finding.quadrantCounts.experimentingBoard}
                  </div>
                  <div className="rounded-md border border-emerald-300/25 bg-emerald-300/10 py-3 text-lg font-semibold text-emerald-100">
                    {finding.quadrantCounts.productionBoard}
                  </div>
                  <div className="flex items-center justify-end pr-1 text-right">Operational</div>
                  <div className="rounded-md border border-sky-300/20 bg-sky-300/10 py-3 text-lg font-semibold text-sky-100">
                    {finding.quadrantCounts.experimentingOperational}
                  </div>
                  <div className="rounded-md border border-sky-300/20 bg-sky-300/10 py-3 text-lg font-semibold text-sky-100">
                    {finding.quadrantCounts.productionOperational}
                  </div>
                </div>
              </div>
            )}
            {finding.visual === 'postureStack' && finding.postureBars && (
              <div className="mt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-wide text-neutral-500">Distribution basis</span>
                  <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-0.5">
                    <button
                      type="button"
                      aria-pressed={showAbsentInPosture}
                      onClick={() => setShowAbsentInPosture(true)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                        showAbsentInPosture ? 'bg-emerald-300 text-black' : 'text-neutral-400 hover:text-emerald-100'
                      }`}
                    >
                      All quarters
                    </button>
                    <button
                      type="button"
                      aria-pressed={!showAbsentInPosture}
                      onClick={() => setShowAbsentInPosture(false)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                        !showAbsentInPosture ? 'bg-emerald-300 text-black' : 'text-neutral-400 hover:text-emerald-100'
                      }`}
                    >
                      Non-absent only
                    </button>
                  </div>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
                  {finding.postureBars.map((bar) => (
                    <div
                      key={bar.posture}
                      className={POSTURE_BAR_STYLE[bar.posture]}
                      style={{ width: bar.share }}
                      title={`${POSTURE_LABELS[bar.posture]}: ${bar.count} quarters`}
                    />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-neutral-400">
                  {finding.postureBars.map((bar) => (
                    <div key={bar.posture} className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${POSTURE_BAR_STYLE[bar.posture]}`} />
                      <span>
                        {POSTURE_LABELS[bar.posture]} {bar.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {finding.visual === 'peerProfile' && finding.peerRows && (
              <div className="mt-4 space-y-3">
                {finding.peerRows.map((row) => (
                  <div key={row.peerGroup} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-semibold text-white">{row.peerGroup}</span>
                      <span className="text-[10px] text-neutral-500">
                        {row.banks} banks · {row.citationsPerBank} citations/bank
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="grid grid-cols-[88px_1fr_34px] items-center gap-2 text-[10px]">
                        <span className="text-neutral-500">Production</span>
                        <div className="h-1.5 rounded-full bg-white/10">
                          <div className="h-1.5 rounded-full bg-emerald-300" style={{ width: `${row.productionPct}%` }} />
                        </div>
                        <span className="text-right text-neutral-300">{row.productionPct}%</span>
                      </div>
                      <div className="grid grid-cols-[88px_1fr_34px] items-center gap-2 text-[10px]">
                        <span className="text-neutral-500">Board level</span>
                        <div className="h-1.5 rounded-full bg-white/10">
                          <div className="h-1.5 rounded-full bg-sky-300" style={{ width: `${row.boardPct}%` }} />
                        </div>
                        <span className="text-right text-neutral-300">{row.boardPct}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {finding.visual === 'citationLeaders' && finding.topCitationLeaders && (
              <div className="mt-4 space-y-2">
                {finding.topCitationLeaders.map((leader, index) => {
                  const max = finding.topCitationLeaders?.[0]?.citations ?? 1;
                  return (
                    <div key={leader.ticker} className="grid grid-cols-[34px_1fr_42px] items-center gap-2 text-[10px]">
                      <span className="font-mono font-semibold text-emerald-300">{leader.ticker}</span>
                      <div className="min-w-0">
                        <div className="h-1.5 rounded-full bg-white/10">
                          <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-emerald-300 to-teal-300"
                            style={{ width: `${percentValue(leader.citations, max)}%` }}
                          />
                        </div>
                        <p className="mt-1 truncate text-neutral-500">
                          #{index + 1} · {leader.peerGroup} · {leader.strongestFactor}
                        </p>
                      </div>
                      <span className="text-right font-mono text-neutral-300">{leader.citations}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {finding.visual === 'anomalyBars' && finding.anomalyRows && (
              <div className="mt-4 space-y-2">
                {finding.anomalyRows.map((row) => {
                  const max = Math.max(...(finding.anomalyRows?.map((item) => item.count) ?? [1]));
                  return (
                    <div key={row.label} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]">
                        <span className="text-neutral-300">{row.label}</span>
                        <span className="font-mono font-semibold text-white">{row.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10">
                        <div className={`h-1.5 rounded-full ${row.tone}`} style={{ width: `${percentValue(row.count, max)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {finding.visual === 'periodSpark' && finding.periodRows && (
              <div className="mt-4">
                <div className="flex h-28 items-end gap-1.5 rounded-lg border border-white/10 bg-black/20 p-3">
                  {finding.periodRows.map((row) => (
                    <div key={row.period} className="flex h-full flex-1 flex-col justify-end gap-1">
                      <div className="relative flex flex-1 items-end">
                        <div
                          className="w-full rounded-t bg-white/10"
                          style={{ height: `${Math.max(4, percentValue(row.nonAbsent, bundles.length))}%` }}
                          title={`${row.period}: ${row.nonAbsent} non-absent disclosures`}
                        />
                        <div
                          className="absolute bottom-0 w-full rounded-t bg-emerald-300"
                          style={{ height: `${Math.max(2, percentValue(row.concrete, bundles.length))}%` }}
                          title={`${row.period}: ${row.concrete} specific or mature disclosures`}
                        />
                      </div>
                      <span className="-rotate-45 origin-top-left translate-y-2 text-[9px] text-neutral-500">{row.period.replace('20', '')}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-neutral-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-emerald-300" />
                    Specific or mature
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-white/20" />
                    Any disclosure
                  </span>
                </div>
              </div>
            )}
            <p className="mt-4 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
              {finding.metric}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {Object.entries(postureCounts).map(([posture, count]) => (
          <div key={posture} className={`rounded-xl border p-4 ${POSTURE_STYLE[posture as keyof typeof POSTURE_STYLE]}`}>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] uppercase tracking-wide opacity-80">{POSTURE_LABELS[posture as keyof typeof POSTURE_LABELS]}</p>
              <InfoTip
                label={POSTURE_LABELS[posture as keyof typeof POSTURE_LABELS]}
                description={POSTURE_DEFINITIONS[posture as keyof typeof POSTURE_DEFINITIONS]}
              />
            </div>
            <p className="mt-1 text-2xl font-semibold">{count}</p>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <p className="mb-3 shrink-0 px-1 text-xs uppercase tracking-wide text-neutral-500">Banks</p>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
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
                    <div className="mt-2 flex items-center gap-1.5">
                      <p className="text-sm font-semibold">{POSTURE_LABELS[quarter.disclosure_posture]}</p>
                      <InfoTip
                        label={POSTURE_LABELS[quarter.disclosure_posture]}
                        description={POSTURE_DEFINITIONS[quarter.disclosure_posture]}
                      />
                    </div>
                    <p className="mt-2 text-[10px] opacity-75">
                      {getAIEvidenceByIds(quarter.evidence_ids).length} citations
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedQuarter && (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
              <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">{selectedQuarter.period} rationale</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500">{selectedQuarterCitationCount} citations</span>
                    <ConfidenceBadge confidence={selectedQuarter.confidence} />
                  </div>
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
              <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]">
                <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">Quarter Evidence</h3>
                  <span className="text-[10px] text-neutral-500">{selectedQuarterCitationCount} citations</span>
                </div>
                <div className="min-h-0 overflow-y-auto pr-1">
                  <EvidenceList evidence={evidence} />
                </div>
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
