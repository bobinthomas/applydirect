import { byId, type NormalizedJob } from "./ats";
import { all, one, pool, run, sha256, db } from "./db";

export interface HarvestStats {
  companies: number;
  ok: number;
  failed: number;
  inserted: number;
  updated: number;
  closed: number;
}

const MAX_FAILS = 4;

/**
 * Pull every active board and diff against what we hold.
 * A posting that stops appearing on its board is closed, not deleted, because
 * the score history is worth keeping.
 */
export async function harvestAll(limit = 120): Promise<HarvestStats> {
  const companies = await all<{ id: string; ats: string; board_token: string; name: string }>(
    `SELECT id, ats, board_token, name FROM companies
     WHERE active = 1
     ORDER BY COALESCE(last_harvest, '1970') ASC
     LIMIT ?`,
    limit,
  );

  const stats: HarvestStats = {
    companies: companies.length, ok: 0, failed: 0, inserted: 0, updated: 0, closed: 0,
  };

  await pool(companies, 6, async (c) => {
    const adapter = byId(c.ats);
    if (!adapter) return;
    try {
      const jobs = await adapter.listJobs(c.board_token);
      const r = await upsertCompanyJobs(c.id, jobs);
      stats.inserted += r.inserted;
      stats.updated += r.updated;
      stats.closed += r.closed;
      stats.ok++;
      await run(
        `UPDATE companies SET last_harvest = datetime('now'), fail_count = 0 WHERE id = ?`,
        c.id,
      );
    } catch (e: any) {
      stats.failed++;
      const gone = e?.status === 404 || e?.status === 410;
      await run(
        `UPDATE companies
         SET fail_count = fail_count + 1,
             last_harvest = datetime('now'),
             active = CASE WHEN ? OR fail_count + 1 >= ? THEN 0 ELSE active END
         WHERE id = ?`,
        gone ? 1 : 0,
        MAX_FAILS,
        c.id,
      );
    }
  });

  return stats;
}

export async function upsertCompanyJobs(companyId: string, jobs: NormalizedJob[]) {
  const d = await db();
  let inserted = 0, updated = 0, closed = 0;
  const seen = new Set<string>();

  for (const j of jobs) {
    if (!j.title) continue;
    const id = `${companyId}:${j.atsJobId}`;
    seen.add(id);
    const hash = await sha256(`${j.title}\n${j.descriptionMd}`);
    const prior = await one<{ content_hash: string }>(
      `SELECT content_hash FROM jobs WHERE id = ?`,
      id,
    );

    if (!prior) {
      await d
        .prepare(
          `INSERT INTO jobs (id, company_id, ats_job_id, title, location, remote, dept,
             employment, url, posted_at, description_md, content_hash)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(id, companyId, j.atsJobId, j.title, j.location, j.remote ? 1 : 0, j.dept,
              j.employment, j.url, j.postedAt, j.descriptionMd, hash)
        .run();
      inserted++;
    } else {
      await d
        .prepare(
          `UPDATE jobs SET title=?, location=?, remote=?, dept=?, employment=?, url=?,
             posted_at=?, description_md=?, content_hash=?, last_seen=datetime('now'),
             closed_at=NULL
           WHERE id=?`,
        )
        .bind(j.title, j.location, j.remote ? 1 : 0, j.dept, j.employment, j.url,
              j.postedAt, j.descriptionMd, hash, id)
        .run();
      if (prior.content_hash !== hash) updated++;
    }
  }

  // Anything we hold for this company that the board no longer lists is gone.
  const held = await all<{ id: string }>(
    `SELECT id FROM jobs WHERE company_id = ? AND closed_at IS NULL`,
    companyId,
  );
  for (const h of held) {
    if (!seen.has(h.id)) {
      await run(`UPDATE jobs SET closed_at = datetime('now') WHERE id = ?`, h.id);
      closed++;
    }
  }

  return { inserted, updated, closed };
}
