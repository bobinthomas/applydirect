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

`db:migrate` and `db:seed` above hit the **remote** database. `next dev` does not use
it — `initOpenNextCloudflareForDev()` in `next.config.ts` reads the **local** D1
emulation instead, a separate SQLite file wrangler keeps under `.wrangler/state`. To
run entirely on your machine, migrate and seed local instead:

```bash
npx wrangler d1 migrations apply direct-apply --local
npx wrangler d1 execute direct-apply --local --file=seed/seed.sql
```

This works even before `wrangler d1 create` has ever run — the placeholder
`database_id` in `wrangler.jsonc` is enough to name the local file. The remote
database only matters once you deploy, since Workers AI itself has no local
emulation and always calls the real service either way.

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
queries a week is all this uses. Everything else runs without any key. See
[Discovery API setup](#discovery-api-setup) below before wiring it up — there
are a few non-obvious steps and one failure mode worth knowing about upfront.

## Discovery API setup

Two separate things to create: a **Programmable Search Engine** (gives you
`SEARCH_CX`) and a **Custom Search JSON API key** in a Google Cloud project
(gives you `SEARCH_API_KEY`). Neither is quite as simple as it looks.

### 1. The search engine (SEARCH_CX)

`https://programmablesearchengine.google.com/controlpanel/create`

- The **Create** button stays disabled until you add at least one site to
  "Sites to search" — you cannot create an engine with zero sites, even though
  the next step tries to override that.
- Once created, go to **Setup → Basics** and look for **"Search the entire
  web"** under Augment Results. Turning this on is what actually matters —
  without it, `site:` queries only match domains you've explicitly listed.
- **If that toggle is greyed out**, don't fight it. Google requires the sites
  list to be non-empty and won't always let you delete down to zero to unlock
  it either. The reliable fallback: skip "entire web" entirely and instead
  list every host the app's own ATS adapters recognize, verified straight from
  the regex in `src/lib/ats/*.ts`:

  ```
  boards.greenhouse.io/*
  job-boards.greenhouse.io/*
  jobs.lever.co/*
  jobs.eu.lever.co/*
  jobs.ashbyhq.com/*
  apply.workable.com/*
  jobs.smartrecruiters.com/*
  ```

  This is a complete list — any URL from a host outside it gets silently
  dropped by `identify()` in `src/lib/ats/index.ts` regardless of what the
  search engine returns, so scoping the engine to exactly these 7 hosts loses
  nothing versus whole-web mode for the 5 real ATS channels. The one cost: the
  generic "careers pages" channel in the Sources composer needs true
  whole-web search to be useful, and won't return anything scoped this way.
- Grab the **Search engine ID** from Setup → Basics. That's `SEARCH_CX`.

### 2. The API key (SEARCH_API_KEY)

- Enable the API: `https://console.cloud.google.com/apis/library/customsearch.googleapis.com`
  (pick or create a project first, then Enable).
- Create the key: `https://console.cloud.google.com/apis/credentials` →
  **Create credentials → API key**. Optionally restrict it to just this API.
- **The project needs an active billing account linked**, even though usage
  here stays entirely inside the free 100-queries/day tier. Without one, calls
  fail with a 403 whose message doesn't mention billing at all (see below),
  which makes this easy to miss.

### If you get a 403 "This project does not have the access to Custom Search JSON API"

This is the error's exact wording for several unrelated causes, so check in
order: API not enabled, no billing account linked, or (rarer) a bad/restricted
key. If all three check out and it *still* fails — API confirmed enabled via
`gcloud services list --enabled`, billing confirmed active, a freshly created
unrestricted key fails identically, and even a brand-new project with billing
freshly linked fails identically — that combination points to an
**account-level hold**, not a config mistake. One signal that confirms it:
authenticating with `gcloud auth print-access-token` instead of an API key
produces a *different* error ("insufficient authentication scopes") rather
than this one, meaning the project-access check itself passes over OAuth and
only the API-key path is blocked account-wide.

If you land here: file a case at `console.cloud.google.com/support/cases`
(category APIs & Services), or just wait — these holds on freshly
billing-enabled accounts have been observed to clear on their own within a
day or two. The app runs completely fine without discovery in the meantime;
see [Screens](#screens) for growing the company list by hand via the Sources
page's Search/Copy buttons instead.

## Screens

| Route | What it's for |
| --- | --- |
| `/inbox` | The ranked list. Filter by title/company, threshold by score, save / mark applied / dismiss. |
| `/job/[id]` | One posting: full description, the judge's verdict, matches, gaps, and an opening line. |
| `/settings` | Edit the profile the funnel scores against — resume, titles, keywords, dealbreakers, locations, and the six pass weights. Saving bumps `version`, which invalidates every cached score. Backed by `GET`/`PUT /api/profile`. |
| `/sources` | Compose the boolean strings discovery sends to Google: chip lists for seniority, titles, must-mention keywords, location, and (careers-page searches only) site exclusions, previewed live per channel. Save turns one into a row in `queries`; the list below is that table, inline-editable, with a button to run discovery immediately instead of waiting for Monday's cron. Backed by `GET`/`PUT /api/parts` (the chip state, one row, table `search_parts`) and `GET`/`POST /api/queries` + `PUT`/`DELETE /api/queries/[id]`. |

Channels in the composer are capped at what the harvester can actually read —
Greenhouse, Lever, Ashby, Workable, SmartRecruiters — plus one generic "careers
pages" channel for leads outside those five, which discovery can still turn into a
company row but harvest can't pull from until someone writes that adapter.

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
- `googleCse()` in `src/lib/discovery.ts` swallows HTTP errors from the search
  API silently (`if (!res.ok) break`, no error surfaced) — a bad key, missing
  billing, or an account-level block all just show up as an all-zero
  `POST /api/discover` result with nothing in the `runs.error` column. If
  discovery ever returns zeros unexpectedly, verify with a direct `curl`
  against `googleapis.com/customsearch/v1` before assuming the queries
  themselves are the problem — see [Discovery API setup](#discovery-api-setup).

## What is not built yet

- The daily digest email via Resend, and its API route.
- A way to add a company from the Sources page. The Search button opens a real
  Google search and reliably finds boards, but there's no form yet to turn a
  result into a row in `companies` — that still means a direct
  `INSERT INTO companies` via `wrangler d1 execute` today.

Settings and Sources themselves — the other two items this note used to list —
are built; see [Screens](#screens).
