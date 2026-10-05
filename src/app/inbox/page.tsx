import Link from "next/link";
import { all } from "@/lib/db";
import { Actions } from "@/components/Actions";

export const dynamic = "force-dynamic";

interface Row {
  id: string; title: string; company: string; location: string | null; remote: number;
  url: string; posted_at: string | null; score: number; stage: string;
  verdict: string | null; reasons_json: string | null; judged: number | null;
}

function age(iso: string | null) {
  if (!iso) return "date unknown";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (Number.isNaN(d)) return "date unknown";
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  return `${Math.floor(d / 30)} months ago`;
}

function band(score: number) {
  if (score >= 75) return "worth the effort";
  if (score >= 55) return "close";
  return "long shot";
}

export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<{ min?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const min = Number(sp.min ?? 50);
  const q = (sp.q ?? "").trim();

  const rows = await all<Row>(
    `SELECT j.id, j.title, j.location, j.remote, j.url, j.posted_at,
            c.name AS company, s.score, s.stage, s.verdict, s.reasons_json, s.judged
     FROM scores s
     JOIN jobs j ON j.id = s.job_id
     JOIN companies c ON c.id = j.company_id
     WHERE s.profile_id = 'me' AND j.closed_at IS NULL
       AND s.stage != 'filtered' AND s.score >= ?
       AND (? = '' OR j.title LIKE '%' || ? || '%' OR c.name LIKE '%' || ? || '%')
       AND NOT EXISTS (SELECT 1 FROM feedback f
                       WHERE f.job_id = j.id AND f.action IN ('dismissed','applied'))
     ORDER BY s.score DESC, j.posted_at DESC
     LIMIT 80`,
    min, q, q, q,
  );

  const counts = await all<{ stage: string; n: number }>(
    `SELECT stage, COUNT(*) n FROM scores WHERE profile_id = 'me' GROUP BY stage`,
  );
  const total = counts.reduce((a, c) => a + c.n, 0);
  const filtered = counts.find((c) => c.stage === "filtered")?.n ?? 0;

  return (
    <main className="mx-auto max-w-[980px] px-5 pb-24 pt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-[34px] font-bold leading-none tracking-[-0.03em]">Inbox</h1>
            <Link href="/settings" className="text-[13px] text-[color:var(--ink2)] hover:underline">
              Settings
            </Link>
            <Link href="/sources" className="text-[13px] text-[color:var(--ink2)] hover:underline">
              Sources
            </Link>
          </div>
          <p className="mt-2 text-[14px] text-[color:var(--ink2)]">
            {total} postings scored, {filtered} cut before they cost anything,{" "}
            {rows.length} above {min}.
          </p>
        </div>
        <form className="flex gap-2">
          <input
            name="q" defaultValue={q} placeholder="Filter by title or company"
            className="mono rounded-[2px] border border-[color:var(--rule)] bg-white px-3 py-2 text-[12.5px]"
          />
          <select
            name="min" defaultValue={String(min)}
            className="rounded-[2px] border border-[color:var(--rule)] bg-white px-2 py-2 text-[13px]"
          >
            <option value="0">Everything</option>
            <option value="50">50 and up</option>
            <option value="65">65 and up</option>
            <option value="75">75 and up</option>
          </select>
          <button className="rounded-[2px] border border-[color:var(--rule)] bg-white px-3 py-2 text-[13px]">
            Apply
          </button>
        </form>
      </header>

      {rows.length === 0 && (
        <div className="rounded-[3px] border border-[color:var(--rule)] bg-[color:var(--panel)] p-6">
          <p className="font-semibold">Nothing scored yet.</p>
          <p className="mt-1 text-[14px] text-[color:var(--ink2)]">
            Run a harvest, then a rank pass. Both are POST endpoints, or wait for the
            2am cron to do it for you.
          </p>
        </div>
      )}

      <ul className="rounded-[3px] border border-[color:var(--rule)] bg-[color:var(--panel)]">
        {rows.map((r) => {
          const reasons = r.reasons_json ? JSON.parse(r.reasons_json) : null;
          return (
            <li key={r.id} className="border-b border-[color:var(--rule)] p-4 last:border-b-0">
              <div className="flex items-start gap-4">
                <div
                  className="mono w-[52px] shrink-0 pt-0.5 text-[20px] font-medium"
                  style={{ color: r.score >= 75 ? "var(--signal)" : "var(--ink)" }}
                  title={band(r.score)}
                >
                  {Math.round(r.score)}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/job/${encodeURIComponent(r.id)}`} className="text-[15.5px] font-semibold hover:underline">
                    {r.title}
                  </Link>
                  <div className="mt-0.5 text-[13px] text-[color:var(--ink2)]">
                    {r.company} · {r.remote ? "Remote" : r.location ?? "location unspecified"} · {age(r.posted_at)}
                    {r.judged === null && " · not judged yet"}
                  </div>
                  {r.verdict && <p className="mt-2 text-[13.5px]">{r.verdict}</p>}
                  {reasons?.gaps?.length > 0 && (
                    <p className="mt-1 text-[13px] text-[color:var(--neg)]">
                      Gap: {reasons.gaps[0]}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <a
                    href={r.url} target="_blank" rel="noopener"
                    className="rounded-[2px] border border-[color:var(--signal)] bg-[color:var(--signal)] px-3 py-1.5 text-[12.5px] text-white"
                  >
                    Open posting
                  </a>
                  <Actions jobId={r.id} compact />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
