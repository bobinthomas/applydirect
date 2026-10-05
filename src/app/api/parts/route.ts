import { one, run } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { SearchParts } from "@/lib/sourceQuery";
import { EMPTY_PARTS } from "@/lib/sourceQuery";

export const dynamic = "force-dynamic";

interface Row {
  seniority: string; titles: string; must_mention: string; where_terms: string; keep_out: string;
}

const arr = (json: string | undefined): string[] => {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** No saved parts yet: suggest a starting point pulled from the ranking profile. */
async function defaultsFromProfile(): Promise<SearchParts> {
  const p = await one<{ config_json: string }>(`SELECT config_json FROM profiles WHERE id = 'me'`);
  if (!p) return EMPTY_PARTS;
  try {
    const cfg = JSON.parse(p.config_json);
    return {
      seniority: (cfg.seniority?.want ?? []).slice(0, 4),
      titles: (cfg.titles?.core ?? []).slice(0, 4),
      mustMention: (cfg.mustHave ?? []).slice(0, 2),
      where: (cfg.locations?.allow ?? []).slice(0, 3),
      keepOut: ["indeed", "linkedin", "glassdoor", "ziprecruiter", "dice"],
    };
  } catch {
    return EMPTY_PARTS;
  }
}

export async function GET() {
  const row = await one<Row>(`SELECT * FROM search_parts WHERE id = 'default'`);
  if (!row) return Response.json(await defaultsFromProfile());
  return Response.json({
    seniority: arr(row.seniority),
    titles: arr(row.titles),
    mustMention: arr(row.must_mention),
    where: arr(row.where_terms),
    keepOut: arr(row.keep_out),
  } satisfies SearchParts);
}

export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Partial<SearchParts> | null;
  if (!body) return Response.json({ error: "invalid body" }, { status: 400 });
  const p: SearchParts = {
    seniority: Array.isArray(body.seniority) ? body.seniority : [],
    titles: Array.isArray(body.titles) ? body.titles : [],
    mustMention: Array.isArray(body.mustMention) ? body.mustMention : [],
    where: Array.isArray(body.where) ? body.where : [],
    keepOut: Array.isArray(body.keepOut) ? body.keepOut : [],
  };
  await run(
    `INSERT INTO search_parts (id, seniority, titles, must_mention, where_terms, keep_out, updated_at)
     VALUES ('default', ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       seniority = excluded.seniority, titles = excluded.titles,
       must_mention = excluded.must_mention, where_terms = excluded.where_terms,
       keep_out = excluded.keep_out, updated_at = datetime('now')`,
    JSON.stringify(p.seniority), JSON.stringify(p.titles), JSON.stringify(p.mustMention),
    JSON.stringify(p.where), JSON.stringify(p.keepOut),
  );
  return Response.json({ ok: true });
}
