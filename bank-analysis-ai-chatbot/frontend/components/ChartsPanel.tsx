'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ReferenceLine,
} from 'recharts';
import type { ReasoningStep } from '@/lib/types';

interface Props {
  steps: ReasoningStep[];
}

// ── data shapes coming back from the agent tools ──────────────────────────────

interface PeerRow { bank: string; value: number; rank: number; }
interface PeerResult {
  concept_label: string | null;
  quarter: string;
  rows: PeerRow[];
  cohort: { median: number | null; mean: number | null };
}

interface CallFact {
  bank_ticker: string;
  quarter: string;
  value_numeric: number | null;
  label: string | null;
  schedule: string;
  line_item: string;
}
interface CallResult {
  concept_label: string | null;
  facts: CallFact[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}B`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316',
];

// ── peer bar chart ────────────────────────────────────────────────────────────

function PeerBarChart({ data }: { data: PeerResult }) {
  const rows = data.rows.slice(0, 20).map(r => ({
    bank: r.bank,
    value: r.value,
  }));
  const median = data.cohort.median ?? undefined;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h4 className="font-semibold text-neutral-800 text-sm">
          {data.concept_label ?? 'Peer comparison'} — {data.quarter}
        </h4>
        {median !== undefined && (
          <span className="text-xs text-neutral-500">
            cohort median {fmt(median)}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 28)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
          <XAxis
            type="number"
            tickFormatter={fmt}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="bank"
            width={44}
            tick={{ fontSize: 11, fill: '#374151' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v) => [typeof v === 'number' ? fmt(v) : v, 'Exposure']}
            contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
          />
          <Bar dataKey="value" fill="#6366f1" radius={[0, 3, 3, 0]} maxBarSize={20} />
          {median !== undefined && (
            <ReferenceLine
              x={median}
              stroke="#f59e0b"
              strokeDasharray="4 3"
              label={{ value: 'median', position: 'right', fontSize: 10, fill: '#f59e0b' }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── trend line chart ──────────────────────────────────────────────────────────

function TrendLineChart({ data }: { data: CallResult }) {
  const facts = data.facts.filter(f => f.value_numeric !== null);
  if (!facts.length) return null;

  // Pivot: { quarter -> { bankA: val, bankB: val } }
  const quarters = [...new Set(facts.map(f => f.quarter))].sort();
  const banks = [...new Set(facts.map(f => f.bank_ticker))];
  const chartData = quarters.map(q => {
    const row: Record<string, string | number> = { quarter: q };
    for (const b of banks) {
      const f = facts.find(x => x.quarter === q && x.bank_ticker === b);
      if (f?.value_numeric !== null && f?.value_numeric !== undefined) {
        row[b] = f.value_numeric;
      }
    }
    return row;
  });

  // Only render if there are at least 2 quarters (trend is meaningless otherwise)
  if (quarters.length < 2) return null;

  return (
    <div>
      <h4 className="font-semibold text-neutral-800 text-sm mb-3">
        {data.concept_label ?? 'Call Report trend'} — quarter over quarter
      </h4>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="quarter"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            formatter={(v) => typeof v === 'number' ? fmt(v) : v}
            contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {banks.map((b, i) => (
            <Line
              key={b}
              type="monotone"
              dataKey={b}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── main panel ────────────────────────────────────────────────────────────────

export function ChartsPanel({ steps }: Props) {
  const peerStep = steps.findLast(s => s.tool_name === 'compare_peers');
  const callStep = steps.findLast(s => s.tool_name === 'query_call_report');

  const peerData = peerStep?.tool_result as PeerResult | undefined;
  const callData = callStep?.tool_result as CallResult | undefined;

  const hasPeer = peerData?.rows && peerData.rows.length > 0;
  const hasCall = callData?.facts && callData.facts.filter(f => f.value_numeric !== null).length > 1;

  if (!hasPeer && !hasCall) return null;

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-8">
      <h3 className="font-semibold text-neutral-900 text-base -mb-2">Charts</h3>
      {hasPeer && <PeerBarChart data={peerData!} />}
      {hasCall && <TrendLineChart data={callData!} />}
    </section>
  );
}
