import { discover } from "@/lib/discovery";
import { requireAdmin } from "@/lib/auth";
import { run } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    const stats = await discover((body as any)?.queryIds);
    await run(
      `INSERT INTO runs (kind, ended_at, ok, stats_json) VALUES ('discover', datetime('now'), 1, ?)`,
      JSON.stringify(stats),
    );
    return Response.json(stats);
  } catch (e: any) {
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
