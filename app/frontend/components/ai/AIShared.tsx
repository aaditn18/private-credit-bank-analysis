'use client';

import clsx from 'clsx';
import { useState } from 'react';
import type {
  AIConfidence,
  AIDisclosurePosture,
  AIDeploymentStage,
  AIEvidenceRecord,
  AIFactorBar,
  AIGovernanceMaturity,
  AIQuadrantRecord,
} from '@/lib/ai-types';

export const FACTOR_ORDER = [
  'board_governance',
  'strategic_implementation',
  'risk_management',
  'leadership_acumen',
  'growth_profitability',
  'compliance',
  'strategic_risk',
] as const;

export const POSTURE_LABELS: Record<AIDisclosurePosture, string> = {
  absent: 'Absent',
  generic: 'Generic',
  emerging: 'Emerging',
  specific: 'Specific',
  mature: 'Mature',
};

export const POSTURE_DEFINITIONS: Record<AIDisclosurePosture, string> = {
  absent: 'No meaningful AI disclosure was found for the quarter.',
  generic: 'Vague AI, technology, or risk-factor language without company-specific use cases or governance detail.',
  emerging: 'Some concrete AI use case, strategy, or governance language appears, but maturity remains limited.',
  specific: 'Named use cases, business functions, governance processes, or measurable deployment details are disclosed.',
  mature: 'Specific deployment evidence appears together with governance, accountability, or control evidence.',
};

export const DEPLOYMENT_LABELS: Record<AIDeploymentStage, string> = {
  production_scaled: 'Production scaled',
  experimenting_piloting: 'Experimenting / piloting',
  insufficient_evidence: 'Insufficient evidence',
};

export const GOVERNANCE_LABELS: Record<AIGovernanceMaturity, string> = {
  board_level: 'Board level',
  operational_ownership_only: 'Operational ownership',
  insufficient_evidence: 'Insufficient evidence',
};

export const FACTOR_DEFINITIONS = {
  board_governance: 'Board, board-committee, senior oversight, policy, or model-risk governance evidence tied to AI or analytical models.',
  strategic_implementation: 'Evidence that AI, machine learning, automation, or model capabilities are being implemented in strategy, operations, or products.',
  risk_management: 'Evidence of AI/model risk identification, controls, monitoring, cyber/fraud risk, model validation, or operational risk management.',
  leadership_acumen: 'Evidence that leadership, executives, committees, or strategic planning processes understand and direct AI-related activity.',
  growth_profitability: 'Evidence connecting AI, automation, analytics, or technology change to efficiency, productivity, revenue, underwriting, or profitability.',
  compliance: 'Evidence involving regulatory compliance, legal, privacy, audit, validation, fair-lending, control, or policy obligations around AI/model use.',
  strategic_risk: 'Evidence that AI, technology change, competition, reputation, or disruption creates strategic exposure or opportunity for the bank.',
} satisfies Record<AIFactorBar['factor_id'], string>;

export function InfoTip({ label, description }: { label: string; description: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <span
        aria-label={`${label}: ${description}`}
        title={description}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-[10px] font-semibold text-neutral-400 outline-none transition hover:border-emerald-300/50 hover:text-emerald-100 focus:border-emerald-300/60 focus:text-emerald-100"
      >
        i
      </span>
      <span className="pointer-events-none absolute left-1/2 top-5 z-50 hidden w-64 -translate-x-1/2 rounded-md border border-white/10 bg-black/95 px-3 py-2 text-[11px] font-normal leading-relaxed text-neutral-200 shadow-xl group-hover:block">
        {description}
      </span>
    </span>
  );
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return `${Math.round(value)}%`;
}

export function confidenceClass(confidence: AIConfidence): string {
  if (confidence === 'high') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  if (confidence === 'medium') return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
  return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
}

export function ConfidenceBadge({ confidence }: { confidence: AIConfidence }) {
  return (
    <span className={clsx('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', confidenceClass(confidence))}>
      {confidence}
    </span>
  );
}

export function EmptyAIState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-8 text-center text-sm text-neutral-400">
      {message}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function factorMetaLabel(factor: AIFactorBar): string {
  if ((factor.peer_percentile ?? 0) === 0 && factor.evidence_ids.length > 0) {
    return `Lowest peer percentile · ${factor.evidence_ids.length} citations`;
  }
  return `Peer percentile ${formatPercent(factor.peer_percentile)} · ${factor.evidence_ids.length} citations`;
}

export function FactorBars({
  factors,
  onEvidenceClick,
  showEvidenceButtons = true,
}: {
  factors: AIFactorBar[];
  onEvidenceClick?: (ids: string[]) => void;
  showEvidenceButtons?: boolean;
}) {
  return (
    <div className="space-y-3">
      {factors.map((factor) => (
        <div key={factor.factor_id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate text-xs font-medium text-neutral-100">{factor.factor_name}</p>
                <InfoTip label={factor.factor_name} description={FACTOR_DEFINITIONS[factor.factor_id]} />
              </div>
              <p className="text-[10px] text-neutral-500">{factorMetaLabel(factor)}</p>
            </div>
            {showEvidenceButtons && (
              <button
                type="button"
                onClick={() => onEvidenceClick?.(factor.evidence_ids)}
                disabled={factor.evidence_ids.length === 0}
                className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10px] text-neutral-300 transition hover:border-emerald-300/50 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-35"
              >
                Evidence
              </button>
            )}
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
              style={{
                width: `${Math.max(factor.evidence_ids.length > 0 ? 6 : 0, Math.min(100, factor.normalized_value ?? 0))}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EvidenceList({ evidence }: { evidence: AIEvidenceRecord[] }) {
  const unique = Array.from(new Map(evidence.map((item) => [item.evidence_id, item])).values());

  if (unique.length === 0) {
    return <EmptyAIState message="No cited AI evidence is linked to this view." />;
  }

  return (
    <div className="space-y-3">
      {unique.map((item) => (
        <article key={item.evidence_id} className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-semibold text-emerald-300">{item.evidence_id}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-neutral-300">{item.filing_type ?? item.source_type ?? 'source'}</span>
            {item.p_tier && <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-200">{item.p_tier}</span>}
            <ConfidenceBadge confidence={item.confidence} />
          </div>
          <p className="text-sm leading-relaxed text-neutral-100">“{item.excerpt}”</p>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
            {item.bank_name} · {item.fiscal_year}
            {item.fiscal_quarter ? `Q${item.fiscal_quarter}` : ''} · {formatSectionLabel(item.section)}
          </p>
        </article>
      ))}
    </div>
  );
}

function formatSectionLabel(section: string | null): string {
  if (!section) return 'section unavailable';

  const normalized = section.trim().replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();

  if (lower.includes('management') && lower.includes('discussion') && lower.includes('analysis')) {
    if (lower.startsWith('item 2')) return 'MD&A (10-Q Item 2)';
    if (lower.startsWith('item 7')) return 'MD&A (10-K Item 7)';
    return 'Management discussion and analysis';
  }
  if (lower.includes('risk factors')) return 'Risk factors';
  if (lower.includes('executive officers')) return 'Executive officers';
  if (lower.includes('notes to consolidated financial statements')) return 'Financial statement notes';
  if (lower.includes('business')) return 'Business overview';

  return normalized;
}

export function QuadrantMap({
  quadrants,
  strengthByTicker,
  activeTicker,
  onSelectTicker,
}: {
  quadrants: AIQuadrantRecord[];
  strengthByTicker?: Record<string, { deployment: number; governance: number; citations: number }>;
  activeTicker?: string;
  onSelectTicker?: (ticker: string) => void;
}) {
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);

  const visibleQuadrants = quadrants;

  const position = (record: AIQuadrantRecord, index: number) => {
    const strength = strengthByTicker?.[record.ticker] ?? { deployment: 50, governance: 50, citations: record.evidence_ids.length };
    const deploymentStrength = clamp(strength.deployment, 0, 100);
    const governanceStrength = clamp(strength.governance, 0, 100);
    const sameCoordinateIndex = visibleQuadrants
      .slice(0, index)
      .filter(
        (candidate) =>
          candidate.deployment_stage === record.deployment_stage &&
          candidate.governance_maturity === record.governance_maturity &&
          Math.round((strengthByTicker?.[candidate.ticker]?.deployment ?? 50) / 10) === Math.round(deploymentStrength / 10) &&
          Math.round((strengthByTicker?.[candidate.ticker]?.governance ?? 50) / 10) === Math.round(governanceStrength / 10),
      ).length;
    const offsetPattern = [
      [0, 0],
      [2.5, -2.5],
      [-2.5, 2.5],
      [2.5, 2.5],
      [-2.5, -2.5],
    ];
    const [offsetX, offsetY] = offsetPattern[sameCoordinateIndex % offsetPattern.length];
    const x =
      record.deployment_stage === 'production_scaled'
        ? 56 + deploymentStrength * 0.3
        : 14 + deploymentStrength * 0.3;
    const y =
      record.governance_maturity === 'board_level'
        ? 44 - governanceStrength * 0.3
        : 86 - governanceStrength * 0.3;
    const clampedX = clamp(x + offsetX, 10, 90);
    const clampedY = clamp(y + offsetY, 10, 90);

    return { x: clampedX, y: clampedY, style: { left: `${clampedX}%`, top: `${clampedY}%` }, strength };
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">AI 2x2 Positioning</h3>
          <p className="text-xs text-neutral-500">
            Dots are placed within each block by peer-relative deployment and governance evidence strength; larger dots have more citations.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-neutral-500">{visibleQuadrants.length} banks</span>
      </div>
      <div className="relative h-[320px] overflow-visible rounded-lg border border-white/10 bg-black/20">
        <div className="absolute inset-x-0 top-1/2 border-t border-white/10" />
        <div className="absolute inset-y-0 left-1/2 border-l border-white/10" />
        <div className="absolute left-3 top-3 max-w-[170px] text-[10px] leading-snug text-neutral-500">
          Experimenting / piloting<br />Board-level governance
        </div>
        <div className="absolute right-3 top-3 max-w-[170px] text-right text-[10px] leading-snug text-neutral-500">
          Production scaled<br />Board-level governance
        </div>
        <div className="absolute bottom-3 left-3 max-w-[170px] text-[10px] leading-snug text-neutral-500">
          Experimenting / piloting<br />Operational ownership
        </div>
        <div className="absolute bottom-3 right-3 max-w-[170px] text-right text-[10px] leading-snug text-neutral-500">
          Production scaled<br />Operational ownership
        </div>
        {visibleQuadrants.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-neutral-500">
            No banks match this peer filter.
          </div>
        )}
        {visibleQuadrants.map((record, index) => {
          const isActive = activeTicker === record.ticker;
          const isHovered = hoveredTicker === record.ticker;
          const { x, style, strength } = position(record, index);
          const markerSize = Math.max(12, Math.min(18, 10 + Math.log2(Math.max(1, strength.citations)) * 2));
          const labelSideClass = x > 65 ? 'right-7' : 'left-7';
          return (
            <div
              key={record.ticker}
              className={clsx('absolute', isActive || isHovered ? 'z-30' : 'z-10')}
              style={{ ...style, transform: 'translate(-50%, -50%)' }}
            >
              <button
                type="button"
                aria-label={`${record.ticker}, ${record.bank_name}: ${DEPLOYMENT_LABELS[record.deployment_stage]} / ${GOVERNANCE_LABELS[record.governance_maturity]}`}
                title={`${record.ticker} · ${record.bank_name}`}
                onMouseEnter={() => setHoveredTicker(record.ticker)}
                onMouseLeave={() => setHoveredTicker(null)}
                onPointerEnter={() => setHoveredTicker(record.ticker)}
                onPointerLeave={() => setHoveredTicker(null)}
                onFocus={() => setHoveredTicker(record.ticker)}
                onBlur={() => setHoveredTicker(null)}
                onClick={() => {
                  setHoveredTicker(record.ticker);
                  onSelectTicker?.(record.ticker);
                }}
                className="peer flex h-5 w-5 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              >
                <span
                  className={clsx(
                    'block rounded-full border shadow-sm transition',
                    isActive
                      ? 'border-emerald-100 bg-emerald-300 ring-4 ring-emerald-300/25'
                      : 'border-white/20 bg-neutral-500/70 hover:border-emerald-300/50 hover:bg-emerald-300',
                  )}
                  style={{ height: `${isActive ? markerSize + 3 : markerSize}px`, width: `${isActive ? markerSize + 3 : markerSize}px` }}
                />
              </button>
              {isActive ? (
                <span
                  className={clsx(
                    'pointer-events-none absolute top-1/2 z-30 -translate-y-1/2 whitespace-nowrap rounded-md border border-emerald-300/40 bg-black/90 px-2 py-1 font-mono text-[10px] font-bold text-emerald-100 shadow-lg',
                    labelSideClass,
                  )}
                >
                  {record.ticker}
                </span>
              ) : (
                <span className="sr-only">{record.ticker}</span>
              )}
              <span
                className={clsx(
                  'pointer-events-none absolute top-1/2 z-40 w-max max-w-[240px] -translate-y-1/2 rounded-md border border-white/10 bg-black/95 px-2.5 py-2 text-left shadow-xl peer-focus:!block peer-hover:!block',
                  labelSideClass,
                  isHovered ? 'block' : 'hidden',
                )}
              >
                <span className="block font-mono text-[10px] font-bold text-emerald-200">{record.ticker}</span>
                <span className="mt-0.5 block text-[11px] font-medium text-white">{record.bank_name}</span>
                <span className="mt-1 block text-[10px] text-neutral-400">
                  {record.peer_group} · {DEPLOYMENT_LABELS[record.deployment_stage]} · {GOVERNANCE_LABELS[record.governance_maturity]}
                </span>
                <span className="mt-1 block text-[10px] text-neutral-500">
                  Deployment {formatPercent(strength.deployment)} · Governance {formatPercent(strength.governance)} · {strength.citations} citations
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
