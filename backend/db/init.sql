-- Schema for the URL shortener (Project Brief, Section 1.3).
-- Safe to run more than once: the API runs this file on every start, so
-- Staging and Production pick up new tables even with an existing volume.

CREATE TABLE IF NOT EXISTS links (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code         VARCHAR(32)  NOT NULL UNIQUE,
    original_url TEXT         NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ  NULL          -- for the optional expiry feature
);

CREATE TABLE IF NOT EXISTS clicks (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    link_id     BIGINT       NOT NULL REFERENCES links (id) ON DELETE CASCADE,
    clicked_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    referrer    TEXT         NULL,
    user_agent  TEXT         NULL,
    ip_hash     CHAR(64)     NULL           -- salted SHA-256 of the visitor IP, never the raw IP
);

-- Keeps the statistics query (clicks per link per day) fast as clicks grow
CREATE INDEX IF NOT EXISTS idx_clicks_link_id_clicked_at ON clicks (link_id, clicked_at);
