# Bank Analysis Tool — Private Credit, Digital Assets, AI

> **Documentation as-acquired: 2026-04-26.**
> Reflects the codebase and data state on this date — SEC filings through the latest available filing, FFIEC Call Reports through 2025Q4, earnings-call transcripts through 2026Q1.

A theme-driven research tool for analysing the 50-bank US universe across three sectors:
**Private Credit** (NBFI lending, direct-lending pipelines, PE sponsor exposure), **Digital
Assets** (custody, stablecoin reserves, tokenisation), and **AI Usage** (model deployment,
GPU/data-center finance, governance). For each sector the app surfaces a sector hub with
four sub-views — Rankings, Trends, Anomalies, Compare — plus a chat assistant for the
Private Credit corpus and a per-bank timeline view. Every answer carries span-level
citations to the underlying SEC filing, transcript, or Call Report row.

---

## Repo layout

```
BUFN403/
├── README.md                       this file
├── .env                            keys for the legacy keyword + semantic pipelines (see below)
├── bank-analysis-ai-chatbot/       THE APP — Next.js frontend + FastAPI backend (focus of this README)
│   ├── .env                        keys for the app (separate from the top-level .env)
│   ├── backend/
│   │   ├── pc_analyst.db           SQLite DB — the only runtime data source for the app
│   │   ├── src/pc_analyst/         FastAPI app, agent loop, anomaly engine, ingestion lib
│   │   ├── scripts/                CLI utilities — only needed if you rebuild the DB
│   │   ├── migrations/             SQL migrations (001–003)
│   │   └── eval/                   20-question eval harness
│   └── frontend/                   Next.js 16 + Tailwind + Recharts
├── sec-edgar-filings/              raw 10-K/Q/8-K downloads (23 GB) — NOT read by the app at runtime; only used to rebuild the DB and by the legacy pipelines
├── Call_Reports/                   FFIEC Call Report quarterly CSVs — NOT read by the app at runtime; only used to rebuild the DB and by the legacy pipelines
├── transcripts_final/              Earnings-call prepared remarks (TICKER_YYYY_QN.txt) — NOT read by the app at runtime; only used to rebuild the DB and by the legacy pipelines
├── Keyword_match_method/           legacy pipeline — keyword-based PC analysis
├── Semantic_similarity_method/     legacy pipeline — embedding-based PC analysis
├── combined_code/                  legacy pipeline — combined PC analysis
└── Plots/                          legacy plot generators that read Call_Reports/ directly
```

**To run the app, you only need `bank-analysis-ai-chatbot/`.** The four legacy pipeline
folders (`Keyword_match_method/`, `Semantic_similarity_method/`, `combined_code/`,
`Plots/`) are pre-chatbot research code that reads `Call_Reports/` and
`transcripts_final/` directly; they are not part of the app and have their own setup
(see top-level `.env` for their `GEMINI_API_KEY`).

---

## What the app actually reads at runtime

The live app — FastAPI backend + Next.js frontend + chatbot + anomaly engine — reads
**exactly one local file**:

```
bank-analysis-ai-chatbot/backend/pc_analyst.db        ~1.3 GB SQLite
```

This database contains every row the app serves: 50 banks, 900 documents, ~120k chunks
with embeddings + topic tags + sentiment scores, ~2.8k Call Report facts, 50 LLM-extracted
findings, ~23k stock-price points, and ~125 cached news articles. You can **delete every
other directory in `BUFN403/`** (`sec-edgar-filings/`, `Call_Reports/`, `transcripts_final/`,
the four legacy pipeline folders) and the chatbot app will continue to run normally.

The DB is **not in git** (`*.db` is gitignored — the file is too large). You must either:

- **Have the DB on your machine already** (current state on this workstation), OR
- **Rebuild it from raw sources** by running the ingestion pipeline (see "Rebuilding the
  database from scratch" further down).

---

## What you need to run the app

Required, in order:

| # | Requirement | Why |
|---|---|---|
| 1 | **macOS or Linux**, Python 3.11–3.13, Node.js 18+ (20 LTS recommended), npm 9+ | Backend is FastAPI; frontend is Next.js 16 |
| 2 | **`bank-analysis-ai-chatbot/backend/pc_analyst.db`** present (~1.3 GB) | The app reads only from this file at runtime |
| 3 | **`bank-analysis-ai-chatbot/.env`** populated (full variable list below) | API keys + DB path resolution |
| 4 | Python deps installed in `bank-analysis-ai-chatbot/backend/.venv` from `requirements.txt` + `google-genai` + `python-dotenv` + `yfinance` | FastAPI / sentence-transformers / Gemini SDK / etc. |
| 5 | Node deps installed in `bank-analysis-ai-chatbot/frontend/` via `npm install` | Next.js / React / Recharts |
| 6 | ~3 GB free disk for the HuggingFace model cache (`bge-reranker-base`, `all-MiniLM-L6-v2`) — downloaded automatically on first backend start | Embedding + reranker models |

That is the complete list. No Postgres, no Docker, no pgvector, no separate vector store
— SQLite holds vectors as serialised blobs and the rerank/embedding steps happen
in-process.

---

## Environment variables

There are **two separate `.env` files** in this repo. Both are gitignored and must be
created locally. They serve different code paths.

### `bank-analysis-ai-chatbot/.env` — the app

Read by `pc_analyst.config.Settings` (see `bank-analysis-ai-chatbot/backend/src/pc_analyst/config.py`).
Resolved at backend startup, once. If you change a key, restart the backend.

```bash
# ── Storage ────────────────────────────────────────────────────────────
STORAGE_BACKEND=sqlite                                     # 'sqlite' is the only path tested locally
DATABASE_URL=postgresql://pc:pc@localhost:5432/pc_analyst  # ignored by SQLite path; kept for postgres parity
SQLITE_PATH=./backend/pc_analyst.db                        # path relative to bank-analysis-ai-chatbot/

# ── Embeddings + reranker ──────────────────────────────────────────────
EMBEDDING_MODEL=local                                      # 'local' = sentence-transformers MiniLM
EMBEDDING_DIM=384
RERANKER_MODEL=BAAI/bge-reranker-base

# ── LLM provider ───────────────────────────────────────────────────────
LLM_PROVIDER=gemini                                        # chatbot answers + populate_findings.py + winner-summary
ANTHROPIC_API_KEY=                                         # leave empty unless LLM_PROVIDER=anthropic
ANTHROPIC_MODEL=claude-sonnet-4-5
GEMINI_API_KEY=AQ.…                                        # required for chatbot answers and findings extraction
GEMINI_MODEL=gemini-2.5-flash

# ── External feeds ─────────────────────────────────────────────────────
ALPHAVANTAGE_API_KEY=…                                     # /news/{ticker} endpoint — Alpha Vantage NEWS_SENTIMENT
SEC_USER_AGENT="private-credit-analyst your.email@example.com"   # SEC EDGAR fair-use header
FFIEC_USERNAME=…                                           # FFIEC CDR PWS — only used by scripts/fetch_missing_pws.py
FFIEC_TOKEN=eyJhbG…                                        # FFIEC CDR PWS bearer token

# ── HTTP ───────────────────────────────────────────────────────────────
BACKEND_PORT=8000                                          # uvicorn bind port
BACKEND_URL=http://localhost:8000                          # used by the Next.js proxy at frontend/app/api/backend/
```

**What each runtime feature needs:**

- **Chatbot answers + LLM findings synthesis + Compare-page winner summary** → `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY` with `LLM_PROVIDER=anthropic`).
- **`/news/{ticker}` sidebar on the timeline page** → `ALPHAVANTAGE_API_KEY`.
- **`/stock/{ticker}` price overlay** → no key — uses `yfinance` against Yahoo Finance.
- **`/findings/{ticker}` panel on Compare** → DB-backed; populated by `scripts/populate_findings.py` which uses `GEMINI_API_KEY`.
- **Anomaly engine + Rankings + Trends + radar + bars** → DB-only, no keys needed.

### `BUFN403/.env` — legacy pipelines only

Read by `Keyword_match_method/`, `Semantic_similarity_method/`, and `combined_code/`. The
chatbot app does not read this file. Only required if you run those pipelines.

```bash
GEMINI_API_KEY=AQ.…
# Optional second key for round-robin if you hit rate limits:
# GEMINI_API_KEYS=key1,key2,key3
```

---

## Setup

From a fresh clone where `bank-analysis-ai-chatbot/backend/pc_analyst.db` is **already
present** (e.g. you copied the directory from this machine).

### 1. Backend

```bash
cd BUFN403/bank-analysis-ai-chatbot/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install google-genai python-dotenv yfinance
```

Create `bank-analysis-ai-chatbot/.env` with the full variable list above.

Run:

```bash
uvicorn pc_analyst.api:app --host 127.0.0.1 --port 8000
```

First start downloads `bge-reranker-base` (~440 MB) and `all-MiniLM-L6-v2` (~90 MB)
from Hugging Face into `~/.cache/huggingface/`. Subsequent starts are ~5 s.

Health check: `curl http://localhost:8000/health` → `{"status":"ok"}`.

### 2. Frontend

In a second terminal:

```bash
cd BUFN403/bank-analysis-ai-chatbot/frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The Next.js dev server proxies `/api/backend/*` to
`BACKEND_URL` (configured in `frontend/app/api/backend/[...path]/route.ts`). Both servers
must be running together.

---

## Rebuilding the database from scratch

Only needed if `pc_analyst.db` is missing or you want to re-ingest fresh data. **You do
not need this step if the DB is already on your machine.**

To rebuild you need three raw-data directories present at the repo root (their default
script paths assume different names — pass the explicit flags shown):

```
BUFN403/sec-edgar-filings/       SEC EDGAR HTML for 10-K, 10-Q, 8-K — ~23 GB
BUFN403/Call_Reports/            FFIEC Call Report CSVs (one per quarter)
BUFN403/transcripts_final/       Earnings-call prepared remarks as TICKER_YYYY_QN.txt
```

`sec-edgar-filings/` is regenerable from EDGAR; the other two are bundled with this
repo.

Then, from `bank-analysis-ai-chatbot/backend/` with the venv active:

```bash
python scripts/init_db.py                                              # apply migrations 001–003
python scripts/load_call_reports.py --csv-dir ../../Call_Reports       # explicit flag — script default is wrong
python scripts/ingest_filings.py   --root    ../../sec-edgar-filings   # chunk + embed 10-K/Q/8-K HTML
python scripts/ingest_transcripts.py --transcript-dir ../../transcripts_final
python scripts/extract_8k_events.py                                    # 8-K item-code regex pass
python scripts/classify_chunk_topics.py                                # PC / AI / DA topic tags
python scripts/score_chunk_sentiment.py                                # Loughran-McDonald sentiment
python scripts/populate_findings.py --rerun                            # LLM extracts strategy/quotes per bank
```

Order matters: filings + transcripts → classify → events → sentiment → findings. All
scripts are idempotent.

To add a bank that isn't yet in the universe:

```bash
python scripts/expand_banks.py --add JPM BAC C WFC GS MS USB
```

This pulls filings from EDGAR, then you re-run the pipeline above for the new tickers.

---

## App map

Every route is live unless flagged "ComingSoon". The Private Credit sector is fully
built; Digital Assets and AI have only their Anomalies tab live (the other tabs render
ComingSoon panels — quantitative ingest for those themes is future work).

```
/                                      Cross-sector home: 3 sector cards + theme-mention chart + multi-theme banks table
/private-credit                        → /private-credit/rankings (default tab)
/private-credit/rankings               Composite score (6 metrics, tunable weights)
/private-credit/trends                 Industry NBFI exposure, peer medians, quarter movers, pullbacks
/private-credit/anomalies              8-category engine with severity scoring
/private-credit/compare                Radar + bars + composite-rank tile + metric trends + stock overlay + LLM strategy/quotes
/digital-assets                        → /digital-assets/anomalies (only live tab)
/digital-assets/anomalies              Live, theme-aware
/digital-assets/{rankings,trends,compare}   ComingSoon
/ai                                    → /ai/anomalies
/ai/anomalies                          Live, theme-aware
/ai/{rankings,trends,compare}          ComingSoon
/timeline/[ticker]                     Per-bank narrative + Call Report + stock + news timeline
```

Old top-level URLs (`/trends`, `/compare`, `/anomalies/{theme}`) 307-redirect to the new
sector-hub paths.

---

## Caching

Read-mostly endpoints (`/banks`, `/concepts`, `/overview`, `/rankings`, `/trends`,
`/timeline/*`, `/anomalies/*`, `/findings*`, `/stock/*`, `/news/*`) are cached at two
layers:

- **Server-side TTL memo** via `@cached(ttl=…)` from `pc_analyst.cache` (300 s for
  trend-y data, 1800 s for findings, 3600 s for static lists).
- **`Cache-Control: public, max-age=… stale-while-revalidate=600`** middleware so the
  browser and the Next.js proxy can both reuse responses.

Admin endpoints:

```bash
curl -X POST  http://localhost:8000/admin/cache/invalidate          # clear all
curl -X POST 'http://localhost:8000/admin/cache/invalidate?prefix=…' # clear scoped
curl         http://localhost:8000/admin/cache/stats
```

`scripts/populate_findings.py` automatically POSTs to `/admin/cache/invalidate` after a
successful run so the UI sees fresh findings without waiting on the TTL.

---

## Troubleshooting

- **`ModuleNotFoundError: pc_analyst`** — run scripts from
  `bank-analysis-ai-chatbot/backend/` with the venv active, or `pip install -e .`.
- **App returns empty data / `no such table: …`** — `pc_analyst.db` is missing or empty.
  Check the file size (~1.3 GB expected) and confirm `SQLITE_PATH` resolves to it.
- **Chatbot returns plain extractive answers, no LLM-style synthesis** — `GEMINI_API_KEY`
  is missing or empty in `bank-analysis-ai-chatbot/.env`. The backend reads `.env` once
  at startup; restart after editing.
- **News panel empty** — `ALPHAVANTAGE_API_KEY` not set. Free tier is 25 requests/day;
  the API caches what it fetches into the `news_article` table so subsequent loads are
  free.
- **Stock prices empty** — `yfinance` not installed in the venv. `pip install yfinance`
  and restart.
- **Reranker download stalls** — set `HF_HUB_OFFLINE=1` after the first successful
  start.
- **Port 8000 in use** — `lsof -ti:8000 | xargs kill -9` then restart.
- **Frontend reports HTTP 502 from `/api/backend/*`** — backend is not running on
  `BACKEND_URL`; check the second terminal.

---

## Honest caveats

- "Private credit" is not a Call Report line item. The proxy uses Schedule RC-C 4.a
  (C&I loans to nondepository financial institutions, RCON1766) + RC-L 1.c.(1) (unused
  commitments to NBFIs, RCONJ457) + taxonomy-driven footnote extraction. The UI surfaces
  the proxy definition in the footer.
- Earnings-call **Q&A is gated behind transcript licensing**; the corpus is prepared
  remarks only.
- **DA and AI quantitative ingestion is not built.** The DA / AI Anomalies tabs work
  because the anomaly engine reads `chunk_topic` (NLP-tagged narrative chunks) — the
  Rankings / Trends / Compare tabs for those themes show ComingSoon panels until the
  quantitative side lands.
- Span-level grounding is best-effort; the eval harness in `backend/eval/` tracks
  regressions across 20 hand-graded analyst questions.
