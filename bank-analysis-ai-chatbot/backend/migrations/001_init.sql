-- Private Credit Analyst Tool — initial schema
-- Postgres 16 + pgvector. Embeddings are stored alongside chunks; every
-- chunk keeps byte-exact offsets into its source document so citations
-- can be resolved back to a highlighted span in the source viewer.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bank (
    ticker        TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    rssd_id       TEXT,                   -- FFIEC RSSD (NULL until mapped)
    cik           TEXT,                   -- SEC CIK (NULL until mapped)
    peer_group    TEXT,                   -- 'GSIB', 'trust-ib', 'regional', ...
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Narrative documents (10-K, 10-Q, 8-K, prepared remarks)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS document (
    id              BIGSERIAL PRIMARY KEY,
    bank_ticker     TEXT NOT NULL REFERENCES bank(ticker) ON DELETE CASCADE,
    doc_type        TEXT NOT NULL,         -- '10-K' | '10-Q' | '8-K' | 'prepared_remarks'
    fiscal_year     INT,
    fiscal_quarter  INT,
    filed_at        DATE,
    source_path     TEXT NOT NULL,         -- filesystem path or URL of original
    source_url      TEXT,                  -- EDGAR URL when available
    title           TEXT,
    raw_text        TEXT NOT NULL,         -- normalized plaintext; offsets index this
    raw_text_sha256 TEXT NOT NULL,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bank_ticker, doc_type, fiscal_year, fiscal_quarter, raw_text_sha256)
);

CREATE INDEX IF NOT EXISTS document_bank_type_idx ON document (bank_ticker, doc_type, fiscal_year, fiscal_quarter);

-- ---------------------------------------------------------------------------
-- Chunks: span-level units with byte offsets into document.raw_text
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS chunk (
    id              BIGSERIAL PRIMARY KEY,
    document_id     BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    chunk_index     INT NOT NULL,          -- ordinal within document
    section_header  TEXT,                  -- e.g. 'Item 1A. Risk Factors'
    page            INT,                   -- if derivable from source
    char_start      INT NOT NULL,          -- byte/char offset into document.raw_text
    char_end        INT NOT NULL,
    text            TEXT NOT NULL,
    token_count     INT,
    taxonomy_hits   TEXT[] DEFAULT '{}',   -- which taxonomy terms matched
    embedding       VECTOR(384),           -- dim must match EMBEDDING_DIM in config
    tsv             TSVECTOR,              -- for BM25-ish full-text retrieval
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS chunk_doc_idx ON chunk (document_id);
CREATE INDEX IF NOT EXISTS chunk_tsv_idx ON chunk USING GIN (tsv);
CREATE INDEX IF NOT EXISTS chunk_taxonomy_idx ON chunk USING GIN (taxonomy_hits);
-- Vector index: IVFFLAT (cosine). Build AFTER bulk-load for best recall.
CREATE INDEX IF NOT EXISTS chunk_embedding_idx
    ON chunk USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Keep tsv in sync via trigger (simple English config).
CREATE OR REPLACE FUNCTION chunk_tsv_trigger() RETURNS trigger AS $$
BEGIN
    NEW.tsv := to_tsvector('english', coalesce(NEW.text, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chunk_tsv_update ON chunk;
CREATE TRIGGER chunk_tsv_update BEFORE INSERT OR UPDATE OF text ON chunk
    FOR EACH ROW EXECUTE FUNCTION chunk_tsv_trigger();

-- ---------------------------------------------------------------------------
-- FFIEC Call Report facts (structured quantitative layer)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS call_report_fact (
    id              BIGSERIAL PRIMARY KEY,
    rssd_id         TEXT NOT NULL,
    bank_ticker     TEXT REFERENCES bank(ticker) ON DELETE SET NULL,
    quarter         TEXT NOT NULL,            -- e.g. '2024Q4'
    schedule        TEXT NOT NULL,            -- 'RC-C' | 'RC-L' | 'RC-R' | ...
    line_item       TEXT NOT NULL,            -- '4.a' | 'RCON1766' | taxonomy key
    label           TEXT,                     -- human-readable label
    value_numeric   NUMERIC,                  -- raw thousands of USD
    value_text      TEXT,
    as_of_date      DATE,
    source_url      TEXT,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (rssd_id, quarter, schedule, line_item)
);

CREATE INDEX IF NOT EXISTS crf_bank_idx ON call_report_fact (bank_ticker, quarter, schedule);
CREATE INDEX IF NOT EXISTS crf_rssd_idx ON call_report_fact (rssd_id, quarter);

-- ---------------------------------------------------------------------------
-- Agent runs + reasoning traces (auditable)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_run (
    id              BIGSERIAL PRIMARY KEY,
    question        TEXT NOT NULL,
    answer          TEXT,                     -- final synthesized answer with [n] markers
    citations_json  JSONB,                    -- [{marker: 1, chunk_id, char_start, char_end, ...}]
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    llm_provider    TEXT,
    llm_model       TEXT,
    status          TEXT NOT NULL DEFAULT 'running'   -- 'running' | 'done' | 'error'
);

CREATE TABLE IF NOT EXISTS reasoning_step (
    id              BIGSERIAL PRIMARY KEY,
    run_id          BIGINT NOT NULL REFERENCES agent_run(id) ON DELETE CASCADE,
    step_index      INT NOT NULL,
    step_type       TEXT NOT NULL,            -- 'decompose' | 'tool_call' | 'synthesize' | 'note'
    tool_name       TEXT,
    tool_arguments  JSONB,
    tool_result     JSONB,
    summary         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (run_id, step_index)
);

CREATE INDEX IF NOT EXISTS reasoning_step_run_idx ON reasoning_step (run_id);
