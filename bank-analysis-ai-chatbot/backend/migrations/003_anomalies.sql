-- Anomalies: topic-tagged chunks, 8-K item events, sentence-lexicon sentiment.

CREATE TABLE IF NOT EXISTS chunk_topic (
    chunk_id        BIGINT PRIMARY KEY REFERENCES chunk(id) ON DELETE CASCADE,
    theme           TEXT NOT NULL,
    confidence      NUMERIC NOT NULL,
    keyword_score   NUMERIC NOT NULL,
    cosine_score    NUMERIC NOT NULL,
    classified_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS chunk_topic_theme_idx ON chunk_topic (theme);

CREATE TABLE IF NOT EXISTS filing_event (
    id              BIGSERIAL PRIMARY KEY,
    document_id     BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    item_code       TEXT NOT NULL,
    item_label      TEXT NOT NULL,
    excerpt         TEXT NOT NULL,
    extracted_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (document_id, item_code, excerpt)
);

CREATE INDEX IF NOT EXISTS filing_event_doc_idx ON filing_event (document_id);
CREATE INDEX IF NOT EXISTS filing_event_code_idx ON filing_event (item_code);

CREATE TABLE IF NOT EXISTS chunk_sentiment (
    chunk_id            BIGINT PRIMARY KEY REFERENCES chunk(id) ON DELETE CASCADE,
    positive_count      INTEGER NOT NULL,
    negative_count      INTEGER NOT NULL,
    uncertainty_count   INTEGER NOT NULL,
    litigious_count     INTEGER NOT NULL,
    total_words         INTEGER NOT NULL,
    net_sentiment       NUMERIC NOT NULL
);
