-- Timeline & Trends: stock prices + news articles

CREATE TABLE IF NOT EXISTS stock_price (
    id              BIGSERIAL PRIMARY KEY,
    bank_ticker     TEXT NOT NULL REFERENCES bank(ticker) ON DELETE CASCADE,
    date            DATE NOT NULL,
    close           NUMERIC NOT NULL,
    volume          BIGINT,
    UNIQUE (bank_ticker, date)
);

CREATE INDEX IF NOT EXISTS stock_price_ticker_idx ON stock_price (bank_ticker, date);

CREATE TABLE IF NOT EXISTS news_article (
    id              BIGSERIAL PRIMARY KEY,
    bank_ticker     TEXT NOT NULL REFERENCES bank(ticker) ON DELETE CASCADE,
    headline        TEXT NOT NULL,
    url             TEXT,
    published_at    TIMESTAMPTZ NOT NULL,
    sentiment_score NUMERIC,
    UNIQUE (bank_ticker, url)
);

CREATE INDEX IF NOT EXISTS news_article_ticker_idx ON news_article (bank_ticker, published_at);

CREATE TABLE IF NOT EXISTS pc_finding (
    id              BIGSERIAL PRIMARY KEY,
    bank_ticker     TEXT NOT NULL REFERENCES bank(ticker) ON DELETE CASCADE,
    bank_name       TEXT,
    rating          INTEGER,
    mention_frequency TEXT,
    sentiment       TEXT,
    key_themes      JSONB,
    strategic_initiatives TEXT,
    perceived_risks TEXT,
    notable_quotes  JSONB,
    pullback_mentions TEXT,
    named_competitors TEXT,
    risk_focus_analysis TEXT,
    involvement_rating INTEGER,
    UNIQUE (bank_ticker)
);
