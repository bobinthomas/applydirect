import { all, one, run, db } from "../db";
import { hardFilter, type JobRow } from "./filters";
import { lexicalScore } from "./lexical";
import { cosine, getVector } from "./embed";
import { judge } from "./judge";
import type { ProfileConfig } from "./config";

export interface RankStats {
  considered: number; filtered: number; lexical: number;
  semantic: number; judged: number; skippedCached: number;
}

export interface ProfileRow {
  id: string; name: string; version: number; resume_md: string; config_json: string;
}

export async function loadProfile(id = "me"): Promise<ProfileRow> {
  const p = await one<ProfileRow>(`SELECT * FROM profiles WHERE id = ?`, id);
  if (!p) throw new Error(`profile ${id} not found. Seed it first.`);
  return p;
}

/**
 * The whole point of the funnel: nothing expensive runs on a job whose
 * content_hash has already been scored against this profile version.
 */
export async function rankPending(profileId = "me", budget = 40): Promise<RankStats> {
  const profile = await loadProfile(profileId);
  const cfg: ProfileConfig = JSON.parse(profile.config_json);
  const stats: RankStats = {
    considered: 0, filtered: 0, lexical: 0, semantic: 0, judged: 0, skippedCached: 0,
  };

  const pending = await all<JobRow & { company_name: string }>(
    `SELECT j.id, j.title, j.location, j.remote, j.dept, j.description_md,
            j.posted_at, j.content_hash, c.name AS company_name
     FROM jobs j
     JOIN companies c ON c.id = j.company_id
     LEFT JOIN scores s
       ON s.job_id = j.id AND s.profile_id = ?
      AND s.profile_ver = ? AND s.content_hash = j.content_hash
     WHERE j.closed_at IS NULL AND s.job_id IS NULL
     ORDER BY COALESCE(j.posted_at, j.first_seen) DESC
     LIMIT 600`,
    profileId, profile.version,
  );
  stats.considered = pending.length;

  // Pass 0 and 1
  const survivors: Array<{ job: JobRow & { company_name: string }; lex: ReturnType<typeof lexicalScore> }> = [];
  for (const job of pending) {
    const f = hardFilter(job, cfg);
    if (!f.pass) {
      await writeScore(job.id, profile, "filtered", 0, { verdict: f.reason ?? "filtered out" });
      stats.filtered++;
      continue;
    }
    const lex = lexicalScore(job, cfg);
    survivors.push({ job, lex });
    stats.lexical++;
  }

  survivors.sort((a, b) => b.lex.score - a.lex.score);

  // Pass 2, semantic, on the top slice only
  const semanticSlice = survivors.slice(0, cfg.semanticTopN ?? 80);
  let profileVec: number[] | null = null;
  try {
    profileVec = await getVector("profile", profile.id, `v${profile.version}`, () =>
      `${profile.resume_md}\n\nTargets: ${cfg.titles.core.join(", ")}\nStrengths: ${cfg.mustHave.join(", ")}`,
    );
  } catch {
    profileVec = null;
  }

  const semantic = new Map<string, number>();
  if (profileVec) {
    for (const s of semanticSlice) {
      try {
        const v = await getVector("job", s.job.id, s.job.content_hash, () =>
          `${s.job.title}\n${s.job.dept ?? ""}\n${s.job.description_md.slice(0, 3500)}`,
        );
        semantic.set(s.job.id, Math.max(0, cosine(profileVec!, v)));
        stats.semantic++;
      } catch { /* leave it lexical-only */ }
    }
  }

  const blended = survivors.map((s) => ({
    ...s,
    sem: semantic.get(s.job.id) ?? null,
    pre: preScore(s.lex.score, semantic.get(s.job.id) ?? null, cfg),
  }));
  blended.sort((a, b) => b.pre - a.pre);

  // Pass 3, the judge, only on what the budget allows
  const dismissed = await all<{ title: string }>(
    `SELECT j.title FROM feedback f JOIN jobs j ON j.id = f.job_id
     WHERE f.profile_id = ? AND f.action = 'dismissed'
     ORDER BY f.created_at DESC LIMIT 10`,
    profileId,
  );
  const dismissedTitles = dismissed.map((d) => d.title);

  const toJudge = blended.slice(0, Math.min(budget, cfg.judgeTopN ?? budget));
  for (const item of toJudge) {
    const j = await judge(item.job, profile.resume_md, cfg, dismissedTitles);
    if (!j) {
      await writeScore(item.job.id, profile, "semantic", item.pre, {
        lexical: item.lex.score, semantic: item.sem,
        verdict: "scored without the judge, model was unavailable",
      });
      continue;
    }
    const final = Math.round(
      (item.pre * (1 - (cfg.weights.judge ?? 0.45)) + j.fit * (cfg.weights.judge ?? 0.45)) * 10,
    ) / 10;
    await writeScore(item.job.id, profile, "judged", final, {
      lexical: item.lex.score, semantic: item.sem, judged: j.fit,
      verdict: j.verdict, model: j.model,
      reasons: { matches: j.matches, gaps: j.gaps, hook: j.hook, lexicalHits: item.lex.hits },
    });
    stats.judged++;
  }

  // Everything below the judge budget still gets a usable score
  for (const item of blended.slice(toJudge.length)) {
    await writeScore(item.job.id, profile, item.sem === null ? "lexical" : "semantic", item.pre, {
      lexical: item.lex.score, semantic: item.sem,
      reasons: { lexicalHits: item.lex.hits },
    });
  }

  return stats;
}

function preScore(lex: number, sem: number | null, cfg: ProfileConfig): number {
  if (sem === null) return lex;
  const w = cfg.weights.semantic ?? 0.25;
  return Math.round((lex * (1 - w) + sem * 100 * w) * 10) / 10;
}

async function writeScore(
  jobId: string,
  profile: ProfileRow,
  stage: string,
  score: number,
  extra: {
    lexical?: number; semantic?: number | null; judged?: number;
    verdict?: string; model?: string; reasons?: unknown;
  } = {},
) {
  const hash = await one<{ content_hash: string }>(
    `SELECT content_hash FROM jobs WHERE id = ?`, jobId,
  );
  const d = await db();
  await d
    .prepare(
      `INSERT INTO scores (job_id, profile_id, profile_ver, content_hash, stage, score,
         lexical, semantic, judged, verdict, reasons_json, model, scored_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
       ON CONFLICT(job_id, profile_id) DO UPDATE SET
         profile_ver=excluded.profile_ver, content_hash=excluded.content_hash,
         stage=excluded.stage, score=excluded.score, lexical=excluded.lexical,
         semantic=excluded.semantic, judged=excluded.judged, verdict=excluded.verdict,
         reasons_json=excluded.reasons_json, model=excluded.model,
         scored_at=datetime('now')`,
    )
    .bind(
      jobId, profile.id, profile.version, hash?.content_hash ?? "", stage, score,
      extra.lexical ?? null, extra.semantic ?? null, extra.judged ?? null,
      extra.verdict ?? null, extra.reasons ? JSON.stringify(extra.reasons) : null,
      extra.model ?? null,
    )
    .run();
}
