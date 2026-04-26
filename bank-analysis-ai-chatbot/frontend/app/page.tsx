'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ── shape of /overview ────────────────────────────────────────────────────────

type Theme = 'private_credit' | 'ai' | 'digital_assets';

interface ThemeSummary {
  theme: Theme;
  chunk_count: number;
  bank_count: number;
  anomaly_total: number;
  anomaly_severity: { high: number; medium: number; low: number };
}

interface OverviewResponse {
  latest_quarter: string | null;
  themes: Record<Theme, ThemeSummary>;
  mentions_by_quarter: {
    quarter: string;
    private_credit: number;
    ai: number;
    digital_assets: number;
  }[];
  multi_theme_banks: {
    ticker: string;
    name: string | null;
    peer_group: string | null;
    themes: { private_credit: number; ai: number; digital_assets: number };
    total: number;
  }[];
}

// ── sector cards ──────────────────────────────────────────────────────────────

const SECTORS: {
  theme: Theme;
  slug: string;
  label: string;
  blurb: string;
  accent: string;
  hover: string;
}[] = [
  {
    theme: 'private_credit',
    slug: 'private-credit',
    label: 'Private Credit',
    blurb: 'NBFI lending · direct lending pipelines · PE sponsor relationships',
    accent: 'from-indigo-500 to-purple-600',
    hover: 'hover:ring-indigo-400/60',
  },
  {
    theme: 'digital_assets',
    slug: 'digital-assets',
    label: 'Digital Assets',
    blurb: 'Crypto custody · stablecoin reserves · tokenization · digital-asset prime',
    accent: 'from-amber-500 to-orange-600',
    hover: 'hover:ring-amber-400/60',
  },
  {
    theme: 'ai',
    slug: 'ai',
    label: 'AI Usage',
    blurb: 'AI / ML deployment · generative-AI strategy · technology investment posture',
    accent: 'from-emerald-500 to-teal-600',
    hover: 'hover:ring-emerald-400/60',
  },
];

const THEME_COLOR: Record<Theme, string> = {
  private_credit: '#818cf8',
  digital_assets: '#fbbf24',
  ai: '#34d399',
};

const THEME_LABEL: Record<Theme, string> = {
  private_credit: 'Private Credit',
  digital_assets: 'Digital Assets',
  ai: 'AI Usage',
};

function fmtInt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/backend/overview')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: OverviewResponse) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData = useMemo(() => data?.mentions_by_quarter ?? [], [data]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-xl border border-white/5 overflow-hidden bg-gradient-to-br from-white/[0.04] to-transparent p-8 shadow-2xl shadow-black/40">
        <div className="text-xs uppercase tracking-wider text-neutral-500">
          Cross-sector cockpit
        </div>
        <h1 className="text-3xl font-semibold text-white tracking-tight mt-1">
          Three themes, one bank universe
        </h1>
        <p className="text-sm text-neutral-400 mt-2 max-w-3xl leading-relaxed">
          Each sector below is its own analytical hub — Rankings, Trends, Anomalies, and
          Compare — backed by SEC filings, earnings transcripts, and Call Reports for
          50 US banks. Click into a sector for the full theme-specific view, or use
          the cross-sector chart at the bottom to see how disclosure volume is shifting
          across all three themes at once.
        </p>
      </section>

      {/* 3 sector cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SECTORS.map((s) => {
          const t = data?.themes?.[s.theme];
          const sev = t?.anomaly_severity;
          return (
            <Link
              key={s.slug}
              href={`/${s.slug}`}
              prefetch
              className={`group rounded-xl bg-gradient-to-br ${s.accent} p-6 text-white shadow-lg ring-1 ring-white/10 ${s.hover} transition-all hover:shadow-xl hover:scale-[1.01]`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] uppercase tracking-wider opacity-80">
                    Sector
                  </div>
                  <h2 className="text-xl font-semibold mt-0.5">{s.label}</h2>
                </div>
                <span className="opacity-60 group-hover:opacity-100 transition-opacity text-lg">
                  →
                </span>
              </div>
              <p className="text-xs opacity-90 mt-2 leading-relaxed">{s.blurb}</p>

              {/* Stat strip */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-md bg-black/20 px-2 py-1.5">
                  <div className="opacity-70 leading-tight">Banks engaged</div>
                  <div className="font-semibold text-base leading-tight tabular-nums mt-0.5">
                    {fmtInt(t?.bank_count)}
                  </div>
                </div>
                <div className="rounded-md bg-black/20 px-2 py-1.5">
                  <div className="opacity-70 leading-tight">Tagged chunks</div>
                  <div className="font-semibold text-base leading-tight tabular-nums mt-0.5">
                    {fmtInt(t?.chunk_count)}
                  </div>
                </div>
                <div className="rounded-md bg-black/20 px-2 py-1.5">
                  <div className="opacity-70 leading-tight">Anomalies</div>
                  <div className="font-semibold text-base leading-tight tabular-nums mt-0.5">
                    {fmtInt(t?.anomaly_total)}
                  </div>
                </div>
              </div>

              {sev && (sev.high + sev.medium + sev.low > 0) && (
                <div className="mt-3 flex items-center gap-2 text-[10px]">
                  {sev.high > 0 && (
                    <span className="bg-rose-200/30 px-2 py-0.5 rounded-full">
                      {sev.high} high
                    </span>
                  )}
                  {sev.medium > 0 && (
                    <span className="bg-amber-200/30 px-2 py-0.5 rounded-full">
                      {sev.medium} medium
                    </span>
                  )}
                  {sev.low > 0 && (
                    <span className="bg-white/15 px-2 py-0.5 rounded-full">
                      {sev.low} low
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </section>

      {/* Cross-sector chart */}
      <section className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden shadow-2xl shadow-black/40">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white text-base">
            Disclosure volume by theme, by quarter
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Topic-tagged chunk count across all 50 banks per quarter. A useful read on
            how each theme is rising or fading in the corporate narrative.
          </p>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-neutral-500">
              Loading cross-sector data…
            </div>
          ) : error ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-rose-400">
              {error}
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-neutral-500">
              No data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  {(['private_credit', 'digital_assets', 'ai'] as Theme[]).map((t) => (
                    <linearGradient key={t} id={`g-${t}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={THEME_COLOR[t]} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={THEME_COLOR[t]} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a30" />
                <XAxis
                  dataKey="quarter"
                  tick={{ fontSize: 11, fill: '#8a8a92' }}
                  axisLine={{ stroke: '#2a2a30' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#8a8a92' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #2a2a30',
                    background: '#0a0a0d',
                    color: '#e5e5e5',
                  }}
                  formatter={(v, name) => [
                    typeof v === 'number' ? v.toLocaleString() : v,
                    THEME_LABEL[(name as string).replace(/-/g, '_') as Theme] ??
                      String(name),
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(name) =>
                    THEME_LABEL[(name as string) as Theme] ?? String(name)
                  }
                />
                <Area
                  type="monotone"
                  dataKey="private_credit"
                  stackId="1"
                  stroke={THEME_COLOR.private_credit}
                  fill={`url(#g-private_credit)`}
                />
                <Area
                  type="monotone"
                  dataKey="digital_assets"
                  stackId="1"
                  stroke={THEME_COLOR.digital_assets}
                  fill={`url(#g-digital_assets)`}
                />
                <Area
                  type="monotone"
                  dataKey="ai"
                  stackId="1"
                  stroke={THEME_COLOR.ai}
                  fill={`url(#g-ai)`}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Multi-theme banks */}
      <section className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden shadow-2xl shadow-black/40">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white text-base">
            Banks active in multiple themes
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Top 10 banks by total topic-tagged chunk count. The colored chips show
            which sectors each bank is engaging with — a useful quick read on which
            institutions sit at the intersection of all three themes.
          </p>
        </div>
        <div className="px-6 py-4 overflow-x-auto">
          {loading ? (
            <div className="text-sm text-neutral-500 py-6 text-center">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-neutral-500 border-b border-white/5">
                  <th className="py-2 text-left font-medium">Bank</th>
                  <th className="py-2 text-left font-medium">Peer group</th>
                  <th className="py-2 text-right font-medium">PC</th>
                  <th className="py-2 text-right font-medium">DA</th>
                  <th className="py-2 text-right font-medium">AI</th>
                  <th className="py-2 text-right font-medium">Themes</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {(data?.multi_theme_banks ?? []).slice(0, 10).map((b) => {
                  const themesPresent = (
                    ['private_credit', 'digital_assets', 'ai'] as Theme[]
                  ).filter((t) => (b.themes as Record<Theme, number>)[t] > 0);
                  return (
                    <tr
                      key={b.ticker}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.025]"
                    >
                      <td className="py-2.5">
                        <span className="font-mono font-semibold text-white">
                          {b.ticker}
                        </span>
                        <span className="text-neutral-500 ml-2 text-xs">{b.name}</span>
                      </td>
                      <td className="py-2.5 text-xs text-neutral-400 capitalize">
                        {b.peer_group ?? '—'}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-neutral-300">
                        {fmtInt(b.themes.private_credit)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-neutral-300">
                        {fmtInt(b.themes.digital_assets)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-neutral-300">
                        {fmtInt(b.themes.ai)}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {themesPresent.map((t) => (
                            <span
                              key={t}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: THEME_COLOR[t] }}
                              title={THEME_LABEL[t]}
                            />
                          ))}
                          <span className="ml-1 text-xs text-neutral-500 tabular-nums">
                            {themesPresent.length}/3
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold text-white tabular-nums">
                        {fmtInt(b.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {data?.latest_quarter && (
        <p className="text-[11px] text-neutral-500 text-right">
          Anomaly counts reflect <span className="font-mono">{data.latest_quarter}</span>.
          Mentions chart is cumulative across all reporting periods in the index.
        </p>
      )}
    </div>
  );
}
