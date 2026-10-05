import { all, one, run } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/sourceQuery";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await all(`SELECT * FROM queries ORDER BY channel, label`);
  return Response.json({ queries: rows });
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as
    | { label?: string; channel?: string; q?: string; active?: boolean }
    | null;
  if (!body?.label || !body.channel || !body.q) {
    return Response.json({ error: "label, channel and q are required" }, { status: 400 });
  }

  let id = `${body.channel}-${slugify(body.label)}`;
  for (let n = 2; await one(`SELECT id FROM queries WHERE id = ?`, id); n++) {
    id = `${body.channel}-${slugify(body.label)}-${n}`;
  }

  await run(
    `INSERT INTO queries (id, label, channel, q, active) VALUES (?, ?, ?, ?, ?)`,
    id, body.label, body.channel, body.q, body.active === false ? 0 : 1,
  );
  return Response.json({ ok: true, id });
}
