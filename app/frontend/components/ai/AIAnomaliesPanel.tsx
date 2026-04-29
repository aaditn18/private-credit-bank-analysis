'use client';

import { useMemo, useState } from 'react';
import type { AIBankBundle } from '@/lib/ai-types';
import {
  ConfidenceBadge,
  DEPLOYMENT_LABELS,
  EmptyAIState,
  EvidenceList,
  formatPercent,
  GOVERNANCE_LABELS,
  POSTURE_LABELS,
} from '@/components/ai/AIShared';

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
    .toReversed()
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
      detail: 'The generated static AI output carries low confidence and should be reviewed against cited excerpts before downstream use.',
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
      detail: `Placement is ${DEPLOYMENT_LABELS[quadrant.deployment_stage]} / ${GOVERNANCE_LABELS[quadrant.governance_maturity]}, while Board Governance factor percentile is ${formatPercent(governance?.peer_percentile)}.`,
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
        .toSorted((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.severity] - order[b.severity] || a.ticker.localeCompare(b.ticker);
        }),
    [bundles],
  );

  const visible = anomalies.filter((item) => kind === 'all' || item.kind === kind);
  const activeEvidence = active
    ? bundles
        .find((bundle) => bundle.score.ticker === active.ticker)
        ?.topEvidence.filter((item) => active.evidenceIds.includes(item.evidence_id)) ?? []
    : [];

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

  if (bundles.length === 0) {
    return <EmptyAIState message="No static AI data is available for anomaly review." />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
        <div className="text-xs font-mono uppercase tracking-wider text-emerald-300">Static AI anomaly review</div>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          AI anomalies are generated from Team 1 static JSON, so this tab does not wait on the backend anomaly API.
          Flags highlight severe evidence gaps, low-confidence rows, strategic-risk disclosure concentration, governance gaps, and generic-only disclosures.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-5">
        {(Object.keys(counts) as AIAnomalyKind[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setKind(kind === item ? 'all' : item)}
            className={`rounded-xl border p-4 text-left transition ${
              kind === item
                ? 'border-emerald-300 bg-emerald-300 text-black'
                : 'border-white/10 bg-white/[0.02] text-neutral-300 hover:border-emerald-300/40'
            }`}
          >
            <p className="text-[10px] uppercase tracking-wide opacity-75">{KIND_LABEL[item]}</p>
            <p className="mt-1 text-2xl font-semibold">{counts[item]}</p>
          </button>
        ))}
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="border-b border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">AI Anomaly Flags</h2>
                <p className="text-xs text-neutral-500">Showing {visible.length} of {anomalies.length} static review flags.</p>
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
          <div className="divide-y divide-white/10">
            {visible.length === 0 ? (
              <EmptyAIState message="No AI anomaly flags match the current filter." />
            ) : (
              visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(item)}
                  className="block w-full p-4 text-left transition hover:bg-white/[0.03]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-300">{item.ticker}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${SEVERITY_CLASS[item.severity]}`}>
                      {item.severity}
                    </span>
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-neutral-300">{KIND_LABEL[item.kind]}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-400">{item.detail}</p>
                </button>
              ))
            )}
          </div>
        </section>

        <aside className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          {active ? (
            <>
              <div className="mb-3">
                <p className="font-mono text-sm font-semibold text-emerald-300">{active.ticker}</p>
                <h3 className="mt-1 text-base font-semibold text-white">{active.bankName}</h3>
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

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h2 className="text-sm font-semibold text-white">Disclosure posture context</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          {['absent', 'generic', 'emerging', 'specific', 'mature'].map((posture) => (
            <div key={posture} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">{POSTURE_LABELS[posture as keyof typeof POSTURE_LABELS]}</p>
              <p className="mt-1 text-xs text-neutral-400">Static timeline label</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
