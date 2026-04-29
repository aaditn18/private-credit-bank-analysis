'use client';

import { useState } from 'react';
import {
  BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TIMELINE, DEVELOPMENTS, SCORES, BANK_NAMES_SORTED,
  clusterColor,
  type TimelineCategory,
} from '@/lib/da-data';

const CATEGORIES: (TimelineCategory | 'All')[] = [
  'All', 'Regulatory', 'Custody', 'Infrastructure', 'Capital Markets', 'Retail',
];

const CATEGORY_COLOR: Record<string, string> = {
  Regulatory:       '#ef4444',
  Custody:          '#3b82f6',
  Infrastructure:   '#10b981',
  'Capital Markets':'#10b981',
  Retail:           '#f59e0b',
};

const STABLECOIN_SCENARIOS = [
  { scenario: 'Now (2026)', value: 237,  color: '#3b82f6' },
  { scenario: 'Base 2030',  value: 1900, color: '#10b981' },
  { scenario: 'Bull 2030',  value: 4000, color: '#f59e0b' },
];

const MARKET_PROJECTIONS = [
  { src: 'JPMorgan',       value: '$5B/day',   label: 'Kinexys daily transaction volume (2026)' },
  { src: 'JPMorgan',       value: '$1.5T+',    label: 'Kinexys cumulative processed since 2020' },
  { src: 'Citi GPS',       value: '$1.9T–$4T', label: 'Stablecoin market size by 2030 (base–bull)' },
  { src: 'Citi GPS',       value: '$5T+',      label: 'Total tokenization market size by 2030' },
  { src: 'BNY Mellon',     value: '80%+',      label: 'Share of US/Canada/EMEA spot crypto ETP fund services' },
  { src: 'River Research', value: '60%',       label: 'Of top 25 US banks now building Bitcoin products (Feb 2026)' },
  { src: 'SVB',            value: '$1.5B+',    label: 'VC investment in stablecoin companies in 2025' },
  { src: 'State Street',   value: '>50%',      label: 'Majority of institutions expect DA exposure to double by 2028' },
];

export function DAMarketPanel() {
  const [catFilter, setCatFilter] = useState<TimelineCategory | 'All'>('All');

  const filteredTimeline = catFilter === 'All'
    ? TIMELINE
    : TIMELINE.filter(t => t.category === catFilter);

  const scatterData = BANK_NAMES_SORTED.map(n => ({
    x: SCORES[n].nlpPeak,
    y: SCORES[n].comp,
    name: SCORES[n].ticker,
    cluster: SCORES[n].cluster,
  }));

  return (
    <div className="space-y-6">

      {/* GENIUS Act root cause */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
        <div className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-1">
          Root Cause · Regulatory Context
        </div>
        <div className="font-semibold text-white mb-2">The GENIUS Act — Root Cause of Q2 2025 Inflection</div>
        <p className="text-sm text-neutral-300 leading-relaxed">
          The GENIUS Act was signed into law{' '}
          <strong className="text-white">July 18, 2025</strong> (Senate 68–30, House 308–122).
          It established the first federal regulatory framework for payment stablecoins: 1:1 reserves,
          mandatory audits, clear bank-subsidiary issuance pathway.{' '}
          <strong className="text-white">9 of 16 banks recorded their peak NLP score in Q2 2025</strong> —
          the GENIUS Act's Senate passage (June 17) generated a wave of analyst stablecoin questions
          in Q2 earnings calls. The inflection is regulatory in origin, not coincidental.
        </p>
      </div>

      {/* Latest Developments */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white">Confirmed Developments Since Q4 2025</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Post-data research conducted April 2026</p>
        </div>
        <div className="divide-y divide-white/5">
          {DEVELOPMENTS.map((d, i) => (
            <div key={i} className="flex gap-3 px-5 py-3 items-start hover:bg-white/[0.02]">
              <div className="font-mono text-[10px] text-neutral-500 w-20 flex-shrink-0 pt-0.5">{d.date}</div>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded flex-shrink-0 mt-0.5"
                style={{ background: `${d.color}20`, color: d.color }}
              >
                {d.bank}
              </span>
              <p className="text-xs text-neutral-400 leading-relaxed">{d.text}</p>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-amber-500/20 bg-amber-500/5">
          <p className="text-xs text-neutral-400 leading-relaxed">
            <span className="text-amber-400 font-medium">Cross-cluster development: </span>
            PNC, Citi, and Wells Fargo are jointly exploring a stablecoin through{' '}
            <strong className="text-white">Early Warning Services</strong> (Zelle's parent) —
            three banks from three different clusters, a convergence our cluster analysis anticipated.
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white">Industry Timeline 2020–2026</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Two pivotal events: SAB 121 rescinded (Dec 2024) unlocked custody economics.
            GENIUS Act (Jul 2025) created the first federal stablecoin framework.
          </p>
        </div>

        {/* Category filters */}
        <div className="px-5 pt-4 flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-colors border ${
                catFilter === cat
                  ? 'bg-amber-500 text-black border-amber-500 font-bold'
                  : 'border-white/10 text-neutral-400 hover:border-amber-400 hover:text-amber-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="px-5 py-5 relative">
          <div className="absolute left-[2.35rem] top-5 bottom-5 w-px bg-white/5" />
          <div className="space-y-5">
            {filteredTimeline.map((item, i) => (
              <div key={i} className="flex gap-4 items-start relative">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                  style={{
                    background: item.color,
                    boxShadow: `0 0 0 3px #0a0a0d, 0 0 0 4px ${item.color}40`,
                  }}
                />
                <div>
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-mono text-[10px] text-neutral-500">{item.date}</span>
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{
                        background: `${CATEGORY_COLOR[item.category] ?? '#9ca3af'}15`,
                        color: CATEGORY_COLOR[item.category] ?? '#9ca3af',
                      }}
                    >
                      {item.category}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-white">{item.event}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    <span className="text-neutral-400">{item.bank}</span> — {item.summary}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Market Data */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white">Market Data & Projections</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Industry context. Our NLP data sits at the very beginning of the Citi GPS stablecoin adoption curve.
          </p>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {/* Stablecoin scenarios */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-3">
                Stablecoin Market Scenarios — Citi GPS ($B)
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={STABLECOIN_SCENARIOS} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="scenario" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} width={40}
                    tickFormatter={v => `$${v}B`} />
                  <Tooltip
                    contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
                    formatter={(v: number) => [`$${v}B`, 'Market Cap']}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {STABLECOIN_SCENARIOS.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-neutral-600 mt-2">Now ($237B) · Base ($1.9T) · Bull ($4T)</p>
            </div>

            {/* Composite vs NLP scatter */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-3">
                Composite Score vs NLP Peak — 16 Banks
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="x" name="NLP Peak" tick={{ fontSize: 9, fill: '#6b7280' }}
                    tickLine={false} axisLine={false}
                    label={{ value: 'NLP Peak', position: 'insideBottom', offset: -8, fontSize: 9, fill: '#6b7280' }} />
                  <YAxis dataKey="y" name="Composite" tick={{ fontSize: 9, fill: '#6b7280' }}
                    tickLine={false} axisLine={false} width={32} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3', stroke: '#374151' }}
                    contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
                    formatter={(_v, _n, props) => [
                      `NLP: ${(props.payload.x as number)?.toFixed(1)}, Composite: ${(props.payload.y as number)?.toFixed(0)}`,
                      props.payload.name as string,
                    ]}
                  />
                  <Scatter data={scatterData} shape={(props: Record<string, unknown>) => {
                    const cx = props.cx as number;
                    const cy = props.cy as number;
                    const cluster = props.cluster as string;
                    return (
                      <circle cx={cx} cy={cy} r={6}
                        fill={`${clusterColor(cluster as 'A'|'B'|'C'|'D'|'E')}bb`}
                        stroke={clusterColor(cluster as 'A'|'B'|'C'|'D'|'E')}
                        strokeWidth={1}
                      />
                    );
                  }} />
                </ScatterChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-neutral-600 mt-2">
                Above diagonal = composite higher than NLP alone (Goldman). Color = cluster.
              </p>
            </div>
          </div>

          {/* Projections table */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-3">
              Institutional Projections & Benchmarks
            </div>
            <div className="divide-y divide-white/5">
              {MARKET_PROJECTIONS.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 w-24 text-center flex-shrink-0">
                    {p.src}
                  </span>
                  <span className="font-mono font-bold text-white w-16 flex-shrink-0">{p.value}</span>
                  <span className="text-xs text-neutral-400">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Methodology */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white">4-Dimensional Scoring Methodology</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Why four dimensions beat single-score NLP</p>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-neutral-400 leading-relaxed">
            A four-dimensional composite scoring system addresses the fundamental weakness of single-metric NLP:
            it cannot distinguish a bank that says "crypto" 200 times from one that uses 12 specific product-level terms,
            and it misses operationally-live banks that underdisclose in Q&A. Each dimension scored 0–25; composite 0–100.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                dim: 'D1 · NLP Engagement (0–25)',
                formula: 'min(25, log(adj_peak+1) / log(21) × 25)',
                desc: "Log-normalised adjusted NLP peak. Prevents Schwab's 19.81 from dominating — maps to 24.9, while BNY's 9.70 maps to 19.5, preserving meaningful spread.",
              },
              {
                dim: 'D2 · Specificity & Depth (0–25)',
                formula: 'min(10, terms×0.85) + specificity×10 + consistency×5',
                desc: 'Rewards breadth and product-specific vocabulary over volume. State Street specificity=1.0 (100% Custodial). PNC: 0.048 (90% General — reactive, not operational).',
              },
              {
                dim: 'D3 · Disclosure Mode (0–25)',
                formula: 'Citi ratio 3.40x → D3=25 · Goldman 0.23x → D3=5.8',
                desc: 'Q&A/Full-transcript ratio >2.0 = proactive discloser. Goldman discusses DA 4× more in prepared remarks than Q&A — systematically invisible to pure Q&A NLP.',
              },
              {
                dim: 'D4 · External Research (0–25)',
                formula: 'products_launched(0–10) + infra_depth(0–8) + trajectory(0–7)',
                desc: 'Analyst-judged. Allows Goldman (D1=8.6) to reach composite 39.9 — GS DAP spin-out, tokenized MMF with BNY, EIB digital bond, $135M DA investment.',
              },
            ].map(d => (
              <div key={d.dim} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="text-xs font-medium text-white mb-1">{d.dim}</div>
                <div className="font-mono text-[10px] text-amber-400 bg-amber-400/5 rounded px-2 py-1 mb-2">
                  {d.formula}
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
