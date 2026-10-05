import { all } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const profileId = u.searchParams.get("profile") ?? "me";
  const min = Number(u.searchParams.get("min") ?? 45);
  const limit = Math.min(Number(u.searchParams.get("limit") ?? 50), 200);
  const q = (u.searchParams.get("q") ?? "").trim();

  const rows = await all(
    `SELECT j.id, j.title, j.location, j.remote, j.url, j.posted_at, j.dept,
            c.name AS company, c.ats,
            s.score, s.stage, s.verdict, s.reasons_json, s.judged, s.lexical, s.semantic
     FROM scores s
     JOIN jobs j ON j.id = s.job_id
     JOIN companies c ON c.id = j.company_id
     WHERE s.profile_id = ?
       AND j.closed_at IS NULL
       AND s.score >= ?
       AND s.stage != 'filtered'
       AND (? = '' OR j.title LIKE '%' || ? || '%' OR c.name LIKE '%' || ? || '%')
       AND NOT EXISTS (
         SELECT 1 FROM feedback f
         WHERE f.job_id = j.id AND f.profile_id = s.profile_id AND f.action = 'dismissed'
       )
     ORDER BY s.score DESC, j.posted_at DESC
     LIMIT ?`,
    profileId, min, q, q, q, limit,
  );

  return Response.json({
    count: rows.length,
    jobs: rows.map((r: any) => ({ ...r, reasons: r.reasons_json ? JSON.parse(r.reasons_json) : null })),
  });
}
