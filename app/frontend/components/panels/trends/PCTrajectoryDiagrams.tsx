'use client';

// Four diagrams that read pc_trajectory.json:
//   1. Trajectory distribution donut (Expanding / Stable / Contracting / Pulling Back)
//   2. Horizontal rating bar — banks ranked 1–5 by PC involvement, colored by trajectory
//   3. Vertical exposure bar — top banks by $B NBFI exposure (Call Report proxy), colored by trajectory
//   4. Two-panel strategy view — left: bank-strategy pair counts; right: rating scatter within each strategy
//
// "Trajectory" not "sentiment" — these labels measure book direction (QoQ NBFI
// ratio change), not the tone of management's language. The LLM's narrative
// sentiment is preserved per-bank as `narrative_sentiment` in the JSON for
// cross-reference but does not drive any color in these charts.
//
// All four share one dataset so a single fetch powers the section.

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  LabelList,
} from 'recharts';

// ── types ──────────────────────────────────────────────────────────────────────

type Trajectory = 'Expanding' | 'Stable' | 'Contracting' | 'Pulling Back';

interface TrajectoryBank {
  ticker: string;
  name: string;
  peer_group: string;
  trajectory: Trajectory;
  trajectory_rel_change: number | null;
  narrative_sentiment: string | null;
  rating: number;
  composite_score: number;
  trajectory_rationale: string;
  strategic_initiatives: string;
  exposure_billions: number;
  exposure_breakdown: { funded: number; commitments: number };
  exposure_source: 'commitment_proxy' | 'funded_plus_commitments' | 'unavailable';
  strategies: string[];
}

interface StrategyPair {
  ticker: string;
  rating: number;
  trajectory: Trajectory;
}

interface TrajectoryDataset {
  as_of: string;
  method: Record<string, string>;
  taxonomy: string[];
  trajectory_colors: Record<Trajectory, string>;
  trajectory_counts: Record<Trajectory, number>;
  total_banks: number;
  banks: TrajectoryBank[];
  strategy_pairs: Record<string, StrategyPair[]>;
}

const TRAJECTORY_ORDER: Trajectory[] = ['Expanding', 'Stable', 'Contracting', 'Pulling Back'];

// Default colors — green=growth, blue=flat, amber=contracting, red=pullback.
// The dataset also carries them so a JSON-side change propagates without code edits.
const FALLBACK_COLOR: Record<Trajectory, string> = {
  'Expanding':    '#10b981',
  'Stable':       '#3b82f6',
  'Contracting':  '#f59e0b',
  'Pulling Back': '#dc2626',
};

// Rating-intensity gradient for the strategy scatter (1=red → 5=green).
const RATING_COLORS = ['#dc2626', '#f59e0b', '#facc15', '#84cc16', '#10b981'];

function ratingColor(r: number): string {
  if (r < 1) return '#9ca3af';
  return RATING_COLORS[Math.min(5, Math.max(1, r)) - 1];
}

// ── shared ─────────────────────────────────────────────────────────────────────

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-100">
        <h3 className="font-semibold text-neutral-900 text-base">{title}</h3>
        {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function TrajectoryLegend({ colors }: { colors: Record<Trajectory, string> }) {
  return (
    <div className="flex gap-4 mt-3 flex-wrap text-[11px] text-neutral-500">
      {TRAJECTORY_ORDER.map((s) => (
        <div key={s} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors[s] }} />
          {s}
        </div>
      ))}
    </div>
  );
}

// ── 1. Donut ───────────────────────────────────────────────────────────────────

function TrajectoryDonut({ data }: { data: TrajectoryDataset }) {
  const colors = { ...FALLBACK_COLOR, ...data.trajectory_colors };
  const slices = TRAJECTORY_ORDER.map((s) => ({
    name: s,
    value: data.trajectory_counts[s] ?? 0,
    color: colors[s],
  })).filter((s) => s.value > 0);

  const total = data.total_banks;

  return (
    <Card
      title="Quarterly NBFI Book Trajectory"
      subtitle={`How the ${total} tracked banks split by QoQ change in NBFI loan ratio, as of ${data.as_of}. Behavioral signal — not management's tone of language.`}
    >
      <div className="relative">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={2}
              label={(props: {
                cx?: number; cy?: number; midAngle?: number;
                outerRadius?: number; name?: string; value?: number;
              }) => {
                // Render label as an SVG <text> so we can control fontSize
                // (returning a plain string uses Recharts' default ~14px which
                // overflows the 300-px-tall donut card and gets clipped).
                const cx = props.cx ?? 0;
                const cy = props.cy ?? 0;
                const midAngle = props.midAngle ?? 0;
                const r = (props.outerRadius ?? 110) + 14;
                const RAD = Math.PI / 180;
                const x = cx + r * Math.cos(-midAngle * RAD);
                const y = cy + r * Math.sin(-midAngle * RAD);
                const v = props.value ?? 0;
                const pct = total ? ((v / total) * 100).toFixed(0) : '0';
                return (
                  <text
                    x={x}
                    y={y}
                    fill="#525252"
                    fontSize={10}
                    textAnchor={x > cx ? 'start' : 'end'}
                    dominantBaseline="central"
                  >
                    {`${props.name ?? ''}: ${v} (${pct}%)`}
                  </text>
                );
              }}
              labelLine={false}
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} stroke="#fff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => {
                const v = typeof value === 'number' ? value : Number(value ?? 0);
                const pct = total ? ((v / total) * 100).toFixed(1) : '0.0';
                return [`${v} banks (${pct}%)`, String(name ?? '')];
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label — total bank count */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold text-neutral-900 tabular-nums">{total}</div>
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 mt-0.5">banks</div>
        </div>
      </div>
      <TrajectoryLegend colors={colors} />
    </Card>
  );
}

// ── 2. Horizontal rating bar ──────────────────────────────────────────────────

function RatingBar({ data }: { data: TrajectoryDataset }) {
  const colors = { ...FALLBACK_COLOR, ...data.trajectory_colors };
  const rows = useMemo(() => {
    return [...data.banks]
      .filter((b) => b.rating > 0)
      .sort((a, b) => b.rating - a.rating || b.exposure_billions - a.exposure_billions)
      .map((b) => ({
        ticker: b.ticker,
        name: b.name,
        rating: b.rating,
        trajectory: b.trajectory,
      }));
  }, [data]);

  return (
    <Card
      title="Private Credit Involvement Rating"
      subtitle="1–5 quintile of the same 6-metric composite the Rankings page uses. Bars colored by quarterly trajectory."
    >
      <ResponsiveContainer width="100%" height={Math.max(320, rows.length * 22)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontSize: 11, fill: '#a3a3a3' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="ticker"
            tick={{ fontSize: 10, fill: '#525252' }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip
            formatter={(value) => {
              const v = typeof value === 'number' ? value : Number(value ?? 0);
              return [`${v} / 5`, 'Rating'];
            }}
            labelFormatter={(label) => {
              const ticker = String(label ?? '');
              const row = rows.find((r) => r.ticker === ticker);
              return row ? `${row.name}  •  ${row.trajectory}` : ticker;
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
          />
          <Bar dataKey="rating" radius={[0, 4, 4, 0]} maxBarSize={16}>
            {rows.map((r) => (
              <Cell key={r.ticker} fill={colors[r.trajectory]} />
            ))}
            <LabelList dataKey="rating" position="right" style={{ fontSize: 10, fill: '#525252' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <TrajectoryLegend colors={colors} />
    </Card>
  );
}

// ── 3. Vertical exposure bar ──────────────────────────────────────────────────

function ExposureBar({ data }: { data: TrajectoryDataset }) {
  const colors = { ...FALLBACK_COLOR, ...data.trajectory_colors };
  const rows = useMemo(() => {
    return [...data.banks]
      .filter((b) => b.exposure_billions > 0)
      .sort((a, b) => b.exposure_billions - a.exposure_billions)
      .slice(0, 25)
      .map((b) => ({
        ticker: b.ticker,
        name: b.name,
        exposure: b.exposure_billions,
        trajectory: b.trajectory,
        source: b.exposure_source,
      }));
  }, [data]);

  return (
    <Card
      title="Private Credit Exposure by Bank"
      subtitle="Top 25 banks by NBFI exposure (RCON1766 + RCONJ457 / RCON2122 × total loans). Bars colored by quarterly trajectory."
    >
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={rows} margin={{ top: 24, right: 16, left: 8, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
          <XAxis
            dataKey="ticker"
            tick={{ fontSize: 10, fill: '#525252' }}
            axisLine={{ stroke: '#e5e5e5' }}
            tickLine={false}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tickFormatter={(v: number) => `$${v.toFixed(0)}B`}
            tick={{ fontSize: 11, fill: '#a3a3a3' }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip
            formatter={(value) => {
              const v = typeof value === 'number' ? value : Number(value ?? 0);
              return [`$${v.toFixed(2)}B`, 'PC Exposure'];
            }}
            labelFormatter={(label) => {
              const ticker = String(label ?? '');
              const row = rows.find((r) => r.ticker === ticker);
              if (!row) return ticker;
              const note = row.source === 'commitment_proxy' ? ' (commitments only — RCON1766 confidential)' : '';
              return `${row.name}  •  ${row.trajectory}${note}`;
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
          />
          <Bar dataKey="exposure" radius={[4, 4, 0, 0]} maxBarSize={26}>
            {rows.map((r) => (
              <Cell key={r.ticker} fill={colors[r.trajectory]} />
            ))}
            <LabelList
              dataKey="exposure"
              position="top"
              formatter={(v) => {
                const n = typeof v === 'number' ? v : Number(v ?? 0);
                return `$${n.toFixed(1)}B`;
              }}
              style={{ fontSize: 9, fill: '#525252' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <TrajectoryLegend colors={colors} />
    </Card>
  );
}

// ── 4. Two-panel strategy view ────────────────────────────────────────────────

function StrategyTwoPanel({ data }: { data: TrajectoryDataset }) {
  // Left: count of banks per strategy (multi-label, so this is bank-strategy pairs)
  const counts = useMemo(() => {
    return data.taxonomy
      .map((cat) => ({ category: cat, count: (data.strategy_pairs[cat] ?? []).length }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [data]);

  // Right: scatter of bank counts within each (strategy, rating) cell. With
  // multi-label classification several banks land on the same (rating,
  // category) coordinate, so per-bank tickers stack and overlap. We
  // aggregate to one dot per cell and label with the count; the tooltip
  // lists the actual tickers behind that count.
  const scatterRows = useMemo(() => {
    const cellMap = new Map<string, { categoryIdx: number; categoryLabel: string; rating: number; tickers: string[] }>();
    counts.forEach((c, idx) => {
      const pairs = data.strategy_pairs[c.category] ?? [];
      pairs.forEach((p) => {
        const key = `${idx}|${p.rating}`;
        const existing = cellMap.get(key);
        if (existing) {
          existing.tickers.push(p.ticker);
        } else {
          cellMap.set(key, {
            categoryIdx: idx,
            categoryLabel: c.category,
            rating: p.rating,
            tickers: [p.ticker],
          });
        }
      });
    });
    return Array.from(cellMap.values()).map((c) => ({
      ...c,
      count: c.tickers.length,
    }));
  }, [counts, data.strategy_pairs]);

  const yTicks = counts.map((_, i) => i);

  return (
    <Card
      title="Strategic Initiatives by Bank"
      subtitle="Left: how many banks pursue each strategy (multi-label). Right: rating intensity of each bank within its strategy bucket."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel — horizontal counts bar */}
        <div>
          <ResponsiveContainer width="100%" height={Math.max(260, counts.length * 36)}>
            <BarChart data={counts} layout="vertical" margin={{ top: 4, right: 32, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#a3a3a3' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 11, fill: '#525252' }}
                axisLine={false}
                tickLine={false}
                width={170}
              />
              <Tooltip
                formatter={(value) => {
                  const v = typeof value === 'number' ? value : Number(value ?? 0);
                  return [`${v} bank-strategy pairs`, 'Count'];
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={22}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#525252' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right panel — rating scatter per category */}
        <div>
          <ResponsiveContainer width="100%" height={Math.max(260, counts.length * 36)}>
            <ScatterChart margin={{ top: 4, right: 16, left: 4, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis
                type="number"
                dataKey="rating"
                domain={[0.5, 5.5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 11, fill: '#a3a3a3' }}
                axisLine={{ stroke: '#e5e5e5' }}
                tickLine={false}
                label={{ value: 'PC Involvement Rating (1–5)', position: 'insideBottom', offset: -10, style: { fontSize: 11, fill: '#737373' } }}
              />
              <YAxis
                type="number"
                dataKey="categoryIdx"
                domain={[-0.5, counts.length - 0.5]}
                ticks={yTicks}
                tickFormatter={(v) => {
                  const idx = typeof v === 'number' ? v : Number(v ?? -1);
                  return counts[idx]?.category ?? '';
                }}
                tick={{ fontSize: 11, fill: '#525252' }}
                axisLine={false}
                tickLine={false}
                width={170}
              />
              {/* Scale dot size by count so cells with more banks read heavier. */}
              <ZAxis dataKey="count" range={[80, 360]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload as (typeof scatterRows)[number];
                  return (
                    <div className="bg-white border border-neutral-200 rounded-lg p-2.5 shadow-md text-xs">
                      <div className="font-semibold text-neutral-900">{d.categoryLabel}</div>
                      <div className="text-neutral-600 mt-0.5">rating {d.rating} / 5  •  {d.count} bank{d.count === 1 ? '' : 's'}</div>
                      <div className="font-mono text-neutral-700 mt-1">{d.tickers.join(', ')}</div>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterRows} shape="circle">
                {scatterRows.map((p, i) => (
                  <Cell key={`${p.categoryIdx}-${p.rating}-${i}`} fill={ratingColor(p.rating)} />
                ))}
                <LabelList
                  dataKey="count"
                  position="top"
                  style={{ fontSize: 10, fill: '#525252', fontWeight: 600 }}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          {/* Rating gradient legend */}
          <div className="flex items-center gap-2 mt-2 text-[10px] text-neutral-500">
            <span>rating</span>
            {[1, 2, 3, 4, 5].map((r) => (
              <span key={r} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: ratingColor(r) }} />
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── top-level component ───────────────────────────────────────────────────────

export function PCTrajectoryDiagrams() {
  const [data, setData] = useState<TrajectoryDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/pc_trajectory.json')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load pc_trajectory.json');
        return r.json() as Promise<TrajectoryDataset>;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-100 px-6 py-4 text-sm text-rose-700">
        Could not load trajectory dataset: {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrajectoryDonut data={data} />
        <RatingBar data={data} />
      </div>
      <ExposureBar data={data} />
      <StrategyTwoPanel data={data} />
    </div>
  );
}
