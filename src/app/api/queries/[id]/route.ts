import { one, run } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const existing = await one(`SELECT id FROM queries WHERE id = ?`, id);
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | { label?: string; channel?: string; q?: string; active?: boolean }
    | null;
  if (!body) return Response.json({ error: "invalid body" }, { status: 400 });

  await run(
    `UPDATE queries SET
       label = COALESCE(?, label), channel = COALESCE(?, channel), q = COALESCE(?, q),
       active = COALESCE(?, active)
     WHERE id = ?`,
    body.label ?? null, body.channel ?? null, body.q ?? null,
    body.active === undefined ? null : body.active ? 1 : 0,
    id,
  );
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  await run(`DELETE FROM queries WHERE id = ?`, id);
  return Response.json({ ok: true });
}
