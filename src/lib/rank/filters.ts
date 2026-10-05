import type { ProfileConfig } from "./config";

export interface JobRow {
  id: string; title: string; location: string | null; remote: number;
  dept: string | null; description_md: string; posted_at: string | null;
  content_hash: string; company_name?: string;
}

export interface FilterResult { pass: boolean; reason?: string }

const rx = (s: string) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

/**
 * Pass 0. Cheap, absolute, and unapologetic. Everything that survives here
 * costs real compute later, so this is where volume dies.
 */
export function hardFilter(job: JobRow, cfg: ProfileConfig): FilterResult {
  const title = job.title.toLowerCase();
  const body = job.description_md.slice(0, 6000);

  for (const t of cfg.titles.exclude) {
    if (rx(t).test(title)) return { pass: false, reason: `title excluded: ${t}` };
  }
  for (const s of cfg.seniority.reject) {
    if (rx(s).test(title)) return { pass: false, reason: `seniority: ${s}` };
  }
  for (const d of cfg.dealbreakers) {
    if (rx(d).test(title) || rx(d).test(body)) return { pass: false, reason: `dealbreaker: ${d}` };
  }

  if (!job.remote) {
    const loc = (job.location ?? "").toLowerCase();
    const ok = cfg.locations.allow.some((a) => loc.includes(a.toLowerCase()));
    if (loc && !ok) return { pass: false, reason: `location: ${job.location}` };
  } else if (!cfg.locations.remoteOk) {
    return { pass: false, reason: "remote not wanted" };
  }

  return { pass: true };
}
