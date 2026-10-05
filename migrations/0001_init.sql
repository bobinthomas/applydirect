-- Direct Apply :: D1 schema
-- Run: npx wrangler d1 migrations apply direct-apply --remote

CREATE TABLE IF NOT EXISTS companies (
  id            TEXT PRIMARY KEY,          -- ats:token  e.g. "greenhouse:figma"
  name          TEXT NOT NULL,
  ats           TEXT NOT NULL,             -- greenhouse | lever | ashby | workable | smartrecruiters
  board_token   TEXT NOT NULL,
  careers_url   TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  fail_count    INTEGER NOT NULL DEFAULT 0,
  discovered_by TEXT,                      -- "seed" | "discovery:<channel>"
  last_harvest  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS companies_ats_token ON companies(ats, board_token);
CREATE INDEX IF NOT EXISTS companies_active ON companies(active, last_harvest);

CREATE TABLE IF NOT EXISTS jobs (
  id             TEXT PRIMARY KEY,         -- ats:token:atsJobId
  company_id     TEXT NOT NULL REFERENCES companies(id),
  ats_job_id     TEXT NOT NULL,
  title          TEXT NOT NULL,
  location       TEXT,
  remote         INTEGER NOT NULL DEFAULT 0,
  dept           TEXT,
  employment     TEXT,
  url            TEXT NOT NULL,
  posted_at      TEXT,
  description_md TEXT NOT NULL,
  content_hash   TEXT NOT NULL,            -- sha256(title + description) :: the re-score guard
  first_seen     TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen      TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at      TEXT
);
CREATE INDEX IF NOT EXISTS jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS jobs_open ON jobs(closed_at, posted_at);
CREATE INDEX IF NOT EXISTS jobs_hash ON jobs(content_hash);

CREATE TABLE IF NOT EXISTS profiles (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,  -- bump to invalidate every cached score
  resume_md    TEXT NOT NULL,
  config_json  TEXT NOT NULL,               -- titles, must_have, nice_to_have, dealbreakers, locations, weights
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Embeddings kept as JSON here. Move to Vectorize when the table passes ~20k rows.
CREATE TABLE IF NOT EXISTS vectors (
  owner_type TEXT NOT NULL,                -- 'job' | 'profile'
  owner_id   TEXT NOT NULL,
  hash       TEXT NOT NULL,                -- content_hash it was built from
  dim        INTEGER NOT NULL,
  vec_json   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (owner_type, owner_id)
);

CREATE TABLE IF NOT EXISTS scores (
  job_id        TEXT NOT NULL REFERENCES jobs(id),
  profile_id    TEXT NOT NULL REFERENCES profiles(id),
  profile_ver   INTEGER NOT NULL,
  content_hash  TEXT NOT NULL,
  stage         TEXT NOT NULL,             -- filtered | lexical | semantic | judged
  score         REAL NOT NULL,             -- 0..100, final blended
  lexical       REAL,
  semantic      REAL,
  judged        REAL,
  verdict       TEXT,                      -- one line, why it ranked here
  reasons_json  TEXT,                      -- {matches:[], gaps:[], hook:""}
  model         TEXT,
  scored_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (job_id, profile_id)
);
CREATE INDEX IF NOT EXISTS scores_rank ON scores(profile_id, score DESC);

CREATE TABLE IF NOT EXISTS feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id     TEXT NOT NULL REFERENCES jobs(id),
  profile_id TEXT NOT NULL,
  action     TEXT NOT NULL,                -- saved | applied | dismissed | snoozed
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS feedback_job ON feedback(job_id);

CREATE TABLE IF NOT EXISTS queries (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  channel    TEXT NOT NULL,                -- greenhouse | lever | ashby | careers | ...
  q          TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  last_run   TEXT,
  found      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,                -- harvest | discover | rank
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at   TEXT,
  ok         INTEGER,
  stats_json TEXT,
  error      TEXT
);
