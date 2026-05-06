'use client';

import { useState, useMemo } from 'react';
import {
  SCORES, BANK_NAMES_SORTED,
  tierColor, tierBg, clusterColor, compositeColor,
  type TierLabel,
} from '@/lib/da-data';

const TIER_FILTERS: { label: string; value: TierLabel | 'all' }[] = [
  { label: 'All 16',           value: 'all'    },
  { label: 'Tier 1 · Leader',  value: 'Tier 1' },
  { label: 'Tier 2 · Advanced',value: 'Tier 2' },
  { label: 'Tier 3 · Building',value: 'Tier 3' },
  { label: 'Tier 4 · Watching',value: 'Tier 4' },
  { label: 'Tier 5 · Absent',  value: 'Tier 5' },
];

const DIM_COLORS = ['#3b82f6', '#10b981', '#a78bfa', '#f59e0b'];

export function DALeaderboardPanel() {
  const [tierFilter, setTierFilter] = useState<TierLabel | 'all'>('all');

  const filteredBanks = useMemo(() =>
    BANK_NAMES_SORTED.filter(n =>
      tierFilter === 'all' || SCORES[n].tier === tierFilter
    ), [tierFilter]);

  return (
    <div className="space-y-4">

      {/* Leaderboard */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="mb-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
            Engagement Score Rankings
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            16 banks ranked by <span className="text-white font-medium">4-dimensional engagement composite (0–100)</span> — measuring how actively each bank is participating in digital assets, not how safely. Safety analysis is on the <strong className="text-white">Risk</strong> tab.{' '}
            <span className="text-rose-400">FP = confirmed false positive</span>.
          </p>
        </div>

        {/* Tier filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {TIER_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setTierFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-colors border ${
                tierFilter === f.value
                  ? 'bg-amber-500 text-black border-amber-500 font-bold'
                  : 'border-white/10 text-neutral-400 hover:border-amber-400 hover:text-amber-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-neutral-500 border-b border-white/5">
                <th className="py-2 text-center w-8">#</th>
                <th className="py-2 text-left w-14">Ticker</th>
                <th className="py-2 text-left">Institution</th>
                <th className="py-2 text-right w-20">Composite</th>
                <th className="py-2 text-right w-20">NLP Peak</th>
                <th className="py-2 text-right w-12">D1</th>
                <th className="py-2 text-right w-12">D2</th>
                <th className="py-2 text-right w-12">D3</th>
                <th className="py-2 text-right w-12">D4</th>
                <th className="py-2 text-left w-28 pl-3">Tier</th>
              </tr>
            </thead>
            <tbody>
              {filteredBanks.map((name, i) => {
                const s = SCORES[name];
                const tc = tierColor(s.tier);
                const cc = clusterColor(s.cluster);
                return (
                  <tr
                    key={name}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-2.5 text-center font-mono text-xs text-neutral-500">{i + 1}</td>
                    <td className="py-2.5 font-mono font-bold text-amber-400 text-xs">{s.ticker}</td>
                    <td className="py-2.5">
                      <span className="text-white">{name}</span>
                      {s.fp && <span className="ml-2 text-[10px] font-mono text-rose-400">FP</span>}
                      <span
                        className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: `${cc}22`, color: cc }}
                      >
                        Cl.{s.cluster}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold tabular-nums"
                      style={{ color: compositeColor(s.comp) }}>
                      {s.comp.toFixed(1)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs text-neutral-400 tabular-nums">
                      {s.nlpPeak.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs tabular-nums" style={{ color: DIM_COLORS[0] }}>{s.d1.toFixed(1)}</td>
                    <td className="py-2.5 text-right font-mono text-xs tabular-nums" style={{ color: DIM_COLORS[1] }}>{s.d2.toFixed(1)}</td>
                    <td className="py-2.5 text-right font-mono text-xs tabular-nums" style={{ color: DIM_COLORS[2] }}>{s.d3.toFixed(1)}</td>
                    <td className="py-2.5 text-right font-mono text-xs tabular-nums" style={{ color: DIM_COLORS[3] }}>{s.d4}</td>
                    <td className="py-2.5 pl-3">
                      <span
                        className="text-[10px] font-mono px-2 py-0.5 rounded font-bold"
                        style={{ background: tierBg(s.tier), color: tc }}
                      >
                        {s.tier}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* False positive note */}
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-neutral-400 leading-relaxed">
        <span className="text-rose-400 font-medium">False positive disclosure: </span>
        Wells Fargo, Truist, Bank of Montreal, and TD Bank passed initial NLP screening due to
        the word "circle" appearing in idiomatic phrases ("circle back," "full circle"). Manual
        excerpt review confirmed none reference Circle Financial. NLP scores zeroed; D4 trajectory
        signals retained. TD Bank's "strategic investment" refers to its Schwab stake.
      </div>

      {/* D1–D4 scoring dimensions reference */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
            How the Engagement Score is Built — 4 Dimensions (D1–D4, each 0–25)
          </div>
        </div>
        <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-white/5">
          {[
            {
              dim: 'D1', color: '#3b82f6',
              label: 'NLP Engagement',
              formula: 'min(25, log(adj_peak+1) / log(21) × 25)',
              desc: 'Log-normalised adjusted NLP peak score from 128 Q&A earnings sessions. Log scale prevents outliers from dominating — Schwab 19.81 → 24.9, BNY 9.70 → 19.5.',
            },
            {
              dim: 'D2', color: '#10b981',
              label: 'Specificity & Depth',
              formula: 'min(10, terms×0.85) + specificity×10 + consistency×5',
              desc: 'Rewards infrastructure-specific vocabulary over generic volume. State Street specificity=1.0 (100% Custodial). PNC specificity=0.048 (90% General — reactive, not operational).',
            },
            {
              dim: 'D3', color: '#a78bfa',
              label: 'Disclosure Mode',
              formula: 'Q&A/Full-transcript ratio → 0–25',
              desc: 'Proactive discloser if Q&A ratio >2.0x. Goldman 0.23x — discusses DA 4× more in prepared remarks than Q&A. Citi 3.40x — fully proactive. Captures systematic underdisclosers.',
            },
            {
              dim: 'D4', color: '#f59e0b',
              label: 'External Research',
              formula: 'products_launched(0–10) + infra_depth(0–8) + trajectory(0–7)',
              desc: 'Analyst-judged. Compensates for underdisclosers like Goldman (D1=8.6 → composite 39.9) using GS DAP spin-out, tokenized MMF with BNY, EIB digital bond, $135M DA investment.',
            },
          ].map(d => (
            <div key={d.dim} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono font-bold text-lg" style={{ color: d.color }}>{d.dim}</span>
                <span className="text-xs font-medium text-neutral-300">{d.label}</span>
              </div>
              <div className="font-mono text-[10px] px-2 py-1 rounded mb-2" style={{ background: `${d.color}10`, color: d.color }}>
                {d.formula}
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
