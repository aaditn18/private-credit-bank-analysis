'use client';

// 2D map: every bank as a dot, X = NBFI loan ratio (actual exposure level),
// Y = composite involvement rating (6-metric quantitative score, same weights
//     as Rankings page — NOT the LLM's narrative read),
// Color = blended sentiment (LLM prose sentiment + QoQ book direction).
//
// Why this combination: rankings show level, trends show movement, but the
// sentiment×exposure intersection answers something neither can — "are
// banks talking the way their actual book suggests?". Top-right dots that
// are amber ("cautious") are disclosure-drift candidates (heavy book +
// hedged language or contracting). Top-right green = unapologetically-large
// players whose book is growing. Bottom-left mass is the not-engaged universe.
//
// Composite involvement is grounded in Call Report data (NBFI ratio 35%,
// NBFI commitment 25%, NBFI growth 15%, C&I ratio 10%, PE exposure 10%,
// loan scale 5%). NBFI growth is in the composite so banks that pull back
// hard (e.g. SF -65% QoQ) get demoted automatically. Sentiment blending
// ensures a bank expanding its book but using cautious language still shows
// as cautious (disclosure drift), and vice versa.

import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts';

interface Bank {
  ticker: string;
  peer_group: string;
}

interface Finding {
  bank_ticker?: string;
  sentiment?: string | null;
  rating?: number | null;
  involvement_rating?: number | null;
}

interface RankingsBank {
  ticker: string;
  raw: Record<string, number | null>;
  norm: Record<string, number>;
}

interface RankingsMetric {
  key: string;
  label: string;
  higher_is_better: boolean;
}

interface QuarterMover {
  ticker: string;
  prev_ratio: number;
  latest_ratio: number;
  change: number;
  direction: 'expanding' | 'contracting';
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: '#10b981',  // emerald
  cautious: '#f59e0b',  // amber
  neutral:  '#6b7280',  // grey
  negative: '#dc2626',  // red
};

const PEER_LABEL: Record<string, string> = {
  GSIB:       'GSIB',
  'trust-ib': 'Trust / IB',
  regional:   'Regional',
};

// Same weights as generate_pc_trajectory_data.py and PCPositioningQuadrant.tsx
const COMPOSITE_WEIGHTS: Record<string, number> = {
  nbfi_loan_ratio:       35,
  nbfi_commitment_ratio: 25,
  nbfi_growth:           15,
  ci_ratio:              10,
  pe_exposure:           10,
  loan_scale:             5,
};

function compositeScore(
  normValues: Record<string, number>,
  metrics: RankingsMetric[],
): number {
  let s = 0;
  let totalW = 0;
  for (const m of metrics) {
    const w = COMPOSITE_WEIGHTS[m.key];
    if (!w) continue;
    const v = normValues[m.key];
    if (v == null) continue;
    const adjusted = m.higher_is_better ? v : 1.0 - v;
    s += (w / 100) * adjusted;
    totalW += w / 100;
  }
  return totalW > 0 ? s / totalW : 0;
}

function quintileRating(score: number, allScores: number[]): number {
  if (allScores.length === 0) return 0;
  const sorted = [...allScores].sort((a, b) => a - b);
  const n = sorted.length;
  const rankBelow = sorted.filter((s) => s < score).length;
  const pct = rankBelow / Math.max(n - 1, 1);
  if (pct < 0.20) return 1;
  if (pct < 0.40) return 2;
  if (pct < 0.60) return 3;
  if (pct < 0.80) return 4;
  return 5;
}

/** Blend LLM narrative sentiment with QoQ book direction.
 *
 * Rules:
 * - LLM cautious/negative AND contracting → negative
 * - LLM cautious AND expanding  → cautious  (disclosure drift: hedged language but growing)
 * - LLM positive   AND contracting → cautious  (talking up but pulling back)
 * - LLM positive   AND expanding  → positive  (walk matches talk)
 * - LLM neutral    AND expanding  → positive  (actions speak louder)
 * - LLM neutral    AND contracting → cautious
 * - No QoQ data / stable          → keep LLM sentiment as-is
 */
function blendSentiment(
  llmSentiment: string,
  qoq: QuarterMover | undefined,
): string {
  if (!qoq) return llmSentiment;

  const relChange = qoq.prev_ratio > 0
    ? (qoq.latest_ratio - qoq.prev_ratio) / qoq.prev_ratio
    : 0;
  const isExpanding = relChange >= 0.03;
  const isContracting = relChange <= -0.03;

  if (!isExpanding && !isContracting) return llmSentiment; // stable → keep LLM

  if (llmSentiment === 'negative' && isContracting) return 'negative';
  if (llmSentiment === 'cautious' && isContracting) return 'negative';
  if (llmSentiment === 'cautious' && isExpanding) return 'cautious';
  if (llmSentiment === 'positive' && isContracting) return 'cautious';
  if (llmSentiment === 'positive' && isExpanding) return 'positive';
  if (llmSentiment === 'neutral' && isExpanding) return 'positive';
  if (llmSentiment === 'neutral' && isContracting) return 'cautious';

  return llmSentiment;
}

interface ScatterDatum {
  ticker: string;
  x: number;       // NBFI loan ratio (actual exposure level)
  y: number;       // continuous composite mapped to 1..5 scale
  z: number;       // dot size
  rating: number;  // integer quintile rating 1-5 (for tooltip)
  sentiment: string;       // blended sentiment
  llm_sentiment: string;   // original LLM sentiment (for tooltip)
  qoq_direction: string;   // QoQ direction (for tooltip)
  qoq_change_pct: string;  // formatted relative change
  peer_group: string;
  raw_nbfi: number;
  composite: number;       // raw 0..1 composite score
}

interface Props {
  banks: Bank[];
  findings: Record<string, Finding>;
  rankingsBanks: RankingsBank[];
  metrics: RankingsMetric[];
  quarterMovers: QuarterMover[];
}

export function SentimentExposureScatter({ banks, findings, rankingsBanks, metrics, quarterMovers }: Props) {
  const data: ScatterDatum[] = useMemo(() => {
    const peerByTicker: Record<string, string> = {};
    for (const b of banks) peerByTicker[b.ticker] = b.peer_group;

    const qoqByTicker: Record<string, QuarterMover> = {};
    for (const m of quarterMovers || []) qoqByTicker[m.ticker] = m;

    // Compute composite scores for all banks in rankings
    const composites: Record<string, number> = {};
    for (const rb of rankingsBanks || []) {
      composites[rb.ticker] = compositeScore(rb.norm || {}, metrics);
    }
    const allScores = Object.values(composites);

    const out: ScatterDatum[] = [];
    for (const rb of rankingsBanks || []) {
      const ticker = rb.ticker;
      const nbfi = rb.raw?.nbfi_loan_ratio;
      if (nbfi == null) continue;

      const comp = composites[ticker] ?? 0;
      const rating = quintileRating(comp, allScores);
      if (rating === 0) continue;

      const finding = findings?.[ticker];
      const llmSentiment = (finding?.sentiment ?? 'neutral').toLowerCase();
      const qoq = qoqByTicker[ticker];
      const blended = blendSentiment(llmSentiment, qoq);

      let qoqDir = 'no data';
      let qoqPct = '--';
      if (qoq && qoq.prev_ratio > 0) {
        const rel = (qoq.latest_ratio - qoq.prev_ratio) / qoq.prev_ratio;
        qoqDir = qoq.direction;
        qoqPct = `${(rel * 100).toFixed(1)}%`;
      }

      // Map composite (0..1) to a continuous 1..5 scale so every bank
      // gets a unique Y position. The integer quintile is kept for the tooltip.
      const continuousY = 1 + comp * 4;

      out.push({
        ticker,
        x: nbfi,
        y: continuousY,
        z: Math.max(60, rating * 60),
        rating,
        sentiment: blended,
        llm_sentiment: llmSentiment,
        qoq_direction: qoqDir,
        qoq_change_pct: qoqPct,
        peer_group: peerByTicker[ticker] ?? 'regional',
        raw_nbfi: nbfi,
        composite: comp,
      });
    }

    return out;
  }, [banks, findings, rankingsBanks, metrics, quarterMovers]);

  // Bucket by sentiment so legend + render order are stable.
  const bySentiment = useMemo(() => {
    const groups: Record<string, ScatterDatum[]> = {
      positive: [],
      cautious: [],
      neutral:  [],
      negative: [],
    };
    for (const d of data) {
      (groups[d.sentiment] || groups.neutral).push(d);
    }
    return groups;
  }, [data]);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-100">
        <h3 className="font-semibold text-neutral-900 text-base">
          Sentiment × NBFI Exposure — Where Talk and Book Meet
        </h3>
        <p className="text-xs text-neutral-400 mt-0.5">
          X-axis: actual NBFI loan ratio (level). Y-axis: composite
          involvement rating (6-metric quantitative score, same weights as
          Rankings page). Color: blended sentiment (LLM prose tone + QoQ
          book direction). Top-right amber = disclosure drift candidates
          (heavy book paired with hedged language or contraction).
          Top-right green = unapologetic full-throttle players.
        </p>
      </div>
      <div className="p-6">
        <ResponsiveContainer width="100%" height={600}>
          <ScatterChart margin={{ top: 40, right: 32, left: 0, bottom: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              type="number"
              dataKey="x"
              name="NBFI ratio"
              tick={{ fontSize: 11, fill: '#737373' }}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              label={{
                value: 'NBFI loan ratio (level) →',
                position: 'insideBottom',
                offset: -4,
                style: { fontSize: 11, fill: '#737373' },
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Involvement rating"
              domain={[0.5, 5.5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fontSize: 11, fill: '#737373' }}
              label={{
                value: 'PC Composite Score (1=negligible → 5=central)',
                angle: -90,
                position: 'insideLeft',
                offset: 12,
                style: { fontSize: 11, fill: '#737373' },
              }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload as ScatterDatum;
                return (
                  <div className="bg-white border border-neutral-200 rounded-lg p-2.5 shadow-md text-xs">
                    <div className="font-mono font-semibold text-neutral-900">
                      {d.ticker}
                      <span className="ml-2 text-[10px] text-neutral-500 font-normal">
                        {PEER_LABEL[d.peer_group] || d.peer_group}
                      </span>
                    </div>
                    <div className="mt-1 text-neutral-600">
                      NBFI ratio: {(d.raw_nbfi * 100).toFixed(2)}%
                    </div>
                    <div className="text-neutral-600">
                      Composite: {(d.composite * 100).toFixed(1)}% → rating {d.rating}/5
                    </div>
                    <div className="text-neutral-600">
                      QoQ: {d.qoq_direction} ({d.qoq_change_pct})
                    </div>
                    <div className="text-neutral-500 mt-1">
                      LLM prose: {d.llm_sentiment} · blended: <span
                        className="font-medium"
                        style={{ color: SENTIMENT_COLOR[d.sentiment] || '#6b7280' }}
                      >{d.sentiment}</span>
                    </div>
                  </div>
                );
              }}
            />
            {(['positive', 'cautious', 'neutral', 'negative'] as const).map((sentiment) => (
              <Scatter
                key={sentiment}
                name={sentiment}
                data={bySentiment[sentiment] || []}
                fill={SENTIMENT_COLOR[sentiment]}
                fillOpacity={0.78}
                stroke="#ffffff"
                strokeWidth={1.25}
              >
                <LabelList
                  dataKey="ticker"
                  position="top"
                  content={(props) => {
                    const px = Number(props.x ?? 0);
                    const py = Number(props.y ?? 0);
                    const val = props.value;
                    if (!val) return null;
                    const ly = py - 12;
                    return (
                      <text
                        key={String(val)}
                        x={px}
                        y={ly}
                        fontSize={7.5}
                        fill="#404040"
                        fontWeight={600}
                        textAnchor="start"
                        transform={`rotate(-70, ${px}, ${ly})`}
                      >
                        {String(val)}
                      </text>
                    );
                  }}
                />
                {(bySentiment[sentiment] || []).map((d, i) => (
                  <Cell key={i} fill={SENTIMENT_COLOR[d.sentiment]} fillOpacity={0.78} />
                ))}
              </Scatter>
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        {/* Legend strip */}
        <div className="flex items-center gap-4 mt-3 text-[11px] text-neutral-500 flex-wrap">
          <span className="font-semibold text-neutral-700">Blended sentiment:</span>
          {(['positive', 'cautious', 'neutral', 'negative'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: SENTIMENT_COLOR[s] }}
              />
              {s}
            </span>
          ))}
          <span className="ml-3 text-neutral-400">
            {data.length} of {banks.length} banks · LLM prose + QoQ direction
          </span>
        </div>
      </div>
    </section>
  );
}
