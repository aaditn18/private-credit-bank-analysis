'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AIFactorBarsRecord,
  AIJsonEnvelope,
  AIQuadrantRecord,
  AIScoreRecord,
} from '@/lib/ai-types';
import {
  ConfidenceBadge,
  DEPLOYMENT_LABELS,
  EmptyAIState,
  FactorBars,
  GOVERNANCE_LABELS,
} from '@/components/ai/AIShared';

interface StaticAIData {
  scores: AIScoreRecord[];
  factorBars: AIFactorBarsRecord[];
  quadrants: AIQuadrantRecord[];
}

async function loadStaticAIData(): Promise<StaticAIData> {
  const [scores, factorBars, quadrants] = await Promise.all([
    fetch('/data/ai/ai_scores.json').then((res) => res.json() as Promise<AIJsonEnvelope<AIScoreRecord>>),
    fetch('/data/ai/ai_factor_bars.json').then((res) => res.json() as Promise<AIJsonEnvelope<AIFactorBarsRecord>>),
    fetch('/data/ai/ai_quadrants.json').then((res) => res.json() as Promise<AIJsonEnvelope<AIQuadrantRecord>>),
  ]);

  return {
    scores: scores.records,
    factorBars: factorBars.records,
    quadrants: quadrants.records,
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
    return { score, bars, quadrant };
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
      <div className="space-y-4 p-6">
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

        {profile.bars ? (
          <FactorBars factors={profile.bars.factors} showEvidenceButtons={false} />
        ) : (
          <EmptyAIState message="No factor bars are available for this bank." />
        )}
      </div>
    </section>
  );
}
