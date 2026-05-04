# Bank Analysis Tool — Private Credit · Digital Assets · AI

> **Last updated: 2026-04-28.**
> Codebase and data state as of this date — SEC filings through the latest available, FFIEC Call Reports through 2025Q4, earnings-call transcripts through 2026Q1. Digital Assets classification & intent analysis (BUFN403 Team 5) covers Q1 2024 – Q4 2025.

A theme-driven research tool for the 50-bank US universe across three sectors: **Private Credit** (NBFI lending, direct-lending pipelines, PE sponsor exposure), **Digital Assets** (crypto custody, stablecoin reserves, tokenization, DA prime brokerage), and **AI Usage** (model deployment, GPU/data-center finance, governance). Each sector has four sub-views — Rankings, Trends, Anomalies, Compare — plus a chat assistant (Private Credit), a per-bank timeline, and a chatbot for narrative Q&A.

---

## Repo Structure

```
private-credit-bank-analysis/
│
├── app/                              ← THE APP — run this to see everything
│   ├── .env                          app environment variables (see setup)
│   ├── .env.example                  template — copy to .env and fill in
│   ├── backend/
│   │   ├── pc_analyst.db             SQLite DB — the only runtime data source (~1.3 GB)
│   │   ├── src/pc_analyst/           FastAPI app, agent loop, anomaly engine, ingestion
│   │   ├── scripts/                  CLI utilities — only needed to rebuild the DB
│   │   ├── migrations/               SQL migrations (001–003)
│   │   └── eval/                     20-question eval harness
│   ├── frontend/                     Next.js 16 + Tailwind + Recharts
│   ├── data/seed/                    call_report_seed.json for demo mode
│   └── infra/                        docker-compose for postgres (optional)
│
├── private-credit/
│   └── analysis/                     ← Team research pipeline (pre-app era)
│       ├── keyword_match/            Keyword-based PC analysis pipeline
│       ├── semantic_similarity/      Embedding-based PC analysis pipeline
│       ├── combined/                 Combined PC analysis scripts
│       ├── plots/                    Plot generators (read Call_Reports/ directly)
│       ├── bufn403_dotenv.py         Env loader for the legacy pipelines
│       └── requirements.txt          Deps for the legacy pipelines
│
├── digital-assets/
│   └── dashboard/
│       └── da_classification_intent_dash.html   ← Original BUFN403 Team 5 dashboard
│                                                  (source of truth for DA scoring data;
│                                                   data is live in the app — see below)
│
├── ai-exposure/                      ← Placeholder for future AI research pipeline
│
└── README.md                         this file
```

**To run the app, you only need `app/`.** The `private-credit/analysis/` pipeline folders are pre-app research code that reads raw `Call_Reports/` CSVs and `transcripts_final/` directly. They are not part of the running app.

---

## What the App Reads at Runtime

**Static JSON only.** As of this commit, the running app makes **zero**
calls to the FastAPI backend or the SQLite DB. Every page renders from
files in `app/frontend/public/data/` — the frontend can be deployed to
any static host (Vercel, Cloudflare Pages, GitHub Pages) with no Python
runtime.

| Page | Source file(s) |
|---|---|
| `/` (home overview chart, sector cards, multi-theme banks table) | `pc_overview.json` |
| `/private-credit/rankings` | `pc_rankings.json` |
| `/private-credit/trends` | `pc_trends.json` + `pc_findings.json` |
| `/private-credit/anomalies` | `pc_anomalies.json` |
| `/private-credit/compare` | `pc_banks.json` + `pc_rankings.json` + `pc_trends.json` + `pc_timelines.json` + `pc_findings.json` |
| `/digital-assets/anomalies` | `da_anomalies.json` |
| `/ai/anomalies` | `ai_anomalies.json` |
| `/digital-assets/{rankings,trends,compare}` | `app/frontend/lib/da-data.ts` (static TS) |
| `/ai` Bank Profile section | `ai/ai_*.json` (5 files) |
| `/timeline/[ticker]` | `pc_timelines.json` (single fetch) |

The SQLite DB at `app/backend/pc_analyst.db` (~1.3 GB) is now only
used **at JSON-generation time** — it's the source the
`scripts/generate_pc_static_data.py` script reads from once when
producing the JSONs. The committed JSONs are the source of truth for
every page. Production deployment doesn't need the DB or the FastAPI
backend running.

**Removed in this iteration:**
- The chatbot drawer + agent loop (would require live LLM + vector
  retrieval; fundamentally not snapshot-friendly)
- The "Generate winner summary" button on the Compare page (same path)
- The Next.js `/api/backend/[...path]` proxy and `lib/api.ts` runtime
  helpers

---

## App Map

All routes are live unless noted. The Private Credit sector is fully data-backed. Digital Assets has live Rankings/Trends/Compare (static DA classification data from BUFN403 Team 5) plus a live Anomalies tab (NLP engine). AI has only Anomalies live.

```
/                                   Cross-sector home: 3 sector cards + theme-mention
                                    chart + multi-theme banks table

/private-credit                     → /private-credit/rankings
/private-credit/rankings            Composite score (6 metrics, tunable weights)
/private-credit/trends              Industry NBFI exposure, peer medians, quarter movers
/private-credit/anomalies           8-category anomaly engine with severity scoring
/private-credit/compare             Radar + bars + composite rank + metric trends +
                                    stock overlay + LLM strategy/quotes

/digital-assets                     → /digital-assets/rankings
/digital-assets/rankings            Composite Leaderboard (16 banks, 4-dim scoring) +
                                    Bank Profile (quarterly NLP + sub-scores + excerpts) +
                                    Cluster Map (5 clusters, evidence layers, use cases)
/digital-assets/trends              GENIUS Act context + Latest Developments +
                                    Industry Timeline 2020–2026 + Market Data +
                                    Scoring Methodology
/digital-assets/compare             Side-by-side bank comparison: bar, line, radar charts
                                    + head-to-head table (up to 4 banks)
/digital-assets/anomalies           Live NLP anomaly engine (theme-aware)

/ai                                 → /ai/anomalies
/ai/anomalies                       Live NLP anomaly engine (theme-aware)
/ai/{rankings,trends,compare}       Coming Soon (quantitative pipeline not yet built)

/timeline/[ticker]                  Per-bank narrative + Call Report + stock + news
```

---

## Refreshing the static JSONs

Every page reads from committed JSON files in `app/frontend/public/data/`:

```
pc_banks.json       50 banks, peer groups
pc_rankings.json    composite-score table for the latest quarter
pc_trends.json      per-bank metric series across all quarters
pc_anomalies.json   8-category PC anomaly engine output (with takeaways)
da_anomalies.json   DA anomaly engine output (with takeaways)
ai_anomalies.json   AI anomaly engine output (with takeaways)
pc_overview.json    cross-sector home-page data
pc_timelines.json   per-bank filings + Call Report metrics + stock + news
pc_findings.json    LLM-extracted strategy + classification fields
```

Whenever the DB changes — re-ingestion, re-running `populate_findings.py`, etc.
— run the generator + annotator pipeline to refresh them:

```bash
# 1. Bring the FastAPI backend up so the generator can read /banks,
#    /rankings, /trends, /anomalies/{theme}, /timeline/{ticker},
#    /findings/{ticker}, /overview.
cd app/backend && source .venv/bin/activate && uvicorn pc_analyst.api:app --port 8000 &

# 2. Snapshot every endpoint into JSON. Concurrent per-ticker fans
#    finish in ~10s.
cd ../..  # back to repo root
python scripts/generate_pc_static_data.py \
    --backend http://localhost:8000 \
    --out app/frontend/public/data

# 3. (Optional) regenerate Gemini-written anomaly takeaways. The
#    generator at step 2 wipes them since it pulls fresh anomalies
#    from the DB. Each call costs ~80 seconds.
python app/backend/scripts/annotate_anomaly_takeaways.py --rerun
python app/backend/scripts/annotate_anomaly_takeaways.py \
    --input app/frontend/public/data/da_anomalies.json --rerun
python app/backend/scripts/annotate_anomaly_takeaways.py \
    --input app/frontend/public/data/ai_anomalies.json --rerun

# 4. Commit + push so collaborators pick up the refreshed data via git pull.
git add app/frontend/public/data/
git commit -m "Refresh static JSONs from DB"
git push
```

Once the JSONs are committed, the running app needs **only** the JSONs to
work — the FastAPI backend is irrelevant to production deployment. Step 1
only matters when you regenerate.

---

## Setup

### Requirements

| Requirement | Notes |
|---|---|
| Python 3.11–3.13 | Backend |
| Node.js 18+ (20 LTS recommended), npm 9+ | Frontend |
| `app/backend/pc_analyst.db` present (~1.3 GB) | App reads only this file at runtime |
| `app/.env` populated | Keys + DB path (see variables below) |
| ~3 GB free disk | HuggingFace model cache on first backend start |

No Postgres, no Docker, no pgvector — SQLite holds everything including vector blobs. Embedding and reranking happen in-process.

### 1. Backend

```bash
cd app/backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

Create `app/.env` (see variables section below), then:

```bash
uvicorn pc_analyst.api:app --host 127.0.0.1 --port 8000 --reload
```

First start downloads `bge-reranker-base` (~440 MB) and `all-MiniLM-L6-v2` (~90 MB) from Hugging Face. Subsequent starts take ~5 s.

Health check: `curl http://localhost:8000/health` → `{"status":"ok"}`

### 2. Frontend

```bash
cd app/frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Next.js dev server proxies `/api/backend/*` to `BACKEND_URL`.

### Demo mode (no real DB)

If `pc_analyst.db` is missing, you can seed a minimal schema for development:

```bash
cd app/backend
python scripts/init_db.py          # creates schema
python scripts/seed_demo.py        # seeds 20 call-report facts
```

The DA pages (Rankings/Trends/Compare) work in demo mode because they read static TypeScript data, not the DB.

---

## Environment Variables

The single `.env` lives at `app/.env`. Copy `app/.env.example` and fill in values.

```bash
# ── Storage ────────────────────────────────────────────────────────────
STORAGE_BACKEND=sqlite
DATABASE_URL=postgresql://pc:pc@localhost:5432/pc_analyst  # unused on sqlite path
SQLITE_PATH=./backend/pc_analyst.db                        # relative to app/

# ── Embeddings + reranker ──────────────────────────────────────────────
EMBEDDING_MODEL=local                                      # sentence-transformers MiniLM
EMBEDDING_DIM=384
RERANKER_MODEL=BAAI/bge-reranker-base

# ── LLM provider ───────────────────────────────────────────────────────
LLM_PROVIDER=gemini                                        # 'none' | 'gemini' | 'anthropic'
GEMINI_API_KEY=                                            # chatbot + findings extraction
GEMINI_MODEL=gemini-2.5-flash
ANTHROPIC_API_KEY=                                         # alternative to Gemini
ANTHROPIC_MODEL=claude-sonnet-4-5

# ── External feeds ─────────────────────────────────────────────────────
ALPHAVANTAGE_API_KEY=                                      # /news/{ticker} sidebar
SEC_USER_AGENT=private-credit-analyst your.email@example.com

# ── HTTP ───────────────────────────────────────────────────────────────
BACKEND_PORT=8000
BACKEND_URL=http://localhost:8000
```

**What each feature requires:**

| Feature | Key needed |
|---|---|
| Chatbot answers, LLM findings, Compare winner summary | `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` |
| `/news/{ticker}` sidebar | `ALPHAVANTAGE_API_KEY` |
| Stock price overlay | None — uses `yfinance` |
| Anomaly engine, Rankings (PC), Trends (PC), Radar/Charts | DB only — no keys |
| DA Rankings, Trends, Compare | None — static TypeScript data |

---

## Rebuilding the Database from Scratch

Only needed if `pc_analyst.db` is missing. Three raw-data directories must be present:

```
sec-edgar-filings/          SEC EDGAR HTML for 10-K, 10-Q, 8-K (~23 GB)
Call_Reports/               FFIEC Call Report quarterly CSVs
transcripts_final/          Earnings-call prepared remarks (TICKER_YYYY_QN.txt)
```

From `app/backend/` with the venv active:

```bash
python scripts/init_db.py
python scripts/load_call_reports.py   --csv-dir  ../../Call_Reports
python scripts/ingest_filings.py      --root     ../../sec-edgar-filings
python scripts/ingest_transcripts.py  --transcript-dir ../../transcripts_final
python scripts/extract_8k_events.py
python scripts/classify_chunk_topics.py
python scripts/score_chunk_sentiment.py
python scripts/populate_findings.py --rerun
```

All scripts are idempotent. Order matters: ingest → classify → events → sentiment → findings.

To add a bank: `python scripts/expand_banks.py --add JPM BAC C` then re-run the pipeline for those tickers.

---

## Caching

Read-mostly endpoints are cached at two layers:

- **Server-side TTL** via `@cached(ttl=…)` in `pc_analyst.cache` (300 s for trends, 1800 s for findings, 3600 s for static lists)
- **`Cache-Control` headers** so the browser and Next.js proxy can reuse responses

```bash
curl -X POST  http://localhost:8000/admin/cache/invalidate           # clear all
curl -X POST 'http://localhost:8000/admin/cache/invalidate?prefix=…' # clear scoped
curl         http://localhost:8000/admin/cache/stats
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ModuleNotFoundError: pc_analyst` | Run from `app/backend/` with venv active, or `pip install -e .` |
| Empty data / `no such table` | `pc_analyst.db` missing or empty. Check size (~1.3 GB) and `SQLITE_PATH` |
| Chatbot gives plain answers, no synthesis | `GEMINI_API_KEY` missing in `app/.env`. Restart backend after editing |
| News panel empty | `ALPHAVANTAGE_API_KEY` not set. Free tier: 25 req/day; results cached to DB |
| Stock prices missing | `pip install yfinance` then restart backend |
| Port 8000 in use | `lsof -ti:8000 \| xargs kill -9` |
| Frontend 502 from `/api/backend/*` | Backend not running on `BACKEND_URL` |

---

## Caveats

- "Private credit" is not a Call Report line item. The proxy uses RC-C 4.a (RCON1766) + RC-L 1.c.(1) (RCONJ457) + taxonomy-driven footnote extraction.
- Earnings-call **Q&A is gated behind transcript licensing** — corpus is prepared remarks only.
- DA and AI **quantitative ingestion is not built for the backend DB.** The DA Rankings/Trends/Compare pages are powered by static classification data (BUFN403 Team 5 NLP pipeline outputs). The Anomalies tabs for all three themes are fully live via the NLP chunk-tagging engine.
- Span-level grounding is best-effort; the eval harness in `app/backend/eval/` tracks regressions across 20 hand-graded analyst questions.

---

## Digital Assets — Complete Code Map

Every file that contains or controls Digital Assets content. Reference this if you need to make any future edits.

### Static data (frontend)

| File | What it contains |
|---|---|
| `app/frontend/lib/da-data.ts` | **Single source of truth for all DA scoring data.** 16 bank composite scores (D1–D4), full quarterly NLP data (8 quarters × 16 banks), 5 cluster definitions with evidence layers and use cases, 21 timeline events, 11 latest developments, helper color functions. Edit here to update any score, bank, or finding. |

### UI panels (frontend)

| File | Route it powers |
|---|---|
| `app/frontend/components/panels/DALeaderboardPanel.tsx` | `/digital-assets/rankings` — Composite Leaderboard table, Bank Profile view (score ring + dimension bars + quarterly charts + excerpts), Cluster Map (expandable cards) |
| `app/frontend/components/panels/DATrendsPanel.tsx` | `/digital-assets/trends` — GENIUS Act banner, Latest Developments list, Timeline with category filters, Stablecoin market chart, Composite vs NLP scatter, Projections table, Methodology detail |
| `app/frontend/components/panels/DAComparePanel.tsx` | `/digital-assets/compare` — Bank chip selector (up to 4), Composite vs NLP bar chart, Quarterly NLP line chart, Head-to-head metrics table, Radar chart |

### Routing pages (frontend)

| File | Change made |
|---|---|
| `app/frontend/app/[sector]/rankings/page.tsx` | Added `if (sector === 'digital-assets') return <DALeaderboardPanel />;` |
| `app/frontend/app/[sector]/trends/page.tsx` | Added `if (sector === 'digital-assets') return <DATrendsPanel />;` |
| `app/frontend/app/[sector]/compare/page.tsx` | Added `if (sector === 'digital-assets') return <DAComparePanel />;` |
| `app/frontend/app/[sector]/anomalies/page.tsx` | Unchanged — `digital-assets` was already in `VALID_SLUGS` |

### Shared frontend files (DA is one of three themes)

| File | DA-specific content |
|---|---|
| `app/frontend/app/[sector]/layout.tsx` | `SECTOR_META['digital-assets']` — label, blurb, amber gradient |
| `app/frontend/app/page.tsx` | `SECTORS` array entry — slug `digital-assets`, amber color `#fbbf24` |
| `app/frontend/components/HeaderSectorNav.tsx` | Nav pill for Digital Assets with amber active state |
| `app/frontend/lib/types.ts` | `AnomalyTheme` union includes `'digital_assets'` |
| `app/frontend/app/layout.tsx` | Meta description mentions digital assets |

### Backend (anomaly engine — all three themes share this code)

| File | DA-specific content |
|---|---|
| `app/backend/src/pc_analyst/taxonomy/digital_assets.yaml` | **8-concept taxonomy** — crypto_custody, stablecoin_reserves, fbo_deposits, digital_asset_trading, tokenized_assets, sab121, basel_crypto, exchange_counterparty |
| `app/backend/src/pc_analyst/anomalies/anchors.py` | DA keyword regex — "crypto", "stablecoin", "SAB-121/122", "USDC", "FBO account", "cold wallet", "GENIUS Act", etc. |
| `app/backend/src/pc_analyst/anomalies/severity.py` | DA domain weights (disclosure_nlp: 1.4, events_8k: 1.5, valuation_marks: 1.4, etc.) |
| `app/backend/src/pc_analyst/anomalies/item_codes.py` | DA 8-K event weights (Items 8.01, 2.06, 4.02, 1.03) |
| `app/backend/src/pc_analyst/anomalies/categories/exposure.py` | DA exposure language detector |
| `app/backend/src/pc_analyst/anomalies/categories/credit_quality.py` | DA credit-quality language detector |
| `app/backend/src/pc_analyst/anomalies/categories/structural.py` | DA stablecoin reserve composition language detector |
| `app/backend/src/pc_analyst/anomalies/categories/valuation_marks.py` | DA fair-value / mark-to-market language detector |
| `app/backend/src/pc_analyst/anomalies/categories/peer_deviation.py` | DA peer deviation enabled |
| `app/backend/src/pc_analyst/anomalies/categories/macro_divergence.py` | DA macro divergence (placeholder — BTC/ETH prices not yet ingested) |
| `app/backend/src/pc_analyst/anomalies/topic_classifier.py` | Tags chunks as `'digital_assets'` (hybrid NLP classifier) |
| `app/backend/src/pc_analyst/retrieval/taxonomy.py` | Maps slug `'digital_assets'` → `digital_assets.yaml` |
| `app/backend/src/pc_analyst/api.py` | API endpoints aggregate DA data in `/overview`, `/concepts`, `/anomalies/*` |
| `app/backend/src/pc_analyst/db.py` | `chunk_topic` column stores `'digital_assets'` |

### Original research

| File | Purpose |
|---|---|
| `digital-assets/dashboard/da_classification_intent_dash.html` | Original BUFN403 Team 5 dashboard — the source that `da-data.ts` was ported from. Kept for reference. |
