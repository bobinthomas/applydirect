import { harvestAll } from "@/lib/harvest";
import { requireAdmin } from "@/lib/auth";
import { run } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 120);
  try {
    const stats = await harvestAll(limit);
    await run(
      `INSERT INTO runs (kind, ended_at, ok, stats_json) VALUES ('harvest', datetime('now'), 1, ?)`,
      JSON.stringify(stats),
    );
    return Response.json(stats);
  } catch (e: any) {
    await run(
      `INSERT INTO runs (kind, ended_at, ok, error) VALUES ('harvest', datetime('now'), 0, ?)`,
      String(e?.message ?? e),
    );
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
