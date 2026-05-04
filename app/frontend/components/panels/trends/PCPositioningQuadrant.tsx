'use client';

// Single 2D map of every bank's private-credit posture.
//
//   X-axis = PC composite score (0..1)
//            Same composite the Rankings page computes — weighted average of
//            the 6 normalized metrics under default weights
//            (35% NBFI loan ratio, 25% NBFI commitment, 15% NBFI growth,
//            10% C&I, 10% PE, 5% scale). Higher = more PC-engaged.
//
//   Y-axis = Strategic Direction (signed % QoQ NBFI loan ratio change)
//            Above 0 = expanding (growing PC book quarter-over-quarter)
//            Below 0 = pulling back (NBFI ratio shrinking)
//            Source: pc_rankings.banks[].raw.nbfi_growth.
//
//   Bubble size = NBFI book in $B
//            = exp(loan_scale) × nbfi_loan_ratio (then ÷ 1e6 → billions)
//            Bigger bubble = more dollars at work in PC. Falls back to
//            total loan book if NBFI ratio is missing.
//
//   Bubble color = sentiment from pc_findings.json
//            LLM-extracted (Gemini) per bank by reading the actual SEC
//            filings + earnings transcripts. Not a hardcoded analyst map —
//            this is a real disclosure-derived signal:
//              positive (emerald)  – bank's prose is clearly bullish on PC
//              cautious (amber)    – bank's prose hedges / flags risks
//              neutral  (grey)     – PC barely discussed or strictly factual
//              negative (red)      – outright pullback language (rare)
//
// The four quadrants tell distinct stories:
//   Top-right    high score + expanding   → leaning in at scale (e.g. JPM, BAC)
//   Top-left     low score + expanding    → smaller players ramping up
//   Bottom-right high score + pulling back → established but contracting (GS)
//   Bottom-left  low score + pulling back  → small + receding

import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts';

interface MetricDef {
  key: string;
  label: string;
  higher_is_better: boolean;
}
interface RankingsBank {
  ticker: string;
  name: string;
  peer_group: string;
  raw: Record<string, number | null>;
  norm: Record<string, number>;
}
interface RankingsResponse {
  quarter: string;
  metrics: MetricDef[];
  banks: RankingsBank[];
}

interface Finding {
  bank_ticker?: string;
  sentiment?: string | null;
}

// Default weights — must match RankingsPanel.tsx and ComparePanel.tsx
// composite-rank tile so the X-axis here is byte-identical to the score
// users see elsewhere.
const DEFAULT_WEIGHTS: Record<string, number> = {
  nbfi_loan_ratio:       35,
  nbfi_commitment_ratio: 25,
  nbfi_growth:           15,
  ci_ratio:              10,
  pe_exposure:           10,
  loan_scale:            5,
};

const SENTIMENT_COLOR: Record<string, string> = {
  positive: '#10b981', // emerald
  cautious: '#f59e0b', // amber
  neutral:  '#9ca3af', // grey
  negative: '#dc2626', // red
};

const PEER_LABEL: Record<string, string> = {
  GSIB:       'GSIB',
  'trust-ib': 'Trust / IB',
  regional:   'Regional',
};

interface ScatterDatum {
  ticker: string;
  name: string;
  peer_group: string;
  x: number;            // composite score 0..1
  y: number;            // signed QoQ growth ratio
  z: number;            // NBFI book size in $B (or fallback to loan book in $B)
  sentiment: string;
  raw_score: number;
  raw_growth: number;
  raw_nbfi_book_b: number;
}

interface Props {
  rankings: RankingsResponse;
  findings: Record<string, Finding>;
}

function compositeScore(bank: RankingsBank, metrics: MetricDef[]): number {
  let s = 0;
  let totalW = 0;
  for (const m of metrics) {
    const w = DEFAULT_WEIGHTS[m.key];
    if (!w) continue;
    const norm = bank.norm[m.key];
    if (norm == null || !Number.isFinite(norm)) continue;
    const adjusted = m.higher_is_better ? norm : 1 - norm;
    s += (w / 100) * adjusted;
    totalW += w / 100;
  }
  return totalW > 0 ? s / totalW : 0;
}

export function PCPositioningQuadrant({ rankings, findings }: Props) {
  const data: ScatterDatum[] = useMemo(() => {
    const out: ScatterDatum[] = [];
    for (const b of rankings.banks) {
      const score = compositeScore(b, rankings.metrics);
      const growth = b.raw.nbfi_growth;
      if (growth == null || !Number.isFinite(growth)) continue;
      // NBFI book $B = exp(loan_scale_log) * nbfi_loan_ratio / 1e6
      const ls = b.raw.loan_scale;
      const ratio = b.raw.nbfi_loan_ratio;
      let bookB = 0;
      if (ls != null) {
        const totalThousands = Math.exp(ls);
        bookB = ratio != null
          ? (totalThousands * ratio) / 1_000_000
          : totalThousands / 1_000_000; // fallback to total loan book size in $B
      }
      // Recharts ZAxis sizing benefits from a non-zero floor.
      const zSize = Math.max(0.5, bookB);
      const sentiment = (
        findings?.[b.ticker]?.sentiment || 'neutral'
      ).toLowerCase();
      out.push({
        ticker: b.ticker,
        name: b.name,
        peer_group: b.peer_group,
        x: score,
        y: growth,
        z: zSize,
        sentiment,
        raw_score: score,
        raw_growth: growth,
        raw_nbfi_book_b: bookB,
      });
    }
    return out;
  }, [rankings, findings]);

  // Group data by sentiment so legend stays stable and rendering order is deterministic.
  const bySentiment = useMemo(() => {
    const groups: Record<string, ScatterDatum[]> = {
      positive: [],
      cautious: [],
      neutral:  [],
      negative: [],
    };
    for (const d of data) (groups[d.sentiment] || groups.neutral).push(d);
    return groups;
  }, [data]);

  // Y-axis padding so the smallest bubbles aren't pinned to the edge.
  const [yMin, yMax] = useMemo(() => {
    const ys = data.map((d) => d.y);
    if (!ys.length) return [-0.1, 0.1];
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const pad = Math.max(Math.abs(lo), Math.abs(hi)) * 0.15 || 0.02;
    return [lo - pad, hi + pad];
  }, [data]);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-100">
        <h3 className="font-semibold text-neutral-900 text-base">
          Private Credit Positioning Quadrant
        </h3>
        <p className="text-xs text-neutral-400 mt-0.5">
          X = composite PC score (0..1, default weights · same score the
          Rankings page sorts on). Y = QoQ change in NBFI loan ratio (+
          expanding / − pulling back). Bubble size = NBFI book in $B (i.e.
          dollars actually at work in PC). Bubble color = LLM-extracted
          sentiment from each bank&apos;s SEC filings and earnings
          transcripts (not a hand-coded label).
        </p>
      </div>
      <div className="p-6">
        <ResponsiveContainer width="100%" height={520}>
          <ScatterChart margin={{ top: 24, right: 32, left: 0, bottom: 32 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              type="number"
              dataKey="x"
              name="Composite score"
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tick={{ fontSize: 11, fill: '#737373' }}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}`}
              label={{
                value: 'PC composite score (0–100) →',
                position: 'insideBottom',
                offset: -8,
                style: { fontSize: 11, fill: '#737373' },
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Strategic direction"
              domain={[yMin, yMax]}
              tick={{ fontSize: 11, fill: '#737373' }}
              tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`}
              label={{
                value: 'Strategic direction (QoQ NBFI ratio Δ)',
                angle: -90,
                position: 'insideLeft',
                offset: 12,
                style: { fontSize: 11, fill: '#737373' },
              }}
            />
            <ZAxis dataKey="z" range={[60, 1200]} name="NBFI book $B" />
            {/* Quadrant boundary at y=0 */}
            <ReferenceLine y={0} stroke="#a3a3a3" strokeDasharray="4 4" />
            {/* Score-midline at x=0.5 to anchor the four quadrants */}
            <ReferenceLine x={0.5} stroke="#e5e5e5" strokeDasharray="2 4" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload as ScatterDatum;
                return (
                  <div className="bg-white border border-neutral-200 rounded-lg p-2.5 shadow-md text-xs max-w-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-neutral-900">
                        {d.ticker}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        {PEER_LABEL[d.peer_group] || d.peer_group}
                      </span>
                    </div>
                    <div className="mt-1 text-neutral-600">
                      Composite score: {(d.raw_score * 100).toFixed(0)} / 100
                    </div>
                    <div className="text-neutral-600">
                      QoQ change:{' '}
                      <span className={d.raw_growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {d.raw_growth >= 0 ? '+' : ''}{(d.raw_growth * 100).toFixed(2)}%
                      </span>{' '}
                      NBFI ratio
                    </div>
                    <div className="text-neutral-600">
                      NBFI book: ~${d.raw_nbfi_book_b.toFixed(d.raw_nbfi_book_b >= 10 ? 0 : 1)}B
                    </div>
                    <div
                      className="text-[11px] mt-1 italic font-medium"
                      style={{ color: SENTIMENT_COLOR[d.sentiment] || '#6b7280' }}
                    >
                      sentiment: {d.sentiment}
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
                fillOpacity={0.72}
                stroke="#ffffff"
                strokeWidth={1.25}
              >
                <LabelList
                  dataKey="ticker"
                  position="top"
                  style={{ fontSize: 9, fill: '#404040', fontWeight: 600 }}
                />
                {(bySentiment[sentiment] || []).map((d, i) => (
                  <Cell key={i} fill={SENTIMENT_COLOR[d.sentiment]} fillOpacity={0.72} />
                ))}
              </Scatter>
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        {/* Quadrant captions */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-neutral-500">
          <div className="rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2">
            <div className="font-semibold text-neutral-700">↑ → Top-right (high score, expanding)</div>
            Leaning in at scale — established PC franchise still growing the book.
          </div>
          <div className="rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2">
            <div className="font-semibold text-neutral-700">↑ ← Top-left (low score, expanding)</div>
            Smaller players ramping up — PC franchise nascent but trajectory positive.
          </div>
          <div className="rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2">
            <div className="font-semibold text-neutral-700">↓ → Bottom-right (high score, pulling back)</div>
            Established + contracting — the GS / MS pattern (heavy book trimming).
          </div>
          <div className="rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2">
            <div className="font-semibold text-neutral-700">↓ ← Bottom-left (low score, pulling back)</div>
            Small + receding — historically barely engaged, now pulling further back.
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-[11px] text-neutral-500 flex-wrap">
          <span className="font-semibold text-neutral-700">Sentiment:</span>
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
            {data.length} of {rankings.banks.length} banks shown · banks
            without QoQ growth data omitted
          </span>
        </div>
      </div>
    </section>
  );
}
