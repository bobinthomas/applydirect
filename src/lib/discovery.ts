import { identify, byId } from "./ats";
import { all, env, one, run } from "./db";

/**
 * Discovery is the only part that touches a search engine, and it runs weekly
 * rather than daily. Its whole job is to turn search result URLs into board
 * tokens, which the harvester then reads for free forever after.
 */

export interface DiscoverStats {
  queries: number;
  urls: number;
  newCompanies: number;
  skipped: number;
}

async function googleCse(q: string, key: string, cx: string, pages = 2): Promise<string[]> {
  const links: string[] = [];
  for (let p = 0; p < pages; p++) {
    const url =
      `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}` +
      `&q=${encodeURIComponent(q)}&num=10&start=${p * 10 + 1}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data: any = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    links.push(...items.map((i: any) => String(i.link)));
    if (items.length < 10) break;
  }
  return links;
}

export async function discover(queryIds?: string[]): Promise<DiscoverStats> {
  const e = await env();
  const stats: DiscoverStats = { queries: 0, urls: 0, newCompanies: 0, skipped: 0 };
  if (!e.SEARCH_API_KEY || !e.SEARCH_CX) return stats;

  const rows = queryIds?.length
    ? await all<{ id: string; q: string; channel: string }>(
        `SELECT id, q, channel FROM queries WHERE id IN (${queryIds.map(() => "?").join(",")})`,
        ...queryIds,
      )
    : await all<{ id: string; q: string; channel: string }>(
        `SELECT id, q, channel FROM queries WHERE active = 1
         ORDER BY COALESCE(last_run,'1970') ASC LIMIT 8`,
      );

  for (const row of rows) {
    stats.queries++;
    let found = 0;
    const links = await googleCse(row.q, e.SEARCH_API_KEY, e.SEARCH_CX);
    stats.urls += links.length;

    for (const link of links) {
      const hit = identify(link);
      if (!hit) { stats.skipped++; continue; }
      const id = `${hit.ats}:${hit.token}`;
      const exists = await one(`SELECT id FROM companies WHERE id = ?`, id);
      if (exists) continue;
      const adapter = byId(hit.ats)!;
      await run(
        `INSERT OR IGNORE INTO companies (id, name, ats, board_token, careers_url, discovered_by)
         VALUES (?,?,?,?,?,?)`,
        id,
        prettyName(hit.token),
        hit.ats,
        hit.token,
        adapter.boardUrl(hit.token),
        `discovery:${row.channel}`,
      );
      stats.newCompanies++;
      found++;
    }
    await run(
      `UPDATE queries SET last_run = datetime('now'), found = found + ? WHERE id = ?`,
      found, row.id,
    );
  }
  return stats;
}

/** Board tokens are slugs. Good enough until the first harvest gives a real name. */
function prettyName(token: string): string {
  return token
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
