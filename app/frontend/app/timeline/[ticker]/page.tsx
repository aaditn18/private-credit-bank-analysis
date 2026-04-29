'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
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
} from 'recharts';
import { StockPriceChart } from '@/components/StockPriceChart';

// ── types ──────────────────────────────────────────────────────────────────────

interface Filing {
  doc_type: string;
  fiscal_year: number | null;
  fiscal_quarter: number | null;
  filed_at: string | null;
  title: string | null;
}

interface MetricSet {
  ci_ratio: number | null;
  nbfi_loan_ratio: number | null;
  nbfi_commitment_ratio: number | null;
  pe_exposure: number | null;
  loan_scale: number | null;
}

interface StockPrice {
  date: string;
  close: number;
  volume: number | null;
}

interface NewsArticle {
  headline: string;
  url: string | null;
  published_at: string;
  sentiment_score: number | null;
}

interface TimelineData {
  ticker: string;
  name: string;
  peer_group: string;
  filings: Filing[];
  metrics_by_quarter: Record<string, MetricSet>;
  stock_prices: StockPrice[];
  news: NewsArticle[];
}

// ── helpers ────────────────────────────────────────────────────────────────────

function peerBadge(pg: string): string {
  if (pg === 'GSIB') return 'bg-purple-100 text-purple-700';
  if (pg === 'trust-ib') return 'bg-blue-100 text-blue-700';
  return 'bg-neutral-100 text-neutral-600';
}

function sentimentBadge(score: number | null): { bg: string; label: string } {
  if (score === null) return { bg: 'bg-neutral-100 text-neutral-500', label: 'N/A' };
  if (score >= 0.15) return { bg: 'bg-emerald-100 text-emerald-700', label: 'Bullish' };
  if (score >= 0) return { bg: 'bg-amber-100 text-amber-700', label: 'Neutral' };
  if (score >= -0.15) return { bg: 'bg-orange-100 text-orange-700', label: 'Bearish-Lean' };
  return { bg: 'bg-rose-100 text-rose-700', label: 'Bearish' };
}

function docTypeBadge(dt: string): string {
  if (dt === '10-K') return 'bg-indigo-100 text-indigo-700';
  if (dt === '10-Q') return 'bg-blue-100 text-blue-700';
  if (dt === '8-K') return 'bg-amber-100 text-amber-700';
  return 'bg-neutral-100 text-neutral-600';
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return '--';
  return `${(val * 100).toFixed(2)}%`;
}

function fmtBps(val: number): string {
  return `${(val * 10000).toFixed(0)} bps`;
}

const METRIC_COLORS: Record<string, string> = {
  ci_ratio: '#6366f1',
  nbfi_loan_ratio: '#10b981',
  nbfi_commitment_ratio: '#f59e0b',
  pe_exposure: '#ef4444',
};

const METRIC_LABELS: Record<string, string> = {
  ci_ratio: 'C&I Ratio',
  nbfi_loan_ratio: 'NBFI Loan Ratio',
  nbfi_commitment_ratio: 'NBFI Commitment Ratio',
  pe_exposure: 'PE Exposure',
};

const METRIC_DESCRIPTIONS: Record<string, string> = {
  ci_ratio: 'Commercial & Industrial loans as a share of total loans — core business lending',
  nbfi_loan_ratio: 'Loans to non-bank financial institutions as a share of total loans — private credit proxy',
  nbfi_commitment_ratio: 'Unfunded commitments to NBFIs — forward-looking exposure',
  pe_exposure: 'Private equity fund exposure — direct alternative investment activity',
};

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="h-6 w-48 bg-neutral-100 rounded mb-2" />
        <div className="h-4 w-32 bg-neutral-100 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="h-4 w-24 bg-neutral-100 rounded mb-2" />
            <div className="h-7 w-16 bg-neutral-100 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="h-4 w-36 bg-neutral-100 rounded mb-4" />
        <div className="h-64 bg-neutral-50 rounded" />
      </div>
    </div>
  );
}

function Insight({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 px-4 py-3 bg-indigo-50/60 border border-indigo-100 rounded-lg">
      <p className="text-xs text-indigo-800 leading-relaxed">{children}</p>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const params = useParams();
  const ticker = (params.ticker as string)?.toUpperCase() ?? '';

  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);

  // Load main timeline data
  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    fetch(`/api/backend/timeline/${ticker}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load timeline for ${ticker}`);
        return r.json();
      })
      .then((d: TimelineData) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [ticker]);

  // Auto-load stock prices when main data arrives and stock prices are empty
  useEffect(() => {
    if (!data || data.stock_prices.length > 0 || stockLoading) return;
    setStockLoading(true);
    fetch(`/api/backend/stock/${ticker}`)
      .then((r) => r.ok ? r.json() : [])
      .then((prices: StockPrice[]) => {
        setData((prev) => (prev ? { ...prev, stock_prices: prices } : prev));
      })
      .catch(() => {})
      .finally(() => setStockLoading(false));
  }, [data, ticker, stockLoading]);

  // Auto-load news when main data arrives and news is empty
  useEffect(() => {
    if (!data || data.news.length > 0 || newsLoading) return;
    setNewsLoading(true);
    fetch(`/api/backend/news/${ticker}`)
      .then((r) => r.ok ? r.json() : [])
      .then((articles: NewsArticle[]) => {
        setData((prev) => (prev ? { ...prev, news: articles } : prev));
      })
      .catch(() => {})
      .finally(() => setNewsLoading(false));
  }, [data, ticker, newsLoading]);

  // Derived data
  const quarters = useMemo(() => data ? Object.keys(data.metrics_by_quarter).sort() : [], [data]);

  const metricsChartData = useMemo(() => {
    if (!data) return [];
    return quarters.map((q) => {
      const m = data.metrics_by_quarter[q];
      return { quarter: q, ...m };
    });
  }, [data, quarters]);

  const metricKeys = ['ci_ratio', 'nbfi_loan_ratio', 'nbfi_commitment_ratio', 'pe_exposure'] as const;
  const activeMetrics = useMemo(() => {
    if (!data) return [];
    return metricKeys.filter((k) => quarters.some((q) => data.metrics_by_quarter[q][k] !== null));
  }, [data, quarters]);

  const filingDates = useMemo(() => {
    if (!data) return [];
    return data.filings.map((f) => f.filed_at).filter((d): d is string => d !== null);
  }, [data]);

  // Metric summary cards
  const metricSummary = useMemo(() => {
    if (!data || quarters.length === 0) return null;
    const latestQ = quarters[quarters.length - 1];
    const prevQ = quarters.length >= 2 ? quarters[quarters.length - 2] : null;
    const latest = data.metrics_by_quarter[latestQ];
    const prev = prevQ ? data.metrics_by_quarter[prevQ] : null;

    return activeMetrics.map((key) => {
      const currentVal = latest[key];
      const prevVal = prev ? prev[key] : null;
      const change = currentVal !== null && prevVal !== null ? currentVal - prevVal : null;
      return {
        key,
        label: METRIC_LABELS[key],
        description: METRIC_DESCRIPTIONS[key],
        color: METRIC_COLORS[key],
        value: currentVal,
        prevValue: prevVal,
        change,
        latestQuarter: latestQ,
        prevQuarter: prevQ,
      };
    });
  }, [data, quarters, activeMetrics]);

  // News sentiment summary
  const newsSentiment = useMemo(() => {
    if (!data || data.news.length === 0) return null;
    const scored = data.news.filter((n) => n.sentiment_score !== null);
    if (scored.length === 0) return null;
    const avg = scored.reduce((sum, n) => sum + (n.sentiment_score ?? 0), 0) / scored.length;
    const positive = scored.filter((n) => (n.sentiment_score ?? 0) >= 0.15).length;
    const negative = scored.filter((n) => (n.sentiment_score ?? 0) < -0.15).length;
    const neutral = scored.length - positive - negative;
    return { avg, positive, negative, neutral, total: scored.length };
  }, [data]);

  if (loading) return <Skeleton />;

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
        <h2 className="text-lg font-semibold text-red-800 mb-1">Error loading timeline</h2>
        <p className="text-sm text-red-600">{error ?? 'Unknown error'}</p>
        <a href="/trends" className="inline-block mt-4 text-sm text-indigo-600 hover:text-indigo-800 underline">
          Back to trends
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bank Header */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-neutral-900">{data.ticker}</h1>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${peerBadge(data.peer_group)}`}>
            {data.peer_group === 'trust-ib' ? 'Trust / IB' : data.peer_group}
          </span>
          <a href="/trends" className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 underline">
            All Banks
          </a>
        </div>
        <p className="text-sm text-neutral-500 mt-1">{data.name}</p>
        <p className="text-xs text-neutral-400 mt-2">
          {quarters.length} quarters of Call Report data | {data.filings.length} SEC filings on record
        </p>
      </section>

      {/* Metric Summary Cards */}
      {metricSummary && metricSummary.length > 0 && (
        <div className={`grid grid-cols-2 ${metricSummary.length >= 3 ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-4`}>
          {metricSummary.map((m) => (
            <div key={m.key} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">{m.label}</p>
              </div>
              <p className="text-2xl font-bold text-neutral-900 mt-2">{fmtPct(m.value)}</p>
              {m.change !== null && (
                <p className={clsx('text-xs font-semibold mt-1', m.change >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                  {m.change >= 0 ? '+' : ''}{fmtBps(m.change)} QoQ
                </p>
              )}
              <p className="text-[10px] text-neutral-400 mt-0.5">{m.latestQuarter}</p>
            </div>
          ))}
        </div>
      )}

      {/* Stock Price Chart */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="font-semibold text-neutral-900 text-base">Stock Price</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Historical closing prices{filingDates.length > 0 ? ' — vertical lines mark SEC filing dates' : ''}
          </p>
        </div>
        <div className="p-6">
          {data.stock_prices.length > 0 ? (
            <>
              <StockPriceChart data={data.stock_prices} filingDates={filingDates} />
              <Insight>
                Filing dates are marked on the chart. Look for price reactions around 10-K and 10-Q filing dates —
                significant moves within 2-3 days of a filing may indicate the market is responding to disclosed private credit exposure changes.
                Compare stock direction against the NBFI ratio trend below to assess whether markets are pricing in private credit strategy shifts.
              </Insight>
            </>
          ) : stockLoading ? (
            <div className="flex items-center justify-center h-48 gap-2">
              <svg className="animate-spin h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm text-neutral-400">Loading stock data...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
              Stock price data unavailable for {data.ticker}
            </div>
          )}
        </div>
      </section>

      {/* Metrics Evolution */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="font-semibold text-neutral-900 text-base">Call Report Metrics Over Time</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Key lending ratios derived from FFIEC Call Report data across reported quarters
          </p>
        </div>
        <div className="p-6">
          {metricsChartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={metricsChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                    formatter={(value: number, name: string) => [fmtPct(value), METRIC_LABELS[name] ?? name]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
                  />
                  <Legend formatter={(value: string) => <span className="text-xs text-neutral-600">{METRIC_LABELS[value] ?? value}</span>} />
                  {activeMetrics.map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={METRIC_COLORS[key]}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {/* Metric legend with descriptions */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                {activeMetrics.map((key) => (
                  <div key={key} className="flex items-start gap-2 text-[11px]">
                    <div className="w-2 h-2 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: METRIC_COLORS[key] }} />
                    <div>
                      <span className="font-medium text-neutral-700">{METRIC_LABELS[key]}</span>
                      <span className="text-neutral-400"> — {METRIC_DESCRIPTIONS[key]}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Insight>
                {(() => {
                  if (quarters.length < 2) return 'Only one quarter of data available — trend analysis requires at least two quarters.';
                  const latestQ = quarters[quarters.length - 1];
                  const firstQ = quarters[0];
                  const latestNbfi = data.metrics_by_quarter[latestQ]?.nbfi_loan_ratio;
                  const firstNbfi = data.metrics_by_quarter[firstQ]?.nbfi_loan_ratio;
                  if (latestNbfi == null || firstNbfi == null) return 'NBFI loan ratio data is sparse for this bank.';
                  const direction = latestNbfi > firstNbfi ? 'expanded' : 'contracted';
                  const changeBps = Math.abs((latestNbfi - firstNbfi) * 10000).toFixed(0);
                  return `${data.ticker}'s NBFI loan exposure has ${direction} by ${changeBps} basis points from ${firstQ} to ${latestQ}. ${
                    direction === 'expanded'
                      ? 'This signals growing engagement with private credit markets — the bank is increasing its lending to fund managers, BDCs, and other non-bank financial intermediaries.'
                      : 'This signals a strategic pullback from NBFI lending — potentially driven by regulatory concerns, credit quality tightening, or reallocation toward traditional C&I lending.'
                  }`;
                })()}
              </Insight>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
              No quarterly metrics available for {data.ticker}
            </div>
          )}
        </div>
      </section>

      {/* News + Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* News Sentiment Summary */}
        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h3 className="font-semibold text-neutral-900 text-base">News Sentiment</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Alpha Vantage news analysis</p>
          </div>
          <div className="p-6">
            {newsLoading ? (
              <div className="flex items-center justify-center h-32 gap-2">
                <svg className="animate-spin h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-xs text-neutral-400">Loading news...</span>
              </div>
            ) : newsSentiment ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-neutral-900">
                    {newsSentiment.avg >= 0.15 ? 'Bullish' : newsSentiment.avg >= 0 ? 'Neutral' : newsSentiment.avg >= -0.15 ? 'Bearish-Lean' : 'Bearish'}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Avg score: {newsSentiment.avg.toFixed(3)} across {newsSentiment.total} articles
                  </p>
                </div>
                <div className="flex justify-center gap-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600">{newsSentiment.positive}</p>
                    <p className="text-[10px] text-neutral-400">Bullish</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-amber-600">{newsSentiment.neutral}</p>
                    <p className="text-[10px] text-neutral-400">Neutral</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-rose-600">{newsSentiment.negative}</p>
                    <p className="text-[10px] text-neutral-400">Bearish</p>
                  </div>
                </div>
                <Insight>
                  News sentiment provides an external market perspective on {data.ticker}. Compare this with the Call Report metrics above —
                  if filings show increasing NBFI exposure but news sentiment is negative, the market may be skeptical of the bank&apos;s private credit strategy.
                </Insight>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-neutral-400">
                No news data available
              </div>
            )}
          </div>
        </section>

        {/* News Feed */}
        <section className="lg:col-span-2 rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h3 className="font-semibold text-neutral-900 text-base">Recent News</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Live financial news with ticker-specific sentiment scores
            </p>
          </div>
          <div className="divide-y divide-neutral-100 max-h-[420px] overflow-y-auto">
            {newsLoading ? (
              <div className="px-6 py-8 text-center">
                <svg className="animate-spin h-5 w-5 text-indigo-500 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <p className="text-sm text-neutral-400">Fetching news from Alpha Vantage...</p>
              </div>
            ) : data.news.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-neutral-400">
                No recent news articles found for {data.ticker}
              </div>
            ) : (
              data.news
                .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
                .map((article, i) => {
                  const sb = sentimentBadge(article.sentiment_score);
                  return (
                    <div key={i} className="px-6 py-3 hover:bg-neutral-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {article.url ? (
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-neutral-800 hover:text-indigo-600 line-clamp-2 transition-colors"
                            >
                              {article.headline}
                            </a>
                          ) : (
                            <p className="text-sm font-medium text-neutral-800 line-clamp-2">{article.headline}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[11px] text-neutral-400">
                              {new Date(article.published_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                              })}
                            </p>
                            {article.sentiment_score !== null && (
                              <p className="text-[10px] text-neutral-400 tabular-nums">
                                Score: {article.sentiment_score.toFixed(3)}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap shrink-0 ${sb.bg}`}>
                          {sb.label}
                        </span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </section>
      </div>

      {/* SEC Filings */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="font-semibold text-neutral-900 text-base">SEC Filings</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            {data.filings.length} filings on record — 10-K (annual), 10-Q (quarterly), 8-K (current events)
          </p>
        </div>
        <div className="overflow-x-auto">
          {data.filings.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-neutral-400">No filings found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-400 border-b border-neutral-100">
                  <th className="px-6 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Fiscal Year</th>
                  <th className="px-3 py-2.5 font-medium">Quarter</th>
                  <th className="px-3 py-2.5 font-medium">Filed</th>
                  <th className="px-3 py-2.5 font-medium">Title</th>
                </tr>
              </thead>
              <tbody>
                {data.filings
                  .sort((a, b) => {
                    if (a.filed_at && b.filed_at) return new Date(b.filed_at).getTime() - new Date(a.filed_at).getTime();
                    return 0;
                  })
                  .map((f, i) => (
                    <tr key={i} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-2.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${docTypeBadge(f.doc_type)}`}>
                          {f.doc_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-neutral-700 tabular-nums">{f.fiscal_year ?? '--'}</td>
                      <td className="px-3 py-2.5 text-neutral-700 tabular-nums">{f.fiscal_quarter ? `Q${f.fiscal_quarter}` : '--'}</td>
                      <td className="px-3 py-2.5 text-neutral-500 text-xs">
                        {f.filed_at
                          ? new Date(f.filed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '--'}
                      </td>
                      <td className="px-3 py-2.5 text-neutral-600 max-w-sm truncate">{f.title ?? '--'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
