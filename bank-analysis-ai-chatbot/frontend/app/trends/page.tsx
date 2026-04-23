'use client';

import { useEffect, useState, useMemo } from 'react';
import clsx from 'clsx';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

// ── types ──────────────────────────────────────────────────────────────────────

interface Bank {
  ticker: string;
  name: string;
  peer_group: string;
}

interface IndustryTrend {
  quarter: string;
  avg_nbfi_ratio: number | null;
  avg_ci_ratio: number | null;
  reporting_banks: number;
}

interface Pullback {
  ticker: string;
  name: string;
  prev_quarter: string;
  latest_quarter: string;
  prev_ratio: number;
  latest_ratio: number;
  change: number;
}

interface ExposureEntry {
  rank: number;
  ticker: string;
  name: string;
  peer_group: string;
  nbfi_ratio: number;
  ci_ratio: number | null;
  commitment_ratio: number | null;
  pe_exposure: number | null;
  latest_quarter: string;
}

interface QuarterMover {
  ticker: string;
  name: string;
  peer_group: string;
  prev_quarter: string;
  latest_quarter: string;
  prev_ratio: number;
  latest_ratio: number;
  change: number;
  direction: 'expanding' | 'contracting';
}

interface TrendsData {
  banks: Bank[];
  metrics_over_time: Record<string, Record<string, Record<string, number | null>>>;
  industry_trend: IndustryTrend[];
  pullbacks: Pullback[];
  exposure_ranking: ExposureEntry[];
  quarter_movers: QuarterMover[];
  peer_group_comparison: Record<string, Record<string, { avg_nbfi_ratio: number | null; avg_ci_ratio: number | null; bank_count: number }>>;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function peerLabel(pg: string): string {
  if (pg === 'trust-ib') return 'Trust / IB';
  return pg;
}

function peerColor(pg: string): string {
  if (pg === 'GSIB') return '#8b5cf6';
  if (pg === 'trust-ib') return '#3b82f6';
  if (pg === 'Large Regional') return '#10b981';
  if (pg === 'Mid Regional') return '#f59e0b';
  return '#6b7280';
}

function fmtPct(val: number | null | undefined): string {
  if (val === null || val === undefined) return '--';
  return `${(val * 100).toFixed(2)}%`;
}

function fmtBps(val: number): string {
  return `${(val * 10000).toFixed(0)} bps`;
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="h-6 w-56 bg-neutral-100 rounded mb-2" />
        <div className="h-4 w-40 bg-neutral-100 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((n) => (
          <div key={n} className="rounded-xl border border-neutral-200 bg-white p-6">
            <div className="h-8 w-20 bg-neutral-100 rounded mb-2" />
            <div className="h-4 w-28 bg-neutral-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="rounded-xl border border-neutral-200 bg-white p-6">
            <div className="h-4 w-36 bg-neutral-100 rounded mb-4" />
            <div className="h-56 bg-neutral-50 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Insight box ───────────────────────────────────────────────────────────────

function Insight({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 px-4 py-3 bg-indigo-50/60 border border-indigo-100 rounded-lg">
      <p className="text-xs text-indigo-800 leading-relaxed">{children}</p>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peerFilter, setPeerFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/backend/trends')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load trends data');
        return r.json();
      })
      .then((d: TrendsData) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Derived data
  const peerGroups = useMemo(() => {
    if (!data) return ['all'];
    const groups = Array.from(new Set(data.banks.map((b) => b.peer_group)));
    return ['all', ...groups.sort()];
  }, [data]);

  const filteredTickers = useMemo(() => {
    if (!data) return new Set<string>();
    if (peerFilter === 'all') return new Set(data.banks.map((b) => b.ticker));
    return new Set(data.banks.filter((b) => b.peer_group === peerFilter).map((b) => b.ticker));
  }, [data, peerFilter]);

  const filteredPullbacks = useMemo(() => {
    if (!data) return [];
    return data.pullbacks
      .filter((p) => filteredTickers.has(p.ticker))
      .sort((a, b) => a.change - b.change);
  }, [data, filteredTickers]);

  const filteredExposure = useMemo(() => {
    if (!data) return [];
    return data.exposure_ranking.filter((e) => filteredTickers.has(e.ticker));
  }, [data, filteredTickers]);

  const filteredMovers = useMemo(() => {
    if (!data) return [];
    return data.quarter_movers.filter((m) => filteredTickers.has(m.ticker));
  }, [data, filteredTickers]);

  // Peer group comparison chart data
  const peerComparisonData = useMemo(() => {
    if (!data) return [];
    const pgc = data.peer_group_comparison;
    const allQuarters = new Set<string>();
    for (const pg of Object.keys(pgc)) {
      for (const q of Object.keys(pgc[pg])) allQuarters.add(q);
    }
    const sortedQ = Array.from(allQuarters).sort();
    // Use latest quarter
    if (sortedQ.length === 0) return [];
    const latestQ = sortedQ[sortedQ.length - 1];
    return Object.keys(pgc)
      .filter((pg) => pgc[pg][latestQ]?.avg_nbfi_ratio != null)
      .map((pg) => ({
        peer_group: peerLabel(pg),
        raw_pg: pg,
        avg_nbfi_ratio: pgc[pg][latestQ]?.avg_nbfi_ratio ?? 0,
        avg_ci_ratio: pgc[pg][latestQ]?.avg_ci_ratio ?? 0,
        bank_count: pgc[pg][latestQ]?.bank_count ?? 0,
        quarter: latestQ,
      }))
      .sort((a, b) => b.avg_nbfi_ratio - a.avg_nbfi_ratio);
  }, [data]);

  // Peer group trend over time
  const peerTrendData = useMemo(() => {
    if (!data) return [];
    const pgc = data.peer_group_comparison;
    const allQuarters = new Set<string>();
    const pgs = Object.keys(pgc);
    for (const pg of pgs) {
      for (const q of Object.keys(pgc[pg])) allQuarters.add(q);
    }
    return Array.from(allQuarters)
      .sort()
      .map((q) => {
        const row: Record<string, string | number | null> = { quarter: q };
        for (const pg of pgs) {
          row[pg] = pgc[pg]?.[q]?.avg_nbfi_ratio ?? null;
        }
        return row;
      });
  }, [data]);

  const peerGroupKeys = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.peer_group_comparison).sort();
  }, [data]);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!data) return null;
    const trend = data.industry_trend.filter((t) => t.avg_nbfi_ratio != null).sort((a, b) => a.quarter.localeCompare(b.quarter));
    const latest = trend[trend.length - 1];
    const prev = trend.length >= 2 ? trend[trend.length - 2] : null;
    const nbfiChange = latest && prev && latest.avg_nbfi_ratio != null && prev.avg_nbfi_ratio != null
      ? latest.avg_nbfi_ratio - prev.avg_nbfi_ratio
      : null;
    return {
      totalBanks: data.banks.length,
      latestQuarter: latest?.quarter ?? '--',
      avgNbfi: latest?.avg_nbfi_ratio ?? null,
      nbfiChange,
      pullbackCount: data.pullbacks.length,
      expandingCount: data.quarter_movers.filter((m) => m.direction === 'expanding').length,
    };
  }, [data]);

  if (loading) return <Skeleton />;

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
        <h2 className="text-lg font-semibold text-red-800 mb-1">Error loading trends</h2>
        <p className="text-sm text-red-600">{error ?? 'Unknown error'}</p>
      </div>
    );
  }

  const sortedIndustryTrend = [...data.industry_trend]
    .filter((t) => t.avg_nbfi_ratio != null)
    .sort((a, b) => a.quarter.localeCompare(b.quarter));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-neutral-900">Private Credit Industry Trends</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Cross-bank analysis of non-bank financial institution (NBFI) lending exposure from FFIEC Call Reports
        </p>
      </section>

      {/* Summary Cards */}
      {summaryStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Industry Avg NBFI Exposure</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{fmtPct(summaryStats.avgNbfi)}</p>
            {summaryStats.nbfiChange !== null && (
              <p className={clsx('text-xs font-semibold mt-1', summaryStats.nbfiChange >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                {summaryStats.nbfiChange >= 0 ? '+' : ''}{fmtBps(summaryStats.nbfiChange)} QoQ
              </p>
            )}
            <p className="text-[10px] text-neutral-400 mt-0.5">As of {summaryStats.latestQuarter}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Banks Tracked</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{summaryStats.totalBanks}</p>
            <p className="text-xs text-neutral-400 mt-1">Across {peerGroups.length - 1} peer groups</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Banks Expanding</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{summaryStats.expandingCount}</p>
            <p className="text-xs text-neutral-400 mt-1">Increased NBFI exposure QoQ</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Banks Pulling Back</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{summaryStats.pullbackCount}</p>
            <p className="text-xs text-neutral-400 mt-1">Decreased NBFI exposure QoQ</p>
          </div>
        </div>
      )}

      {/* Peer Group Filter */}
      <div className="flex gap-2 flex-wrap">
        {peerGroups.map((pg) => (
          <button
            key={pg}
            onClick={() => setPeerFilter(pg)}
            className={clsx(
              'text-xs px-3 py-1.5 rounded-full border font-medium capitalize transition-colors',
              peerFilter === pg
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
            )}
          >
            {pg === 'all' ? 'All banks' : peerLabel(pg)}
          </button>
        ))}
      </div>

      {/* NBFI Exposure Rankings */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="font-semibold text-neutral-900 text-base">NBFI Exposure Rankings</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Banks ranked by their loans to non-bank financial institutions as a share of total loans — a proxy for private credit exposure
          </p>
        </div>
        <div className="p-6">
          {filteredExposure.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={Math.max(280, Math.min(filteredExposure.length * 28, 600))}>
                <BarChart
                  data={filteredExposure.slice(0, 25)}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                    tick={{ fontSize: 11, fill: '#a3a3a3' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="ticker"
                    tick={{ fontSize: 11, fill: '#525252' }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${(value * 100).toFixed(3)}%`, 'NBFI Loan Ratio']}
                    labelFormatter={(label: string) => {
                      const entry = filteredExposure.find((e) => e.ticker === label);
                      return entry ? `${entry.name} (${entry.peer_group})` : label;
                    }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
                  />
                  <Bar dataKey="nbfi_ratio" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {filteredExposure.slice(0, 25).map((entry) => (
                      <Cell key={entry.ticker} fill={peerColor(entry.peer_group)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3 flex-wrap">
                {peerGroupKeys.map((pg) => (
                  <div key={pg} className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: peerColor(pg) }} />
                    {peerLabel(pg)}
                  </div>
                ))}
              </div>
              <Insight>
                {filteredExposure[0]?.ticker} leads with an NBFI loan ratio of {fmtPct(filteredExposure[0]?.nbfi_ratio)},
                {' '}meaning {fmtPct(filteredExposure[0]?.nbfi_ratio)} of its total loan portfolio is directed toward non-bank financial institutions.
                {' '}Higher ratios indicate deeper involvement in private credit markets through direct lending to fund managers, BDCs, and other NBFIs.
                {filteredExposure.length > 10 && (
                  <> The top 5 banks account for a disproportionate share of NBFI lending, suggesting concentration risk in private credit exposure among a handful of large lenders.</>
                )}
              </Insight>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
              No exposure data available
            </div>
          )}
        </div>
      </section>

      {/* Industry Trend + Peer Group Trend row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industry Trend Chart */}
        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h3 className="font-semibold text-neutral-900 text-base">Industry-Wide NBFI Exposure Trend</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Average NBFI and C&I lending ratios across all reporting banks over time
            </p>
          </div>
          <div className="p-6">
            {sortedIndustryTrend.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={sortedIndustryTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#a3a3a3' }} axisLine={{ stroke: '#e5e5e5' }} tickLine={false} />
                    <YAxis
                      tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                      tick={{ fontSize: 11, fill: '#a3a3a3' }}
                      axisLine={false}
                      tickLine={false}
                      width={55}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `${(value * 100).toFixed(3)}%`,
                        name === 'avg_nbfi_ratio' ? 'Avg NBFI Ratio' : 'Avg C&I Ratio',
                      ]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
                    />
                    <Legend
                      formatter={(value: string) => (
                        <span className="text-xs text-neutral-600">
                          {value === 'avg_nbfi_ratio' ? 'Avg NBFI Ratio' : 'Avg C&I Ratio'}
                        </span>
                      )}
                    />
                    <Line type="monotone" dataKey="avg_nbfi_ratio" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="avg_ci_ratio" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
                <Insight>
                  {(() => {
                    const first = sortedIndustryTrend[0];
                    const last = sortedIndustryTrend[sortedIndustryTrend.length - 1];
                    if (!first || !last || first.avg_nbfi_ratio == null || last.avg_nbfi_ratio == null) return 'Insufficient data for trend analysis.';
                    const direction = last.avg_nbfi_ratio > first.avg_nbfi_ratio ? 'increased' : 'decreased';
                    const changeBps = Math.abs((last.avg_nbfi_ratio - first.avg_nbfi_ratio) * 10000).toFixed(0);
                    return `Industry-wide NBFI lending has ${direction} by ${changeBps} basis points from ${first.quarter} to ${last.quarter}. This reflects ${direction === 'increased' ? 'growing bank participation in private credit markets' : 'a retreat from non-bank lending activity'}. The C&I ratio provides context: when NBFI exposure rises while C&I stays flat, banks are specifically targeting private credit rather than broadly expanding lending.`;
                  })()}
                </Insight>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
                No industry trend data available
              </div>
            )}
          </div>
        </section>

        {/* Peer Group NBFI Trend */}
        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h3 className="font-semibold text-neutral-900 text-base">NBFI Exposure by Peer Group</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              How different bank categories approach private credit over time
            </p>
          </div>
          <div className="p-6">
            {peerTrendData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={peerTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#a3a3a3' }} axisLine={{ stroke: '#e5e5e5' }} tickLine={false} />
                    <YAxis
                      tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                      tick={{ fontSize: 11, fill: '#a3a3a3' }}
                      axisLine={false}
                      tickLine={false}
                      width={55}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [`${(value * 100).toFixed(3)}%`, peerLabel(name)]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
                    />
                    <Legend formatter={(value: string) => <span className="text-xs text-neutral-600">{peerLabel(value)}</span>} />
                    {peerGroupKeys.map((pg) => (
                      <Line
                        key={pg}
                        type="monotone"
                        dataKey={pg}
                        stroke={peerColor(pg)}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <Insight>
                  GSIBs (globally systemically important banks) and large regionals typically have higher NBFI exposure due to their scale and existing relationships with fund managers.
                  Mid-regionals show more variation — some are aggressively entering private credit markets while others remain focused on traditional C&I lending.
                  Diverging trends between peer groups signal differentiated strategic positioning in the private credit space.
                </Insight>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
                No peer group comparison data
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Biggest Movers + Pullback Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Biggest Movers */}
        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h3 className="font-semibold text-neutral-900 text-base">Biggest Quarter-over-Quarter Movers</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Banks with the largest absolute change in NBFI exposure between their last two reported quarters
            </p>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            {filteredMovers.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-neutral-400">
                No quarter-over-quarter data available
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-left text-xs text-neutral-400 border-b border-neutral-100">
                      <th className="px-6 py-2.5 font-medium">Bank</th>
                      <th className="px-3 py-2.5 font-medium text-right">Previous</th>
                      <th className="px-3 py-2.5 font-medium text-right">Latest</th>
                      <th className="px-3 py-2.5 font-medium text-right">Change</th>
                      <th className="px-3 py-2.5 font-medium text-center">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovers.slice(0, 20).map((m) => (
                      <tr key={m.ticker} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                        <td className="px-6 py-2.5">
                          <a href={`/timeline/${m.ticker}`} className="font-semibold text-neutral-800 hover:text-indigo-600 transition-colors">
                            {m.ticker}
                          </a>
                          <div className="text-[11px] text-neutral-400 truncate max-w-[140px]">{m.name}</div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-neutral-600 tabular-nums text-right">
                          {fmtPct(m.prev_ratio)}
                          <div className="text-[10px] text-neutral-400">{m.prev_quarter}</div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-neutral-600 tabular-nums text-right">
                          {fmtPct(m.latest_ratio)}
                          <div className="text-[10px] text-neutral-400">{m.latest_quarter}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={clsx('text-xs font-bold tabular-nums', m.change >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                            {m.change >= 0 ? '+' : ''}{fmtBps(m.change)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={clsx(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            m.direction === 'expanding' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          )}>
                            {m.direction === 'expanding' ? 'Expanding' : 'Contracting'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-6 py-3">
                  <Insight>
                    Large QoQ moves indicate strategic shifts in private credit positioning. Banks showing expansion may be building out fund finance desks,
                    increasing credit facility commitments to BDCs, or acquiring NBFI loan portfolios. Contracting banks may be responding to
                    regulatory pressure, credit quality concerns, or strategic reallocation toward other lending segments.
                  </Insight>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Pullback Tracker */}
        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h3 className="font-semibold text-neutral-900 text-base">Pullback Tracker</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Banks actively reducing their private credit exposure — a potential early signal of market stress or strategic retrenchment
            </p>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            {filteredPullbacks.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-neutral-400">
                No pullback signals detected — all banks maintained or increased NBFI exposure
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-left text-xs text-neutral-400 border-b border-neutral-100">
                      <th className="px-6 py-2.5 font-medium">Bank</th>
                      <th className="px-3 py-2.5 font-medium text-right">Previous</th>
                      <th className="px-3 py-2.5 font-medium text-right">Latest</th>
                      <th className="px-3 py-2.5 font-medium text-right">Decline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPullbacks.map((p) => (
                      <tr key={p.ticker} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                        <td className="px-6 py-2.5">
                          <a href={`/timeline/${p.ticker}`} className="font-semibold text-neutral-800 hover:text-indigo-600 transition-colors">
                            {p.ticker}
                          </a>
                          <div className="text-[11px] text-neutral-400 truncate max-w-[140px]">{p.name}</div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-neutral-600 tabular-nums text-right">
                          {fmtPct(p.prev_ratio)}
                          <div className="text-[10px] text-neutral-400">{p.prev_quarter}</div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-neutral-600 tabular-nums text-right">
                          {fmtPct(p.latest_ratio)}
                          <div className="text-[10px] text-neutral-400">{p.latest_quarter}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="text-xs font-bold tabular-nums text-rose-600">
                            {fmtBps(p.change)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-6 py-3">
                  <Insight>
                    Pullbacks deserve attention in private credit analysis: when banks reduce NBFI exposure simultaneously,
                    it may signal industry-wide tightening of credit conditions for non-bank lenders. This can constrain capital
                    availability for private credit funds and affect deal flow across the market. Cross-reference with the bank&apos;s
                    timeline page for filing language and news context.
                  </Insight>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Peer Group Snapshot Table */}
      {peerComparisonData.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h3 className="font-semibold text-neutral-900 text-base">Peer Group Snapshot</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Average lending ratios by bank category for the latest reported quarter ({peerComparisonData[0]?.quarter})
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-400 border-b border-neutral-100">
                  <th className="px-6 py-3 font-medium">Peer Group</th>
                  <th className="px-4 py-3 font-medium text-right">Banks</th>
                  <th className="px-4 py-3 font-medium text-right">Avg NBFI Ratio</th>
                  <th className="px-4 py-3 font-medium text-right">Avg C&I Ratio</th>
                  <th className="px-6 py-3 font-medium">Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {peerComparisonData.map((pg) => (
                  <tr key={pg.peer_group} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: peerColor(pg.raw_pg) }} />
                        <span className="font-medium text-neutral-800">{pg.peer_group}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-600">{pg.bank_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-neutral-800">
                      {fmtPct(pg.avg_nbfi_ratio)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                      {fmtPct(pg.avg_ci_ratio)}
                    </td>
                    <td className="px-6 py-3 text-xs text-neutral-500 max-w-xs">
                      {pg.avg_nbfi_ratio > 0.02
                        ? 'Significant private credit involvement — active NBFI lender'
                        : pg.avg_nbfi_ratio > 0.005
                        ? 'Moderate NBFI exposure — selective participation'
                        : 'Minimal NBFI lending — traditional lending focus'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
