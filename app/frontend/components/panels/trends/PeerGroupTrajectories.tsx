'use client';

// Six small-multiples line charts, one per metric, each showing the
// per-peer-group AVERAGE across the 8 quarters. All visible at once — no
// metric selector — so you can scan how GSIB / trust-IB / regional are
// trending across every metric simultaneously. Companion to the latest-
// quarter Snapshot bars below.
//
// 5 of the 6 metrics are read directly from pc_trends.metrics_over_time
// (the historical payload). nbfi_growth is the QoQ delta of nbfi_loan_ratio
// computed on-the-fly per bank, then averaged within the peer group.

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Bank {
  ticker: string;
  peer_group: string;
}

interface QuarterMetrics {
  ci_ratio: number | null;
  loan_scale: number | null;
  nbfi_loan_ratio: number | null;
  nbfi_commitment_ratio: number | null;
  pe_exposure: number | null;
}

type MetricKey =
  | keyof QuarterMetrics
  | 'nbfi_growth';

const METRICS: { key: MetricKey; label: string; unit: 'pct' | 'log' | 'bps' }[] = [
  { key: 'nbfi_loan_ratio',       label: 'NBFI Loan Ratio',           unit: 'pct' },
  { key: 'nbfi_commitment_ratio', label: 'NBFI Commitment Pipeline',  unit: 'pct' },
  { key: 'ci_ratio',              label: 'C&I Concentration',         unit: 'pct' },
  { key: 'pe_exposure',           label: 'PE Exposure',               unit: 'pct' },
  { key: 'loan_scale',            label: 'Loan Book Scale',           unit: 'log' },
  { key: 'nbfi_growth',           label: 'NBFI QoQ Growth',           unit: 'bps' },
];

const PEER_COLOR: Record<string, string> = {
  GSIB:       '#8b5cf6',
  'trust-ib': '#3b82f6',
  regional:   '#10b981',
};

const PEER_LABEL: Record<string, string> = {
  GSIB:       'GSIB',
  'trust-ib': 'Trust / IB',
  regional:   'Regional',
};

const PEERS = ['GSIB', 'trust-ib', 'regional'] as const;

function mean(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function fmtY(unit: 'pct' | 'log' | 'bps', v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (unit === 'pct') return `${(v * 100).toFixed(1)}%`;
  if (unit === 'bps') return `${v >= 0 ? '+' : ''}${(v * 10000).toFixed(0)}bp`;
  // loan_scale is log-thousands → exp gives thousands; /1e6 → billions.
  const abs = Math.exp(v);
  return abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(0)}B` : `$${(abs / 1_000).toFixed(0)}M`;
}

interface Props {
  banks: Bank[];
  metricsOverTime: Record<string, Record<string, QuarterMetrics>>;
}

interface MiniChartData {
  quarter: string;
  GSIB: number | null;
  'trust-ib': number | null;
  regional: number | null;
}

export function PeerGroupTrajectories({ banks, metricsOverTime }: Props) {
  // Pre-bucket banks by peer once. Same buckets reused for every metric.
  const peerToTickers = useMemo(() => {
    const out: Record<string, string[]> = { GSIB: [], 'trust-ib': [], regional: [] };
    for (const b of banks) if (out[b.peer_group]) out[b.peer_group].push(b.ticker);
    return out;
  }, [banks]);

  // Union of quarters across all banks — sorted ascending.
  const quarters = useMemo(() => {
    const set = new Set<string>();
    for (const t of Object.keys(metricsOverTime)) {
      for (const q of Object.keys(metricsOverTime[t] || {})) set.add(q);
    }
    return Array.from(set).sort();
  }, [metricsOverTime]);

  // Build {metricKey: [{quarter, GSIB, trust-ib, regional}]} once per render.
  const dataByMetric = useMemo(() => {
    const out: Record<MetricKey, MiniChartData[]> = {} as never;
    for (const m of METRICS) {
      const series: MiniChartData[] = quarters.map((q) => {
        const row: MiniChartData = { quarter: q, GSIB: null, 'trust-ib': null, regional: null };
        for (const peer of PEERS) {
          const vals: number[] = [];
          for (const t of peerToTickers[peer]) {
            const mq = metricsOverTime[t]?.[q];
            if (!mq) continue;
            if (m.key === 'nbfi_growth') {
              const sortedQs = Object.keys(metricsOverTime[t] || {}).sort();
              const idx = sortedQs.indexOf(q);
              if (idx <= 0) continue;
              const prev = metricsOverTime[t][sortedQs[idx - 1]];
              if (!prev) continue;
              const cur = mq.nbfi_loan_ratio;
              const prv = prev.nbfi_loan_ratio;
              if (cur != null && prv != null && prv > 0) vals.push((cur - prv) / prv);
            } else {
              const v = mq[m.key as keyof QuarterMetrics];
              if (v != null) vals.push(v);
            }
          }
          row[peer] = mean(vals);
        }
        return row;
      });
      out[m.key] = series;
    }
    return out;
  }, [quarters, peerToTickers, metricsOverTime]);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-100">
        <h3 className="font-semibold text-neutral-900 text-base">
          Peer-Group Trajectories — Average Per Group, Across 8 Quarters
        </h3>
        <p className="text-xs text-neutral-400 mt-0.5">
          Six small-multiples — one per metric. Each shows the within-peer-
          group average over time. All metrics visible at once so you can
          scan GSIB vs trust-IB vs regional movement on every dimension
          simultaneously, without flipping between tabs.
        </p>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {METRICS.map((m) => (
          <div key={m.key} className="rounded-lg border border-neutral-100 p-3">
            <div className="text-xs font-semibold text-neutral-700 mb-1">
              {m.label}
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart
                data={dataByMetric[m.key]}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis
                  dataKey="quarter"
                  tick={{ fontSize: 9, fill: '#a3a3a3' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e5e5' }}
                  interval="preserveStartEnd"
                  minTickGap={8}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#a3a3a3' }}
                  tickLine={false}
                  axisLine={false}
                  width={38}
                  tickFormatter={(v: number) => fmtY(m.unit, v)}
                />
                <Tooltip
                  cursor={{ stroke: '#e5e5e5', strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="bg-white border border-neutral-200 rounded-md p-2 shadow-md text-[11px]">
                        <div className="font-mono font-semibold text-neutral-900">
                          {label}
                        </div>
                        {payload.map((p) => (
                          <div key={p.name} className="flex items-baseline gap-1.5 mt-0.5">
                            <span
                              className="inline-block w-2 h-2 rounded-sm"
                              style={{ backgroundColor: p.color }}
                            />
                            <span className="font-medium text-neutral-700">
                              {PEER_LABEL[p.name as string]}
                            </span>
                            <span className="text-neutral-500 font-mono">
                              {fmtY(m.unit, p.value as number)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {PEERS.map((peer) => (
                  <Line
                    key={peer}
                    type="monotone"
                    dataKey={peer}
                    stroke={PEER_COLOR[peer]}
                    strokeWidth={1.75}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
      {/* Shared legend */}
      <div className="px-6 pb-4 flex items-center gap-4 text-[11px] text-neutral-500">
        {PEERS.map((peer) => (
          <span key={peer} className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm inline-block"
              style={{ backgroundColor: PEER_COLOR[peer] }}
            />
            {PEER_LABEL[peer]}
          </span>
        ))}
      </div>
    </section>
  );
}
