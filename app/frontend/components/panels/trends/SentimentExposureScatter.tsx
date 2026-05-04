'use client';

// 2D map: every bank as a dot, X = NBFI loan ratio (their actual exposure),
// Y = LLM-extracted involvement_rating (the strategic-narrative read on how
// engaged they are). Color = sentiment from pc_findings.json. Outline = peer
// group.
//
// Why this combination: rankings show level, trends show movement, but the
// sentiment×exposure intersection answers something neither can — "are
// banks talking the way their actual book suggests?". Top-right dots that
// are red ("cautious") are the disclosure-drift candidates (heavy book +
// hedged language). Top-right green dots are the unapologetically-large
// players. Bottom-left mass is the not-engaged universe.

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
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: '#10b981',  // emerald
  cautious: '#f59e0b',  // amber
  neutral:  '#6b7280',  // grey
  negative: '#dc2626',  // red (rare in current data)
};

const PEER_LABEL: Record<string, string> = {
  GSIB:       'GSIB',
  'trust-ib': 'Trust / IB',
  regional:   'Regional',
};

interface ScatterDatum {
  ticker: string;
  x: number;       // NBFI loan ratio (actual exposure level)
  y: number;       // involvement rating (1..5, narrative engagement)
  z: number;       // dot size — driven by rating
  sentiment: string;
  peer_group: string;
  raw_nbfi: number;
  raw_rating: number;
}

interface Props {
  banks: Bank[];
  findings: Record<string, Finding>;
  rankingsBanks: RankingsBank[];
}

export function SentimentExposureScatter({ banks, findings, rankingsBanks }: Props) {
  const data: ScatterDatum[] = useMemo(() => {
    const peerByTicker: Record<string, string> = {};
    for (const b of banks) peerByTicker[b.ticker] = b.peer_group;
    const nbfiByTicker: Record<string, number | null> = {};
    for (const b of rankingsBanks || []) nbfiByTicker[b.ticker] = b.raw?.nbfi_loan_ratio ?? null;

    const out: ScatterDatum[] = [];
    for (const f of Object.values(findings || {})) {
      const ticker = String(f.bank_ticker ?? '');
      const inv = Number(f.involvement_rating ?? 0);
      const nbfi = nbfiByTicker[ticker];
      if (!ticker || !inv || nbfi == null) continue;
      out.push({
        ticker,
        x: nbfi,
        y: inv,
        z: Math.max(60, Number(f.rating ?? 1) * 60),
        sentiment: (f.sentiment ?? 'neutral').toLowerCase(),
        peer_group: peerByTicker[ticker] ?? 'regional',
        raw_nbfi: nbfi,
        raw_rating: Number(f.rating ?? 0),
      });
    }
    return out;
  }, [banks, findings, rankingsBanks]);

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
          X-axis: actual NBFI loan ratio (level). Y-axis: LLM involvement
          rating (narrative engagement). Color: sentiment of the bank's
          private-credit prose. Top-right with cautious / amber color =
          disclosure drift candidates (heavy book paired with hedged
          language). Top-right green = unapologetic full-throttle players.
        </p>
      </div>
      <div className="p-6">
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 16 }}>
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
                value: 'Involvement (1=barely engaged, 5=primary focus)',
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
                      Involvement: {d.y} · LLM rating: {d.raw_rating}
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
                fillOpacity={0.78}
                stroke="#ffffff"
                strokeWidth={1.25}
              >
                <LabelList
                  dataKey="ticker"
                  position="top"
                  style={{ fontSize: 9, fill: '#404040', fontWeight: 600 }}
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
            {data.length} of {banks.length} banks shown · banks with no
            involvement rating omitted
          </span>
        </div>
      </div>
    </section>
  );
}
