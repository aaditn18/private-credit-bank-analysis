'use client';

import { useMemo, useState } from 'react';
import type { AIBankBundle } from '@/lib/ai-types';
import {
  ConfidenceBadge,
  DEPLOYMENT_LABELS,
  EmptyAIState,
  EvidenceList,
  formatPercent,
} from '@/components/ai/AIShared';
import { getAIEvidenceByIds } from '@/lib/ai-data';

type AIAnomalyKind = 'missing_evidence' | 'low_confidence' | 'strategic_risk' | 'governance_gap' | 'generic_disclosure';

interface AIAnomaly {
  id: string;
  ticker: string;
  bankName: string;
  kind: AIAnomalyKind;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  evidenceIds: string[];
}

const KIND_LABEL: Record<AIAnomalyKind, string> = {
  missing_evidence: 'Evidence Gaps',
  low_confidence: 'Low Confidence',
  strategic_risk: 'Strategic Risk Signal',
  governance_gap: 'Governance Gap',
  generic_disclosure: 'Generic Disclosure',
};

const SEVERITY_CLASS = {
  high: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  medium: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  low: 'border-white/10 bg-white/[0.04] text-neutral-300',
} as const;

const SEVERITY_DOT = {
  high: 'bg-rose-300',
  medium: 'bg-amber-300',
  low: 'bg-neutral-400',
} as const;

const KIND_ACCENT: Record<AIAnomalyKind, string> = {
  missing_evidence: 'bg-rose-300',
  low_confidence: 'bg-purple-300',
  strategic_risk: 'bg-amber-300',
  governance_gap: 'bg-sky-300',
  generic_disclosure: 'bg-slate-300',
};

const KIND_DESCRIPTION: Record<AIAnomalyKind, string> = {
  missing_evidence: 'Severe gaps that block confident placement.',
  low_confidence: 'Rows requiring manual review before use.',
  strategic_risk: 'High peer-relative strategic-risk disclosure.',
  governance_gap: 'Deployment evidence ahead of board governance.',
  generic_disclosure: 'Recent AI language remains boilerplate.',
};

function percentValue(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function severeEvidenceGaps(bundle: AIBankBundle): string[] {
  const quadrant = bundle.quadrant;
  if (!quadrant) return [];

  return quadrant.missing_evidence.filter((gap) => {
    const normalized = gap.toLowerCase();
    const deploymentGap =
      normalized.includes('no deployment evidence') ||
      normalized.includes('no deployment evidence excerpts') ||
      normalized.includes('no pilot or deployment evidence') ||
      normalized.includes('no production deployment evidence');
    const governanceGap =
      normalized.includes('no board-level oversight evidence') ||
      normalized.includes('no board-level ai governance evidence') ||
      normalized.includes('no explicit board-level') ||
      normalized.includes('no direct evidence of board-level');

    if (deploymentGap && quadrant.deployment_stage === 'insufficient_evidence') return true;
    if (governanceGap && quadrant.governance_maturity === 'insufficient_evidence') return true;
    return false;
  });
}

function buildAIAnomalies(bundle: AIBankBundle): AIAnomaly[] {
  const anomalies: AIAnomaly[] = [];
  const quadrant = bundle.quadrant;
  const strategicRisk = bundle.bars?.factors.find((factor) => factor.factor_id === 'strategic_risk');
  const governance = bundle.bars?.factors.find((factor) => factor.factor_id === 'board_governance');
  const latestGeneric = bundle.timeline?.quarters
    .slice()
    .reverse()
    .find((quarter) => quarter.disclosure_posture === 'generic');

  const severeGaps = severeEvidenceGaps(bundle);
  if (quadrant && severeGaps.length > 0) {
    anomalies.push({
      id: `${bundle.score.ticker}-missing`,
      ticker: bundle.score.ticker,
      bankName: bundle.score.bank_name,
      kind: 'missing_evidence',
      severity: quadrant.confidence === 'low' ? 'high' : 'medium',
      title: `${bundle.score.ticker} has unresolved AI placement evidence gaps`,
      detail: severeGaps.join('; '),
      evidenceIds: quadrant.evidence_ids,
    });
  }

  if (bundle.score.confidence === 'low' || quadrant?.confidence === 'low') {
    anomalies.push({
      id: `${bundle.score.ticker}-confidence`,
      ticker: bundle.score.ticker,
      bankName: bundle.score.bank_name,
      kind: 'low_confidence',
      severity: 'high',
      title: `${bundle.score.ticker} requires review before relying on AI classification`,
      detail: 'The AI output carries low confidence and should be reviewed against cited excerpts before downstream use.',
      evidenceIds: bundle.score.evidence_ids.slice(0, 6),
    });
  }

  if ((strategicRisk?.peer_percentile ?? 0) >= 75 && strategicRisk?.evidence_ids.length) {
    anomalies.push({
      id: `${bundle.score.ticker}-strategic-risk`,
      ticker: bundle.score.ticker,
      bankName: bundle.score.bank_name,
      kind: 'strategic_risk',
      severity: (strategicRisk.peer_percentile ?? 0) >= 90 ? 'high' : 'medium',
      title: `${bundle.score.ticker} has elevated peer-relative AI strategic-risk disclosure`,
      detail: `Strategic Risk factor is at peer percentile ${formatPercent(strategicRisk.peer_percentile)}. This indicates more disclosed AI-related exposure, not automatically worse risk.`,
      evidenceIds: strategicRisk.evidence_ids,
    });
  }

  if (
    quadrant &&
    quadrant.deployment_stage !== 'insufficient_evidence' &&
    quadrant.governance_maturity === 'insufficient_evidence'
  ) {
    anomalies.push({
      id: `${bundle.score.ticker}-governance-gap`,
      ticker: bundle.score.ticker,
      bankName: bundle.score.bank_name,
      kind: 'governance_gap',
      severity: 'high',
      title: `${bundle.score.ticker} shows deployment evidence without governance maturity evidence`,
      detail: `${DEPLOYMENT_LABELS[quadrant.deployment_stage]} deployment is visible, but governance remains classified as insufficient evidence.`,
      evidenceIds: quadrant.evidence_ids,
    });
  } else if (
    quadrant &&
    quadrant.deployment_stage !== 'insufficient_evidence' &&
    quadrant.governance_maturity === 'operational_ownership_only' &&
    (governance?.peer_percentile ?? 0) < 50
  ) {
    anomalies.push({
      id: `${bundle.score.ticker}-operational-governance`,
      ticker: bundle.score.ticker,
      bankName: bundle.score.bank_name,
      kind: 'governance_gap',
      severity: 'medium',
      title: `${bundle.score.ticker} deployment evidence is ahead of board-governance evidence`,
      detail: `${DEPLOYMENT_LABELS[quadrant.deployment_stage]} deployment appears stronger than board-governance evidence. Board Governance is at peer percentile ${formatPercent(governance?.peer_percentile)}.`,
      evidenceIds: quadrant.evidence_ids,
    });
  }

  if (latestGeneric) {
    anomalies.push({
      id: `${bundle.score.ticker}-generic-${latestGeneric.period}`,
      ticker: bundle.score.ticker,
      bankName: bundle.score.bank_name,
      kind: 'generic_disclosure',
      severity: 'low',
      title: `${bundle.score.ticker} has generic AI disclosure in ${latestGeneric.period}`,
      detail: latestGeneric.posture_reason,
      evidenceIds: latestGeneric.evidence_ids,
    });
  }

  return anomalies;
}

export function AIAnomaliesPanel({ bundles }: { bundles: AIBankBundle[] }) {
  const [kind, setKind] = useState<AIAnomalyKind | 'all'>('all');
  const [active, setActive] = useState<AIAnomaly | null>(null);

  const anomalies = useMemo(
    () =>
      bundles
        .flatMap(buildAIAnomalies)
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.severity] - order[b.severity] || a.ticker.localeCompare(b.ticker);
        }),
    [bundles],
  );

  const visible = anomalies.filter((item) => kind === 'all' || item.kind === kind);
  const activeEvidence = active ? getAIEvidenceByIds(active.evidenceIds) : [];

  const counts = anomalies.reduce<Record<AIAnomalyKind, number>>(
    (acc, item) => {
      acc[item.kind] += 1;
      return acc;
    },
    {
      missing_evidence: 0,
      low_confidence: 0,
      strategic_risk: 0,
      governance_gap: 0,
      generic_disclosure: 0,
    },
  );

  const severityCounts = anomalies.reduce(
    (acc, item) => {
      acc[item.severity] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );

  const impactedBanks = new Set(anomalies.map((item) => item.ticker)).size;
  const maxKindCount = Math.max(...Object.values(counts), 1);

  const topBanks = Object.values(
    anomalies.reduce<Record<string, { ticker: string; bankName: string; total: number; high: number; medium: number; low: number }>>(
      (acc, item) => {
        acc[item.ticker] ??= { ticker: item.ticker, bankName: item.bankName, total: 0, high: 0, medium: 0, low: 0 };
        acc[item.ticker].total += 1;
        acc[item.ticker][item.severity] += 1;
        return acc;
      },
      {},
    ),
  )
    .sort((a, b) => b.total - a.total || b.high - a.high || a.ticker.localeCompare(b.ticker))
    .slice(0, 8);

  const peerRows = Object.values(
    anomalies.reduce<Record<string, { peer: string; total: number; high: number; medium: number; low: number }>>((acc, item) => {
      const peer = bundles.find((bundle) => bundle.score.ticker === item.ticker)?.score.peer_group ?? 'unknown';
      acc[peer] ??= { peer, total: 0, high: 0, medium: 0, low: 0 };
      acc[peer].total += 1;
      acc[peer][item.severity] += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.total - a.total);

  const maxPeerCount = Math.max(...peerRows.map((row) => row.total), 1);

  if (bundles.length === 0) {
    return <EmptyAIState message="No AI data is available for anomaly review." />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-xs font-mono uppercase tracking-wider text-emerald-300">AI anomaly review</div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">
              Review flags show where AI disclosures need analyst attention: evidence gaps, generic language,
              strategic-risk concentration, and deployment/governance mismatch.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(['high', 'medium', 'low'] as const).map((severity) => (
              <div key={severity} className={`min-w-16 rounded-lg border px-3 py-2 ${SEVERITY_CLASS[severity]}`}>
                <p className="text-lg font-semibold tabular-nums">{severityCounts[severity]}</p>
                <p className="text-[10px] uppercase tracking-wide">{severity}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Review flags</p>
          <p className="mt-1 text-3xl font-semibold text-white">{anomalies.length}</p>
          <p className="mt-2 text-xs text-neutral-500">{impactedBanks} banks have at least one flag.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Most common flag</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {KIND_LABEL[(Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'generic_disclosure') as AIAnomalyKind]}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            {Math.max(...Object.values(counts))} occurrences across the review queue.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">High-priority items</p>
          <p className="mt-1 text-3xl font-semibold text-rose-200">{severityCounts.high}</p>
          <p className="mt-2 text-xs text-neutral-500">High severity flags appear first in the queue.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Active filter</p>
          <p className="mt-1 text-lg font-semibold text-white">{kind === 'all' ? 'All flags' : KIND_LABEL[kind]}</p>
          <p className="mt-2 text-xs text-neutral-500">Showing {visible.length} matching review items.</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Flag Mix</h2>
              <p className="text-xs text-neutral-500">Click any category to filter the review queue.</p>
            </div>
            {kind !== 'all' && (
              <button
                type="button"
                onClick={() => setKind('all')}
                className="rounded-md border border-white/10 px-3 py-1 text-xs text-neutral-300 hover:border-emerald-300/50"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="space-y-3">
            {(Object.keys(counts) as AIAnomalyKind[]).map((item) => {
              const isActive = kind === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setKind(isActive ? 'all' : item)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    isActive
                      ? 'border-emerald-300 bg-emerald-300/10'
                      : 'border-white/10 bg-black/20 hover:border-emerald-300/40'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${KIND_ACCENT[item]}`} />
                      <span className="text-sm font-semibold text-white">{KIND_LABEL[item]}</span>
                    </div>
                    <span className="font-mono text-sm font-semibold text-neutral-200">{counts[item]}</span>
                  </div>
                  <p className="mb-2 text-xs text-neutral-500">{KIND_DESCRIPTION[item]}</p>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className={`h-2 rounded-full ${KIND_ACCENT[item]}`} style={{ width: `${percentValue(counts[item], maxKindCount)}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="text-base font-semibold text-white">Peer-Group Concentration</h2>
            <p className="mt-1 text-xs text-neutral-500">Review load by peer group, stacked by severity.</p>
            <div className="mt-4 space-y-3">
              {peerRows.map((row) => (
                <div key={row.peer} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-mono font-semibold text-neutral-200">{row.peer}</span>
                    <span className="text-neutral-500">{row.total} flags</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-white/10" style={{ width: `${Math.max(12, percentValue(row.total, maxPeerCount))}%` }}>
                    {(['high', 'medium', 'low'] as const).map((severity) => (
                      <div
                        key={severity}
                        className={SEVERITY_DOT[severity]}
                        style={{ width: `${percentValue(row[severity], row.total)}%` }}
                        title={`${row.peer}: ${row[severity]} ${severity} flags`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="text-base font-semibold text-white">Most Flagged Banks</h2>
            <p className="mt-1 text-xs text-neutral-500">Banks with the densest anomaly review queue.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {topBanks.map((bank) => (
                <button
                  key={bank.ticker}
                  type="button"
                  onClick={() => setActive(anomalies.find((item) => item.ticker === bank.ticker) ?? null)}
                  className="rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-emerald-300/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-semibold text-emerald-300">{bank.ticker}</span>
                    <span className="text-xs font-semibold text-white">{bank.total}</span>
                  </div>
                  <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-white/10">
                    {(['high', 'medium', 'low'] as const).map((severity) => (
                      <div key={severity} className={SEVERITY_DOT[severity]} style={{ width: `${percentValue(bank[severity], bank.total)}%` }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="border-b border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Review Queue</h2>
                <p className="text-xs text-neutral-500">Showing {visible.length} of {anomalies.length} review flags.</p>
              </div>
              {kind !== 'all' && (
                <button
                  type="button"
                  onClick={() => setKind('all')}
                  className="rounded-md border border-white/10 px-3 py-1 text-xs text-neutral-300 hover:border-emerald-300/50"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {visible.length === 0 ? (
              <EmptyAIState message="No AI anomaly flags match the current filter." />
            ) : (
              visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(item)}
                  className={`block w-full rounded-xl border p-4 text-left transition ${
                    active?.id === item.id
                      ? 'border-emerald-300 bg-emerald-300/10'
                      : 'border-white/10 bg-black/20 hover:border-emerald-300/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-mono text-sm font-bold text-emerald-300">{item.ticker}</span>
                      <p className="mt-0.5 truncate text-[11px] text-neutral-500">{item.bankName}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${SEVERITY_CLASS[item.severity]}`}>
                      {item.severity}
                    </span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded bg-white/10 px-2 py-1 text-[10px] text-neutral-300">
                    <span className={`h-1.5 w-1.5 rounded-full ${KIND_ACCENT[item.kind]}`} />
                    {KIND_LABEL[item.kind]}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-400">{item.detail}</p>
                </button>
              ))
            )}
          </div>
        </section>

        <aside className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-4 xl:sticky xl:top-4 xl:self-start">
          {active ? (
            <>
              <div className="mb-4 rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-emerald-300">{active.ticker}</p>
                    <h3 className="mt-1 text-base font-semibold text-white">{active.bankName}</h3>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${SEVERITY_CLASS[active.severity]}`}>
                    {active.severity}
                  </span>
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded bg-white/10 px-2 py-1 text-[10px] text-neutral-300">
                  <span className={`h-1.5 w-1.5 rounded-full ${KIND_ACCENT[active.kind]}`} />
                  {KIND_LABEL[active.kind]}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-400">{active.detail}</p>
              </div>
              <EvidenceList evidence={activeEvidence} />
            </>
          ) : (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-white">Select a flag</h3>
              <p className="text-sm leading-relaxed text-neutral-400">
                Click an anomaly flag to inspect linked evidence excerpts and confidence handling.
              </p>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-xs font-semibold text-white">Interpretation guardrail</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  These are review flags over disclosed AI evidence. They are not enforcement findings or definitive credit-risk ratings.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
