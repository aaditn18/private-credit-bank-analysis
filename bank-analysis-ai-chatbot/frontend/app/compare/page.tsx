'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts';

// ── backend shapes (mirrors backend api.py) ───────────────────────────────────

interface Bank {
  ticker: string;
  name: string;
  peer_group: string;
}

interface TimelineFiling {
  doc_type: string;
  fiscal_year: number | null;
  fiscal_quarter: number | null;
  filed_at: string | null;
  title: string | null;
}

interface TimelineMetricSet {
  ci_ratio: number | null;
  nbfi_loan_ratio: number | null;
  nbfi_commitment_ratio: number | null;
  pe_exposure: number | null;
  loan_scale: number | null;
  // Derived QoQ on the frontend (not in backend timeline payload)
  nbfi_growth?: number | null;
}

interface TimelineData {
  ticker: string;
  name: string;
  peer_group: string;
  filings: TimelineFiling[];
  metrics_by_quarter: Record<string, TimelineMetricSet>;
  stock_prices: { date: string; close: number; volume: number | null }[];
}

// Mirror of /rankings response (only the fields we use here).
interface RankingsBank {
  ticker: string;
  name: string;
  peer_group: string;
  raw: Record<string, number | null>;
  norm: Record<string, number>;
}
interface RankingsResponse {
  quarter: string;
  prev_quarter: string;
  metrics: { key: string; label: string; higher_is_better: boolean }[];
  banks: RankingsBank[];
}

// Mirror of /trends response (only the fields we use here).
interface TrendsResponse {
  banks: { ticker: string; name: string; peer_group: string }[];
  metrics_over_time: Record<
    string,
    Record<
      string,
      {
        ci_ratio: number | null;
        loan_scale: number | null;
        nbfi_loan_ratio: number | null;
        nbfi_commitment_ratio: number | null;
        pe_exposure: number | null;
      }
    >
  >;
  peer_group_comparison: Record<
    string,
    Record<string, { avg_nbfi_ratio: number | null; avg_ci_ratio: number | null; bank_count: number }>
  >;
}

type FindingThemes = string[] | string | null;
type FindingQuotes =
  | { quote: string; source?: string; topic?: string }[]
  | string[]
  | string
  | null;

interface FindingData {
  bank_ticker: string;
  bank_name: string | null;
  rating: number | null;
  mention_frequency: string | null;
  sentiment: string | null;
  key_themes: FindingThemes;
  strategic_initiatives: string | null;
  perceived_risks: string | null;
  notable_quotes: FindingQuotes;
  pullback_mentions: string | null;
  named_competitors: string | null;
  risk_focus_analysis: string | null;
  involvement_rating: number | null;
}

// ── constants / helpers ───────────────────────────────────────────────────────

const MAX_BANKS = 4;
const MIN_BANKS = 2;

// METRICS now mirrors the 6-metric set used by RankingsPanel so the radar /
// bars / trends chart all reflect the same composite the home page scores on.
//
// `pct: true` metrics fit on a single percent y-axis (used for the grouped
// bar chart). `loan_scale` (log of total loans) and `nbfi_growth` (QoQ delta)
// don't share that axis — they're shown alongside the bars as a small KPI
// strip.
const METRICS = [
  { key: 'ci_ratio', label: 'C&I', fmt: (v: number) => `${(v * 100).toFixed(2)}%`, pct: true },
  { key: 'nbfi_loan_ratio', label: 'NBFI loans', fmt: (v: number) => `${(v * 100).toFixed(2)}%`, pct: true },
  { key: 'nbfi_commitment_ratio', label: 'NBFI commits', fmt: (v: number) => `${(v * 100).toFixed(2)}%`, pct: true },
  { key: 'pe_exposure', label: 'PE exposure', fmt: (v: number) => `${(v * 100).toFixed(2)}%`, pct: true },
  {
    key: 'loan_scale',
    label: 'Loan scale',
    // RCON2122 is reported in thousands — exp(log(thousands)) gives thousands;
    // divide by 1e6 to render as billions.
    fmt: (v: number) => `$${(Math.exp(v) / 1e6).toFixed(1)}B`,
    pct: false,
  },
  {
    key: 'nbfi_growth',
    label: 'NBFI QoQ',
    fmt: (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`,
    pct: false,
  },
] as const;

type MetricKey = (typeof METRICS)[number]['key'];

// Default composite weights — matches RankingsPanel.tsx so the rank we display
// on /compare is exactly what /home shows under the default weights toggle.
const DEFAULT_WEIGHTS: Record<string, number> = {
  nbfi_loan_ratio: 35,
  nbfi_commitment_ratio: 25,
  nbfi_growth: 15,
  ci_ratio: 10,
  pe_exposure: 10,
  loan_scale: 5,
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'] as const;

function peerBadge(pg: string): string {
  if (pg === 'GSIB') return 'bg-purple-100 text-purple-700';
  if (pg === 'trust-ib') return 'bg-blue-100 text-blue-700';
  if (pg === 'regional') return 'bg-emerald-100 text-emerald-700';
  return 'bg-neutral-100 text-neutral-600';
}

function peerLabel(pg: string): string {
  if (pg === 'trust-ib') return 'Trust / IB';
  if (pg === 'regional') return 'Regional';
  return pg;
}

function parseMaybeJson<T>(val: unknown): T | null {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'string') return val as T;
  const s = val.trim();
  if (!s) return null;
  if (!(s.startsWith('[') || s.startsWith('{'))) return val as T;
  try {
    return JSON.parse(s) as T;
  } catch {
    return val as T;
  }
}

function unionFilingDates(timelines: Record<string, TimelineData | null>) {
  const out = new Set<string>();
  Object.values(timelines).forEach((t) => {
    t?.filings?.forEach((f) => {
      if (f.filed_at) out.add(f.filed_at);
    });
  });
  return Array.from(out).sort();
}

function latestQuarter(metricsByQuarter: Record<string, TimelineMetricSet> | undefined): string | null {
  if (!metricsByQuarter) return null;
  const qs = Object.keys(metricsByQuarter).sort();
  return qs.length ? qs[qs.length - 1] : null;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function safeNum(v: number | null | undefined): number | null {
  return v === null || v === undefined || Number.isNaN(v) ? null : v;
}

// ── tiny “markdown-ish” renderer for winner summaries ─────────────────────────

type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; items: string[] };

function splitIntoBlocks(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let bullets: string[] | null = null;
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const flushBullets = () => {
    if (bullets && bullets.length) {
      blocks.push({ kind: 'bullet', items: bullets });
      bullets = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushBullets();
      continue;
    }
    if (line.startsWith('## ') || line.startsWith('### ')) {
      flushParagraph();
      flushBullets();
      blocks.push({ kind: 'heading', text: line.replace(/^#+\s*/, '') });
    } else if (line.startsWith('- ')) {
      flushParagraph();
      if (!bullets) bullets = [];
      bullets.push(line.slice(2));
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();
  return blocks;
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = /^\*\*(.+)\*\*$/.exec(p);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return <span key={i}>{p}</span>;
  });
}

function RenderedMarkdown({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => splitIntoBlocks(markdown), [markdown]);
  return (
    <div className="space-y-2 leading-relaxed text-sm text-neutral-800">
      {blocks.map((b, i) =>
        b.kind === 'heading' ? (
          <div key={i} className="font-semibold text-[11px] uppercase tracking-wide text-neutral-500 pt-1">
            {b.text}
          </div>
        ) : b.kind === 'bullet' ? (
          <ul key={i} className="list-disc ml-4 space-y-1">
            {b.items.map((line, j) => (
              <li key={j}>{renderBold(line)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{renderBold(b.text)}</p>
        ),
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [banksError, setBanksError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const [timelines, setTimelines] = useState<Record<string, TimelineData | null>>({});
  const [findings, setFindings] = useState<Record<string, FindingData | null>>({});
  const [loadingTickers, setLoadingTickers] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);

  const [winnerLoading, setWinnerLoading] = useState(false);
  const [winnerError, setWinnerError] = useState<string | null>(null);
  const [winnerMarkdown, setWinnerMarkdown] = useState<string | null>(null);
  const abortWinner = useRef<AbortController | null>(null);

  // Cross-bank context: rankings (composite rank tile) + trends (per-metric
  // line chart). These are global, not per-ticker, so we fetch once on mount.
  const [rankings, setRankings] = useState<RankingsResponse | null>(null);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);

  // Metric trends section state.
  const [trendMetric, setTrendMetric] = useState<MetricKey>('nbfi_loan_ratio');
  const [showPeerMedian, setShowPeerMedian] = useState(false);

  // Read initial state from URL (?banks=JPM,BAC)
  useEffect(() => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('banks');
    if (raw) {
      const tickers = raw
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, MAX_BANKS);
      if (tickers.length) setSelected(Array.from(new Set(tickers)));
    } else {
      setSelected(['JPM', 'BAC'].slice(0, MAX_BANKS));
    }
  }, []);

  // Keep URL in sync
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected.length) url.searchParams.set('banks', selected.join(','));
    else url.searchParams.delete('banks');
    window.history.replaceState(null, '', url.toString());
  }, [selected]);

  // Load bank list
  useEffect(() => {
    setBanksLoading(true);
    setBanksError(null);
    fetch('/api/backend/banks')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load banks (HTTP ${r.status})`);
        return r.json();
      })
      .then((d: Bank[]) => setBanks(d))
      .catch((e) => setBanksError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBanksLoading(false));
  }, []);

  // Load /rankings (composite rank tile) — once per mount. Failures here
  // shouldn't kill the page; the rank tile just won't render.
  useEffect(() => {
    fetch('/api/backend/rankings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RankingsResponse | null) => {
        if (d) setRankings(d);
      })
      .catch(() => {
        /* swallow */
      });
  }, []);

  // Load /trends (multi-quarter metric chart) — once per mount.
  useEffect(() => {
    fetch('/api/backend/trends')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TrendsResponse | null) => {
        if (d) setTrends(d);
      })
      .catch(() => {
        /* swallow */
      });
  }, []);

  // Ensure we have timeline + findings for selected tickers
  useEffect(() => {
    let cancelled = false;
    async function loadFor(ticker: string) {
      setLoadingTickers((prev) => new Set(prev).add(ticker));
      try {
        const [tRes, fRes] = await Promise.all([
          fetch(`/api/backend/timeline/${ticker}`),
          fetch(`/api/backend/findings/${ticker}`),
        ]);
        if (!tRes.ok) throw new Error(`Timeline failed for ${ticker} (HTTP ${tRes.status})`);
        const tJson = (await tRes.json()) as TimelineData;
        const fJson = fRes.ok ? ((await fRes.json()) as FindingData) : null;
        if (!cancelled) {
          setTimelines((prev) => ({ ...prev, [ticker]: tJson }));
          setFindings((prev) => ({ ...prev, [ticker]: fJson }));
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) {
          setLoadingTickers((prev) => {
            const next = new Set(prev);
            next.delete(ticker);
            return next;
          });
        }
      }
    }

    for (const t of selected) {
      if (!timelines[t] && !loadingTickers.has(t)) void loadFor(t);
      if (findings[t] === undefined && !loadingTickers.has(t)) void loadFor(t);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const selectedBanks = useMemo(() => {
    const byTicker = new Map(banks.map((b) => [b.ticker.toUpperCase(), b]));
    return selected
      .map((t) => byTicker.get(t) ?? null)
      .filter((b): b is Bank => b !== null);
  }, [banks, selected]);

  const filteredBankOptions = useMemo(() => {
    const q = query.trim().toUpperCase();
    const selectedSet = new Set(selected);
    const options = banks.filter((b) => !selectedSet.has(b.ticker.toUpperCase()));
    if (!q) return options.slice(0, 20);
    return options
      .filter((b) => b.ticker.toUpperCase().includes(q) || b.name.toUpperCase().includes(q))
      .slice(0, 20);
  }, [banks, query, selected]);

  const latestQByBank = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const t of selected) {
      out[t] = latestQuarter(timelines[t]?.metrics_by_quarter);
    }
    return out;
  }, [selected, timelines]);

  const latestMetricsByBank = useMemo(() => {
    const out: Record<string, TimelineMetricSet | null> = {};
    for (const t of selected) {
      const tl = timelines[t];
      const q = latestQByBank[t];
      if (!tl || !q) {
        out[t] = null;
        continue;
      }
      const cur = tl.metrics_by_quarter?.[q] ?? null;
      // Derive nbfi_growth = QoQ % change in nbfi_loan_ratio. The backend
      // /timeline payload doesn't include it; /rankings does, but using the
      // timeline-derived value here keeps the radar consistent with the
      // bank-specific quarter shown in the sidebar.
      const sortedQs = Object.keys(tl.metrics_by_quarter ?? {}).sort();
      const idx = sortedQs.indexOf(q);
      const prevQ = idx > 0 ? sortedQs[idx - 1] : null;
      const prev = prevQ ? tl.metrics_by_quarter?.[prevQ] : null;
      let nbfi_growth: number | null = null;
      if (
        cur?.nbfi_loan_ratio != null &&
        prev?.nbfi_loan_ratio != null &&
        prev.nbfi_loan_ratio > 0
      ) {
        nbfi_growth =
          (cur.nbfi_loan_ratio - prev.nbfi_loan_ratio) / prev.nbfi_loan_ratio;
      }
      out[t] = cur ? { ...cur, nbfi_growth } : null;
    }
    return out;
  }, [selected, timelines, latestQByBank]);

  const radarData = useMemo(() => {
    // Build normalized values per metric across selected banks.
    const keys = METRICS.map((m) => m.key);
    const rawByMetric: Record<string, number[]> = {};
    keys.forEach((k) => (rawByMetric[k] = []));
    for (const t of selected) {
      const m = latestMetricsByBank[t];
      if (!m) continue;
      for (const k of keys) {
        const v = safeNum((m as any)[k] as number | null);
        if (v !== null) rawByMetric[k].push(v);
      }
    }
    const minMax: Record<string, { lo: number; hi: number }> = {};
    for (const k of keys) {
      const vals = rawByMetric[k];
      const lo = vals.length ? Math.min(...vals) : 0;
      const hi = vals.length ? Math.max(...vals) : 1;
      minMax[k] = { lo, hi: hi === lo ? lo + 1e-9 : hi };
    }

    return METRICS.map((metric) => {
      const row: Record<string, string | number> = { metric: metric.label };
      for (const t of selected) {
        const m = latestMetricsByBank[t];
        const raw = m ? safeNum((m as any)[metric.key] as number | null) : null;
        const mm = minMax[metric.key];
        const norm = raw === null ? 0 : clamp01((raw - mm.lo) / (mm.hi - mm.lo));
        row[t] = norm;
      }
      return row;
    });
  }, [selected, latestMetricsByBank]);

  const metricsBarData = useMemo(() => {
    // Grouped bars only for percent-of-loans metrics — loan_scale (log) and
    // nbfi_growth (signed delta) don't share the same y-axis, so they get
    // their own KPI strip below.
    return METRICS.filter((m) => m.pct).map((metric) => {
      const row: Record<string, string | number | null> = { metric: metric.label };
      for (const t of selected) {
        const m = latestMetricsByBank[t];
        const raw = m ? safeNum((m as any)[metric.key] as number | null) : null;
        row[t] = raw;
      }
      return row;
    });
  }, [selected, latestMetricsByBank]);

  // ── Composite ranking (B) ───────────────────────────────────────────────
  // Score every bank in /rankings under the default weights, then sort to
  // get rank position. Mirrors RankingsPanel.tsx logic exactly.
  const compositeRanking = useMemo(() => {
    if (!rankings) return null;
    const weightSum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    type Scored = {
      ticker: string;
      peer_group: string;
      name: string;
      score: number;
      rank: number;
      peerRank: number;
    };
    const scored: Scored[] = rankings.banks.map((b) => {
      let score = 0;
      for (const m of rankings.metrics) {
        const w = (DEFAULT_WEIGHTS[m.key] ?? 0) / weightSum;
        const raw = b.norm[m.key] ?? 0;
        const norm = m.higher_is_better ? raw : 1 - raw;
        score += w * norm;
      }
      return {
        ticker: b.ticker,
        peer_group: b.peer_group,
        name: b.name,
        score,
        rank: 0,
        peerRank: 0,
      };
    });
    scored.sort((a, b) => b.score - a.score);
    scored.forEach((s, i) => {
      s.rank = i + 1;
    });
    // Peer-group ranks
    const byPeer: Record<string, Scored[]> = {};
    for (const s of scored) (byPeer[s.peer_group] ??= []).push(s);
    for (const pg of Object.keys(byPeer)) {
      byPeer[pg].sort((a, b) => b.score - a.score);
      byPeer[pg].forEach((s, i) => {
        s.peerRank = i + 1;
      });
    }
    return {
      total: scored.length,
      byTicker: Object.fromEntries(scored.map((s) => [s.ticker, s])) as Record<
        string,
        Scored
      >,
      peerSizes: Object.fromEntries(
        Object.entries(byPeer).map(([pg, arr]) => [pg, arr.length]),
      ) as Record<string, number>,
    };
  }, [rankings]);

  // ── Metric trends over time (C) ─────────────────────────────────────────
  const trendChartData = useMemo(() => {
    if (!trends) return [];
    // Union of quarters that any selected bank reports for the chosen metric.
    const allQuarters = new Set<string>();
    for (const t of selected) {
      const m = trends.metrics_over_time[t] ?? {};
      Object.keys(m).forEach((q) => allQuarters.add(q));
    }
    const quarters = Array.from(allQuarters).sort();

    // Per-quarter peer-group medians, for the optional overlay.
    const peerGroupOf: Record<string, string> = {};
    for (const b of trends.banks) peerGroupOf[b.ticker] = b.peer_group;

    function valFor(t: string, q: string): number | null {
      if (trendMetric === 'nbfi_growth') {
        const series = trends?.metrics_over_time?.[t];
        if (!series) return null;
        const sortedQs = Object.keys(series).sort();
        const idx = sortedQs.indexOf(q);
        if (idx <= 0) return null;
        const prevQ = sortedQs[idx - 1];
        const cur = series[q]?.nbfi_loan_ratio;
        const prev = series[prevQ]?.nbfi_loan_ratio;
        if (cur != null && prev != null && prev > 0) return (cur - prev) / prev;
        return null;
      }
      return ((trends?.metrics_over_time?.[t]?.[q] as any) ?? {})[trendMetric] ?? null;
    }

    return quarters.map((q) => {
      const row: Record<string, string | number | null> = { quarter: q };
      for (const t of selected) row[t] = valFor(t, q);

      if (showPeerMedian) {
        // Group by peer of the selected banks; compute median across that peer
        // group at this quarter.
        const peerGroups = Array.from(
          new Set(selected.map((t) => peerGroupOf[t]).filter(Boolean)),
        );
        for (const pg of peerGroups) {
          const peers = (trends?.banks ?? [])
            .filter((b) => b.peer_group === pg)
            .map((b) => valFor(b.ticker, q))
            .filter((v): v is number => v != null);
          if (peers.length) {
            peers.sort((a, b) => a - b);
            const mid = Math.floor(peers.length / 2);
            const median =
              peers.length % 2 === 0 ? (peers[mid - 1] + peers[mid]) / 2 : peers[mid];
            row[`__peer_${pg}`] = median;
          } else {
            row[`__peer_${pg}`] = null;
          }
        }
      }
      return row;
    });
  }, [trends, selected, trendMetric, showPeerMedian]);

  const trendPeerKeys = useMemo(() => {
    if (!showPeerMedian || !trends) return [] as string[];
    const peers = new Set<string>();
    for (const t of selected) {
      const pg = trends.banks.find((b) => b.ticker === t)?.peer_group;
      if (pg) peers.add(pg);
    }
    return Array.from(peers);
  }, [showPeerMedian, trends, selected]);

  const stockOverlayData = useMemo(() => {
    // Pivot all selected stock series onto a single date axis.
    const series: Record<string, { date: string; close: number }[]> = {};
    const allDates = new Set<string>();
    for (const t of selected) {
      const sp = timelines[t]?.stock_prices ?? [];
      const sorted = [...sp].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      series[t] = sorted.map((p) => ({ date: p.date, close: p.close }));
      sorted.forEach((p) => allDates.add(p.date));
    }
    const dates = Array.from(allDates).sort();
    if (!dates.length) return [];
    return dates.map((d) => {
      const row: Record<string, string | number> = { date: d };
      for (const t of selected) {
        const match = series[t].find((p) => p.date === d);
        if (match) row[t] = match.close;
      }
      return row;
    });
  }, [selected, timelines]);

  const filingDates = useMemo(() => unionFilingDates(timelines), [timelines]);

  const quoteTopics = useMemo(() => {
    const topics = new Set<string>();
    for (const t of selected) {
      const f = findings[t];
      if (!f) continue;
      const themes = parseMaybeJson<any>(f.key_themes);
      if (Array.isArray(themes)) themes.forEach((x) => typeof x === 'string' && topics.add(x));
    }
    return Array.from(topics).sort();
  }, [selected, findings]);

  const [topic, setTopic] = useState<string>('');
  useEffect(() => {
    if (!topic && quoteTopics.length) setTopic(quoteTopics[0]);
  }, [topic, quoteTopics]);

  function addTicker(t: string) {
    const up = t.toUpperCase();
    setWinnerMarkdown(null);
    setWinnerError(null);
    setSelected((prev) => {
      if (prev.includes(up)) return prev;
      if (prev.length >= MAX_BANKS) return prev;
      return [...prev, up];
    });
    setQuery('');
  }

  function removeTicker(t: string) {
    setWinnerMarkdown(null);
    setWinnerError(null);
    setSelected((prev) => prev.filter((x) => x !== t));
  }

  async function generateWinnerSummary() {
    if (selected.length < MIN_BANKS) return;
    abortWinner.current?.abort();
    const ctrl = new AbortController();
    abortWinner.current = ctrl;
    setWinnerLoading(true);
    setWinnerError(null);
    setWinnerMarkdown(null);
    try {
      const payload = {
        question:
          `Compare these banks side-by-side: ${selected.join(', ')}.\n\n` +
          `Use these dimensions and pick a "winner" per dimension with a short justification:\n` +
          `- Call Report metrics (C&I ratio, NBFI loans, NBFI commitments, PE exposure)\n` +
          `- Stock performance context (note any reactions around filing dates if visible)\n` +
          `- Strategy initiatives / narrative positioning\n` +
          `- Quote face-off on a shared theme (if available)\n\n` +
          `Be precise and cite sources with [n] markers when possible.`,
      };
      const res = await fetch('/api/backend/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Winner summary failed (HTTP ${res.status})`);
      const json = await res.json();
      setWinnerMarkdown(String(json.answer_markdown ?? ''));
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setWinnerError(e instanceof Error ? e.message : String(e));
    } finally {
      setWinnerLoading(false);
      abortWinner.current = null;
    }
  }

  const readyCount = selected.filter((t) => timelines[t]).length;
  const canRenderCharts = selected.length >= MIN_BANKS && readyCount >= MIN_BANKS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-neutral-400">Cross-bank comparison</div>
            <h1 className="text-2xl font-semibold text-neutral-900 mt-1">Compare banks</h1>
            <p className="text-sm text-neutral-500 mt-1 max-w-3xl">
              Pick 2–4 banks and get a side-by-side read on Call Report metrics, stock reactions near filings, strategy initiatives, and quote-level language differences.
            </p>
          </div>
          <button
            type="button"
            onClick={generateWinnerSummary}
            disabled={selected.length < MIN_BANKS || winnerLoading}
            className={clsx(
              'text-sm px-4 py-2 rounded-lg font-medium border',
              selected.length < MIN_BANKS
                ? 'border-neutral-200 text-neutral-400 cursor-not-allowed'
                : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50',
            )}
          >
            {winnerLoading ? 'Generating…' : 'Generate “winner” summary'}
          </button>
        </div>
      </section>

      {/* Picker */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="font-semibold text-neutral-900 text-base">Bank picker</h3>
          <p className="text-xs text-neutral-400 mt-0.5">Multi-select up to {MAX_BANKS}. Shareable URL updates as you pick.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {selected.map((t, idx) => {
              const meta = selectedBanks.find((b) => b.ticker.toUpperCase() === t);
              const isLoading = loadingTickers.has(t);
              return (
                <div
                  key={t}
                  className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-sm font-semibold text-neutral-800">{t}</span>
                  {meta?.peer_group && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${peerBadge(meta.peer_group)}`}>
                      {peerLabel(meta.peer_group)}
                    </span>
                  )}
                  {isLoading && <span className="text-[11px] text-neutral-400">loading…</span>}
                  <button
                    type="button"
                    onClick={() => removeTicker(t)}
                    className="text-neutral-300 hover:text-neutral-600"
                    aria-label={`Remove ${t}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
            {selected.length < MIN_BANKS && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Pick at least {MIN_BANKS} banks to enable overlays.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-neutral-500">Search banks</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type ticker or name (e.g., JPM or JPMorgan)"
                className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <div className="mt-2 rounded-lg border border-neutral-200 overflow-hidden">
                {banksLoading ? (
                  <div className="px-3 py-3 text-sm text-neutral-400">Loading banks…</div>
                ) : banksError ? (
                  <div className="px-3 py-3 text-sm text-rose-600">Failed: {banksError}</div>
                ) : filteredBankOptions.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-neutral-400">No matches.</div>
                ) : (
                  <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100">
                    {filteredBankOptions.map((b) => (
                      <button
                        key={b.ticker}
                        type="button"
                        onClick={() => addTicker(b.ticker)}
                        disabled={selected.length >= MAX_BANKS}
                        className="w-full text-left px-3 py-2 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-neutral-800">
                              {b.ticker}{' '}
                              <span className="text-xs font-normal text-neutral-500">{b.name}</span>
                            </div>
                            <div className="text-[11px] text-neutral-400">
                              {peerLabel(b.peer_group)}
                            </div>
                          </div>
                          <span className="text-xs text-indigo-600">Add</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
              <div className="text-xs font-semibold text-neutral-700">Data status</div>
              <div className="text-[11px] text-neutral-500 mt-1">
                Loaded: {readyCount}/{selected.length} timelines
              </div>
              {loadError && (
                <div className="text-[11px] text-rose-600 mt-2">
                  {loadError}
                </div>
              )}
              <div className="text-[11px] text-neutral-400 mt-3">
                Tip: charts render once at least {MIN_BANKS} selected banks have timeline data.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Composite ranking position (B) */}
      {compositeRanking && selected.length >= 1 && (
        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h3 className="font-semibold text-neutral-900 text-base">
              Composite ranking position
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Where each selected bank sits in the live PC composite ranking (
              {compositeRanking.total} banks total). Default weights: 35% NBFI loans,
              25% commits, 15% growth, 10% C&amp;I, 10% PE, 5% scale — same as the
              home-page rankings panel.
            </p>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {selected.map((t, i) => {
              const entry = compositeRanking.byTicker[t];
              const meta = banks.find((b) => b.ticker === t);
              if (!entry) {
                return (
                  <div
                    key={t}
                    className="rounded-lg border border-dashed border-neutral-200 px-4 py-3 text-xs text-neutral-400"
                  >
                    {t}: not in current rankings
                  </div>
                );
              }
              const peerSize = compositeRanking.peerSizes[entry.peer_group] ?? 0;
              return (
                <div
                  key={t}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-sm font-bold text-neutral-900">{t}</span>
                    {meta?.peer_group && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${peerBadge(meta.peer_group)}`}
                      >
                        {peerLabel(meta.peer_group)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-neutral-900 tabular-nums">
                      #{entry.rank}
                    </span>
                    <span className="text-xs text-neutral-500">
                      of {compositeRanking.total}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
                    <span className="font-mono">
                      Score {(entry.score * 100).toFixed(0)}
                    </span>
                    <span>·</span>
                    <span>
                      Peer #{entry.peerRank}/{peerSize}
                    </span>
                  </div>
                  {/* Score bar */}
                  <div className="mt-2 h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, entry.score * 100)}%`,
                        backgroundColor: COLORS[i % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {!rankings && (
            <div className="px-6 pb-4 text-[11px] text-neutral-400">
              Rankings data still loading…
            </div>
          )}
        </section>
      )}

      {/* Winner summary */}
      {(winnerError || winnerMarkdown) && (
        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h3 className="font-semibold text-neutral-900 text-base">AI “winner” summary</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Generated via the same cite-backed agent used in chat (may take ~30–60s).
            </p>
          </div>
          <div className="p-6">
            {winnerError ? (
              <div className="text-sm text-rose-600">{winnerError}</div>
            ) : winnerMarkdown ? (
              <RenderedMarkdown markdown={winnerMarkdown} />
            ) : null}
          </div>
        </section>
      )}

      {/* Radar overlays */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="font-semibold text-neutral-900 text-base">Side-by-side radar overlay</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Normalized across the selected set (0–1). Uses each bank’s latest available quarter.
          </p>
        </div>
        <div className="p-6">
          {!canRenderCharts ? (
            <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
              Select at least {MIN_BANKS} banks and wait for data to load.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={360}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#2a2a30" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#8a8a92' }} />
                    {/*
                      PolarRadiusAxis draws a radial line + numeric ticks at a fixed
                      angle. Concentric grid polygons already imply the 0→1 scale,
                      and the diagonal line was clipping its "1" label into a
                      garbled squiggle. Keep the domain enforced via the grid; hide
                      the visible radial axis.
                    */}
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 1]}
                      axisLine={false}
                      tick={false}
                    />
                    {selected.map((t, i) => (
                      <Radar
                        key={t}
                        name={t}
                        dataKey={t}
                        stroke={COLORS[i % COLORS.length]}
                        fill={COLORS[i % COLORS.length]}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                <div className="text-xs font-semibold text-neutral-700">Latest quarters</div>
                <div className="mt-2 space-y-1">
                  {selected.map((t) => (
                    <div key={t} className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-600 font-mono">{t}</span>
                      <span className="text-neutral-400">{latestQByBank[t] ?? '--'}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-neutral-400 mt-3">
                  Radar is a quick “shape” view; use the bars below for actual percentages.
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Stock overlay */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="font-semibold text-neutral-900 text-base">Stock price overlay + filing markers</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Overlaid closing prices. Vertical markers = union of SEC filing dates across selected banks.
          </p>
        </div>
        <div className="p-6">
          {!canRenderCharts || stockOverlayData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
              No stock data available yet for the current selection.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={stockOverlayData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#a3a3a3' }}
                  axisLine={{ stroke: '#e5e5e5' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#a3a3a3' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  formatter={(v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : v)}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {selected.map((t, i) => (
                  <Line
                    key={t}
                    type="monotone"
                    dataKey={t}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
                {filingDates.slice(-18).map((d) => (
                  <ReferenceLine key={d} x={d} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Call report metric comparison */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="font-semibold text-neutral-900 text-base">Call Report metric comparison</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Grouped bars show latest-quarter percent-of-loans ratios per bank.
            Loan scale (size) and NBFI QoQ growth are shown as KPI cards below — they
            don&apos;t share the percent axis but are part of the same composite.
          </p>
        </div>
        <div className="p-6 space-y-6">
          {!canRenderCharts ? (
            <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
              Select at least {MIN_BANKS} banks to compare.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metricsBarData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e5e5' }} tickLine={false} />
                  <YAxis
                    tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                    tick={{ fontSize: 11, fill: '#a3a3a3' }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    formatter={(v, name) => {
                      if (typeof v !== 'number') return [v as any, name];
                      return [`${(v * 100).toFixed(3)}%`, String(name)];
                    }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {selected.map((t, i) => (
                    <Bar key={t} dataKey={t} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>

              {/* Scale & growth KPI strip — the two non-percent metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(['loan_scale', 'nbfi_growth'] as const).map((mkey) => {
                  const meta = METRICS.find((m) => m.key === mkey)!;
                  return (
                    <div
                      key={mkey}
                      className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3"
                    >
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold">
                        {meta.label}
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {selected.map((t, i) => {
                          const m = latestMetricsByBank[t];
                          const v = m ? safeNum((m as any)[mkey] as number | null) : null;
                          return (
                            <div
                              key={t}
                              className="flex items-center gap-2 rounded-md bg-white border border-neutral-100 px-2 py-1.5"
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-neutral-700 leading-tight">
                                  {t}
                                </div>
                                <div className="text-[11px] text-neutral-500 font-mono leading-tight">
                                  {v == null ? '—' : meta.fmt(v)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Metric trends over time (C) */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-neutral-900 text-base">
              Metric trends over time
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              One line per selected bank, charted across all reporting quarters. Toggle
              metric to see how each bank&apos;s ratio has moved.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={trendMetric}
              onChange={(e) => setTrendMetric(e.target.value as MetricKey)}
              className="text-sm px-2 py-1.5 rounded-lg border border-neutral-200 bg-white"
            >
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPeerMedian}
                onChange={(e) => setShowPeerMedian(e.target.checked)}
                className="rounded border-neutral-300"
              />
              Peer-group median overlay
            </label>
          </div>
        </div>
        <div className="p-6">
          {!trends ? (
            <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
              Loading trends…
            </div>
          ) : selected.length < 1 || trendChartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
              No trend data for the current selection.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={trendChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis
                  dataKey="quarter"
                  tick={{ fontSize: 11, fill: '#a3a3a3' }}
                  axisLine={{ stroke: '#e5e5e5' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => {
                    const meta = METRICS.find((m) => m.key === trendMetric)!;
                    if (meta.pct) return `${(v * 100).toFixed(1)}%`;
                    if (trendMetric === 'nbfi_growth')
                      return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;
                    if (trendMetric === 'loan_scale')
                      return `$${(Math.exp(v) / 1e6).toFixed(0)}B`;
                    return String(v);
                  }}
                  tick={{ fontSize: 11, fill: '#a3a3a3' }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  formatter={(v, name) => {
                    if (typeof v !== 'number') return [v as any, name];
                    const meta = METRICS.find((m) => m.key === trendMetric)!;
                    return [meta.fmt(v), String(name)];
                  }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {selected.map((t, i) => (
                  <Line
                    key={t}
                    type="monotone"
                    dataKey={t}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
                {trendPeerKeys.map((pg, i) => (
                  <Line
                    key={`__peer_${pg}`}
                    type="monotone"
                    dataKey={`__peer_${pg}`}
                    name={`${peerLabel(pg)} median`}
                    stroke="#9ca3af"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Strategy + quotes (F) ─────────────────────────────────────────────
          These two panels read from the `pc_finding` table — an LLM-extracted
          narrative layer (strategic_initiatives, notable_quotes, key_themes).
          That table is currently EMPTY in this database: the schema and the
          /findings endpoint exist, but no script writes to it. Until someone
          builds `backend/scripts/populate_findings.py` to run an LLM over each
          bank's filings + transcripts, every selected bank's findings payload
          will come back null and these panels would just show "no data" rows.
          We detect that case explicitly and surface a single clear banner
          instead of N rows of placeholder text. */}
      {(() => {
        // findings[t] === undefined → still loading
        // findings[t] === null → endpoint returned 404 / no row in pc_finding
        // findings[t] is an object → pipeline produced a row (fields may be
        // sparse if the LLM judged evidence insufficient — that's correct
        // behavior, not a missing-pipeline signal)
        const allLoaded = selected.every((t) => findings[t] !== undefined);
        // Only the "all 404" case means populate_findings.py never ran. A row
        // with empty strings is the model's honest answer — render the
        // default panels so the user sees the per-bank "No strategy
        // initiatives" placeholders instead of a misleading global banner.
        const allMissing = selected.every((t) => findings[t] === null);
        const pipelineNotRun = allLoaded && allMissing && selected.length > 0;

        if (pipelineNotRun) {
          return (
            <section className="rounded-xl border border-amber-200 bg-amber-50 shadow-sm overflow-hidden">
              <div className="px-6 py-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-8 w-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 font-bold">
                    !
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-amber-900 text-base">
                      Strategy &amp; quote face-off — pipeline not yet run
                    </h3>
                    <p className="text-sm text-amber-800 mt-1 leading-relaxed">
                      These two panels read from the{' '}
                      <code className="font-mono text-[12px] bg-amber-100 px-1 py-0.5 rounded">
                        pc_finding
                      </code>{' '}
                      table — an LLM-extracted narrative layer (strategic
                      initiatives, key themes, and notable quotes) that turns
                      each bank&apos;s filings and earnings-call transcripts into
                      structured comparison fields. The schema and the{' '}
                      <code className="font-mono text-[12px] bg-amber-100 px-1 py-0.5 rounded">
                        /findings/&#123;ticker&#125;
                      </code>{' '}
                      endpoint exist, but no row has been written for any of the{' '}
                      {selected.length} bank{selected.length === 1 ? '' : 's'}{' '}
                      currently selected.
                    </p>
                    <div className="mt-3 rounded-lg bg-white border border-amber-200 px-4 py-3 text-[13px] text-neutral-700 leading-relaxed">
                      <div className="font-semibold text-neutral-900 mb-1">
                        To turn this on
                      </div>
                      Build{' '}
                      <code className="font-mono text-[12px] bg-neutral-100 px-1 py-0.5 rounded">
                        backend/scripts/populate_findings.py
                      </code>{' '}
                      that, for each bank: pulls the most recent 10-K / 10-Q /
                      earnings-call chunks, prompts an LLM to extract{' '}
                      <span className="font-mono text-[12px]">
                        strategic_initiatives
                      </span>
                      ,{' '}
                      <span className="font-mono text-[12px]">key_themes</span>,
                      and{' '}
                      <span className="font-mono text-[12px]">
                        notable_quotes
                      </span>
                      , and upserts one row per ticker into{' '}
                      <code className="font-mono text-[12px] bg-neutral-100 px-1 py-0.5 rounded">
                        pc_finding
                      </code>
                      . Once any row exists, the panels below auto-populate.
                    </div>
                    <p className="text-[11px] text-amber-700 mt-3">
                      Numeric comparisons (radar, bars, composite rank, metric
                      trends, stock overlay) are unaffected — they don&apos;t
                      depend on this pipeline.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          );
        }

        // Default render: at least one selected bank has findings data.
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100">
                <h3 className="font-semibold text-neutral-900 text-base">
                  Strategy initiatives
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  From <code className="font-mono">pc_finding.strategic_initiatives</code>{' '}
                  (LLM-extracted narrative).
                </p>
              </div>
              <div className="p-6 space-y-4">
                {selected.map((t, i) => {
                  const f = findings[t];
                  return (
                    <div
                      key={t}
                      className="rounded-lg border border-neutral-200 overflow-hidden"
                    >
                      <div className="px-3 py-2 bg-neutral-50 flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-sm font-semibold text-neutral-800">
                          {t}
                        </span>
                      </div>
                      <div className="px-3 py-3 text-sm text-neutral-700 whitespace-pre-wrap">
                        {f?.strategic_initiatives?.trim()
                          ? f.strategic_initiatives.trim()
                          : 'No strategy initiatives found yet for this bank.'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100">
                <h3 className="font-semibold text-neutral-900 text-base">
                  Key quote face-off
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Same topic, different language. Topic list from{' '}
                  <code className="font-mono">pc_finding.key_themes</code>.
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-500">Topic</span>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="text-sm px-2 py-1.5 rounded-lg border border-neutral-200"
                  >
                    {quoteTopics.length === 0 ? (
                      <option value="">No topics available</option>
                    ) : (
                      quoteTopics.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {selected.map((t, i) => {
                  const f = findings[t];
                  const quotes = parseMaybeJson<any>(f?.notable_quotes);
                  let best: string | null = null;
                  if (Array.isArray(quotes)) {
                    const candidates = quotes
                      .map((q) => {
                        if (typeof q === 'string') return { text: q, topic: '' };
                        if (q && typeof q === 'object')
                          return {
                            text: String(q.quote ?? ''),
                            topic: String(q.topic ?? ''),
                          };
                        return { text: '', topic: '' };
                      })
                      .filter((q) => q.text.trim().length > 0);
                    const topicLower = topic.trim().toLowerCase();
                    best =
                      candidates.find(
                        (c) => c.topic.trim().toLowerCase() === topicLower,
                      )?.text ??
                      candidates.find(
                        (c) =>
                          topicLower && c.text.toLowerCase().includes(topicLower),
                      )?.text ??
                      candidates[0]?.text ??
                      null;
                  } else if (typeof quotes === 'string' && quotes.trim()) {
                    best = quotes.trim();
                  }

                  return (
                    <div
                      key={t}
                      className="rounded-lg border border-neutral-200 overflow-hidden"
                    >
                      <div className="px-3 py-2 bg-neutral-50 flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-sm font-semibold text-neutral-800">
                          {t}
                        </span>
                      </div>
                      <div className="px-3 py-3 text-sm text-neutral-700 whitespace-pre-wrap">
                        {best ?? 'No quote available for this bank yet.'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        );
      })()}
    </div>
  );
}

