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

      {/* Validation banner */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-1">
          Methodology Validation · April 16, 2026
        </div>
        <p className="text-sm text-neutral-300 leading-relaxed">
          Our NLP model scored Charles Schwab at{' '}
          <span className="font-semibold text-white">19.81 in Q2 2025</span> — highest in
          the dataset. On April 16, 2026,{' '}
          <span className="font-semibold text-white">Schwab launched "Schwab Crypto"</span> — direct
          BTC/ETH at 75bps. The model flagged this intent{' '}
          <span className="font-semibold text-white">10 months before product launch</span>.
          Bank profiles and cluster analysis are on the <strong className="text-white">Trends</strong> tab.
        </p>
      </div>

      {/* Leaderboard */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <p className="text-xs text-neutral-400 mb-3 leading-relaxed">
          Banks ranked by <span className="text-white font-medium">composite score (0–100)</span>{' '}
          combining four independent dimensions (D1–D4, each 0–25). Goldman Sachs ranks 11th in
          NLP but Tier 3 due to strong external research (D4=22).{' '}
          <span className="text-rose-400">FP = confirmed false positive</span>.
        </p>

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

    </div>
  );
}
