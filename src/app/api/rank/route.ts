import { rankPending } from "@/lib/rank/pipeline";
import { requireAdmin } from "@/lib/auth";
import { run } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const u = new URL(req.url);
  const profile = u.searchParams.get("profile") ?? "me";
  const budget = Number(u.searchParams.get("budget") ?? 40);
  try {
    const stats = await rankPending(profile, budget);
    await run(
      `INSERT INTO runs (kind, ended_at, ok, stats_json) VALUES ('rank', datetime('now'), 1, ?)`,
      JSON.stringify(stats),
    );
    return Response.json(stats);
  } catch (e: any) {
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
