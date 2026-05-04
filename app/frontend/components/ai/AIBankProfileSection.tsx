'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AIEvidenceRecord,
  AIFactorBarsRecord,
  AIJsonEnvelope,
  AIQuadrantRecord,
  AIScoreRecord,
  AITimelineRecord,
} from '@/lib/ai-types';
import {
  ConfidenceBadge,
  DEPLOYMENT_LABELS,
  EmptyAIState,
  EvidenceList,
  FactorBars,
  GOVERNANCE_LABELS,
  POSTURE_LABELS,
} from '@/components/ai/AIShared';

interface StaticAIData {
  scores: AIScoreRecord[];
  factorBars: AIFactorBarsRecord[];
  evidence: AIEvidenceRecord[];
  quadrants: AIQuadrantRecord[];
  timeline: AITimelineRecord[];
}

async function loadStaticAIData(): Promise<StaticAIData> {
  const [scores, factorBars, evidence, quadrants, timeline] = await Promise.all([
    fetch('/data/ai/ai_scores.json').then((res) => res.json() as Promise<AIJsonEnvelope<AIScoreRecord>>),
    fetch('/data/ai/ai_factor_bars.json').then((res) => res.json() as Promise<AIJsonEnvelope<AIFactorBarsRecord>>),
    fetch('/data/ai/ai_evidence.json').then((res) => res.json() as Promise<AIJsonEnvelope<AIEvidenceRecord>>),
    fetch('/data/ai/ai_quadrants.json').then((res) => res.json() as Promise<AIJsonEnvelope<AIQuadrantRecord>>),
    fetch('/data/ai/ai_timeline.json').then((res) => res.json() as Promise<AIJsonEnvelope<AITimelineRecord>>),
  ]);

  return {
    scores: scores.records,
    factorBars: factorBars.records,
    evidence: evidence.records,
    quadrants: quadrants.records,
    timeline: timeline.records,
  };
}

export function AIBankProfileSection({ ticker }: { ticker: string }) {
  const normalizedTicker = ticker.toUpperCase();
  const [data, setData] = useState<StaticAIData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadStaticAIData()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const profile = useMemo(() => {
    if (!data) return null;
    const score = data.scores.find((record) => record.ticker === normalizedTicker) ?? null;
    const bars = data.factorBars.find((record) => record.ticker === normalizedTicker) ?? null;
    const quadrant = data.quadrants.find((record) => record.ticker === normalizedTicker) ?? null;
    const timeline = data.timeline.find((record) => record.ticker === normalizedTicker) ?? null;
    const evidenceById = new Map(data.evidence.map((record) => [record.evidence_id, record]));
    const ids = [
      ...(quadrant?.evidence_ids ?? []),
      ...(bars?.factors.flatMap((factor) => factor.evidence_ids.slice(0, 1)) ?? []),
      ...(timeline?.quarters.slice().reverse().flatMap((quarter) => quarter.evidence_ids.slice(0, 1)) ?? []),
    ];
    const evidence = Array.from(new Set(ids))
      .map((id) => evidenceById.get(id))
      .filter((record): record is AIEvidenceRecord => Boolean(record))
      .slice(0, 5);
    return { score, bars, quadrant, timeline, evidence };
  }, [data, normalizedTicker]);

  if (error) {
    return <EmptyAIState message={`AI evidence data could not be loaded: ${error}`} />;
  }

  if (!data) {
    return (
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-44 animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-24 animate-pulse rounded bg-neutral-100" />
      </section>
    );
  }

  if (!profile?.score) {
    return <EmptyAIState message={`No AI evidence output is available for ${normalizedTicker}.`} />;
  }

  const latestPosture = profile.timeline?.quarters.slice().reverse().find((quarter) => quarter.disclosure_posture !== 'absent');

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">AI Evidence Posture</h3>
            <p className="mt-0.5 text-xs text-neutral-400">
              Evidence-linked AI posture. High AI involvement is not automatically high AI risk.
            </p>
          </div>
          <ConfidenceBadge confidence={profile.score.confidence} />
        </div>
      </div>
      <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-100 bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">Deployment</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {profile.quadrant ? DEPLOYMENT_LABELS[profile.quadrant.deployment_stage] : 'Missing'}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-100 bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">Governance</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {profile.quadrant ? GOVERNANCE_LABELS[profile.quadrant.governance_maturity] : 'Missing'}
              </p>
            </div>
          </div>

          {latestPosture && (
            <div className="rounded-lg border border-neutral-100 bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">Latest non-absent disclosure posture</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {latestPosture.period}: {POSTURE_LABELS[latestPosture.disclosure_posture]}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">{latestPosture.posture_reason}</p>
            </div>
          )}

          {profile.bars ? (
            <FactorBars factors={profile.bars.factors} />
          ) : (
            <EmptyAIState message="No factor bars are available for this bank." />
          )}
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-neutral-900">Referenced evidence</h4>
          <EvidenceList evidence={profile.evidence} />
        </div>
      </div>
    </section>
  );
}
