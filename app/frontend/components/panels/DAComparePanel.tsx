'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  SCORES, QNA, BANK_NAMES_SORTED,
  tierColor, tierBg, clusterColor,
} from '@/lib/da-data';

const COMPARE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#a78bfa'];
const MAX_BANKS = 4;

export function DAComparePanel() {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(name: string) {
    if (selected.includes(name)) {
      setSelected(prev => prev.filter(n => n !== name));
    } else if (selected.length < MAX_BANKS) {
      setSelected(prev => [...prev, name]);
    }
  }

  const bankData = useMemo(() =>
    selected.map((name, i) => ({
      name,
      s: SCORES[name],
      q: QNA[name],
      color: COMPARE_COLORS[i],
    })), [selected]);

  // Bar chart: composite vs NLP peak
  const barData = [
    { metric: 'Composite', ...Object.fromEntries(bankData.map(b => [b.s.ticker, b.s.comp])) },
    { metric: 'NLP Peak', ...Object.fromEntries(bankData.map(b => [b.s.ticker, b.s.nlpPeak])) },
  ];

  // Line chart: quarterly trends (use first bank's quarters as labels)
  const quarters = bankData[0]?.q.quarters ?? [];
  const lineData = quarters.map((qtr, i) => ({
    quarter: qtr,
    ...Object.fromEntries(bankData.map(b => [b.s.ticker, b.q.scores[i] ?? 0])),
  }));

  // Radar chart: 4 dimensions
  const radarData = [
    { dim: 'D1: NLP', ...Object.fromEntries(bankData.map(b => [b.s.ticker, b.s.d1])) },
    { dim: 'D2: Specificity', ...Object.fromEntries(bankData.map(b => [b.s.ticker, b.s.d2])) },
    { dim: 'D3: Disclosure', ...Object.fromEntries(bankData.map(b => [b.s.ticker, b.s.d3])) },
    { dim: 'D4: External', ...Object.fromEntries(bankData.map(b => [b.s.ticker, b.s.d4])) },
  ];

  const TABLE_ROWS: [string, (b: typeof bankData[0]) => string][] = [
    ['Composite (/100)', b => b.s.comp.toFixed(1)],
    ['Tier', b => b.s.tier],
    ['Cluster', b => `Cluster ${b.s.cluster}`],
    ['D1: NLP', b => `${b.s.d1.toFixed(1)} /25`],
    ['D2: Specificity', b => `${b.s.d2.toFixed(1)} /25`],
    ['D3: Disclosure', b => `${b.s.d3.toFixed(1)} /25`],
    ['D4: External', b => `${b.s.d4} /25`],
    ['NLP Peak (adj)', b => b.s.nlpPeak.toFixed(2)],
    ['Real Terms', b => String(b.s.realTerms)],
    ['Specificity %', b => `${(b.s.specificity * 100).toFixed(0)}%`],
    ['Disclosure Ratio', b => `${b.s.disclosure.toFixed(2)}x`],
    ['Consistency', b => `${Math.round(b.s.consistency * 8)}/8`],
    ['False Positive', b => (b.s.fp ? 'YES ⚠' : 'No')],
  ];

  return (
    <div className="space-y-5">
      {/* Instructions */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <p className="text-xs text-neutral-400 leading-relaxed">
          Select up to <span className="text-white font-medium">4 banks</span> to compare. The dimension breakdown
          reveals banks with similar composites but fundamentally different drivers — e.g.{' '}
          <span className="text-white">Goldman</span> (D4-heavy, underdiscloser) vs{' '}
          <span className="text-white">Schwab</span> (D1+D3-heavy, proactive discloser).
          Both Tier 3, completely different strategic postures.
        </p>
        <div className="text-xs font-mono text-neutral-500 mt-2">
          {selected.length} / {MAX_BANKS} selected
          {selected.length < 2 && ' — pick at least 2 to compare'}
        </div>
      </div>

      {/* Bank chips */}
      <div className="flex flex-wrap gap-2">
        {BANK_NAMES_SORTED.map(name => {
          const s = SCORES[name];
          const idx = selected.indexOf(name);
          const isOn = idx !== -1;
          const cc = clusterColor(s.cluster);
          return (
            <button
              key={name}
              onClick={() => toggle(name)}
              disabled={!isOn && selected.length >= MAX_BANKS}
              className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all border ${
                isOn
                  ? 'font-bold text-black'
                  : 'border-white/10 text-neutral-400 hover:border-white/30 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
              }`}
              style={isOn ? { background: COMPARE_COLORS[idx], borderColor: COMPARE_COLORS[idx] } : {}}
            >
              {s.ticker}
              {isOn && <span className="ml-1.5 opacity-70">{s.comp.toFixed(0)}</span>}
            </button>
          );
        })}
      </div>

      {/* Comparison content */}
      {selected.length >= 2 && (
        <div className="space-y-5">
          {/* Charts row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Composite vs NLP bar */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-3">
                Composite vs NLP Peak
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="metric" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} width={32} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {bankData.map(b => (
                    <Bar key={b.s.ticker} dataKey={b.s.ticker} fill={b.color} radius={[3, 3, 0, 0]} fillOpacity={0.8} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Quarterly NLP trends */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-3">
                Quarter-by-Quarter NLP Trend
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={lineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 8, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {bankData.map(b => (
                    <Line key={b.s.ticker} type="monotone" dataKey={b.s.ticker}
                      stroke={b.color} strokeWidth={1.5} dot={{ r: 2 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Head-to-head table */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">Head-to-Head — All Dimensions</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="py-2 px-4 text-left font-mono text-[10px] uppercase tracking-wider text-neutral-500 w-36">Metric</th>
                    {bankData.map((b, i) => (
                      <th key={b.name} className="py-2 px-4 text-left font-mono font-bold text-sm" style={{ color: COMPARE_COLORS[i] }}>
                        {b.s.ticker}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TABLE_ROWS.map(([label, fn]) => (
                    <tr key={label} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="py-2 px-4 font-mono text-[10px] uppercase tracking-wider text-neutral-500">{label}</td>
                      {bankData.map(b => {
                        const val = fn(b);
                        const isTier = label === 'Tier';
                        const isFp = label === 'False Positive' && b.s.fp;
                        return (
                          <td key={b.name} className="py-2 px-4">
                            {isTier ? (
                              <span
                                className="font-mono text-[10px] px-2 py-0.5 rounded font-bold"
                                style={{ background: tierBg(b.s.tier), color: tierColor(b.s.tier) }}
                              >
                                {val}
                              </span>
                            ) : (
                              <span className={isFp ? 'text-rose-400 font-medium' : 'text-white'}>{val}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Radar chart */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-3">
              Dimension Breakdown — Radar View
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                <PolarGrid stroke="#1f2937" />
                <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {bankData.map(b => (
                  <Radar
                    key={b.s.ticker}
                    name={b.s.ticker}
                    dataKey={b.s.ticker}
                    stroke={b.color}
                    fill={b.color}
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-neutral-600 mt-1 text-center">
              All dimensions scaled 0–25. Each axis = one scoring dimension.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
