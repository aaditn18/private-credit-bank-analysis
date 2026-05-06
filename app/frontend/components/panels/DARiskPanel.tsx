'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, LineChart, Line, Legend,
  BarChart, Bar,
} from 'recharts';
import {
  GENUINE_BANKS,
  FALSE_POSITIVES,
  BANK_BY_TICKER,
  CLUSTER_INFO,
  QUADRANT_COLORS,
  QUADRANT_DESCRIPTIONS,
  DEFAULT_WEIGHTS,
  WEIGHT_RATIONALES,
  R1_SUBCOMPONENTS,
  R2_SUBCOMPONENTS,
  R3_SUBCOMPONENTS,
  METHODOLOGY_CONTENT,
  KEY_FINDINGS,
  computeComposite,
  getGovernanceGap,
  getGovernanceConcernBanks,
  getBanksByQuadrant,
  type BankProfile,
  type Cluster,
  type QuadrantLabel,
  type SupervisoryAction,
} from '@/lib/da-risk-data';

type View = 'overview' | 'rankings' | 'matrix' | 'supervisory' | 'methodology';

// ─── Display helpers ─────────────────────────────────────────────────────────

function safetyColor(v: number): string {
  if (v >= 55) return '#10b981';
  if (v >= 50) return '#3b82f6';
  if (v >= 45) return '#f59e0b';
  if (v >= 40) return '#fb923c';
  return '#ef4444';
}

function trendIcon(d: 'improving' | 'stable' | 'declining') {
  if (d === 'improving') return <span className="text-emerald-400">↑</span>;
  if (d === 'declining') return <span className="text-rose-400">↓</span>;
  return <span className="text-neutral-500">→</span>;
}

function actionPillStyle(action: SupervisoryAction): string {
  switch (action) {
    case 'Targeted Examination': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    case 'Enhanced Monitoring':  return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'Routine Monitoring':   return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
  }
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export function DARiskPanel() {
  const [view, setView] = useState<View>('overview');
  const [drawerBank, setDrawerBank] = useState<string | null>(null);

  const TABS: { key: View; label: string }[] = [
    { key: 'overview',    label: 'Key Findings' },
    { key: 'rankings',    label: 'Risk Rankings' },
    { key: 'matrix',      label: 'Regulatory Matrix' },
    { key: 'supervisory', label: 'Supervisory Insights' },
    { key: 'methodology', label: 'Methodology & Weights' },
  ];

  return (
    <div className="space-y-4">
      {/* Tab strip */}
      <div className="flex gap-1 border-b border-white/5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              view === t.key
                ? 'bg-white/[0.07] text-white border-b-2 border-blue-400'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'overview'    && <OverviewView onBankClick={setDrawerBank} onTabClick={setView} />}
      {view === 'rankings'    && <RankingsView onBankClick={setDrawerBank} />}
      {view === 'matrix'      && <MatrixView onBankClick={setDrawerBank} />}
      {view === 'supervisory' && <SupervisoryView onBankClick={setDrawerBank} />}
      {view === 'methodology' && <MethodologyView />}

      {drawerBank && <BankProfileDrawer ticker={drawerBank} onClose={() => setDrawerBank(null)} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// VIEW 1: OVERVIEW / KEY FINDINGS
// ═════════════════════════════════════════════════════════════════════════════

function OverviewView({
  onBankClick,
  onTabClick,
}: {
  onBankClick: (t: string) => void;
  onTabClick: (v: View) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Project framing */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
          Research Question
        </div>
        <p className="text-base text-neutral-200 leading-relaxed">
          {METHODOLOGY_CONTENT.question}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-mono text-neutral-500">
          <span>16 banks analyzed</span>
          <span>•</span>
          <span>8 quarters: Q1 2024 – Q4 2025</span>
          <span>•</span>
          <span>Sponsors: ABA + Google</span>
          <span>•</span>
          <span>12 genuine DA-active banks + 4 validation cases</span>
        </div>
      </div>

      {/* Five key findings */}
      <div>
        <div className="text-sm font-medium text-neutral-300 mb-3">Five Key Findings</div>
        <div className="space-y-3">
          {KEY_FINDINGS.map((finding, idx) => (
            <button
              key={finding.id}
              onClick={() => onTabClick(finding.deepDiveTab as View)}
              className="block w-full text-left rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-colors p-5 group"
            >
              <div className="flex items-start gap-4">
                <div className="font-mono text-3xl text-blue-400/40 leading-none flex-shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white mb-2 group-hover:text-blue-300 transition-colors">
                    {finding.title}
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                    {finding.summary}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400/80 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                      {finding.metric}
                    </span>
                    <span className="text-[10px] text-neutral-500 group-hover:text-neutral-300 transition-colors">
                      Open deep-dive →
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Industry-wide R1 trend chart — the "no risk-return tradeoff" finding */}
      <OverviewR1TrendChart onBankClick={onBankClick} />
    </div>
  );
}

function OverviewR1TrendChart({ onBankClick }: { onBankClick: (t: string) => void }) {
  // Show 4 banks: the 4 most-engaged (BK, SCHW, C, STT) which spans clusters A and B
  // and illustrates R1 trends across different engagement tiers
  const showcaseTickers = ['BK', 'JPM', 'C', 'STT'];
  const banks = showcaseTickers.map(t => BANK_BY_TICKER[t]).filter(Boolean);

  const quarters = banks[0]?.r1QuarterlyData.map(q => q.quarter) ?? [];

  const chartData = quarters.map((q, i) => {
    const row: Record<string, string | number | null> = { quarter: q };
    banks.forEach(b => {
      const point = b.r1QuarterlyData[i];
      row[b.ticker] = point ? point.r1 : null;
    });
    return row;
  });

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
        Industry-wide finding: financial resilience is improving alongside DA expansion
      </div>
      <div className="text-sm text-neutral-300 mb-3">
        4 of the most DA-engaged banks — all showing improving R1 trends over Q1 2024 → Q4 2025
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 5, right: 25, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="quarter" stroke="#888" tick={{ fontSize: 10, fill: '#888' }} />
            <YAxis
              domain={[0, 100]}
              stroke="#888"
              tick={{ fontSize: 10, fill: '#888' }}
              label={{ value: 'R1 (0–100)', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{ background: '#0a0a0a', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#fff' }}
            />
            {banks.map(b => (
              <Line
                key={b.ticker}
                type="monotone"
                dataKey={b.ticker}
                stroke={CLUSTER_INFO[b.cluster].color}
                strokeWidth={2}
                dot={{ r: 3, fill: CLUSTER_INFO[b.cluster].color }}
                activeDot={{ r: 5, onClick: () => onBankClick(b.ticker), cursor: 'pointer' }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-neutral-500 mt-2">
        Click any bank in the legend to view its full profile. Full bank-by-bank trend chart available in the Rankings tab.
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// VIEW 2: RISK RANKINGS
// ═════════════════════════════════════════════════════════════════════════════

type SortKey = 'rank' | 'composite' | 't5' | 'r1' | 'r2' | 'r3';

function RankingsView({ onBankClick }: { onBankClick: (t: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('composite');
  const [filterCluster, setFilterCluster] = useState<Cluster | 'all'>('all');
  const [filterAction, setFilterAction] = useState<SupervisoryAction | 'all'>('all');

  const filtered = useMemo(() => {
    return GENUINE_BANKS.filter(b => {
      if (filterCluster !== 'all' && b.cluster !== filterCluster) return false;
      if (filterAction !== 'all' && b.supervisoryAction !== filterAction) return false;
      return true;
    });
  }, [filterCluster, filterAction]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case 'composite': arr.sort((a, b) => b.weightedComposite - a.weightedComposite); break;
      case 't5':        arr.sort((a, b) => b.t5Composite - a.t5Composite); break;
      case 'r1':        arr.sort((a, b) => b.r1 - a.r1); break;
      case 'r2':        arr.sort((a, b) => b.r2 - a.r2); break;
      case 'r3':        arr.sort((a, b) => b.r3 - a.r3); break;
      case 'rank':      arr.sort((a, b) => b.weightedComposite - a.weightedComposite); break;
    }
    return arr;
  }, [filtered, sortKey]);

  return (
    <div className="space-y-4">
      {/* Filter strip */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Filter</span>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-neutral-400">Cluster:</span>
          <select
            value={filterCluster}
            onChange={e => setFilterCluster(e.target.value as Cluster | 'all')}
            className="bg-neutral-900 border border-white/10 rounded px-2 py-1 text-xs text-neutral-200"
          >
            <option value="all">All</option>
            {(['A','B','C','D','E'] as Cluster[]).map(c => (
              <option key={c} value={c}>{c} — {CLUSTER_INFO[c].name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-neutral-400">Action:</span>
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value as SupervisoryAction | 'all')}
            className="bg-neutral-900 border border-white/10 rounded px-2 py-1 text-xs text-neutral-200"
          >
            <option value="all">All</option>
            <option value="Targeted Examination">Targeted Examination</option>
            <option value="Enhanced Monitoring">Enhanced Monitoring</option>
            <option value="Routine Monitoring">Routine Monitoring</option>
          </select>
        </div>

        <div className="ml-auto text-[11px] text-neutral-500">
          Showing <span className="text-neutral-300 font-mono">{sorted.length}</span> of 12 genuine DA-active banks. False positives in validation card below.
        </div>
      </div>

      {/* Rankings table */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500 border-b border-white/5 bg-white/[0.02]">
          <div className="col-span-1">Rank</div>
          <div className="col-span-2">Bank</div>
          <div className="col-span-1">
            <button onClick={() => setSortKey('t5')} className="hover:text-white">
              T5 {sortKey === 't5' && '↓'}
            </button>
          </div>
          <div className="col-span-1">
            <button onClick={() => setSortKey('r1')} className="hover:text-white">
              R1 {sortKey === 'r1' && '↓'}
            </button>
          </div>
          <div className="col-span-1">
            <button onClick={() => setSortKey('r2')} className="hover:text-white">
              R2 {sortKey === 'r2' && '↓'}
            </button>
          </div>
          <div className="col-span-1">
            <button onClick={() => setSortKey('r3')} className="hover:text-white">
              R3 {sortKey === 'r3' && '↓'}
            </button>
          </div>
          <div className="col-span-1">
            <button onClick={() => setSortKey('composite')} className="hover:text-white">
              Composite {sortKey === 'composite' && '↓'}
            </button>
          </div>
          <div className="col-span-2">Quadrant</div>
          <div className="col-span-2">Supervisory Action</div>
        </div>

        {sorted.map((bank, idx) => (
          <button
            key={bank.ticker}
            onClick={() => onBankClick(bank.ticker)}
            className="w-full text-left grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-white/5 hover:bg-white/[0.03] transition-colors group"
          >
            <div className="col-span-1 flex items-center gap-2">
              <div
                className="w-1 h-8 rounded-full"
                style={{ background: CLUSTER_INFO[bank.cluster].color }}
              />
              <span className="font-mono text-sm text-neutral-400">{idx + 1}</span>
            </div>
            <div className="col-span-2">
              <div className="font-mono font-bold text-amber-400 text-sm">{bank.ticker}</div>
              <div className="text-[10px] text-neutral-500 truncate">{bank.bankName}</div>
            </div>
            <div className="col-span-1 font-mono text-xs text-neutral-300">
              {bank.t5Composite.toFixed(1)}
            </div>
            <div className="col-span-1 font-mono text-xs text-neutral-300">
              {bank.r1.toFixed(1)}
              {bank.hqlaUnderstated && (
                <span className="text-amber-400 ml-1" title="HQLA understated — see profile">*</span>
              )}
            </div>
            <div className="col-span-1 font-mono text-xs text-neutral-300">
              {bank.r2.toFixed(1)}
            </div>
            <div className="col-span-1 font-mono text-xs text-neutral-300">
              {bank.r3.toFixed(1)}
            </div>
            <div className="col-span-1">
              <span
                className="font-mono font-bold text-sm"
                style={{ color: safetyColor(bank.weightedComposite) }}
              >
                {bank.weightedComposite.toFixed(1)}
              </span>
            </div>
            <div className="col-span-2">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-mono font-medium"
                style={{
                  background: `${QUADRANT_COLORS[bank.quadrantLabel]}25`,
                  color: QUADRANT_COLORS[bank.quadrantLabel],
                }}
              >
                {bank.quadrantLabel}
              </span>
            </div>
            <div className="col-span-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${actionPillStyle(bank.supervisoryAction)}`}>
                {bank.supervisoryAction}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* HQLA legend */}
      <div className="text-[10px] text-neutral-500 px-2">
        <span className="text-amber-400">*</span> R1 may be understated — bank-subsidiary Call Report excludes holding-company liquidity pool. Affects JPM, BAC, C.
      </div>

      {/* Cluster legend */}
      <ClusterLegend />

      {/* Validation card with false positives */}
      <FalsePositiveValidationCard onBankClick={onBankClick} />
    </div>
  );
}

function ClusterLegend() {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
        Engagement Clusters
      </div>
      <div className="flex flex-wrap gap-3">
        {(['A','B','C','D','E'] as Cluster[]).map(c => (
          <div key={c} className="flex items-center gap-2 text-[11px]">
            <div className="w-3 h-3 rounded" style={{ background: CLUSTER_INFO[c].color }} />
            <span className="text-neutral-300 font-mono">{c}</span>
            <span className="text-neutral-500">— {CLUSTER_INFO[c].name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FalsePositiveValidationCard({ onBankClick }: { onBankClick: (t: string) => void }) {
  return (
    <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.03] p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-2xl">✓</div>
        <div className="flex-1">
          <div className="text-sm font-medium text-blue-300 mb-1">
            Independent Methodology Validation
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Four banks were identified as false positives based on idiomatic language patterns
            (&quot;circle back&quot;, &quot;full circle&quot;, &quot;strategic investment&quot;).
            Our governance and exposure scoring &mdash; using a completely independent methodology based on
            formal filing quality and operational risk &mdash; independently scores all four banks at near-zero.
            Two methodologies, zero overlap in approach, same conclusion.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3">
        {FALSE_POSITIVES.map(b => (
          <button
            key={b.ticker}
            onClick={() => onBankClick(b.ticker)}
            className="text-left p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono font-bold text-amber-400 text-xs">{b.ticker}</span>
              <span className="text-[9px] font-mono text-neutral-500">T5: {b.t5Composite.toFixed(1)}</span>
            </div>
            <div className="text-[10px] text-neutral-500 truncate mb-2">{b.bankName}</div>
            <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
              <div>
                <div className="text-neutral-600 text-[8px]">R2 (fixed)</div>
                <div className="text-neutral-300">{b.r2.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-neutral-600 text-[8px]">FORMAL</div>
                <div className="text-neutral-300">{b.r2Formal.raw}/10</div>
              </div>
              <div>
                <div className="text-neutral-600 text-[8px]">VENDOR</div>
                <div className="text-neutral-300">{b.r3Vendor.raw}/10</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// VIEW 3: REGULATORY MATRIX (joint scatter + 2x2 grid)
// ═════════════════════════════════════════════════════════════════════════════

function MatrixView({ onBankClick }: { onBankClick: (t: string) => void }) {
  return (
    <div className="space-y-5">
      {/* How to read */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-neutral-400 leading-relaxed">
        <span className="text-white font-medium">How to read these views: </span>
        Two complementary perspectives on the same 11 genuine DA-active banks plus COF (deliberate abstainer).
        Joint Matrix shows continuous position; 2×2 Grid shows categorical regulatory readiness.
        False positives excluded from both.
        <span className="block mt-2 text-neutral-500">
          Joint Matrix axes: <span className="font-mono">X = Engagement Composite (0-100), Y = Safety Composite (0-100), bubble size = R4 systemic footprint</span>.
          Midpoints at 50.
        </span>
      </div>

      {/* Joint matrix scatter */}
      <JointMatrixScatter onBankClick={onBankClick} />

      {/* 2x2 quadrant grid */}
      <QuadrantGrid onBankClick={onBankClick} />
    </div>
  );
}

function JointMatrixScatter({ onBankClick }: { onBankClick: (t: string) => void }) {
  // Use only genuine banks (12) — false positives excluded
  const data = GENUINE_BANKS.map(b => ({
    ticker: b.ticker,
    bankName: b.bankName,
    x: b.t5Composite,
    y: b.weightedComposite,
    r4: b.r4Raw,
    cluster: b.cluster,
    clusterColor: CLUSTER_INFO[b.cluster].color,
    quadrant: b.quadrantLabel,
    quadrantColor: QUADRANT_COLORS[b.quadrantLabel],
    oneLineStory: b.oneLineStory,
    isSchwab: b.ticker === 'SCHW',
  }));

  // Custom bubble shape (bigger bubble = bigger R4)
  const BubbleShape = (props: Record<string, unknown>) => {
    const cx = props.cx as number | undefined;
    const cy = props.cy as number | undefined;
    const payload = props.payload as typeof data[0] | undefined;
    if (cx === undefined || cy === undefined || !payload) return <g />;
    const r = Math.sqrt(payload.r4 / 25) * 22 + 8;
    return (
      <g
        style={{ cursor: 'pointer' }}
        onClick={() => onBankClick(payload.ticker)}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={payload.clusterColor + 'cc'}
          stroke={payload.clusterColor}
          strokeWidth={1.5}
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fontWeight={700}
          fill="#fff"
          style={{ pointerEvents: 'none', fontFamily: 'monospace' }}
        >
          {payload.ticker}
        </text>
        {payload.isSchwab && (
          <text
            x={cx + r + 4}
            y={cy - r}
            fontSize={14}
            fill="#fbbf24"
            style={{ pointerEvents: 'none' }}
          >
            *
          </text>
        )}
      </g>
    );
  };

  const ScatterTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: typeof data[0] }[] }) => {
    if (!active || !payload?.length) return null;
    const b = payload[0].payload;
    return (
      <div className="bg-neutral-900 border border-white/10 rounded-lg p-3 text-xs max-w-xs shadow-xl">
        <div className="font-mono font-bold text-amber-400 mb-1">{b.ticker} — {b.bankName}</div>
        <div className="flex gap-3 mb-2 font-mono text-[11px]">
          <span>T5: <strong className="text-white">{b.x.toFixed(1)}</strong></span>
          <span>Composite: <strong style={{ color: safetyColor(b.y) }}>{b.y.toFixed(1)}</strong></span>
          <span>R4: <strong className="text-purple-400">{b.r4.toFixed(1)}</strong></span>
        </div>
        <div className="mb-2">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
            style={{ background: `${b.quadrantColor}20`, color: b.quadrantColor }}
          >
            {b.quadrant}
          </span>
        </div>
        <p className="text-neutral-400 leading-relaxed text-[11px]">{b.oneLineStory}</p>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
        Joint Regulatory Safety Matrix
      </div>
      <div className="text-sm text-neutral-300 mb-3">
        Engagement (X) vs Weighted Composite (Y) — bubble = R4 systemic footprint
      </div>

      <div style={{ width: '100%', height: 480 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, 100]}
              stroke="#888"
              tick={{ fontSize: 11, fill: '#888' }}
              label={{ value: 'Engagement Composite (0-100)', position: 'bottom', offset: 25, fill: '#666', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[20, 70]}
              stroke="#888"
              tick={{ fontSize: 11, fill: '#888' }}
              label={{ value: 'Weighted Safety Composite (0-100)', angle: -90, position: 'insideLeft', offset: -30, fill: '#666', fontSize: 11 }}
            />
            <ReferenceLine x={50} stroke="#ffffff15" strokeDasharray="4 4" />
            <ReferenceLine y={50} stroke="#ffffff15" strokeDasharray="4 4" />
            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data} shape={<BubbleShape />} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Quadrant legend */}
      <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] font-mono text-neutral-500">
        <div className="border-t border-r border-white/5 pt-2 pr-2">
          <span className="text-neutral-300">Top-Left:</span> Cautious + Safe (Prudent Observers)
        </div>
        <div className="border-t border-l border-white/5 pt-2 pl-2">
          <span className="text-neutral-300">Top-Right:</span> Active + Safe (Institutional Leaders)
        </div>
        <div className="border-t border-r border-white/5 pt-2 pr-2">
          <span className="text-neutral-300">Bottom-Left:</span> Baseline / Absent
        </div>
        <div className="border-t border-l border-white/5 pt-2 pl-2">
          <span className="text-rose-400">Bottom-Right:</span> Active + Under-Prepared (Supervisory Priority)
        </div>
      </div>

      {/* Schwab asterisk note */}
      <div className="mt-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-200/90 leading-relaxed">
        <span className="font-mono text-amber-400">*</span>{' '}
        <span className="font-medium">Schwab note:</span> Position reflects Q4 2025 governance posture.
        Schwab Crypto launched April 16, 2026 — our NLP analysis predicted this 10 months in advance.
        Our framework correctly flagged Schwab for Targeted Examination based on the pre-launch governance gap.
      </div>
    </div>
  );
}

function QuadrantGrid({ onBankClick }: { onBankClick: (t: string) => void }) {
  const grid = useMemo(() => getBanksByQuadrant(), []);

  // 2×2 layout (plus a Not Participating row below)
  // Top-row = Low/Moderate Contingency, Bottom-row = High Contingency
  // Left-col = Partnership-Dependent, Right-col = Proprietary Platform
  // From the data: only 'Low Contingency' and 'High Contingency' quadrants are populated
  // Mapping:
  //   Top-Left  = Cautious Abstainer (Partnership + Low Contingency) — empty
  //   Top-Right = Operational Leader (Proprietary + Low Contingency) — BK, JPM, C
  //   Bottom-Left  = Announced But Unproven (Partnership + High Contingency)
  //   Bottom-Right = Building But Waiting (Proprietary + High Contingency)

  const cells: Array<{ label: QuadrantLabel; banks: BankProfile[]; gridArea: string }> = [
    { label: 'Cautious Abstainer',     banks: grid['Cautious Abstainer'],     gridArea: 'tl' },
    { label: 'Operational Leader',     banks: grid['Operational Leader'],     gridArea: 'tr' },
    { label: 'Announced But Unproven', banks: grid['Announced But Unproven'], gridArea: 'bl' },
    { label: 'Building But Waiting',   banks: grid['Building But Waiting'],   gridArea: 'br' },
  ];

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
        2×2 Regulatory Readiness Grid
      </div>
      <div className="text-sm text-neutral-300 mb-3">
        Categorical positioning — Infrastructure Depth × Regulatory Contingency
      </div>

      {/* Axis labels */}
      <div className="relative">
        {/* Y-axis labels (left side, top: Low → bottom: High Contingency) */}
        <div className="absolute -left-1 top-0 h-full flex flex-col justify-between items-center text-[9px] font-mono text-neutral-500 py-3 pointer-events-none">
          <div className="rotate-180 [writing-mode:vertical-rl] whitespace-nowrap">↓ High Contingency</div>
          <div className="rotate-180 [writing-mode:vertical-rl] whitespace-nowrap">Low Contingency ↑</div>
        </div>

        {/* Grid 2×2 */}
        <div className="ml-7 grid grid-cols-2 gap-3">
          {cells.map(cell => (
            <QuadrantCard
              key={cell.label}
              label={cell.label}
              banks={cell.banks}
              onBankClick={onBankClick}
            />
          ))}
        </div>

        {/* X-axis label */}
        <div className="ml-7 mt-2 grid grid-cols-2 gap-3 text-[10px] font-mono text-neutral-500">
          <div className="text-center">← Partnership-Dependent</div>
          <div className="text-center">Proprietary Platform →</div>
        </div>
      </div>

      {/* Not Participating row */}
      <div className="ml-7 mt-3">
        <QuadrantCard
          label="Not Participating"
          banks={grid['Not Participating']}
          onBankClick={onBankClick}
          fullWidth
        />
      </div>
    </div>
  );
}

function QuadrantCard({
  label,
  banks,
  onBankClick,
  fullWidth = false,
}: {
  label: QuadrantLabel;
  banks: BankProfile[];
  onBankClick: (t: string) => void;
  fullWidth?: boolean;
}) {
  const color = QUADRANT_COLORS[label];
  const isEmpty = banks.length === 0;

  return (
    <div
      className={`rounded-lg border p-3 ${fullWidth ? 'min-h-[80px]' : 'min-h-[140px]'}`}
      style={{
        borderColor: `${color}40`,
        background: `${color}08`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-xs font-bold" style={{ color }}>
          {label}
        </div>
        <div className="text-[10px] font-mono text-neutral-500">
          {banks.length} {banks.length === 1 ? 'bank' : 'banks'}
        </div>
      </div>
      <p className="text-[10px] text-neutral-500 leading-snug mb-2">
        {QUADRANT_DESCRIPTIONS[label]}
      </p>
      {isEmpty ? (
        <div className="text-[10px] text-neutral-600 italic">
          No banks in this quadrant — see what this means in the supervisory implications below
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {banks
            .sort((a, b) => b.weightedComposite - a.weightedComposite)
            .map(b => (
              <button
                key={b.ticker}
                onClick={() => onBankClick(b.ticker)}
                className="px-2 py-1 rounded font-mono text-[11px] font-bold hover:bg-white/10 transition-colors flex items-center gap-1.5"
                style={{ background: `${color}20`, color: color, border: `1px solid ${color}30` }}
                title={`${b.bankName} — ${b.weightedComposite.toFixed(1)}`}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: CLUSTER_INFO[b.cluster].color }}
                />
                {b.ticker}
                <span className="opacity-70 text-[10px]">{b.weightedComposite.toFixed(0)}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// VIEW 4: SUPERVISORY INSIGHTS
// ═════════════════════════════════════════════════════════════════════════════

function SupervisoryView({ onBankClick }: { onBankClick: (t: string) => void }) {
  const concernBanks = useMemo(() => getGovernanceConcernBanks(), []);
  const noConcernBanks = useMemo(() => {
    return GENUINE_BANKS
      .filter(b => getGovernanceGap(b) >= -5)
      .sort((a, b) => getGovernanceGap(b) - getGovernanceGap(a));
  }, []);

  return (
    <div className="space-y-5">
      {/* Section A: Governance gap concerns */}
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.03] p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-2xl">⚑</div>
          <div>
            <div className="text-sm font-medium text-rose-300 mb-1">
              Governance Documentation Gaps
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Banks where formal governance documentation (R2) lags engagement level (T5) by more than 5 points.
              Governance gap is computed as <span className="font-mono">R2 − T5</span> on the same 0-100 scale.
              Negative = under-governed relative to engagement.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {concernBanks.map(b => {
            const gap = getGovernanceGap(b);
            return (
              <button
                key={b.ticker}
                onClick={() => onBankClick(b.ticker)}
                className="block w-full text-left rounded-lg border border-rose-500/15 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-1 h-10 rounded-full"
                      style={{ background: CLUSTER_INFO[b.cluster].color }}
                    />
                    <div>
                      <div className="font-mono font-bold text-amber-400 text-sm">{b.ticker} — {b.bankName}</div>
                      <div className="text-[10px] text-neutral-500">{CLUSTER_INFO[b.cluster].name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-2xl font-bold text-rose-400">{gap.toFixed(1)}</div>
                    <div className="text-[10px] text-neutral-500">governance gap</div>
                  </div>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed mb-2">{b.oneLineStory}</p>
                <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-neutral-500">
                  <div>T5: <span className="text-neutral-300">{b.t5Composite.toFixed(1)}</span></div>
                  <div>R2: <span className="text-neutral-300">{b.r2.toFixed(1)}</span></div>
                  <div>
                    Action:{' '}
                    <span className={`px-1.5 py-0.5 rounded ${actionPillStyle(b.supervisoryAction)}`}>
                      {b.supervisoryAction}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* No concern banks — collapsed */}
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] text-neutral-500 hover:text-neutral-300 font-mono">
            ▸ Other genuine DA-active banks (governance proportional or exceeding engagement) — {noConcernBanks.length} banks
          </summary>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
            {noConcernBanks.map(b => {
              const gap = getGovernanceGap(b);
              return (
                <button
                  key={b.ticker}
                  onClick={() => onBankClick(b.ticker)}
                  className="text-left p-2 rounded border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-amber-400">{b.ticker}</span>
                    <span className="font-mono text-[10px] text-emerald-400">+{gap.toFixed(1)}</span>
                  </div>
                  <div className="text-[10px] text-neutral-500 truncate">{b.bankName}</div>
                </button>
              );
            })}
          </div>
        </details>
      </div>

      {/* Section B: The two risk archetypes finding */}
      <RiskArchetypesChart onBankClick={onBankClick} />

      {/* Section C: Infrastructure correlation finding */}
      <InfrastructureGovernanceCorrelation />
    </div>
  );
}

function RiskArchetypesChart({ onBankClick }: { onBankClick: (t: string) => void }) {
  // Custom SVG chart: R1 (X) vs R2 (Y) for genuine DA-active banks (excluding COF for clarity)
  const banks = GENUINE_BANKS.filter(b => b.ticker !== 'COF');

  // SVG dimensions
  const W = 700;
  const H = 380;
  const PAD = { top: 30, right: 30, bottom: 50, left: 60 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const xScale = (v: number) => PAD.left + (v / 100) * innerW;
  const yScale = (v: number) => PAD.top + innerH - (v / 100) * innerH;

  const midX = xScale(50);
  const midY = yScale(50);

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
        Two Risk Archetypes — R1 Financial Resilience vs R2 Governance Quality
      </div>
      <div className="text-sm text-neutral-300 mb-3">
        Two distinct profiles emerge: systemically important + financially vulnerable (top-left) vs financially strong + governance vacuum (bottom-right)
      </div>

      <div className="overflow-x-auto">
        <svg width={W} height={H} className="mx-auto">
          {/* Quadrant backgrounds */}
          <rect x={PAD.left} y={PAD.top} width={midX - PAD.left} height={midY - PAD.top} fill="#10b98108" />
          <rect x={midX} y={PAD.top} width={W - PAD.right - midX} height={midY - PAD.top} fill="#3b82f608" />
          <rect x={PAD.left} y={midY} width={midX - PAD.left} height={H - PAD.bottom - midY} fill="#ef444408" />
          <rect x={midX} y={midY} width={W - PAD.right - midX} height={H - PAD.bottom - midY} fill="#f59e0b08" />

          {/* Quadrant labels */}
          <text x={PAD.left + 10} y={PAD.top + 16} fontSize={10} fontFamily="monospace" fill="#10b981" opacity={0.7}>
            Vulnerable but Governed
          </text>
          <text x={midX + 10} y={PAD.top + 16} fontSize={10} fontFamily="monospace" fill="#3b82f6" opacity={0.7}>
            Strong & Governed (ideal)
          </text>
          <text x={PAD.left + 10} y={midY + 16} fontSize={10} fontFamily="monospace" fill="#ef4444" opacity={0.7}>
            Vulnerable & Ungoverned
          </text>
          <text x={midX + 10} y={midY + 16} fontSize={10} fontFamily="monospace" fill="#f59e0b" opacity={0.7}>
            Strong but Governance Vacuum
          </text>

          {/* Axes */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#ffffff20" />
          <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#ffffff20" />

          {/* Midpoint lines */}
          <line x1={midX} y1={PAD.top} x2={midX} y2={H - PAD.bottom} stroke="#ffffff15" strokeDasharray="4 4" />
          <line x1={PAD.left} y1={midY} x2={W - PAD.right} y2={midY} stroke="#ffffff15" strokeDasharray="4 4" />

          {/* Axis ticks and labels */}
          {[0, 25, 50, 75, 100].map(v => (
            <g key={`x-${v}`}>
              <line x1={xScale(v)} y1={H - PAD.bottom} x2={xScale(v)} y2={H - PAD.bottom + 4} stroke="#888" />
              <text x={xScale(v)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize={10} fill="#888">{v}</text>
            </g>
          ))}
          {[0, 25, 50, 75, 100].map(v => (
            <g key={`y-${v}`}>
              <line x1={PAD.left - 4} y1={yScale(v)} x2={PAD.left} y2={yScale(v)} stroke="#888" />
              <text x={PAD.left - 8} y={yScale(v) + 3} textAnchor="end" fontSize={10} fill="#888">{v}</text>
            </g>
          ))}

          {/* Axis titles */}
          <text x={PAD.left + innerW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#999">
            R1 — Financial Resilience (0-100)
          </text>
          <text
            x={-(PAD.top + innerH / 2)}
            y={18}
            transform={`rotate(-90)`}
            textAnchor="middle"
            fontSize={11}
            fill="#999"
          >
            R2 — Governance Quality (0-100)
          </text>

          {/* Data points */}
          {banks.map(b => {
            const cx = xScale(b.r1);
            const cy = yScale(b.r2);
            const color = CLUSTER_INFO[b.cluster].color;
            // Label offset to avoid overlap — small banks below, others above
            const labelOffset = ['SCHW', 'MS', 'AXP'].includes(b.ticker) ? 18 : -10;
            return (
              <g
                key={b.ticker}
                style={{ cursor: 'pointer' }}
                onClick={() => onBankClick(b.ticker)}
              >
                <circle cx={cx} cy={cy} r={7} fill={color + 'cc'} stroke={color} strokeWidth={1.5} />
                <text
                  x={cx}
                  y={cy + labelOffset}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily="monospace"
                  fontWeight={700}
                  fill="#fff"
                  style={{ pointerEvents: 'none' }}
                >
                  {b.ticker}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-lg border border-rose-500/15 bg-rose-500/[0.03]">
          <div className="text-rose-300 font-medium mb-1">
            Type 1: Systemically Important + Financially Vulnerable
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            <span className="font-mono text-neutral-300">C, STT, JPM, BK</span> &mdash;
            high R4 (systemic footprint), low R1 (deposit fragility from institutional concentration),
            but solid R2/R3 (good governance). The risk lives in the balance sheet, not in the controls.
            Regulatory implication: treat as critical financial infrastructure.
          </p>
        </div>
        <div className="p-3 rounded-lg border border-amber-500/15 bg-amber-500/[0.03]">
          <div className="text-amber-300 font-medium mb-1">
            Type 2: Financially Strong + Governance Vacuum
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            <span className="font-mono text-neutral-300">SCHW, MS</span> &mdash;
            high R1 (resilient balance sheets) but low R2 (formal disclosure absent or thin).
            Risk is from operational mismanagement, not financial collapse.
            Regulatory implication: OCC bank examiner / consumer protection focus.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfrastructureGovernanceCorrelation() {
  // Compute group averages
  const proprietary = GENUINE_BANKS.filter(b => b.infraDepth === 'Proprietary Platform');
  const partnership = GENUINE_BANKS.filter(b => b.infraDepth === 'Partnership-Dependent');

  const avg = (banks: BankProfile[], key: 'r2' | 'r3') =>
    banks.reduce((sum, b) => sum + b[key], 0) / banks.length;

  const data = [
    { group: 'Proprietary Platform', count: proprietary.length, r2: avg(proprietary, 'r2'), r3: avg(proprietary, 'r3') },
    { group: 'Partnership-Dependent', count: partnership.length, r2: avg(partnership, 'r2'), r3: avg(partnership, 'r3') },
  ];

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
        Infrastructure Correlates with Governance Quality
      </div>
      <div className="text-sm text-neutral-300 mb-3">
        Banks that build proprietary infrastructure also document it &mdash; the gap is large and consistent
      </div>

      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 30, bottom: 30, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="group" stroke="#888" tick={{ fontSize: 11, fill: '#888' }} />
            <YAxis domain={[0, 100]} stroke="#888" tick={{ fontSize: 10, fill: '#888' }} />
            <Tooltip
              contentStyle={{ background: '#0a0a0a', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#fff' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="r2" name="Avg R2 (Governance)" fill="#3b82f6" />
            <Bar dataKey="r3" name="Avg R3 (Exposure Safety)" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
        Building your own platform requires governance be in place &mdash; you can&apos;t get OCC non-objection
        for proprietary blockchain custody without a documented framework.
        This is the underlying mechanism behind Key Finding #1.
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// VIEW 5: METHODOLOGY + WEIGHT EXPLORER
// ═════════════════════════════════════════════════════════════════════════════

function MethodologyView() {
  return (
    <div className="space-y-5">
      <MethodologyContent />
      <WeightExplorer />
    </div>
  );
}

function MethodologyContent() {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-5">
      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
          Project Question
        </div>
        <p className="text-sm text-neutral-300 leading-relaxed">{METHODOLOGY_CONTENT.question}</p>
      </div>

      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
          Bank Universe
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">{METHODOLOGY_CONTENT.bankUniverse}</p>
      </div>

      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
          Engagement Composite
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">{METHODOLOGY_CONTENT.team5Summary}</p>
      </div>

      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-3">
          Risk Framework
        </div>
        <div className="space-y-2">
          {METHODOLOGY_CONTENT.ourFramework.map(d => (
            <div key={d.dim} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-400 text-sm">{d.dim}</span>
                  <span className="text-sm text-neutral-200 font-medium">{d.name}</span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500 bg-white/5 px-2 py-1 rounded">
                  {d.weight}
                </span>
              </div>
              <div className="text-[10px] font-mono text-neutral-500 mb-1">{d.source}</div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">{d.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
          Weighted Composite Formula
        </div>
        <div className="rounded-lg border border-blue-500/15 bg-blue-500/[0.03] p-3 font-mono text-xs text-blue-200">
          R1 (0-100) × 40% + R2 (0-100) × 35% + R3 (0-100) × 25% = Composite (0-100)
        </div>
        <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">{METHODOLOGY_CONTENT.weightedComposite}</p>
      </div>

      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
          Data Sources
        </div>
        <ul className="space-y-1">
          {METHODOLOGY_CONTENT.dataSources.map((s, i) => (
            <li key={i} className="text-[11px] text-neutral-400 flex items-start gap-2">
              <span className="text-neutral-600 mt-0.5">•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
          Known Limitations
        </div>
        <ul className="space-y-1">
          {METHODOLOGY_CONTENT.knownLimitations.map((s, i) => (
            <li key={i} className="text-[11px] text-neutral-400 flex items-start gap-2">
              <span className="text-amber-500/60 mt-0.5">⚠</span>
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function WeightExplorer() {
  const [advanced, setAdvanced] = useState(false);

  // Simple mode: 3 dimension weights
  const [w1, setW1] = useState(40);
  const [w2, setW2] = useState(35);
  const [w3, setW3] = useState(25);

  const total = w1 + w2 + w3;
  const normalized = total > 0 ? { r1: w1 / total, r2: w2 / total, r3: w3 / total } : DEFAULT_WEIGHTS;

  const ranked = useMemo(() => {
    return [...GENUINE_BANKS]
      .map(b => ({
        bank: b,
        composite: computeComposite(b, { r1: w1, r2: w2, r3: w3 }),
      }))
      .sort((a, b) => b.composite - a.composite);
  }, [w1, w2, w3]);

  const reset = useCallback(() => {
    setW1(40); setW2(35); setW3(25);
  }, []);

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
            Interactive Weight Explorer
          </div>
          <p className="text-xs text-neutral-400">
            Adjust dimension weights to see how rankings shift. Default: R1 40% / R2 35% / R3 25%.
          </p>
        </div>
        <button
          onClick={reset}
          className="text-[11px] font-mono text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded border border-blue-500/30 hover:border-blue-500/50 transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sliders */}
        <div className="space-y-4">
          <WeightSlider
            label="R1 — Financial Resilience"
            value={w1}
            onChange={setW1}
            color="#3b82f6"
            rationale={WEIGHT_RATIONALES.r1}
          />
          <WeightSlider
            label="R2 — Governance Quality"
            value={w2}
            onChange={setW2}
            color="#10b981"
            rationale={WEIGHT_RATIONALES.r2}
          />
          <WeightSlider
            label="R3 — DA Risk Exposure"
            value={w3}
            onChange={setW3}
            color="#f59e0b"
            rationale={WEIGHT_RATIONALES.r3}
          />

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-neutral-500">Total weight:</span>
            <span className={`font-mono font-bold ${Math.abs(total - 100) > 5 ? 'text-amber-400' : 'text-neutral-300'}`}>
              {total}%
              {Math.abs(total - 100) > 5 && <span className="ml-2 text-[10px]">(auto-normalized)</span>}
            </span>
          </div>

          {/* Advanced toggle */}
          <details className="border-t border-white/5 pt-3">
            <summary
              className="cursor-pointer text-[11px] font-mono text-neutral-500 hover:text-neutral-300 select-none"
              onClick={() => setAdvanced(!advanced)}
            >
              ⚙ Advanced — adjust 12 sub-component weights
            </summary>
            <div className="mt-3 space-y-3 text-[10px] text-neutral-400">
              <div className="p-2 bg-amber-500/5 border border-amber-500/15 rounded text-[11px] text-amber-200/80">
                Sub-component weights are read-only in this version &mdash; default weights applied.
                Future versions will allow per-component override.
              </div>
              <SubComponentList title="R1 Sub-components" subs={R1_SUBCOMPONENTS} />
              <SubComponentList title="R2 Sub-components" subs={R2_SUBCOMPONENTS} />
              <SubComponentList title="R3 Sub-components" subs={R3_SUBCOMPONENTS} />
            </div>
          </details>
        </div>

        {/* Live ranking */}
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
            Live Ranking — {ranked.length} banks
          </div>
          <div className="space-y-1 max-h-[440px] overflow-y-auto">
            {ranked.map((row, idx) => {
              const pctOfMax = row.composite > 0 ? row.composite : 0;
              return (
                <div
                  key={row.bank.ticker}
                  className="flex items-center gap-2 p-2 rounded bg-white/[0.02] border border-white/5 text-xs"
                >
                  <span className="font-mono text-neutral-500 w-5">{idx + 1}</span>
                  <span className="font-mono font-bold text-amber-400 w-12 flex-shrink-0">{row.bank.ticker}</span>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${pctOfMax}%`,
                          background: safetyColor(row.composite),
                        }}
                      />
                    </div>
                  </div>
                  <span
                    className="font-mono font-bold text-xs w-12 text-right flex-shrink-0"
                    style={{ color: safetyColor(row.composite) }}
                  >
                    {row.composite.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeightSlider({
  label,
  value,
  onChange,
  color,
  rationale,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  rationale: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-neutral-300 font-medium">{label}</span>
        <span className="font-mono text-sm font-bold" style={{ color }}>
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${value}%, rgba(255,255,255,0.05) ${value}%, rgba(255,255,255,0.05) 100%)`,
        }}
      />
      <p className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed">{rationale}</p>
    </div>
  );
}

function SubComponentList({
  title,
  subs,
}: {
  title: string;
  subs: typeof R1_SUBCOMPONENTS | typeof R2_SUBCOMPONENTS | typeof R3_SUBCOMPONENTS;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{title}</div>
      <div className="space-y-1">
        {subs.map(sc => (
          <div key={sc.key} className="flex items-center justify-between py-1 px-2 bg-white/[0.02] rounded">
            <span className="text-neutral-400">{sc.label}</span>
            <span className="font-mono text-neutral-300">{Math.round(sc.weight * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BANK PROFILE DRAWER (modal overlay)
// ═════════════════════════════════════════════════════════════════════════════

function BankProfileDrawer({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const bank = BANK_BY_TICKER[ticker];
  if (!bank) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-neutral-950 border border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-neutral-950 border-b border-white/10 p-5 flex items-start justify-between gap-4 z-10">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-1.5 h-12 rounded-full flex-shrink-0"
              style={{ background: CLUSTER_INFO[bank.cluster].color }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-0.5 flex-wrap">
                <span className="font-mono font-bold text-amber-400 text-xl">{bank.ticker}</span>
                <span className="text-lg text-neutral-200 font-medium truncate">{bank.bankName}</span>
                {bank.isFalsePositive && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-500/20 text-neutral-400 border border-neutral-500/30">
                    FALSE POSITIVE
                  </span>
                )}
              </div>
              <div className="text-[11px] text-neutral-500 font-mono">
                ${bank.assetsB.toLocaleString()}B assets · {bank.t5Tier} · {CLUSTER_INFO[bank.cluster].name}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white text-xl leading-none flex-shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* One-line story */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1.5">One-line summary</div>
            <p className="text-sm text-neutral-200 leading-relaxed">{bank.oneLineStory}</p>
          </div>

          {/* Schwab note */}
          {bank.schwabValidationNote && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 mb-1.5">
                ★ Predictive validation
              </div>
              <p className="text-xs text-amber-100/90 leading-relaxed">{bank.schwabValidationNote}</p>
            </div>
          )}

          {/* COF deliberate abstainer note */}
          {bank.deliberateAbstainerNote && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.03] p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-blue-400 mb-1.5">
                Deliberate strategic abstainer
              </div>
              <p className="text-xs text-blue-100/90 leading-relaxed">{bank.deliberateAbstainerNote}</p>
            </div>
          )}

          {/* Score breakdown */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">Score Breakdown</div>
            <div className="space-y-3">
              <ScoreRow label="R1 — Financial Resilience" value={bank.r1} weight="40%" color="#3b82f6" trend={bank.r1Trend}>
                {bank.hqlaUnderstated && (
                  <div className="text-[10px] text-amber-400 mt-1">
                    * R1 may be understated — bank-subsidiary Call Report excludes holding-company liquidity.
                  </div>
                )}
              </ScoreRow>
              <ScoreRow label="R2 — Governance Quality" value={bank.r2} weight="35%" color="#10b981" />
              <ScoreRow label="R3 — DA Risk Exposure Safety" value={bank.r3} weight="25%" color="#f59e0b" />
              <div className="pt-2 mt-2 border-t border-white/5">
                <ScoreRow
                  label="Weighted Composite"
                  value={bank.weightedComposite}
                  weight="0-100"
                  color={safetyColor(bank.weightedComposite)}
                  bold
                />
                <div className="text-[10px] text-neutral-500 mt-1 text-right">
                  Peer percentile: <span className="font-mono text-neutral-400">{bank.peerPercentile}%</span> among 12 genuine DA-active banks
                </div>
              </div>
            </div>
          </div>

          {/* R1 Trend chart */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                R1 Trend — Q1 2024 to Q4 2025
              </div>
              <div className="text-[11px] font-mono text-neutral-400">
                {trendIcon(bank.r1Trend)} {bank.r1Trend} (slope {bank.r1TrendSlope.toFixed(3)})
              </div>
            </div>
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <LineChart
                  data={bank.r1QuarterlyData.map(d => ({ q: d.quarter.replace(' ', ''), r1: d.r1 }))}
                  margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="q" stroke="#888" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis domain={[0, 100]} stroke="#888" tick={{ fontSize: 10, fill: '#888' }} />
                  <Tooltip
                    contentStyle={{ background: '#0a0a0a', border: '1px solid #ffffff20', borderRadius: 6, fontSize: 11 }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="r1"
                    stroke={CLUSTER_INFO[bank.cluster].color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CLUSTER_INFO[bank.cluster].color }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* R2 sub-components */}
          {!bank.isFalsePositive && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
                R2 Sub-components — Gemini scoring justifications
              </div>
              <div className="space-y-2">
                <SubScoreCard label="Formal 10-K Disclosure" data={bank.r2Formal} max={10} />
                <SubScoreCard label="Operational Controls" data={bank.r2OpsControls} max={10} />
                <SubScoreCard label="Technical Risk Documentation" data={bank.r2TechRisk} max={10} />
              </div>
              <div className="text-[10px] text-neutral-500 mt-2 leading-relaxed">
                Disclosure ratio (formal vs transcript): <span className="font-mono text-neutral-400">{bank.r2DisclosureRatio.toFixed(3)}</span>
                . Contextual only &mdash; not part of the displayed R2 score.
              </div>
            </div>
          )}

          {/* R3 sub-components */}
          {!bank.isFalsePositive && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
                R3 Sub-components — Operational risk dimensions
              </div>
              <div className="space-y-2">
                <SubScoreCard label="Vendor Concentration Safety" data={bank.r3Vendor} max={10} />
                <SubScoreCard label="Institutional vs Retail" data={bank.r3RetailInst} max={10} />
                <SubScoreCard label="Regulatory Readiness" data={bank.r3RegReadiness} max={10} />
                <SubScoreCard label="Contagion Containment (inverted)" data={bank.r3ContagionSafety} max={10} note="Higher raw = more contagion-prone. Inverted in score." />
              </div>
              {bank.r3PrimaryVendors.length > 0 && (
                <div className="mt-2 text-[11px]">
                  <span className="text-neutral-500">Primary vendors:</span>{' '}
                  <span className="text-neutral-300 font-mono">{bank.r3PrimaryVendors.join(', ')}</span>
                </div>
              )}
              {bank.r3ClientProfile && (
                <div className="text-[11px]">
                  <span className="text-neutral-500">Client profile:</span>{' '}
                  <span className="text-neutral-300">{bank.r3ClientProfile}</span>
                </div>
              )}
              {bank.r3GeniusActStatus && (
                <div className="text-[11px]">
                  <span className="text-neutral-500">GENIUS Act status:</span>{' '}
                  <span className="text-neutral-300">{bank.r3GeniusActStatus}</span>
                </div>
              )}
            </div>
          )}

          {/* Quadrant placement */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                Regulatory Readiness Placement
              </div>
              <span className="text-[10px] font-mono text-neutral-500">
                Confidence: <span className="text-neutral-300">{bank.quadrantConfidence}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span
                className="px-2.5 py-1 rounded text-xs font-mono font-bold"
                style={{
                  background: `${QUADRANT_COLORS[bank.quadrantLabel]}20`,
                  color: QUADRANT_COLORS[bank.quadrantLabel],
                  border: `1px solid ${QUADRANT_COLORS[bank.quadrantLabel]}40`,
                }}
              >
                {bank.quadrantLabel}
              </span>
              <span className="text-[10px] font-mono text-neutral-500">
                {bank.infraDepth} × {bank.regContingency}
              </span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed mb-3">{bank.quadrantJustification}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div>
                <div className="text-neutral-500 mb-1 font-mono">Infrastructure evidence:</div>
                <ul className="space-y-1">
                  {bank.infraEvidence.map((e, i) => (
                    <li key={i} className="text-neutral-400 flex items-start gap-1.5">
                      <span className="text-neutral-600">›</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-neutral-500 mb-1 font-mono">Contingency evidence:</div>
                <ul className="space-y-1">
                  {bank.contingencyEvidence.map((e, i) => (
                    <li key={i} className="text-neutral-400 flex items-start gap-1.5">
                      <span className="text-neutral-600">›</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 text-[11px]">
              <div className="text-neutral-500 mb-1 font-mono">What would change placement:</div>
              <p className="text-neutral-300">{bank.whatWouldChange}</p>
            </div>
          </div>

          {/* Supervisory action and flags */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                Supervisory Detail
              </div>
              <span className={`px-2 py-1 rounded text-[10px] font-mono border ${actionPillStyle(bank.supervisoryAction)}`}>
                {bank.supervisoryAction}
              </span>
            </div>
            <div className="mb-3">
              <div className="text-[10px] font-mono text-neutral-500 mb-1">Biggest systemic risk:</div>
              <p className="text-xs text-neutral-300 leading-relaxed">{bank.biggestRisk}</p>
            </div>
            {bank.supervisoryFlags.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-mono text-neutral-500 mb-1">Supervisory priority flags:</div>
                <ul className="space-y-1">
                  {bank.supervisoryFlags.map((f, i) => (
                    <li key={i} className="text-[11px] text-neutral-400 flex items-start gap-2">
                      <span className="text-rose-400/70 mt-0.5">⚑</span>
                      <span className="leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {bank.keyStrengths.length > 0 && (
              <div>
                <div className="text-[10px] font-mono text-neutral-500 mb-1">Key strengths:</div>
                <ul className="space-y-1">
                  {bank.keyStrengths.map((s, i) => (
                    <li key={i} className="text-[11px] text-neutral-400 flex items-start gap-2">
                      <span className="text-emerald-400/70 mt-0.5">✓</span>
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Engagement context */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
              Engagement Context
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
              <div>
                <div className="text-neutral-500 font-mono">T5 Composite</div>
                <div className="font-mono text-base text-neutral-200">{bank.t5Composite.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-neutral-500 font-mono">Tier</div>
                <div className="font-mono text-base text-neutral-200">{bank.t5Tier}</div>
              </div>
              <div>
                <div className="text-neutral-500 font-mono">D2 Specificity</div>
                <div className="font-mono text-base text-neutral-200">{bank.d2Specificity.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-neutral-500 font-mono">D3 Disclosure</div>
                <div className="font-mono text-base text-neutral-200">{bank.d3DisclosureMode.toFixed(2)}x</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreRow({
  label,
  value,
  weight,
  color,
  trend,
  bold = false,
  children,
}: {
  label: string;
  value: number;
  weight: string;
  color: string;
  trend?: 'improving' | 'stable' | 'declining';
  bold?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs ${bold ? 'text-neutral-200 font-medium' : 'text-neutral-400'}`}>{label}</span>
          {trend && <span className="text-[11px]">{trendIcon(trend)}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-neutral-500">{weight}</span>
          <span className={`font-mono ${bold ? 'text-base font-bold' : 'text-sm'}`} style={{ color }}>
            {value.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
      </div>
      {children}
    </div>
  );
}

function SubScoreCard({
  label,
  data,
  max,
  note,
}: {
  label: string;
  data: { raw: number; norm25: number; justification: string; evidence: string[] };
  max: number;
  note?: string;
}) {
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-neutral-300 font-medium">{label}</span>
        <span className="font-mono text-xs text-neutral-400">
          {data.raw}/{max} <span className="text-neutral-600">·</span>{' '}
          <span className="text-neutral-500">{data.norm25.toFixed(1)}/25</span>
        </span>
      </div>
      {note && <div className="text-[10px] text-neutral-500 mb-1 italic">{note}</div>}
      <p className="text-[11px] text-neutral-400 leading-relaxed">{data.justification}</p>
      {data.evidence.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] font-mono text-neutral-500 hover:text-neutral-300">
            ▸ Evidence ({data.evidence.length})
          </summary>
          <ul className="mt-1 space-y-0.5">
            {data.evidence.map((e, i) => (
              <li key={i} className="text-[10px] text-neutral-500 pl-2 border-l border-white/10">{e}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
