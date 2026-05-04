'use client';

// Latest-quarter snapshot — peer-group averages for all 6 ranking metrics in
// one grouped-bar view. Answers "where do GSIBs / trust-IBs / regionals
// stand RIGHT NOW on each metric" without scrolling through the trajectories
// chart 6 times.
//
// Reads pc_rankings.json (the latest-quarter source — already includes the
// derived nbfi_growth field that's missing from the historical
// metrics_over_time payload).

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface RankingsBank {
  ticker: string;
  peer_group: string;
  raw: Record<string, number | null>;
}

interface MetricDef {
  key: string;
  label: string;
}

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

// All 6 metrics in display order. Note the unit per metric — NBFI growth is
// in bps (signed), loan_scale needs the log → $B unwrap, the rest are pct.
const METRIC_UNITS: Record<string, 'pct' | 'log' | 'bps'> = {
  nbfi_loan_ratio:       'pct',
  nbfi_commitment_ratio: 'pct',
  ci_ratio:              'pct',
  pe_exposure:           'pct',
  loan_scale:            'log',
  nbfi_growth:           'bps',
};

const METRIC_SHORT_LABEL: Record<string, string> = {
  nbfi_loan_ratio:       'NBFI Loans',
  nbfi_commitment_ratio: 'NBFI Commits',
  ci_ratio:              'C&I',
  pe_exposure:           'PE Exposure',
  loan_scale:            'Loan Scale',
  nbfi_growth:           'NBFI QoQ',
};

function mean(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function fmt(unit: 'pct' | 'log' | 'bps', v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (unit === 'pct') return `${(v * 100).toFixed(2)}%`;
  if (unit === 'bps') return `${v >= 0 ? '+' : ''}${(v * 10000).toFixed(0)} bps`;
  const abs = Math.exp(v);
  return abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(0)}B` : `$${(abs / 1_000).toFixed(0)}M`;
}

interface Props {
  rankingsBanks: RankingsBank[];
  metrics: MetricDef[];
  quarter: string;
}

// Each metric becomes its own mini bar chart so the y-axes don't collapse
// (NBFI ratios are 0..1, loan_scale is log values around 18, nbfi_growth is
// signed and tiny). One row of 6 cards is more readable than one giant
// dual-axis chart.
export function PeerGroupSnapshotBars({ rankingsBanks, metrics, quarter }: Props) {
  // Pre-compute means once: { [metricKey]: { GSIB: x, trust-ib: y, regional: z } }
  // Mean (not median) per the analyst spec — gives the "average bank" read
  // within each peer group. Heavy tails are visible separately in the
  // sentiment-exposure scatter below, so robustness is less critical here.
  const averages = useMemo(() => {
    const out: Record<string, Record<string, number | null>> = {};
    const peers = ['GSIB', 'trust-ib', 'regional'];
    for (const m of metrics) {
      out[m.key] = {};
      for (const peer of peers) {
        const vals = rankingsBanks
          .filter((b) => b.peer_group === peer)
          .map((b) => b.raw[m.key])
          .filter((v): v is number => v != null && Number.isFinite(v));
        out[m.key][peer] = mean(vals);
      }
    }
    return out;
  }, [rankingsBanks, metrics]);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-100">
        <h3 className="font-semibold text-neutral-900 text-base">
          Per-Peer-Group Snapshot — All 6 Metrics ({quarter})
        </h3>
        <p className="text-xs text-neutral-400 mt-0.5">
          Average value within each peer group at the latest quarter. Scan
          left-to-right to see where GSIBs are most distinctive (NBFI book
          ratios) and where regionals catch up (C&I concentration).
        </p>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m) => {
          const unit = METRIC_UNITS[m.key] || 'pct';
          const data = (['GSIB', 'trust-ib', 'regional'] as const).map((peer) => ({
            peer,
            label: PEER_LABEL[peer],
            value: averages[m.key]?.[peer] ?? null,
          }));
          return (
            <div key={m.key} className="rounded-lg border border-neutral-100 p-3">
              <div className="text-xs font-semibold text-neutral-700 mb-1">
                {METRIC_SHORT_LABEL[m.key] || m.label}
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ top: 4, right: 36, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={false} />
                  <XAxis
                    type="number"
                    hide
                    domain={
                      unit === 'bps'
                        ? ([(min: number, max: number) => Math.min(min, 0), (max: number) => Math.max(max, 0)] as never)
                        : ['auto', 'auto']
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#737373' }}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(99,102,241,0.04)' }}
                    formatter={(v: unknown) => fmt(unit, v as number | null)}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                    {data.map((d) => (
                      <Cell key={d.peer} fill={PEER_COLOR[d.peer]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Caption */}
              <div className="mt-1 text-[10px] text-neutral-400 font-mono">
                {data.map((d) => (
                  <span key={d.peer} className="mr-2">
                    {PEER_LABEL[d.peer]}: {fmt(unit, d.value)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
