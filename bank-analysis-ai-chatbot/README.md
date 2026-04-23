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

## Quick start (with Docker)

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d                # Postgres + pgvector
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -e .
python scripts/init_db.py                                        # apply migrations
python scripts/seed_demo.py                                      # seed Call Report + demo answers
python scripts/ingest_filings.py --banks DFS FHN FLG             # chunk + embed HTML filings
uvicorn pc_analyst.api:app --reload --port 8000
```

In another terminal:

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

## Running without Docker / without API keys

The system is designed to degrade gracefully:

- `EMBEDDING_MODEL=local` uses `sentence-transformers/all-MiniLM-L6-v2` locally (no API).
- `LLM_PROVIDER=none` uses a deterministic extractive synthesizer (no LLM calls) so you
  can demo the pipeline offline.
- `STORAGE_BACKEND=sqlite` falls back to SQLite with in-Python cosine-similarity search
  when Postgres is unavailable.

Set `ANTHROPIC_API_KEY` in `.env` to use Claude for synthesis.

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
