-- Reusable composer state for the Sources screen. One row, id 'default'.
-- Each column is a JSON array of strings. These are the chip lists the
-- query builder combines with a channel's site filter to produce a
-- Boolean string, which then gets saved as a row in `queries`.

CREATE TABLE IF NOT EXISTS search_parts (
  id           TEXT PRIMARY KEY DEFAULT 'default',
  seniority    TEXT NOT NULL DEFAULT '[]',  -- OR'd, e.g. ["Senior","Staff","Lead"]
  titles       TEXT NOT NULL DEFAULT '[]',  -- OR'd
  must_mention TEXT NOT NULL DEFAULT '[]',  -- AND'd, each quoted
  where_terms  TEXT NOT NULL DEFAULT '[]',  -- OR'd
  keep_out     TEXT NOT NULL DEFAULT '[]',  -- site/word exclusions, non-ATS channels only
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
