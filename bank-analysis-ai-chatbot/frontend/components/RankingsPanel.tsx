'use client';

import { useEffect, useState, useMemo } from 'react';

// ── types ──────────────────────────────────────────────────────────────────────

interface MetricDef {
  key: string;
  label: string;
  description: string;
  higher_is_better: boolean;
}

interface BankRow {
  ticker: string;
  name: string;
  peer_group: string;
  raw: Record<string, number | null>;
  norm: Record<string, number>;
}

interface RankingsData {
  quarter: string;
  metrics: MetricDef[];
  banks: BankRow[];
}

// ── default weights (must sum to 100) ─────────────────────────────────────────

const DEFAULT_WEIGHTS: Record<string, number> = {
  ci_ratio: 20,
  loan_scale: 10,
  nbfi_loan_ratio: 30,
  nbfi_commitment_ratio: 20,
  pe_exposure: 10,
  nbfi_growth: 10,
};

// ── formatters ────────────────────────────────────────────────────────────────

function fmtRaw(key: string, val: number | null): string {
  if (val === null || val === undefined) return '—';
  if (key === 'loan_scale') {
    const abs = Math.exp(val);
    if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(0)}B`;
    if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}M`;
    return `$${abs.toFixed(0)}`;
  }
  if (key === 'nbfi_growth') return `${(val * 100).toFixed(1)}%`;
  return `${(val * 100).toFixed(2)}%`;
}

function scoreColor(s: number): string {
  if (s >= 0.7) return 'bg-emerald-500';
  if (s >= 0.45) return 'bg-amber-400';
  return 'bg-rose-400';
}

function peerBadge(pg: string): string {
  if (pg === 'GSIB') return 'bg-purple-100 text-purple-700';
  if (pg === 'trust-ib') return 'bg-blue-100 text-blue-700';
  return 'bg-neutral-100 text-neutral-600';
}

// ── subcomponents ─────────────────────────────────────────────────────────────

function WeightSlider({
  metric,
  weight,
  onChange,
}: {
  metric: MetricDef;
  weight: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-medium text-neutral-700">{metric.label}</span>
        <span className="text-xs font-semibold text-indigo-600 w-10 text-right">{weight}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={weight}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-indigo-500 cursor-pointer"
      />
      <p className="text-[11px] text-neutral-400 leading-tight">{metric.description}</p>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function RankingsPanel() {
  const [data, setData] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const [peerFilter, setPeerFilter] = useState<string>('all');
  const [showWeights, setShowWeights] = useState(false);

  function changeWeight(key: string, newVal: number) {
    setWeights((prev) => {
      const clamped = Math.min(100, Math.max(0, newVal));
      const others = Object.keys(prev).filter((k) => k !== key);
      const otherTotal = others.reduce((s, k) => s + prev[k], 0);
      const next: Record<string, number> = { ...prev, [key]: clamped };
      const budget = 100 - clamped;
      if (otherTotal === 0) {
        const share = Math.floor(budget / others.length);
        others.forEach((k) => { next[k] = share; });
        next[others[others.length - 1]] = budget - share * (others.length - 1);
      } else {
        let allocated = 0;
        others.forEach((k, i) => {
          if (i === others.length - 1) {
            next[k] = budget - allocated;
          } else {
            next[k] = Math.round(prev[k] * (budget / otherTotal));
            allocated += next[k];
          }
        });
      }
      return next;
    });
  }

  useEffect(() => {
    fetch('/api/backend/rankings')
      .then((r) => r.json())
      .then((d: RankingsData) => {
        setData(d);
        const init: Record<string, number> = {};
        d.metrics.forEach((m) => { init[m.key] = DEFAULT_WEIGHTS[m.key] ?? 1; });
        setWeights(init);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const ranked = useMemo(() => {
    if (!data) return [];
    return data.banks
      .filter((b) => peerFilter === 'all' || b.peer_group === peerFilter)
      .map((b) => {
        const score = data.metrics.reduce((sum, m) => {
          const w = (weights[m.key] ?? 0) / 100;
          const norm = m.higher_is_better ? b.norm[m.key] : 1 - b.norm[m.key];
          return sum + w * norm;
        }, 0);
        return { ...b, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [data, weights, peerFilter]);

  if (loading) {
    return (
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-40 bg-neutral-100 rounded animate-pulse" />
      </section>
    );
  }

  if (error || !data) {
    return null;
  }

  const peerGroups = ['all', ...Array.from(new Set(data.banks.map((b) => b.peer_group)))];

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
        <div>
          <h3 className="font-semibold text-neutral-900 text-base">Bank Rankings</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Ranked by private credit relevance · {data.quarter} Call Report data
          </p>
        </div>
        <button
          onClick={() => setShowWeights((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600
            hover:bg-indigo-50 font-medium"
        >
          {showWeights ? 'Hide weights' : 'Adjust weights'}
        </button>
      </div>

      {/* weight sliders */}
      {showWeights && (
        <div className="px-6 py-5 bg-neutral-50 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-neutral-500">
              Adjust how each metric is weighted. Weights always sum to{' '}
              <span className="font-semibold text-indigo-600">100%</span>.
            </p>
            <button
              onClick={() => setWeights(DEFAULT_WEIGHTS)}
              className="text-xs text-neutral-400 hover:text-neutral-600 underline"
            >
              Reset
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            {data.metrics.map((m) => (
              <WeightSlider
                key={m.key}
                metric={m}
                weight={weights[m.key] ?? 0}
                onChange={(v) => changeWeight(m.key, v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* peer filter */}
      <div className="flex gap-2 px-6 pt-4 pb-2 flex-wrap">
        {peerGroups.map((pg) => (
          <button
            key={pg}
            onClick={() => setPeerFilter(pg)}
            className={`text-xs px-3 py-1 rounded-full border font-medium capitalize transition-colors ${
              peerFilter === pg
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
            }`}
          >
            {pg === 'all' ? 'All banks' : pg === 'trust-ib' ? 'Trust / IB' : pg}
          </button>
        ))}
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-400 border-b border-neutral-100">
              <th className="px-6 py-2 font-medium w-8">#</th>
              <th className="px-2 py-2 font-medium">Bank</th>
              <th className="px-3 py-2 font-medium">Score</th>
              {data.metrics.map((m) => (
                <th key={m.key} className="px-3 py-2 font-medium whitespace-nowrap">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map((bank, i) => (
              <tr
                key={bank.ticker}
                className={`border-b border-neutral-50 hover:bg-neutral-50 transition-colors ${
                  i < 3 ? 'bg-indigo-50/30' : ''
                }`}
              >
                <td className="px-6 py-2.5 text-xs text-neutral-400 font-mono">{i + 1}</td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-800 text-sm">{bank.ticker}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${peerBadge(bank.peer_group)}`}
                    >
                      {bank.peer_group === 'trust-ib' ? 'IB' : bank.peer_group}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 truncate max-w-[160px]">{bank.name}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${scoreColor(bank.score)}`}
                        style={{ width: `${bank.score * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-neutral-700 tabular-nums">
                      {(bank.score * 100).toFixed(0)}
                    </span>
                  </div>
                </td>
                {data.metrics.map((m) => {
                  const raw = bank.raw[m.key];
                  const norm = bank.norm[m.key];
                  const missing = raw === null || raw === undefined;
                  return (
                    <td key={m.key} className="px-3 py-2.5 text-xs tabular-nums">
                      {missing ? (
                        <span className="text-neutral-300">—</span>
                      ) : (
                        <span
                          className={
                            norm > 0.66
                              ? 'text-emerald-600 font-medium'
                              : norm > 0.33
                              ? 'text-neutral-600'
                              : 'text-rose-500'
                          }
                        >
                          {fmtRaw(m.key, raw)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="px-6 py-3 text-[11px] text-neutral-400 border-t border-neutral-100">
        — = metric not reported (FFIEC "CONF"). Score = weighted average of 0–1 normalized metrics.
        NBFI Loan Ratio and PE Exposure are reported by ~28% of banks; others score 0 on those dimensions.
      </p>
    </section>
  );
}
