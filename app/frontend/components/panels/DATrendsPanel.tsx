'use client';

import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  SCORES, QNA, CLUSTERS, BANK_NAMES_SORTED,
  clusterColor, compositeColor, statusColor, evidenceColor,
  type ClusterLabel,
} from '@/lib/da-data';

type View = 'profile' | 'clusters';

const DIM_COLORS = ['#3b82f6', '#10b981', '#a78bfa', '#f59e0b'];

export function DATrendsPanel() {
  const [view, setView] = useState<View>('profile');

  return (
    <div className="space-y-4">

      {/* Tab strip */}
      <div className="flex gap-1 border-b border-white/5">
        {(['profile', 'clusters'] as View[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors capitalize ${
              view === v
                ? 'bg-white/[0.07] text-white border-b-2 border-amber-400'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {v === 'profile' ? 'Bank Profile' : 'Cluster Map'}
          </button>
        ))}
      </div>

      {view === 'profile' && <BankProfileView />}
      {view === 'clusters' && <ClustersView />}
    </div>
  );
}

// ── Bank Profile ──────────────────────────────────────────────────────────────

function BankProfileView() {
  const [selectedBank, setSelectedBank] = useState<string>(BANK_NAMES_SORTED[0]);
  const s = SCORES[selectedBank];
  const q = QNA[selectedBank];
  if (!s || !q) return null;

  const peakIdx = q.scores.indexOf(Math.max(...q.scores));
  const quarterlyData = q.quarters.map((quarter, i) => ({ quarter, score: q.scores[i] }));
  const subScoreData = [
    { name: 'Custodial', value: q.cust[peakIdx],   color: '#3b82f6' },
    { name: 'Infra',     value: q.infra[peakIdx],   color: '#10b981' },
    { name: 'Fintech',   value: q.fintech[peakIdx], color: '#a78bfa' },
    { name: 'General',   value: q.gen[peakIdx],     color: '#f59e0b' },
  ];
  const dimData = [
    { label: 'D1 · NLP Engagement',      value: s.d1, max: 25, color: DIM_COLORS[0], note: `Adj. NLP peak ${s.nlpPeak.toFixed(2)} → log-normalised to ${s.d1.toFixed(1)}/25` },
    { label: 'D2 · Specificity & Depth', value: s.d2, max: 25, color: DIM_COLORS[1], note: `${s.realTerms} unique terms · ${(s.specificity * 100).toFixed(0)}% specificity · ${Math.round(s.consistency * 8)}/8 consistency` },
    { label: 'D3 · Disclosure Mode',     value: s.d3, max: 25, color: DIM_COLORS[2], note: `Q&A/Full ratio: ${s.disclosure.toFixed(2)}x${s.disclosure >= 2 ? ' · Proactive discloser' : s.disclosure < 0.5 ? ' · Underdiscloser' : ''}` },
    { label: 'D4 · External Research',   value: s.d4, max: 25, color: DIM_COLORS[3], note: 'Products launched + infrastructure depth + strategic trajectory' },
  ];

  return (
    <div className="space-y-4">
      {/* Bank selector */}
      <select
        value={selectedBank}
        onChange={e => setSelectedBank(e.target.value)}
        className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
      >
        {BANK_NAMES_SORTED.map(n => (
          <option key={n} value={n} className="bg-neutral-900">
            {SCORES[n].ticker} — {n}
          </option>
        ))}
      </select>

      {/* Header: score ring + stats */}
      <div className="flex gap-4 items-stretch">
        <div
          className="flex-shrink-0 w-20 h-20 rounded-full flex flex-col items-center justify-center border-4"
          style={{ borderColor: compositeColor(s.comp) }}
        >
          <span className="font-bold text-xl leading-none" style={{ color: compositeColor(s.comp) }}>
            {s.comp.toFixed(0)}
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">/ 100</span>
        </div>
        <div className="flex-1 grid grid-cols-4 gap-2">
          {[
            { l: 'Tier',        v: s.tier },
            { l: 'Cluster',     v: `Cluster ${s.cluster}` },
            { l: 'NLP Peak',    v: s.nlpPeak.toFixed(2) },
            { l: 'Real Terms',  v: String(s.realTerms) },
            { l: 'Consistency', v: `${Math.round(s.consistency * 8)}/8` },
            { l: 'Disclosure',  v: `${s.disclosure.toFixed(2)}x` },
            { l: 'Specificity', v: `${(s.specificity * 100).toFixed(0)}%` },
            { l: 'Adj. Avg',    v: s.adjAvg.toFixed(2) },
          ].map(stat => (
            <div key={stat.l} className="rounded-lg bg-white/[0.04] px-2 py-1.5">
              <div className="text-[9px] font-mono uppercase tracking-wider text-neutral-500">{stat.l}</div>
              <div className="font-mono font-semibold text-sm text-white mt-0.5">{stat.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Explanation callout */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-neutral-400 leading-relaxed">
        {s.fp && (
          <span className="text-rose-400 font-medium block mb-1">
            NOTE: Confirmed false positive — NLP score driven by idiomatic language, not genuine DA engagement.
          </span>
        )}
        {!s.fp && s.disclosure < 0.5 && (
          <span className="text-amber-400 font-medium block mb-1">
            Underdiscloser: Q&A/Full ratio {s.disclosure.toFixed(2)}x — discusses DA significantly more in prepared remarks than investor Q&A. D4 compensates.
          </span>
        )}
        {q.research && <span className="text-neutral-300">{q.research}</span>}
      </div>

      {/* Dimension bars */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-3">
          Score Composition — All 4 Dimensions
        </div>
        <div className="space-y-3">
          {dimData.map(d => (
            <div key={d.label}>
              <div className="flex items-center gap-3 mb-0.5">
                <div className="text-xs w-44 text-neutral-300 flex-shrink-0">{d.label}</div>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(d.value / d.max) * 100}%`, background: d.color }}
                  />
                </div>
                <div className="font-mono font-bold text-sm w-10 text-right" style={{ color: d.color }}>
                  {d.value.toFixed(1)}
                </div>
              </div>
              <div className="text-[10px] text-neutral-600 pl-44">{d.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-3">
            NLP Score by Quarter
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={quarterlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
                formatter={(v: number) => [v.toFixed(2), 'NLP Score']}
              />
              <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={1.5}
                dot={{ r: 3, fill: '#f59e0b' }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-neutral-600 mt-2">
            Peak quarter: <span className="text-amber-400">{q.peakQ}</span>
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-3">
            Sub-Score Breakdown · {q.peakQ}
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={subScoreData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {subScoreData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Excerpts */}
      {(q.ex1 || q.ex2) && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
            Transcript Excerpts · {q.peakQ}
          </div>
          {[q.ex1, q.ex2].filter(Boolean).map((ex, i) => (
            <div key={i} className="bg-white/[0.03] rounded-lg p-3">
              <div className="flex gap-2 mb-1.5">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400/10 text-amber-400">{q.peakQ}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">Excerpt {i + 1}</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">"{ex}"</p>
            </div>
          ))}
        </div>
      )}

      {/* Terms by quarter */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-3">
          Terms Detected Per Quarter
        </div>
        <div className="divide-y divide-white/5">
          {q.quarters.map((qtr, i) => {
            if (!q.terms[i]) return null;
            const isFp = q.terms[i].includes('FALSE');
            return (
              <div key={qtr} className="flex gap-3 py-1.5">
                <span className="font-mono text-[10px] text-neutral-500 w-16 flex-shrink-0">{qtr}</span>
                <span className={`text-xs ${isFp ? 'text-rose-400' : 'text-neutral-400'}`}>{q.terms[i]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Cluster Map ───────────────────────────────────────────────────────────────

function ClustersView() {
  const [openCluster, setOpenCluster] = useState<ClusterLabel | null>(null);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <p className="text-xs text-neutral-400 leading-relaxed">
          Clusters are based on <span className="text-white font-medium">what banks are doing</span>, not how much they score.
          The specificity ratio (Custodial+Infrastructure / Total) and sub-score composition drive cluster assignment,
          corrected by external research. Click any cluster to expand capabilities, description, three evidence layers, and use cases.
        </p>
      </div>

      {CLUSTERS.map(c => {
        const isOpen = openCluster === c.id;
        return (
          <div
            key={c.id}
            className="rounded-xl border bg-white/[0.02] overflow-hidden transition-all"
            style={{ borderColor: isOpen ? c.color : 'rgba(255,255,255,0.07)' }}
          >
            <button
              className="w-full text-left p-4 flex items-center justify-between gap-4"
              onClick={() => setOpenCluster(isOpen ? null : c.id)}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-2xl opacity-20" style={{ color: c.color }}>{c.id}</span>
                <div>
                  <div className="font-semibold text-sm" style={{ color: c.color }}>
                    Cluster {c.id} · {c.name}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">{c.banks.join(' · ')}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.banks.map(b => (
                  <span key={b} className="text-[10px] font-mono px-2 py-0.5 rounded font-bold"
                    style={{ background: `${c.color}20`, color: c.color }}>
                    {SCORES[b]?.ticker} {SCORES[b]?.comp.toFixed(0)}
                  </span>
                ))}
                <span className="text-neutral-500 text-sm ml-2">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
                {/* Capability bars */}
                <div className="grid grid-cols-5 gap-3">
                  {c.caps.map(cap => (
                    <div key={cap.label} className="text-center">
                      <div className="text-[9px] font-mono text-neutral-500 uppercase mb-1">{cap.label}</div>
                      <div className="h-16 bg-white/5 rounded relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 right-0 rounded"
                          style={{ height: `${cap.value * 10}%`, background: c.color }} />
                      </div>
                      <div className="text-xs font-mono font-bold mt-1" style={{ color: c.color }}>{cap.value}/10</div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed">{c.desc}</p>

                {/* Evidence layers */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">Three-Layer Evidence</div>
                  <div className="space-y-2">
                    {c.evidence.map(ev => (
                      <div key={ev.type} className="flex gap-3 items-start">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded flex-shrink-0 mt-0.5"
                          style={{ background: `${evidenceColor(ev.type)}18`, color: evidenceColor(ev.type) }}>
                          {ev.type}
                        </span>
                        <p className="text-xs text-neutral-400 leading-relaxed">{ev.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Use cases */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">Use Cases by Bank</div>
                  {Array.from(new Set(c.usecases.map(u => u.bank))).map(bank => (
                    <div key={bank} className="mb-3">
                      <div className="text-[10px] font-mono text-neutral-400 mb-1.5">
                        {SCORES[bank]?.ticker} — {bank}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {c.usecases.filter(u => u.bank === bank).map(u => (
                          <span key={u.uc} className="text-[10px] font-mono px-2 py-0.5 rounded font-bold"
                            style={{ background: `${statusColor(u.status)}20`, color: statusColor(u.status) }}>
                            {u.uc} · {u.status}
                          </span>
                        ))}
                      </div>
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
