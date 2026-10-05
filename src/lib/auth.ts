import { env } from "./db";

/** Personal tool, single operator. Put Cloudflare Access in front for anything more. */
export async function requireAdmin(req: Request): Promise<Response | null> {
  const e = await env();
  if (!e.ADMIN_TOKEN) return null; // unset locally, so dev stays frictionless
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  const cookie = req.headers.get("cookie")?.match(/da_admin=([^;]+)/)?.[1];
  if (token === e.ADMIN_TOKEN || cookie === e.ADMIN_TOKEN) return null;
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
