import { run } from "@/lib/db";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["saved", "applied", "dismissed", "snoozed"]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { jobId, action, note, profileId = "me" } = body as any;
  if (!jobId || !ACTIONS.has(action)) {
    return Response.json({ error: "jobId and a valid action are required" }, { status: 400 });
  }
  await run(
    `INSERT INTO feedback (job_id, profile_id, action, note) VALUES (?,?,?,?)`,
    jobId, profileId, action, note ?? null,
  );
  return Response.json({ ok: true });
}
