'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, LineChart, Line, Legend,
  BarChart, Bar, Cell, LabelList,
} from 'recharts';
import {
  RISK_BANKS, QUADRANT_GRID, R1_TIMESERIES, QUARTERS,
  WEIGHT_COMPONENTS, WEIGHTED_BANKS, SUPERVISORY_TABLE,
  QUADRANT_COLOR, type QuadrantLabel,
} from '@/lib/da-risk-data';

type View = 'matrix' | 'safety' | 'weights' | 'supervisory';

const QUADRANT_LABELS: QuadrantLabel[] = [
  'Operational Leader',
  'Building But Waiting',
  'Cautious Abstainer',
  'Announced But Unproven',
  'Not Participating',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function safetyColor(v: number) {
  if (v >= 44) return '#10b981';
  if (v >= 38) return '#3b82f6';
  if (v >= 30) return '#f59e0b';
  return '#ef4444';
}

function trendIcon(d: string) {
  if (d === 'improving') return <span className="text-emerald-400">↑</span>;
  if (d === 'declining') return <span className="text-rose-400">↓</span>;
  return <span className="text-neutral-500">→</span>;
}

// ── Custom bubble shape for scatter chart ─────────────────────────────────────

function BubbleShape(props: Record<string, unknown>) {
  const cx = props.cx as number;
  const cy = props.cy as number;
  const payload = props.payload as typeof RISK_BANKS[0];
  if (!cx || !cy) return null;
  const r = Math.sqrt(payload.bubbleSizeR4 / 25) * 26 + 7;
  const fill = payload.clusterColor + 'bb';
  const stroke = payload.clusterColor;
  if (payload.isFalsePositive) {
    return (
      <path
        d={`M ${cx},${cy - r} L ${cx + r},${cy} L ${cx},${cy + r} L ${cx - r},${cy} Z`}
        fill={fill} stroke={stroke} strokeWidth={1.5}
      />
    );
  }
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />;
}

// ── Custom scatter tooltip ────────────────────────────────────────────────────

function MatrixTooltip({ active, payload }: { active?: boolean; payload?: { payload: typeof RISK_BANKS[0] }[] }) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  return (
    <div className="bg-neutral-900 border border-white/10 rounded-lg p-3 text-xs max-w-xs shadow-xl">
      <div className="font-mono font-bold text-amber-400 mb-1">{b.ticker} — {b.bankName}</div>
      <div className="flex gap-3 mb-2 font-mono text-[11px]">
        <span>Engagement: <strong className="text-white">{b.xEngagement.toFixed(1)}</strong></span>
        <span>Safety: <strong style={{ color: safetyColor(b.ySafety) }}>{b.ySafety.toFixed(1)}</strong></span>
        <span>R4: <strong className="text-purple-400">{b.bubbleSizeR4.toFixed(1)}</strong></span>
      </div>
      <div className="flex gap-1 flex-wrap mb-2">
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
          style={{ background: `${QUADRANT_COLOR[b.quadrantLabel]}20`, color: QUADRANT_COLOR[b.quadrantLabel] }}>
          {b.quadrantLabel}
        </span>
        {b.pncPattern && <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-400">PNC Pattern</span>}
        {b.goldmanPattern && <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-400">GS Pattern</span>}
        {b.isFalsePositive && <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-500/20 text-neutral-400">False Positive ◇</span>}
      </div>
      <p className="text-neutral-400 leading-relaxed">{b.oneLineStory}</p>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function DARiskPanel() {
  const [view, setView] = useState<View>('matrix');

  const TABS: { key: View; label: string }[] = [
    { key: 'matrix',      label: 'Joint Matrix' },
    { key: 'safety',      label: 'Safety Scores' },
    { key: 'weights',     label: 'Weight Builder' },
    { key: 'supervisory', label: 'Supervisory' },
  ];

  return (
    <div className="space-y-4">
      {/* Team 6 attribution */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-blue-400">Team 6 — Digital Asset Risk Profile & Exposure</span>
          <p className="text-xs text-neutral-500 mt-0.5">
            Safety composite = R1 Financial Resilience + R2 Governance Quality + R3 DA Risk Exposure (0–75).
            R4 Systemic Footprint shown separately — <strong className="text-neutral-300">not added to safety score</strong>.
            Higher score = lower risk = safer bank.
          </p>
        </div>
        <div className="font-mono text-right flex-shrink-0">
          <div className="text-[10px] text-neutral-500">Team Lead</div>
          <div className="text-xs text-white">Vedanta Gawande</div>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 border-b border-white/5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setView(t.key)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              view === t.key
                ? 'bg-white/[0.07] text-white border-b-2 border-blue-400'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {view === 'matrix'      && <MatrixView />}
      {view === 'safety'      && <SafetyView />}
      {view === 'weights'     && <WeightsView />}
      {view === 'supervisory' && <SupervisoryView />}
    </div>
  );
}

// ── View 1: Joint Matrix ──────────────────────────────────────────────────────

function MatrixView() {
  const [hoveredQuadrant, setHoveredQuadrant] = useState<QuadrantLabel | null>(null);

  return (
    <div className="space-y-5">
      {/* Methodology callout */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-neutral-400 leading-relaxed">
        <span className="text-white font-medium">How to read this chart: </span>
        X-axis = Team 5 engagement (how active). Y-axis = Team 6 safety (how safe to operate).
        Bubble size = R4 Systemic Footprint (not part of safety — shows supervisory consequence if something goes wrong).
        Color = Team 5 cluster. <span className="text-neutral-300">◇ diamond = confirmed false positive</span>.
        Quadrant midpoints: <span className="font-mono">X=50, Y=37.5</span>.
      </div>

      {/* Bubble chart */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
          Joint Regulatory Safety Matrix — 16 Banks
        </div>
        <div className="text-[10px] text-neutral-600 mb-4">
          Upper-right = Institutional Leaders (Active + Safe) · Upper-left = Prudent Observers ·
          Lower-right = Supervisory Priority (Active + Under-prepared) · Lower-left = Baseline
        </div>
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 20, right: 40, bottom: 40, left: 20 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis
              type="number" dataKey="xEngagement" domain={[0, 105]} name="Engagement"
              tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false}
              label={{ value: 'Team 5 Engagement Composite (0–100)', position: 'insideBottom', offset: -20, fontSize: 10, fill: '#6b7280' }}
            />
            <YAxis
              type="number" dataKey="ySafety" domain={[0, 75]} name="Safety"
              tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false}
              label={{ value: 'Safety Composite R1+R2+R3 (0–75)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 10, fill: '#6b7280' }}
            />
            {/* Quadrant dividers */}
            <ReferenceLine x={50}   stroke="#4b5563" strokeDasharray="6 3" strokeWidth={1} label={{ value: 'Engagement midpoint', position: 'insideTopRight', fontSize: 9, fill: '#4b5563' }} />
            <ReferenceLine y={37.5} stroke="#4b5563" strokeDasharray="6 3" strokeWidth={1} label={{ value: 'Safety midpoint', position: 'insideTopLeft', fontSize: 9, fill: '#4b5563' }} />
            <Tooltip content={<MatrixTooltip />} cursor={false} />
            <Scatter data={RISK_BANKS} shape={<BubbleShape />} />
          </ScatterChart>
        </ResponsiveContainer>

        {/* Cluster legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {[
            { color: '#4A90D9', label: 'Cluster A — Custodial' },
            { color: '#3DBE7A', label: 'Cluster B — Wholesale Blockchain' },
            { color: '#B39DFA', label: 'Cluster C — Retail DA' },
            { color: '#F59C55', label: 'Cluster D — Strategic Movers' },
            { color: '#8EA3B8', label: 'Cluster E — Monitoring' },
          ].map(c => (
            <div key={c.color} className="flex items-center gap-1.5 text-[10px] text-neutral-500">
              <div className="w-3 h-3 rounded-full" style={{ background: c.color }} />
              {c.label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
            <span className="font-mono text-neutral-400">◇</span> False positive · Bubble size = R4 footprint
          </div>
        </div>
      </div>

      {/* 2×2 Quadrant grid */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white">2×2 Regulatory Readiness Grid</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Framework by Somil Varshney (April 2026 capstone). LLM-as-judge classification —
            each placement is an argument, not a formula result. Click a quadrant to expand.
          </p>
        </div>

        {/* Axis labels */}
        <div className="px-5 pt-4">
          <div className="flex justify-between text-[10px] font-mono text-neutral-500 mb-1">
            <span>← Partnership-Dependent</span>
            <span className="font-medium text-neutral-400">Infrastructure Depth</span>
            <span>Proprietary Platform →</span>
          </div>
        </div>

        {/* Grid */}
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-3 mb-1">
            <div className="text-[10px] font-mono text-emerald-400 text-center pb-1">Low Contingency ↑</div>
            <div className="text-[10px] font-mono text-emerald-400 text-center pb-1">Low Contingency ↑</div>
          </div>

          {/* Row 1: Low contingency */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Top-left: Cautious Abstainer (empty) */}
            <QuadrantCard
              label="Cautious Abstainer"
              banks={QUADRANT_GRID['Cautious Abstainer']}
              isExpanded={hoveredQuadrant === 'Cautious Abstainer'}
              onToggle={() => setHoveredQuadrant(p => p === 'Cautious Abstainer' ? null : 'Cautious Abstainer')}
            />
            {/* Top-right: Operational Leader */}
            <QuadrantCard
              label="Operational Leader"
              banks={QUADRANT_GRID['Operational Leader']}
              isExpanded={hoveredQuadrant === 'Operational Leader'}
              onToggle={() => setHoveredQuadrant(p => p === 'Operational Leader' ? null : 'Operational Leader')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-1">
            <div className="text-[10px] font-mono text-rose-400 text-center">↓ High Contingency</div>
            <div className="text-[10px] font-mono text-rose-400 text-center">↓ High Contingency</div>
          </div>

          {/* Row 2: High contingency */}
          <div className="grid grid-cols-2 gap-3">
            {/* Bottom-left: Announced But Unproven */}
            <QuadrantCard
              label="Announced But Unproven"
              banks={QUADRANT_GRID['Announced But Unproven']}
              isExpanded={hoveredQuadrant === 'Announced But Unproven'}
              onToggle={() => setHoveredQuadrant(p => p === 'Announced But Unproven' ? null : 'Announced But Unproven')}
            />
            {/* Bottom-right: Building But Waiting */}
            <QuadrantCard
              label="Building But Waiting"
              banks={QUADRANT_GRID['Building But Waiting']}
              isExpanded={hoveredQuadrant === 'Building But Waiting'}
              onToggle={() => setHoveredQuadrant(p => p === 'Building But Waiting' ? null : 'Building But Waiting')}
            />
          </div>

          {/* Not Participating strip */}
          <div className="mt-3">
            <QuadrantCard
              label="Not Participating"
              banks={QUADRANT_GRID['Not Participating']}
              isExpanded={hoveredQuadrant === 'Not Participating'}
              onToggle={() => setHoveredQuadrant(p => p === 'Not Participating' ? null : 'Not Participating')}
              horizontal
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuadrantCard({ label, banks, isExpanded, onToggle, horizontal }: {
  label: QuadrantLabel;
  banks: typeof QUADRANT_GRID[QuadrantLabel];
  isExpanded: boolean;
  onToggle: () => void;
  horizontal?: boolean;
}) {
  const color = QUADRANT_COLOR[label];
  const supervisoryNote: Record<QuadrantLabel, string> = {
    'Operational Leader':   'Active and operational. Monitor for concentration risk and governance gaps.',
    'Building But Waiting': 'Infrastructure built, strategy paused for regulatory clarity. Low immediate risk.',
    'Cautious Abstainer':   'Partnership-dependent but operational. Primary concern: vendor concentration.',
    'Announced But Unproven': 'HIGH SUPERVISORY CONCERN: CEO ambition exceeds operational reality.',
    'Not Participating':    'Baseline/false positive. No meaningful DA supervisory attention required.',
  };

  return (
    <div
      className="rounded-lg border bg-white/[0.015] overflow-hidden cursor-pointer transition-all"
      style={{ borderColor: isExpanded ? color : 'rgba(255,255,255,0.07)' }}
      onClick={onToggle}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-xs" style={{ color }}>{label}</div>
          <div className="flex items-center gap-1.5">
            {banks.map(b => (
              <span key={b.ticker} className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: `${b.clusterColor}22`, color: b.clusterColor }}>
                {b.ticker}
              </span>
            ))}
            {banks.length === 0 && <span className="text-[10px] text-neutral-600 font-mono">empty</span>}
            <span className="text-neutral-500 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
          </div>
        </div>
        <p className="text-[10px] text-neutral-500 leading-relaxed">{supervisoryNote[label]}</p>
      </div>

      {isExpanded && banks.length > 0 && (
        <div className="border-t border-white/5 px-3 pb-3 pt-2 space-y-3">
          {banks.map(b => (
            <div key={b.ticker} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-400 text-xs">{b.ticker}</span>
                  <span className="text-xs text-neutral-300">{b.bankName}</span>
                  {b.pncPattern && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400">PNC</span>}
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span style={{ color: QUADRANT_COLOR[label] }} className="font-bold">{b.safetyComposite.toFixed(1)}</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px]"
                    style={{
                      color: b.confidence === 'High' ? '#10b981' : b.confidence === 'Medium' ? '#f59e0b' : '#ef4444',
                      background: b.confidence === 'High' ? 'rgba(16,185,129,0.12)' : b.confidence === 'Medium' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                    }}>
                    {b.confidence}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-neutral-500 leading-relaxed">{b.justification}</p>
              <div className="grid grid-cols-2 gap-1">
                {b.infraEvidence.slice(0, 2).map((e, i) => (
                  <div key={i} className="text-[9px] text-neutral-600 flex gap-1">
                    <span className="text-blue-400 flex-shrink-0">▸</span>{e}
                  </div>
                ))}
              </div>
              <div className="text-[9px] text-neutral-600 italic">
                What would change: {b.whatWouldChange}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── View 2: Safety Scores ─────────────────────────────────────────────────────

function SafetyView() {
  const [showAll, setShowAll] = useState(false);

  // Sorted bar chart: all banks by safety composite
  const barData = [...RISK_BANKS]
    .sort((a, b) => b.ySafety - a.ySafety)
    .map(b => ({ ticker: b.ticker, R1: b.r1, R2: b.r2, R3: b.r3, R4: b.r4, total: b.ySafety, color: safetyColor(b.ySafety), fp: b.isFalsePositive }));

  // R1 timeseries: format for recharts multi-line
  const r1LineData = QUARTERS.map((q, qi) => {
    const row: Record<string, string | number> = { quarter: q };
    R1_TIMESERIES.forEach(s => { row[s.ticker] = s.r1Scores[qi]; });
    return row;
  });

  const visibleSeries = showAll ? R1_TIMESERIES : R1_TIMESERIES.filter(s => !s.ticker.match(/WFC|TFC|BMO|TD/));

  return (
    <div className="space-y-5">

      {/* R1+R2+R3 stacked bar */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
          Safety Composite R1+R2+R3 — All 16 Banks
        </div>
        <p className="text-[10px] text-neutral-600 mb-4">
          Higher = safer. Stacked: R1 Financial (blue) + R2 Governance (green) + R3 DA Exposure (violet).
          R4 Systemic Footprint shown separately — not part of safety.
          ◇ = false positive. * = HQLA understated (JPM, C, BAC — holding-company consolidation).
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="ticker" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} angle={-35} textAnchor="end" />
            <YAxis domain={[0, 75]} tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
              formatter={(value, name) => {
                const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                return [numericValue.toFixed(1), String(name)];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
            <Bar dataKey="R1" stackId="a" fill="#3b82f6" fillOpacity={0.85} name="R1 Financial" />
            <Bar dataKey="R2" stackId="a" fill="#10b981" fillOpacity={0.85} name="R2 Governance" />
            <Bar dataKey="R3" stackId="a" fill="#a78bfa" fillOpacity={0.85} name="R3 DA Exposure" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* R4 footprint bar */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
          R4 Systemic Footprint — Shown Separately
        </div>
        <p className="text-[10px] text-neutral-600 mb-4">
          How bad would it be if this bank's DA operations failed? Higher = more systemically important.
          <strong className="text-amber-400"> Not added to safety composite</strong> —
          a high R4 bank with safety=44 needs more supervisory attention than a low R4 bank with the same safety score.
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={[...RISK_BANKS].sort((a,b) => b.bubbleSizeR4 - a.bubbleSizeR4).map(b => ({ ticker:b.ticker, r4:b.bubbleSizeR4, color:b.clusterColor }))}
            margin={{ top: 4, right: 16, left: 0, bottom: 24 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="ticker" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} angle={-35} textAnchor="end" />
            <YAxis domain={[0, 25]} tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} width={24} />
            <Tooltip
              contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
              formatter={(value) => {
                const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                return [numericValue.toFixed(1), 'R4 Footprint'];
              }}
            />
            <Bar dataKey="r4" radius={[3,3,0,0]}>
              {[...RISK_BANKS].sort((a,b) => b.bubbleSizeR4 - a.bubbleSizeR4).map((b, i) => (
                <Cell key={i} fill={b.clusterColor + 'bb'} stroke={b.clusterColor} strokeWidth={1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* R1 timeseries */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
            R1 Financial Resilience Over Time — Q1 2024 to Q4 2025
          </div>
          <button
            onClick={() => setShowAll(p => !p)}
            className="text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 text-neutral-400 hover:text-white hover:border-white/30 transition-colors"
          >
            {showAll ? 'Hide false positives' : 'Show all 16'}
          </button>
        </div>
        <p className="text-[10px] text-neutral-600 mb-4">
          Tight clustering (4–8 range) with no extreme outliers reflects effective bank supervision.
          Fee-income adjusted banks (BNY, STT, GS, MS) ranked within peer group for Earnings Power.
          * HQLA understated for JPM, C, BAC.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={r1LineData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <YAxis domain={[1, 11]} tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 10 }}
              formatter={(value, name) => {
                const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                return [numericValue.toFixed(2), String(name)];
              }}
            />
            {visibleSeries.map(s => (
              <Line
                key={s.ticker}
                type="monotone"
                dataKey={s.ticker}
                stroke={s.clusterColor}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-2 mt-3">
          {visibleSeries.map(s => (
            <div key={s.ticker} className="flex items-center gap-1 text-[10px] text-neutral-500">
              <div className="w-3 h-0.5" style={{ background: s.clusterColor }} />
              <span className="font-mono">{s.ticker}</span>
              {trendIcon(s.trendDirection)}
              {s.feeIncomePeerAdjusted && <span className="text-[9px] text-amber-500/70">PA</span>}
              {s.hqlaFlag && <span className="text-[9px] text-rose-500/70">*</span>}
            </div>
          ))}
        </div>
        <p className="text-[9px] text-neutral-600 mt-2">PA = peer-adjusted earnings (fee-income banks) · * = HQLA understated (Y-9C true LCR &gt;100%)</p>
      </div>
    </div>
  );
}

// ── View 3: Interactive Weight Builder ────────────────────────────────────────

function WeightsView() {
  const defaultWeights = useMemo(() => {
    const w: Record<string, number> = {};
    WEIGHT_COMPONENTS.forEach(c => { w[c.key] = c.defaultWeight; });
    return w;
  }, []);

  const [weights, setWeights] = useState<Record<string, number>>(defaultWeights);

  const setWeight = useCallback((key: string, val: number) => {
    setWeights(prev => ({ ...prev, [key]: val }));
  }, []);

  const totalWeight = useMemo(() => Object.values(weights).reduce((a, b) => a + b, 0), [weights]);

  const composites = useMemo(() => {
    return WEIGHTED_BANKS.map(b => {
      const raw = WEIGHT_COMPONENTS.reduce((sum, c) => sum + (b.scores[c.key] ?? 0) * weights[c.key], 0);
      const comp = totalWeight > 0 ? (raw / totalWeight) * 75 / 10 : 0;
      return { ticker: b.ticker, bankName: b.bankName, comp, color: safetyColor(comp), pnc: b.pncPattern, goldman: b.goldmanPattern };
    }).sort((a, b) => b.comp - a.comp);
  }, [weights, totalWeight]);

  const dimGroups: { label: string; dim: 'R1' | 'R2' | 'R3'; color: string }[] = [
    { label: 'R1 — Financial Resilience', dim: 'R1', color: '#3b82f6' },
    { label: 'R2 — Governance Quality',   dim: 'R2', color: '#10b981' },
    { label: 'R3 — DA Risk Exposure',     dim: 'R3', color: '#a78bfa' },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-neutral-400 leading-relaxed">
        <span className="text-white font-medium">Analyst-adjustable weights. </span>
        Adjust the 13 component sliders and watch the composite update live for all 12 genuine banks.
        No default composite is shown on this page — the Team 6 philosophy is that the analyst's weighting choice
        encodes their supervisory priority (e.g., a liquidity-focused examiner should increase R1 Liquidity weight).
        <span className="text-amber-400 font-medium"> Formula: weighted_average × 75</span>.
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Sliders */}
        <div className="space-y-4">
          {dimGroups.map(g => (
            <div key={g.dim} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-xs font-medium mb-3" style={{ color: g.color }}>{g.label}</div>
              <div className="space-y-3">
                {WEIGHT_COMPONENTS.filter(c => c.dimension === g.dim).map(c => (
                  <div key={c.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-neutral-300">{c.label}</span>
                      <span className="font-mono text-[11px] font-bold" style={{ color: g.color }}>
                        {(weights[c.key] * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0} max={0.5} step={0.01}
                      value={weights[c.key]}
                      onChange={e => setWeight(c.key, parseFloat(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{ accentColor: g.color }}
                    />
                    <p className="text-[9px] text-neutral-600 mt-0.5 leading-relaxed">{c.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={() => setWeights(defaultWeights)}
            className="w-full py-2 rounded-lg border border-white/10 text-xs text-neutral-400 hover:text-white hover:border-white/30 transition-colors font-mono"
          >
            Reset to Team 6 defaults
          </button>
        </div>

        {/* Live composite bar chart */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 sticky top-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
            Live Composite — 12 Genuine Banks
          </div>
          <p className="text-[10px] text-neutral-600 mb-3">Updates as you adjust sliders</p>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={composites.filter(b => !['WFC','TFC','BMO','TD'].includes(b.ticker))}
              layout="vertical"
              margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis type="number" domain={[0, 75]} tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="ticker" tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={36} />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
                formatter={(value) => {
                  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                  return [numericValue.toFixed(1), 'Weighted Composite'];
                }}
              />
              <Bar dataKey="comp" radius={[0, 3, 3, 0]}>
                <LabelList dataKey="comp" position="right" formatter={(value) => {
                  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                  return numericValue.toFixed(1);
                }} style={{ fontSize: 9, fill: '#9ca3af', fontFamily: 'monospace' }} />
                {composites.filter(b => !['WFC','TFC','BMO','TD'].includes(b.ticker)).map((b, i) => (
                  <Cell key={i} fill={`${b.color}bb`} stroke={b.color} strokeWidth={0.5} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── View 4: Supervisory Priority ──────────────────────────────────────────────

function SupervisoryView() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-neutral-400 leading-relaxed">
        <span className="text-white font-medium">Governance gap ranking. </span>
        Sorted by governance gap = R2 actual − R2 expected (where expected = T5 composite / 100 × 25).
        Most negative = most under-governed relative to engagement level.
        <span className="text-rose-400 font-medium"> Schwab leads with −14.5 gap</span> (highest engagement, near-zero governance disclosure).
      </div>

      {SUPERVISORY_TABLE.map(b => {
        const isOpen = expanded === b.ticker;
        const gapColor = b.governanceGap < -5 ? '#ef4444' : b.governanceGap < 0 ? '#f59e0b' : '#10b981';
        const actionColor = b.supervisoryAction === 'Targeted Examination' ? '#ef4444'
          : b.supervisoryAction === 'Enhanced Monitoring' ? '#f59e0b' : '#9ca3af';
        const qColor = QUADRANT_COLOR[b.quadrantLabel];

        return (
          <div key={b.ticker}
            className="rounded-xl border bg-white/[0.02] overflow-hidden cursor-pointer transition-all"
            style={{ borderColor: isOpen ? gapColor : 'rgba(255,255,255,0.07)' }}
            onClick={() => setExpanded(isOpen ? null : b.ticker)}
          >
            <div className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02]">
              {/* Rank */}
              <div className="font-mono text-sm font-bold text-neutral-500 w-6 flex-shrink-0 text-center">{b.rank}</div>

              {/* Ticker + name */}
              <div className="w-28 flex-shrink-0">
                <div className="font-mono font-bold text-amber-400 text-sm">{b.ticker}</div>
                <div className="text-[10px] text-neutral-500">{b.bankName}</div>
              </div>

              {/* Governance gap bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-[10px] font-mono" style={{ color: gapColor }}>
                    Gap: {b.governanceGap > 0 ? '+' : ''}{b.governanceGap.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-neutral-600 truncate">{b.governanceGap < 0 ? '⚠ Under-governed' : 'Proportional'}</div>
                </div>
                <div className="relative h-2 bg-white/5 rounded overflow-hidden">
                  {b.governanceGap <= 0 ? (
                    <div className="absolute right-1/2 top-0 h-full rounded"
                      style={{ width: `${Math.min(Math.abs(b.governanceGap) / 15 * 50, 50)}%`, background: gapColor }} />
                  ) : (
                    <div className="absolute left-1/2 top-0 h-full rounded"
                      style={{ width: `${Math.min(b.governanceGap / 15 * 50, 50)}%`, background: gapColor }} />
                  )}
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/20" />
                </div>
              </div>

              {/* Scores */}
              <div className="hidden md:flex gap-2 font-mono text-[10px] flex-shrink-0">
                <span className="text-blue-400">R1 {b.r1.toFixed(0)}</span>
                <span className="text-emerald-400">R2 {b.r2.toFixed(0)}</span>
                <span className="text-violet-400">R3 {b.r3.toFixed(0)}</span>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1 flex-shrink-0">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
                  style={{ background: `${actionColor}20`, color: actionColor }}>
                  {b.supervisoryAction === 'Targeted Examination' ? 'Targeted' : b.supervisoryAction === 'Enhanced Monitoring' ? 'Enhanced' : 'Routine'}
                </span>
                {b.pncPattern && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400">PNC</span>}
                {b.goldmanPattern && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">GS</span>}
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background: `${qColor}15`, color: qColor }}>
                  {b.quadrantLabel.split(' ')[0]}
                </span>
              </div>

              <span className="text-neutral-500 text-xs">{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
              <div className="px-4 pb-4 pt-0 border-t border-white/5 space-y-3">
                <p className="text-xs text-neutral-400 leading-relaxed pt-3 italic">"{b.oneLineStory}"</p>
                <div className="rounded-lg bg-white/[0.03] p-3 border border-white/5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Biggest Systemic Risk</div>
                  <p className="text-xs text-neutral-300 leading-relaxed">{b.biggestRisk}</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[['R1', b.r1, '#3b82f6'], ['R2', b.r2, '#10b981'], ['R3', b.r3, '#a78bfa'], ['R4', b.r4, '#f59e0b']].map(([dim, val, col]) => (
                    <div key={String(dim)} className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-center">
                      <div className="text-[9px] font-mono text-neutral-500">{String(dim)}</div>
                      <div className="font-mono font-bold text-sm" style={{ color: String(col) }}>{(val as number).toFixed(1)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
