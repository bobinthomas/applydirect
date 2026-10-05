import type { ProfileConfig } from "./config";
import type { JobRow } from "./filters";

const STOP = new Set(["and", "or", "the", "of", "for", "a", "an", "to", "in", "with", "at"]);
const tokens = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));

function overlap(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = tokens(b);
  if (!A.size || !B.length) return 0;
  const hits = B.filter((t) => A.has(t)).length;
  return hits / Math.max(A.size, B.length);
}

function titleScore(title: string, cfg: ProfileConfig): number {
  const t = title.toLowerCase();
  for (const c of cfg.titles.core) if (t.includes(c.toLowerCase())) return 1;
  for (const a of cfg.titles.adjacent) if (t.includes(a.toLowerCase())) return 0.68;
  const best = Math.max(
    0,
    ...cfg.titles.core.map((c) => overlap(c, title)),
    ...cfg.titles.adjacent.map((a) => overlap(a, title) * 0.8),
  );
  return Math.min(best, 0.6);
}

function keywordScore(job: JobRow, cfg: ProfileConfig): { score: number; hits: string[] } {
  const hay = `${job.title}\n${job.description_md}`.toLowerCase();
  const must = cfg.mustHave.filter((k) => hay.includes(k.toLowerCase()));
  const nice = cfg.niceToHave.filter((k) => hay.includes(k.toLowerCase()));
  const mustPart = cfg.mustHave.length ? must.length / cfg.mustHave.length : 0.5;
  const nicePart = cfg.niceToHave.length ? nice.length / cfg.niceToHave.length : 0;
  return { score: Math.min(1, mustPart * 0.75 + nicePart * 0.45), hits: [...must, ...nice] };
}

function seniorityScore(title: string, cfg: ProfileConfig): number {
  const t = title.toLowerCase();
  if (cfg.seniority.want.some((s) => t.includes(s.toLowerCase()))) return 1;
  if (cfg.seniority.reject.some((s) => t.includes(s.toLowerCase()))) return 0;
  return 0.55; // unmarked titles are common and often fine
}

function recencyScore(postedAt: string | null): number {
  if (!postedAt) return 0.45;
  const days = (Date.now() - new Date(postedAt).getTime()) / 86400000;
  if (Number.isNaN(days)) return 0.45;
  if (days <= 3) return 1;
  return Math.max(0.1, Math.exp(-days / 21));
}

/** Pass 1. Runs over everything that survived the hard filter, costs nothing. */
export function lexicalScore(job: JobRow, cfg: ProfileConfig) {
  const w = cfg.weights;
  const title = titleScore(job.title, cfg);
  const kw = keywordScore(job, cfg);
  const sen = seniorityScore(job.title, cfg);
  const rec = recencyScore(job.posted_at);
  const raw = title * w.title + kw.score * w.keywords + sen * w.seniority + rec * w.recency;
  const denom = w.title + w.keywords + w.seniority + w.recency;
  return {
    score: Math.round((raw / denom) * 1000) / 10,
    parts: { title, keywords: kw.score, seniority: sen, recency: rec },
    hits: kw.hits,
  };
}
