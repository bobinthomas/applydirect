import { one, run } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "me";
  const p = await one(`SELECT * FROM profiles WHERE id = ?`, id);
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ...p, config: JSON.parse((p as any).config_json) });
}

/**
 * Any edit bumps version, which invalidates every cached score. That is the
 * point: change what you are looking for and the whole list re-ranks.
 */
export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json()) as any;
  const id = body.id ?? "me";
  const current = await one<{ version: number }>(`SELECT version FROM profiles WHERE id = ?`, id);
  if (!current) return Response.json({ error: "not found" }, { status: 404 });
  await run(
    `UPDATE profiles SET resume_md = COALESCE(?, resume_md),
       config_json = COALESCE(?, config_json),
       version = version + 1, updated_at = datetime('now')
     WHERE id = ?`,
    body.resume_md ?? null,
    body.config ? JSON.stringify(body.config) : null,
    id,
  );
  return Response.json({ ok: true, version: current.version + 1 });
}
