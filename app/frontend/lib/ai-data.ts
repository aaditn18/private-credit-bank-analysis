import scoresJson from '@/public/data/ai/ai_scores.json';
import factorBarsJson from '@/public/data/ai/ai_factor_bars.json';
import evidenceJson from '@/public/data/ai/ai_evidence.json';
import quadrantsJson from '@/public/data/ai/ai_quadrants.json';
import timelineJson from '@/public/data/ai/ai_timeline.json';
import methodologyJson from '@/public/data/ai/ai_methodology.json';
import type {
  AIBankBundle,
  AIDeploymentStage,
  AIEvidenceRecord,
  AIFactorBarsRecord,
  AIJsonEnvelope,
  AIMethodology,
  AIQuadrantRecord,
  AIScoreRecord,
  AITimelineRecord,
} from '@/lib/ai-types';

export const aiScores = scoresJson as AIJsonEnvelope<AIScoreRecord>;
export const aiFactorBars = factorBarsJson as AIJsonEnvelope<AIFactorBarsRecord>;
export const aiEvidence = evidenceJson as AIJsonEnvelope<AIEvidenceRecord>;
export const aiQuadrants = quadrantsJson as AIJsonEnvelope<AIQuadrantRecord>;
export const aiTimeline = timelineJson as AIJsonEnvelope<AITimelineRecord>;
export const aiMethodology = methodologyJson as AIMethodology;

const evidenceById = new Map(aiEvidence.records.map((record) => [record.evidence_id, record]));
const barsByTicker = new Map(aiFactorBars.records.map((record) => [record.ticker, record]));
const quadrantByTicker = new Map(aiQuadrants.records.map((record) => [record.ticker, record]));
const timelineByTicker = new Map(aiTimeline.records.map((record) => [record.ticker, record]));

function deriveDeploymentStage(
  quadrant: AIQuadrantRecord,
  bars: AIFactorBarsRecord | null,
): AIDeploymentStage {
  if (quadrant.deployment_stage !== 'insufficient_evidence') {
    return quadrant.deployment_stage;
  }

  const strategic = bars?.factors.find((factor) => factor.factor_id === 'strategic_implementation');
  const text = `${quadrant.deployment_justification} ${quadrant.overall_justification}`.toLowerCase();
  const hasEvidence = quadrant.evidence_ids.length > 0;

  const explicitNoDeployment =
    text.includes('no evidence') ||
    text.includes('no explicit evidence') ||
    text.includes('no direct evidence') ||
    text.includes('brief contains no evidence') ||
    text.includes('missing_evidence') ||
    text.includes('not material to our operations') ||
    text.includes('generic') ||
    text.includes('risk-only');

  const scaledSignals = [
    'wide range of material activities',
    'across various business',
    'across core functions',
    'expanded the adoption',
    'enterprise-wide tools',
    'million utilizations',
    'material workflows',
    'uses a variety of machine learning and ai solutions',
    'predictive loan origination',
  ];

  if (
    hasEvidence &&
    !explicitNoDeployment &&
    ((strategic?.evidence_ids.length ?? 0) >= 2 || scaledSignals.some((signal) => text.includes(signal))) &&
    ((strategic?.normalized_value ?? 0) >= 75 || scaledSignals.some((signal) => text.includes(signal)))
  ) {
    return 'production_scaled';
  }

  const pilotSignals = [
    'exploring',
    'experiment',
    'pilot',
    'deploy',
    'implemented',
    'investing in',
    'expects its use to increase',
    'automated decision',
    'scorecards',
    'model governance',
    'machine learning',
    'generative ai',
  ];

  if (
    hasEvidence &&
    !explicitNoDeployment &&
    ((strategic?.evidence_ids.length ?? 0) > 0 || pilotSignals.some((signal) => text.includes(signal)))
  ) {
    return 'experimenting_piloting';
  }

  return 'insufficient_evidence';
}

function quadrantName(deploymentStage: AIDeploymentStage, governanceMaturity: AIQuadrantRecord['governance_maturity']): string {
  if (deploymentStage === 'insufficient_evidence' && governanceMaturity === 'insufficient_evidence') {
    return 'insufficient_evidence';
  }
  return `${deploymentStage}_${governanceMaturity}`;
}

function normalizeQuadrant(
  quadrant: AIQuadrantRecord | null,
  bars: AIFactorBarsRecord | null,
): AIQuadrantRecord | null {
  if (!quadrant) return null;
  const deploymentStage = deriveDeploymentStage(quadrant, bars);
  return {
    ...quadrant,
    deployment_stage: deploymentStage,
    quadrant: quadrantName(deploymentStage, quadrant.governance_maturity),
  };
}

function uniqueEvidence(ids: string[], limit: number): AIEvidenceRecord[] {
  const seen = new Set<string>();
  const records: AIEvidenceRecord[] = [];

  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const record = evidenceById.get(id);
    if (record) records.push(record);
    if (records.length >= limit) break;
  }

  return records;
}

function evidenceIdsForBundle(
  score: AIScoreRecord,
  bars: AIFactorBarsRecord | null,
  quadrant: AIQuadrantRecord | null,
  timeline: AITimelineRecord | null,
): string[] {
  const factorIds =
    bars?.factors
      .toSorted((a, b) => (b.peer_percentile ?? 0) - (a.peer_percentile ?? 0))
      .flatMap((factor) => factor.evidence_ids.slice(0, 2)) ?? [];

  const recentTimelineIds =
    timeline?.quarters
      .toReversed()
      .filter((quarter) => quarter.disclosure_posture !== 'absent')
      .flatMap((quarter) => quarter.evidence_ids.slice(0, 2)) ?? [];

  return [
    ...(quadrant?.evidence_ids ?? []),
    ...factorIds,
    ...recentTimelineIds,
    ...score.evidence_ids.slice(0, 4),
  ];
}

export function getAIBankBundles(): AIBankBundle[] {
  return aiScores.records
    .map((score) => {
      const bars = barsByTicker.get(score.ticker) ?? null;
      const quadrant = normalizeQuadrant(quadrantByTicker.get(score.ticker) ?? null, bars);
      const timeline = timelineByTicker.get(score.ticker) ?? null;
      return {
        score,
        bars,
        quadrant,
        timeline,
        topEvidence: uniqueEvidence(evidenceIdsForBundle(score, bars, quadrant, timeline), 10),
      };
    })
    .toSorted((a, b) => {
      const aMax = Math.max(...(a.bars?.factors.map((factor) => factor.peer_percentile ?? 0) ?? [0]));
      const bMax = Math.max(...(b.bars?.factors.map((factor) => factor.peer_percentile ?? 0) ?? [0]));
      return bMax - aMax || a.score.ticker.localeCompare(b.score.ticker);
    });
}

export function getAIBundle(ticker: string): AIBankBundle | null {
  const normalized = ticker.toUpperCase();
  return getAIBankBundles().find((bundle) => bundle.score.ticker === normalized) ?? null;
}
