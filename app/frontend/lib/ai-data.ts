import scoresJson from '@/public/data/ai/ai_scores.json';
import factorBarsJson from '@/public/data/ai/ai_factor_bars.json';
import evidenceJson from '@/public/data/ai/ai_evidence.json';
import quadrantsJson from '@/public/data/ai/ai_quadrants.json';
import timelineJson from '@/public/data/ai/ai_timeline.json';
import methodologyJson from '@/public/data/ai/ai_methodology.json';
import type {
  AIBankBundle,
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

export function getAIEvidenceByIds(ids: string[]): AIEvidenceRecord[] {
  return uniqueEvidence(ids, Number.POSITIVE_INFINITY);
}

function evidenceIdsForBundle(
  score: AIScoreRecord,
  bars: AIFactorBarsRecord | null,
  quadrant: AIQuadrantRecord | null,
  timeline: AITimelineRecord | null,
): string[] {
  const factorIds =
    bars?.factors
      .slice()
      .sort((a, b) => (b.peer_percentile ?? 0) - (a.peer_percentile ?? 0))
      .flatMap((factor) => factor.evidence_ids.slice(0, 2)) ?? [];

  const recentTimelineIds =
    timeline?.quarters
      .slice()
      .reverse()
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
      const quadrant = quadrantByTicker.get(score.ticker) ?? null;
      const timeline = timelineByTicker.get(score.ticker) ?? null;
      return {
        score,
        bars,
        quadrant,
        timeline,
        topEvidence: uniqueEvidence(evidenceIdsForBundle(score, bars, quadrant, timeline), 10),
      };
    })
    .sort((a, b) => {
      const aMax = Math.max(...(a.bars?.factors.map((factor) => factor.peer_percentile ?? 0) ?? [0]));
      const bMax = Math.max(...(b.bars?.factors.map((factor) => factor.peer_percentile ?? 0) ?? [0]));
      return bMax - aMax || a.score.ticker.localeCompare(b.score.ticker);
    });
}

export function getAIBundle(ticker: string): AIBankBundle | null {
  const normalized = ticker.toUpperCase();
  return getAIBankBundles().find((bundle) => bundle.score.ticker === normalized) ?? null;
}
