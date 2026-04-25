'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  Anomaly,
  AnomalySentiment,
  AnomalySeverity,
} from '@/lib/types';

const SEVERITY_STYLES: Record<AnomalySeverity, string> = {
  high: 'bg-rose-100 text-rose-700 border-rose-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

const SEVERITY_LABEL: Record<AnomalySeverity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const SENTIMENT_STYLES: Record<AnomalySentiment, string> = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  negative: 'bg-rose-50 text-rose-700 border-rose-200',
  inconclusive: 'bg-neutral-50 text-neutral-500 border-neutral-200',
};

const SENTIMENT_LABEL: Record<AnomalySentiment, string> = {
  positive: 'Positive',
  negative: 'Negative',
  inconclusive: 'Inconclusive',
};

function formatPct(v: number | null): string | null {
  if (v === null || v === undefined) return null;
  return `${(v * 100).toFixed(2)}%`;
}

function MetricChip({ a }: { a: Anomaly }) {
  const value = formatPct(a.metric_value);
  const peer = formatPct(a.peer_median);
  if (!value && !peer) return null;
  return (
    <div className="text-xs text-neutral-600 mt-2 flex items-center gap-2">
      {value && (
        <span className="px-2 py-0.5 rounded bg-neutral-100 font-mono">
          {value}
        </span>
      )}
      {peer && (
        <span className="text-neutral-400">
          vs peer median <span className="font-mono">{peer}</span>
        </span>
      )}
    </div>
  );
}

function HistorySparkline({ a }: { a: Anomaly }) {
  if (!a.history || a.history.length < 2) return null;
  const data = a.history.map((p) => ({
    quarter: p.quarter,
    value: Number((p.value * 100).toFixed(3)),
  }));
  return (
    <div className="mt-3 h-20 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="quarter"
            tick={{ fontSize: 9, fill: '#737373' }}
            axisLine={false}
            tickLine={false}
            interval={Math.max(0, Math.ceil(data.length / 4) - 1)}
          />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            cursor={{ stroke: '#a3a3a3', strokeWidth: 1 }}
            contentStyle={{
              fontSize: 11,
              padding: '4px 6px',
              borderRadius: 4,
              border: '1px solid #e5e5e5',
            }}
            formatter={(v: number) => [`${v.toFixed(2)}%`, 'NBFI']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#6366f1"
            strokeWidth={1.6}
            dot={{ r: 2, fill: '#6366f1' }}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PeerComparisonBar({ a }: { a: Anomaly }) {
  if (a.metric_value === null || a.peer_median === null) return null;
  if (a.history && a.history.length >= 2) return null; // sparkline preferred
  const data = [
    { name: a.bank_ticker, value: Number((a.metric_value * 100).toFixed(3)) },
    { name: 'Peer', value: Number((a.peer_median * 100).toFixed(3)) },
  ];
  return (
    <div className="mt-3 h-20 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, left: 24, bottom: 0 }}>
          <XAxis type="number" hide domain={[0, (max: number) => max * 1.15]} />
          <YAxis
            type="category"
            dataKey="name"
            width={40}
            tick={{ fontSize: 10, fill: '#525252' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              padding: '4px 6px',
              borderRadius: 4,
              border: '1px solid #e5e5e5',
            }}
            formatter={(v: number) => [`${v.toFixed(2)}%`, 'Value']}
          />
          <Bar dataKey="value" radius={[2, 2, 2, 2]}>
            <Cell fill="#6366f1" />
            <Cell fill="#a3a3a3" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const [expanded, setExpanded] = useState(false);
  const isPlaceholder = anomaly.bank_ticker === '-';
  const sevClass = SEVERITY_STYLES[anomaly.severity];
  const sentClass = SENTIMENT_STYLES[anomaly.sentiment];

  const canExpand =
    !!anomaly.full_detail &&
    anomaly.full_detail.length > anomaly.detail.replace(/…$/, '').length;

  const shownText = expanded && anomaly.full_detail
    ? anomaly.full_detail
    : anomaly.detail;

  return (
    <div className="border border-neutral-200 rounded-lg p-4 bg-white hover:border-neutral-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          {!isPlaceholder && (
            <span className="font-semibold text-neutral-900 text-sm">
              {anomaly.bank_ticker}
            </span>
          )}
          {anomaly.quarter && (
            <span className="text-xs text-neutral-400 font-mono">
              {anomaly.quarter}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-none">
          <span className={`text-[10px] px-2 py-0.5 rounded border ${sentClass}`}>
            {SENTIMENT_LABEL[anomaly.sentiment]}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded border ${sevClass}`}>
            {SEVERITY_LABEL[anomaly.severity]}
          </span>
        </div>
      </div>

      <div className="mt-2 text-sm font-medium text-neutral-800">
        {anomaly.headline}
      </div>
      <div className="mt-1 text-xs text-neutral-600 leading-relaxed whitespace-pre-wrap">
        {shownText}
      </div>
      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {expanded ? 'Show less' : 'Show full text'}
        </button>
      )}

      <MetricChip a={anomaly} />
      <HistorySparkline a={anomaly} />
      <PeerComparisonBar a={anomaly} />

      {anomaly.citations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-wrap gap-2">
          {anomaly.citations.map((c, idx) => (
            <span
              key={idx}
              className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono"
              title={c.kind}
            >
              {c.label || c.kind}
              {c.ref_id != null && ` #${c.ref_id}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
