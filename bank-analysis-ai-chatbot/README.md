# Private Credit Analyst Tool

A vertical search + AI-overview tool focused on private credit / NBFI exposure across
US banks, tailored for **risk analysts**. Combines narrative documents (10-K/Q, 8-K,
prepared remarks) with FFIEC Call Report structured data, delivers span-level citations,
and exposes reasoning steps through an MCP-style agentic layer so every answer is
auditable.

## What you get

- **Search-engine UX** with an AI overview that cites the exact sentence (span) in the
  source document.
- **Reasoning trace** sidebar showing each tool call the agent made.
- **Structured + unstructured fusion**: narrative statements from filings are joined
  with matching FFIEC Call Report numbers.
- **Peer comparison** surfaced by default for single-bank questions.
- **Disclosure-drift flag**: flags when management commentary contradicts the direction
  of Call Report data.

## Repository layout

```
.
├── backend/                       Python FastAPI + MCP + ingestion + agent
│   ├── migrations/                SQL migrations (Postgres + pgvector)
│   ├── scripts/                   CLI utilities (init_db, ingest_filings, ...)
│   ├── src/pc_analyst/
│   │   ├── ingestion/             EDGAR, FFIEC, IR site pipelines + chunker
│   │   ├── retrieval/             Hybrid BM25 + vector + cross-encoder rerank
│   │   ├── mcp_tools/             search_documents, query_call_report, ...
│   │   ├── agent/                 Decompose + tool-calling loop + synthesizer
│   │   ├── taxonomy/              Private-credit synonym + line-item YAML
│   │   ├── api.py                 FastAPI HTTP API
│   │   └── mcp_server.py          stdio MCP server
│   └── eval/                      20 graded analyst questions + runner
├── frontend/                      Next.js 15 + Tailwind + shadcn
├── infra/
│   └── docker-compose.yml         Postgres 16 + pgvector
├── DFS/ FHN/ FLG/                 Real SEC filings (pilot banks)
└── data/seed/                     Seed Call Report facts + peer tables
```

## Local setup (no Docker required)

This project runs end-to-end on a laptop with **SQLite + local sentence-transformers**;
Postgres is optional. Setup tested on macOS / Linux with Python 3.11+.

### 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11–3.13 | `python3 --version` |
| Node.js | 18+ (20 LTS recommended) | `node --version` |
| npm | 9+ | bundled with Node |
| git | any recent | for cloning |
| RAM | 8 GB+ | first run downloads `bge-reranker-base` (~440 MB) and `all-MiniLM-L6-v2` (~90 MB) from Hugging Face |
| Disk | ~3 GB | filings + DB + model cache |

No Docker, Postgres, or pgvector required — `STORAGE_BACKEND=sqlite` (default) is fully
supported.

### 2. Clone and create the env file

```bash
git clone <repo-url> BUFN403
cd BUFN403/bank-analysis-ai-chatbot
cp .env.example .env                                # inside bank-analysis-ai-chatbot/
```

> **Heads up — there are two possible `.env` files in this repo, for two different things.**
> The chatbot backend (this project) reads **`bank-analysis-ai-chatbot/.env`** (loaded by `pc_analyst.config`,
> which sets `REPO_ROOT = backend/..` = the chatbot project root). The outer `BUFN403/.env` only exists
> if you are running the legacy `Keyword_match_method/` or `Semantic_similarity_method/` pipelines, which
> pick up `GEMINI_API_KEY` from there. **Anything you see referenced below — `ANTHROPIC_API_KEY`,
> `GEMINI_API_KEY`, `FFIEC_*`, `ALPHAVANTAGE_API_KEY` — goes in `bank-analysis-ai-chatbot/.env`,
> NOT the outer `BUFN403/.env`.**

Edit `bank-analysis-ai-chatbot/.env`:

```bash
# Required for LLM-backed answers (chat + synthesis). Omit to fall back to the
# deterministic extractive synthesizer.
GEMINI_API_KEY=AIza...                # google-genai key
# or:
# ANTHROPIC_API_KEY=sk-ant-...
# LLM_PROVIDER=anthropic

# Optional: identify yourself politely to SEC EDGAR (used by ingestion scripts)
SEC_USER_AGENT="Your Name your.email@example.com"

# Optional: FFIEC CDR webservice creds. Only required if you want to pull
# Call Report data via the API instead of the bundled CSVs in Call_Reports/,
# OR run scripts/fetch_missing_pws.py (private-wealth schedules). Free signup
# at https://cdr.ffiec.gov/public/PWS/Login.aspx.
# FFIEC_USERNAME=...
# FFIEC_TOKEN=...

# Optional: Alpha Vantage news-sentiment feed used by /news endpoints. If
# unset the API serves whatever is already cached in SQLite. Free key at
# https://www.alphavantage.co/support/#api-key.
# ALPHAVANTAGE_API_KEY=...
```

Default settings (no need to set unless overriding):
`STORAGE_BACKEND=sqlite`, `EMBEDDING_MODEL=local`, `LLM_PROVIDER=none`,
`SQLITE_PATH=bank-analysis-ai-chatbot/backend/pc_analyst.db`.

The backend resolves the env file at startup via `pc_analyst.config.Settings`
(`backend/src/pc_analyst/config.py`), which points pydantic-settings at
`<chatbot-project-root>/.env`. If you put your keys in `BUFN403/.env` instead,
the chatbot will silently see no keys and fall back to the extractive synthesizer.

**TL;DR for keys:** only `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`) is needed for the
chatbot to generate answers. Everything else is optional and degrades gracefully —
FFIEC creds aren't needed because Call Report data is read from the bundled
`Call_Reports/` CSVs, and Alpha Vantage just powers a side panel.

### 3. Backend Python deps

```bash
cd bank-analysis-ai-chatbot/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install google-genai python-dotenv      # used by Gemini path + .env loader
```

Pulls in: FastAPI/uvicorn, SQLAlchemy, sentence-transformers (downloads MiniLM on first
embed), bge-reranker-base via huggingface_hub, BeautifulSoup/lxml, rank-bm25,
scikit-learn, anthropic, mcp, typer, rich, yfinance, feedparser, psycopg/pgvector
(unused on the SQLite path but installed by the lockfile).

### 4. Expected data layout (at repo root)

The ingestion + analytics scripts read from sibling folders of
`bank-analysis-ai-chatbot/`. The repo ships with these populated for the pilot banks:

```
BUFN403/
├── sec-edgar-filings/      <TICKER>/{10-K,10-Q,8-K}/<filing-dir>/{primary-document.html|full-submission.txt}
├── transcripts_final/      <TICKER>_<YYYY>_Q<N>.txt prepared remarks
├── Call_Reports/           FFIEC CSV exports per quarter
└── bank-analysis-ai-chatbot/
    ├── backend/pc_analyst.db        SQLite DB (gets created/populated by scripts below)
    └── frontend/
```

The chatbot will run as long as `pc_analyst.db` is populated — you do not need to
re-run ingestion if the committed DB is present.

### 5. Database + ingestion (only if `pc_analyst.db` is missing or stale)

Run from `bank-analysis-ai-chatbot/backend/` with the venv active:

```bash
python scripts/init_db.py                              # apply migrations 001–003
python scripts/load_call_reports.py \
    --csv-dir ../../Call_Reports                       # FFIEC structured facts
python scripts/ingest_filings.py --root ../../sec-edgar-filings   # chunk + embed 10-K/Q/8-K HTML
python scripts/ingest_transcripts.py \
    --transcript-dir ../../transcripts_final           # prepared-remarks chunks
python scripts/extract_8k_events.py                    # 8-K item-code regex pass
python scripts/classify_chunk_topics.py                # PC / AI / DA topic tags
python scripts/score_chunk_sentiment.py                # Loughran-McDonald sentiment
python scripts/seed_demo.py                            # optional: canned demo Q&A
```

Order matters: ingest → classify → events → sentiment. All scripts are idempotent and
can be re-run safely.

### 6. Run the backend

```bash
cd bank-analysis-ai-chatbot/backend
source .venv/bin/activate
uvicorn pc_analyst.api:app --reload --port 8000
```

First startup prewarms the reranker + embedding models in a background thread (~30 s on
a cold cache). The health check is `GET /healthz`; the new anomaly endpoints are
`GET /anomalies/{private-credit|ai|digital-assets}`.

### 7. Run the frontend

In a second terminal:

```bash
cd bank-analysis-ai-chatbot/frontend
npm install        # ~250 packages: next 15, react 19, tailwind, recharts
npm run dev        # http://localhost:3000
```

The Next.js dev server proxies `/api/backend/*` to `http://localhost:8000` (configured
in `app/api/backend/[...path]/route.ts`), so the two servers must be running together.

### 8. Optional integrations

- **MCP server** (Claude Desktop / Cursor): `python -m pc_analyst.mcp_server` — exposes
  `search_documents`, `query_call_report`, `compare_peers`, `resolve_citation`.
- **Postgres + pgvector**: `docker compose -f infra/docker-compose.yml up -d` then set
  `STORAGE_BACKEND=postgres` and `DATABASE_URL=postgresql://pc:pc@localhost:5432/pc_analyst`
  in `.env`. Run the ingestion scripts again to populate the new store.
- **Anthropic Claude for synthesis**: set `LLM_PROVIDER=anthropic` and
  `ANTHROPIC_API_KEY` in `.env`.

### Troubleshooting

- **`ModuleNotFoundError: pc_analyst`** — you must run scripts from
  `bank-analysis-ai-chatbot/backend/` with the venv active, or `pip install -e .`.
- **Empty anomaly response** — `pc_analyst.db` is missing tables; re-run `init_db.py`
  followed by ingestion. `sqlite3 pc_analyst.db ".tables"` should show `chunk`,
  `chunk_topic`, `filing_event`, `chunk_sentiment`, `call_report_fact`, etc.
- **Reranker download stalls** — set `HF_HUB_OFFLINE=1` after the first successful
  start to avoid re-checking Hugging Face on every restart.
- **Port 8000 in use** — `lsof -ti:8000 | xargs kill` then restart.

## Running the MCP server

```bash
python -m pc_analyst.mcp_server
```

Expose the four tools (`search_documents`, `query_call_report`, `compare_peers`,
`resolve_citation`) to any MCP-compatible client (Claude Desktop, Cursor, etc.).

## Evaluation

```bash
python backend/eval/runner.py
```

Runs the 20 hand-graded analyst questions in `backend/eval/questions.yaml` and reports
faithfulness + citation-recall metrics.

## Scaling from 3 to 10 banks

```bash
python backend/scripts/expand_banks.py --add JPM BAC C WFC GS MS USB
```

Pulls filings from SEC EDGAR, Call Reports from FFIEC, and chunks + embeds them.

## Honest caveats

- **Transcripts Q&A is gated behind licensing**; MVP uses prepared remarks only.
- **"Private credit" is not a Call Report line item.** We approximate using Schedule
  RC-C 4.a (C&I loans to nonbanks), RC-L (unused commitments), and taxonomy-driven
  footnote extraction. The UI surfaces the proxy definition.
- **Span-level grounding is best-effort**; the eval harness tracks regressions.
