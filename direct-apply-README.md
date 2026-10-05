# Direct apply

Pulls job postings straight from company applicant tracking systems, ranks them
against one profile, and shows you the short list. No aggregators, no scraping.

## Why it is built this way

Google dorks are good at finding *which companies* run a board. They are bad at
being a daily data source: you get blocked, and a search snippet is 160 characters
of nothing to rank on.

So the work splits in two.

**Discovery** runs weekly. It sends the boolean queries to a search API, reads the
result URLs, and pulls the board token out of the path. `job-boards.greenhouse.io/stripe/jobs/123`
becomes `greenhouse:stripe` in the companies table. That is the entire job.

**Harvest** runs nightly and is where postings actually come from. Every ATS in
here publishes open JSON for any board token, free and unauthenticated:

| ATS | Endpoint |
| --- | --- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` |
| Lever | `api.lever.co/v0/postings/{token}?mode=json` |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{token}` |
| Workable | `apply.workable.com/api/v1/widget/accounts/{token}?details=true` |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{token}/postings` |

Full title, location, dates, and the complete description. Three hundred companies
is three hundred fetches on a cron.

## The ranking funnel

Four passes, each one cheaper than the one after it.

| Pass | What it does | Cost |
| --- | --- | --- |
| 0. Hard filter | Excluded titles, rejected seniority, dealbreakers, location | Free |
| 1. Lexical | Title match, must-have coverage, seniority band, recency decay | Free |
| 2. Semantic | `bge-base-en-v1.5` embeddings, cosine against the profile | Workers AI, top 80 |
| 3. Judge | `llama-3.3-70b` returns fit, evidence, gaps, and an opening line | Workers AI, top 30 |

The whole thing hangs on `content_hash`, a sha256 of title plus description. A job
is only ever scored once per hash per profile version. Boards republish the same
posting constantly, and without that guard you pay for the same judgement every night.

Editing the profile bumps `version`, which invalidates every cached score and
re-ranks the corpus. That is deliberate. Change what you are looking for and the
list changes with it.

Dismissals feed back in two ways: the job disappears from the inbox, and the last
ten dismissed titles go into the judge prompt as negative examples.

## Setup

```bash
npm install
npx wrangler d1 create direct-apply     # paste database_id into wrangler.jsonc
npm run db:migrate
```

Open `seed/seed.sql`, replace `REPLACE_WITH_seed/profile.md` with the contents of
`seed/profile.md` as a single-quoted SQL string, then:

```bash
npm run db:seed
npm run dev
```

Kick it manually the first time:

```bash
curl -XPOST localhost:3000/api/harvest   # pulls every seeded board
curl -XPOST localhost:3000/api/rank      # scores what came in
open localhost:3000/inbox
```

Deploy:

```bash
npx wrangler secret put ADMIN_TOKEN
npm run deploy
```

Discovery needs a Google Programmable Search key and engine id in
`SEARCH_API_KEY` and `SEARCH_CX`. A hundred queries a day is free, and eight
queries a week is all this uses. Everything else runs without any key.

## Crons

| Schedule | Job |
| --- | --- |
| `0 2 * * *` | Harvest every active board |
| `30 2 * * *` | Rank whatever is unscored, judge budget 40 |
| `0 3 * * 1` | Discovery, eight queries, grow the company list |

## Seed companies are guesses

The tokens in `seed.sql` are starting points, not a verified list. A wrong token
costs one 404, gets a fail count, and deactivates itself after four. Discovery is
what builds the real list. Check `SELECT active, COUNT(*) FROM companies GROUP BY 1`
after the first harvest to see what stuck.

## Known soft spots

- Board response shapes are stable but undocumented. Ashby and SmartRecruiters
  field names are the two most likely to need a tweak on first run. Every adapter
  reads defensively, so a shape change degrades a field rather than throwing.
- Workers AI model ids move. They are in one place, `src/lib/rank/config.ts`.
  Check the current catalogue before deploying.
- The judge on a 70b model is good at spotting discipline mismatches and weak at
  seniority nuance. If its scores feel generous, lower `weights.judge` rather than
  rewriting the prompt first.
- Vectors sit in D1 as JSON. Fine to about 20k rows, then move to Vectorize.

## What is not built yet

Sources UI for editing discovery queries, the daily digest email via Resend, and
a profile editor. The API routes for all three exist. The bench HTML from the
earlier pass is the design reference for the sources screen.
