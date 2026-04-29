'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { SCORES, BANK_NAMES_SORTED, tierColor, clusterColor, compositeColor } from '@/lib/da-data';

// ── Tier distribution ─────────────────────────────────────────────────────────
const TIER_DIST = [
  { tier: 'Tier 1\nLeader',   count: 2,  color: '#10b981', desc: '≥80 composite' },
  { tier: 'Tier 2\nAdvanced', count: 4,  color: '#3b82f6', desc: '≥55 composite' },
  { tier: 'Tier 3\nBuilding', count: 5,  color: '#a78bfa', desc: '≥35 composite' },
  { tier: 'Tier 4\nWatching', count: 1,  color: '#f59e0b', desc: '≥15 composite' },
  { tier: 'Tier 5\nAbsent',   count: 4,  color: '#ef4444', desc: '<15 composite'  },
];

// ── Key NLP signal anomalies surfaced by the pipeline ─────────────────────────
const NLP_ANOMALIES = [
  {
    label: 'GENIUS Act Inflection — Q2 2025',
    severity: 'High',
    color: '#ef4444',
    banks: ['BNY Mellon', 'Charles Schwab', 'Citi', 'JPMorgan', 'US Bancorp',
            'American Express', 'Bank of America', 'PNC', 'Goldman Sachs'],
    detail:
      '9 of 16 banks hit their NLP peak score in Q2 2025 — the same quarter as the GENIUS Act\'s Senate passage (June 17, 68–30). A simultaneous multi-bank inflection across unrelated institutions is not coincidence; it reflects a common regulatory catalyst driving analyst stablecoin questions in every Q2 2025 earnings call.',
  },
  {
    label: 'Goldman Sachs — Systematic Q&A Underdisclosure',
    severity: 'Medium',
    color: '#f59e0b',
    banks: ['Goldman Sachs'],
    detail:
      'Goldman\'s raw NLP peak is 1.84 — placing it 11th. Its composite is 39.9 (Tier 3) because D4 external research corrects for a 0.23x Q&A/Full transcript ratio: Goldman discusses digital assets 4× more in prepared remarks than investor Q&A. GS DAP spin-out, tokenized MMF with BNY (Jul 2025), EIB digital bond, and $135M DA investment are all but invisible in the Q&A signal. Standard single-score NLP would misclassify Goldman as minimally engaged.',
  },
  {
    label: 'False Positive — Idiomatic "Circle" Language (4 Banks)',
    severity: 'High',
    color: '#ef4444',
    banks: ['Wells Fargo', 'Truist', 'Bank of Montreal', 'TD Bank'],
    detail:
      'All four passed initial NLP screening because the word "circle" appeared in phrases like "circle back," "full circle," and "coming full circle." Manual excerpt review confirmed zero references to Circle Financial. TD Bank\'s "strategic investment" term refers to its Schwab stake, not a digital asset investment. All four NLP scores zeroed; D4 trajectory scores (WFUSD trademark, G7 stablecoin coalition) retained.',
  },
  {
    label: 'PNC — High NLP Score, Low Operational Depth',
    severity: 'Medium',
    color: '#f59e0b',
    banks: ['PNC'],
    detail:
      'PNC NLP peak of 5.87 initially signals meaningful engagement, but D2 specificity ratio is 0.048 — meaning 95% of its score comes from broad General vocabulary ("crypto," "stablecoin") with no product-specific language. Its composite (49.6) is correctly ranked below US Bancorp (58.6), which has a 0.369 specificity ratio and active Custodial sub-scores confirming live custody operations. NLP volume alone would have overranked PNC.',
  },
  {
    label: 'State Street — 100% Custodial, 8/8 Quarter Consistency',
    severity: 'Low',
    color: '#10b981',
    banks: ['State Street'],
    detail:
      'State Street\'s NLP peak (3.19) is modest compared to Schwab (19.81), but it is the only bank in the dataset with 8/8 quarter consistency and a 1.000 specificity ratio — every single NLP sub-score is Custodial. No General vocabulary noise. This signal pattern confirms operational live status rather than aspirational disclosure, and is why its D2 score (20.1) is the highest in the dataset despite a low absolute NLP peak.',
  },
];

const SEVERITY_COLOR: Record<string, string> = {
  High:   '#ef4444',
  Medium: '#f59e0b',
  Low:    '#10b981',
};
const SEVERITY_BG: Record<string, string> = {
  High:   'rgba(239,68,68,0.12)',
  Medium: 'rgba(245,158,11,0.12)',
  Low:    'rgba(16,185,129,0.12)',
};

// ── Key findings ──────────────────────────────────────────────────────────────
const KEY_FINDINGS = [
  'Two banks reached Tier 1 (composite ≥80): BNY Mellon (85.4) and Charles Schwab (83.0)',
  'Schwab Crypto launched April 16, 2026 — 10 months after the model assigned the highest NLP score in the dataset (19.81, Q2 2025). Predictive validity confirmed.',
  'Q2 2025 inflection explained: GENIUS Act Senate passage (June 17, 68–30) drove 9 of 16 banks to their NLP peak that quarter.',
  'Goldman Sachs paradox resolved: Q&A NLP peak = 1.84 (ranks 11th). Composite = 39.9 (Tier 3). D4 external research score of 22 corrects for systematic Q&A underdisclosure.',
  '4 confirmed false positives: Wells Fargo, Truist, Bank of Montreal, TD Bank — NLP scores driven entirely by idiomatic "circle back" language. Zeroed in composite model.',
  'State Street is the only bank with 8/8 quarter consistency and 100% specificity ratio — confirming it is operationally live, not aspirational.',
];

export function DAOverviewPanel() {
  return (
    <div className="space-y-6">

      {/* Validation banner */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-1">
              Methodology Validation · April 16, 2026
            </div>
            <div className="font-semibold text-white text-base mb-2">
              Schwab Crypto launched — model flagged intent 10 months early
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed">
              Our NLP model scored Charles Schwab at <span className="font-semibold text-white">19.81 in Q2 2025</span> — highest
              in the dataset — based on executives describing spot crypto trading plans and native custody infrastructure
              in earnings Q&A. On <span className="font-semibold text-white">April 16, 2026, Schwab launched "Schwab Crypto"</span> — direct
              BTC and ETH trading at 75bps. The model flagged this intent{' '}
              <span className="font-semibold text-white">10 months before product launch</span>. This confirms that
              Q&A NLP scores are predictive leading indicators, not trailing descriptions.
            </p>
          </div>
          <div className="text-right flex-shrink-0 hidden sm:block">
            <div className="font-mono text-3xl font-bold text-amber-400">19.81</div>
            <div className="text-xs text-neutral-500 font-mono">Schwab Q2 2025</div>
            <div className="font-mono text-xl font-bold text-emerald-400 mt-2">✓</div>
            <div className="text-xs text-neutral-500 font-mono">confirmed live</div>
          </div>
        </div>
      </div>

      {/* What we built — 3 columns */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            title: 'What Was Analyzed',
            body: 'We scored the Q&A sections of earnings call transcripts — where analysts press executives directly and hedged or absent answers are as informative as specific ones. 128 transcripts, 16 banks, Q1 2024–Q4 2025.',
          },
          {
            title: '50 → 16 → 12 Banks',
            body: 'Starting from 50 banks, NLP scoring produced 16 with measurable engagement. Post-analysis, 4 were reclassified as false positives (idiomatic "circle back" language). The composite model surfaces 12 banks with genuine digital asset engagement.',
          },
          {
            title: 'Three Evidence Layers',
            body: 'Every cluster and composite score is supported by three independent sources: (1) original NLP pipeline, (2) Gemini-assisted research provided by our team, and (3) live web research conducted April 2026. No finding rests on a single source.',
          },
        ].map(card => (
          <div key={card.title} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">{card.title}</div>
            <p className="text-xs text-neutral-400 leading-relaxed">{card.body}</p>
          </div>
        ))}
      </div>

      {/* Key findings + score distribution side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Key findings */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-3">Key Findings</div>
          <div className="space-y-2">
            {KEY_FINDINGS.map((f, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <span className="text-amber-400 font-mono text-xs mt-0.5 flex-shrink-0">▸</span>
                <span className="text-xs text-neutral-400 leading-relaxed">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Score distribution */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
            Composite Score Distribution — 16 Banks
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={TIER_DIST} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="tier"
                tick={{ fontSize: 8.5, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={20}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
                formatter={(v: number, _n, props) => [`${v} banks`, props.payload.desc]}
                labelFormatter={l => (l as string).replace('\n', ' · ')}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {TIER_DIST.map((t, i) => <Cell key={i} fill={`${t.color}99`} stroke={t.color} strokeWidth={1} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {TIER_DIST.map(t => (
              <div key={t.tier} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm" style={{ background: t.color }} />
                <span className="text-[10px] font-mono text-neutral-500">{t.tier.replace('\n', ' ')} ({t.count})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NLP Signal Anomalies */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white">NLP Signal Anomalies</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Systematic deviations from expected NLP behavior — false positives, underdisclosers,
            multi-bank regulatory inflections, and signal-depth mismatches detected by the 4-dimensional model.
          </p>
        </div>
        <div className="divide-y divide-white/5">
          {NLP_ANOMALIES.map((a, i) => (
            <div key={i} className="px-5 py-4 flex gap-4 items-start hover:bg-white/[0.015]">
              {/* Severity badge */}
              <div className="flex-shrink-0 pt-0.5">
                <span
                  className="text-[10px] font-mono font-bold px-2 py-1 rounded uppercase"
                  style={{ background: SEVERITY_BG[a.severity], color: SEVERITY_COLOR[a.severity] }}
                >
                  {a.severity}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="font-medium text-sm text-white">{a.label}</div>
                  {/* Affected banks */}
                  <div className="flex flex-wrap gap-1 flex-shrink-0">
                    {a.banks.map(b => {
                      const s = SCORES[b];
                      if (!s) return null;
                      return (
                        <span
                          key={b}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{ background: `${clusterColor(s.cluster)}18`, color: clusterColor(s.cluster) }}
                        >
                          {s.ticker}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">{a.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All 16 banks quick-reference strip */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-3">
          All 16 Banks — Composite Score Quick Reference
        </div>
        <div className="space-y-1.5">
          {BANK_NAMES_SORTED.map((name, i) => {
            const s = SCORES[name];
            const pct = (s.comp / 100) * 100;
            return (
              <div key={name} className="flex items-center gap-3">
                <div className="w-4 text-right font-mono text-[10px] text-neutral-600 flex-shrink-0">{i + 1}</div>
                <div className="w-12 font-mono text-[11px] font-bold text-amber-400 flex-shrink-0">{s.ticker}</div>
                <div className="flex-1 h-3 bg-white/5 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{ width: `${pct}%`, background: compositeColor(s.comp) }}
                  />
                </div>
                <div
                  className="w-10 text-right font-mono text-xs font-bold flex-shrink-0"
                  style={{ color: compositeColor(s.comp) }}
                >
                  {s.comp.toFixed(1)}
                </div>
                {s.fp && (
                  <span className="text-[10px] font-mono text-rose-400 flex-shrink-0">FP</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-neutral-600 mt-3">
          FP = confirmed false positive. Bar width = composite score (0–100).
          Color: green ≥75 · blue ≥55 · violet ≥35 · amber ≥15 · red &lt;15.
        </p>
      </div>

    </div>
  );
}
