'use client';

import clsx from 'clsx';
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

export function FactorBars({
  factors,
  onEvidenceClick,
}: {
  factors: AIFactorBar[];
  onEvidenceClick?: (ids: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      {factors.map((factor) => (
        <div key={factor.factor_id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-neutral-100">{factor.factor_name}</p>
              <p className="text-[10px] text-neutral-500">
                Peer percentile {formatPercent(factor.peer_percentile)} · {factor.evidence_ids.length} citations
              </p>
            </div>
            <button
              type="button"
              onClick={() => onEvidenceClick?.(factor.evidence_ids)}
              disabled={factor.evidence_ids.length === 0}
              className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10px] text-neutral-300 transition hover:border-emerald-300/50 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-35"
            >
              Evidence
            </button>
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
              style={{ width: `${Math.max(0, Math.min(100, factor.normalized_value ?? 0))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EvidenceList({ evidence }: { evidence: AIEvidenceRecord[] }) {
  if (evidence.length === 0) {
    return <EmptyAIState message="No cited AI evidence is linked to this view." />;
  }

  return (
    <div className="space-y-3">
      {evidence.map((item) => (
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
            {item.fiscal_quarter ? `Q${item.fiscal_quarter}` : ''} · {item.section ?? 'section unavailable'}
          </p>
        </article>
      ))}
    </div>
  );
}

export function QuadrantMap({ quadrants, activeTicker }: { quadrants: AIQuadrantRecord[]; activeTicker?: string }) {
  const position = (record: AIQuadrantRecord) => {
    const x =
      record.deployment_stage === 'production_scaled'
        ? 82
        : record.deployment_stage === 'experimenting_piloting'
          ? 50
          : 18;
    const y =
      record.governance_maturity === 'board_level'
        ? 18
        : record.governance_maturity === 'operational_ownership_only'
          ? 50
          : 82;
    return { left: `${x}%`, top: `${y}%` };
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">AI 2x2 Positioning</h3>
          <p className="text-xs text-neutral-500">X: deployment stage · Y: governance maturity</p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-neutral-500">Conservative judge</span>
      </div>
      <div className="relative h-[320px] overflow-hidden rounded-lg border border-white/10 bg-black/20">
        <div className="absolute inset-x-0 top-1/2 border-t border-white/10" />
        <div className="absolute inset-y-0 left-1/2 border-l border-white/10" />
        <div className="absolute left-3 top-3 text-[10px] text-neutral-500">Board-level governance</div>
        <div className="absolute bottom-3 left-3 text-[10px] text-neutral-500">Insufficient governance</div>
        <div className="absolute bottom-3 right-3 text-[10px] text-neutral-500">Production scaled</div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-neutral-500">Experimenting</div>
        {quadrants.map((record, index) => {
          const isActive = activeTicker === record.ticker;
          const jitterX = ((index % 7) - 3) * 6;
          const jitterY = ((Math.floor(index / 7) % 5) - 2) * 6;
          return (
            <div
              key={record.ticker}
              className={clsx(
                'absolute flex items-center justify-center rounded-full border text-[10px] font-bold shadow-sm transition',
                isActive
                  ? 'z-20 h-7 w-12 border-emerald-200 bg-emerald-300 text-black'
                  : 'h-3 w-3 border-white/20 bg-neutral-500/70 text-transparent hover:border-emerald-300/50 hover:bg-emerald-300',
              )}
              style={{
                ...position(record),
                transform: `translate(calc(-50% + ${jitterX}px), calc(-50% + ${jitterY}px))`,
              }}
              title={`${record.ticker}: ${DEPLOYMENT_LABELS[record.deployment_stage]} / ${GOVERNANCE_LABELS[record.governance_maturity]}`}
            >
              {isActive ? record.ticker : <span className="sr-only">{record.ticker}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
