import Link from "next/link";
import { notFound } from "next/navigation";
import { one } from "@/lib/db";
import { Actions } from "@/components/Actions";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await one<any>(
    `SELECT j.*, c.name AS company, c.ats, c.careers_url,
            s.score, s.stage, s.verdict, s.reasons_json, s.lexical, s.semantic, s.judged, s.model
     FROM jobs j
     JOIN companies c ON c.id = j.company_id
     LEFT JOIN scores s ON s.job_id = j.id AND s.profile_id = 'me'
     WHERE j.id = ?`,
    decodeURIComponent(id),
  );
  if (!job) notFound();
  const reasons = job.reasons_json ? JSON.parse(job.reasons_json) : null;

  return (
    <main className="mx-auto max-w-[820px] px-5 pb-24 pt-8">
      <Link href="/inbox" className="text-[13px] text-[color:var(--ink2)] hover:underline">
        Back to inbox
      </Link>

      <h1 className="mt-4 text-[30px] font-bold leading-[1.1] tracking-[-0.02em]">{job.title}</h1>
      <p className="mt-2 text-[14px] text-[color:var(--ink2)]">
        {job.company} · {job.remote ? "Remote" : job.location ?? "location unspecified"}
        {job.dept ? ` · ${job.dept}` : ""} · via {job.ats}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a
          href={job.url} target="_blank" rel="noopener"
          className="rounded-[2px] border border-[color:var(--signal)] bg-[color:var(--signal)] px-4 py-2 text-[14px] font-medium text-white"
        >
          Open the application form
        </a>
        <Actions jobId={job.id} />
      </div>

      {job.score != null && (
        <section className="mt-7 rounded-[3px] border border-[color:var(--rule)] bg-[color:var(--panel)] p-5">
          <div className="flex items-baseline gap-4">
            <span className="mono text-[32px] font-medium" style={{ color: "var(--signal)" }}>
              {Math.round(job.score)}
            </span>
            <span className="text-[14px]">{job.verdict}</span>
          </div>
          <p className="mono mt-3 text-[12px] text-[color:var(--ink2)]">
            lexical {job.lexical?.toFixed?.(1) ?? "-"} · semantic{" "}
            {job.semantic != null ? job.semantic.toFixed(3) : "-"} · judge {job.judged ?? "-"}
            {job.model ? ` · ${job.model}` : ""}
          </p>

          {reasons?.matches?.length > 0 && (
            <div className="mt-4">
              <h2 className="text-[13.5px] font-semibold">What lines up</h2>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13.5px]">
                {reasons.matches.map((m: string, i: number) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          {reasons?.gaps?.length > 0 && (
            <div className="mt-4">
              <h2 className="text-[13.5px] font-semibold text-[color:var(--neg)]">What does not</h2>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13.5px]">
                {reasons.gaps.map((g: string, i: number) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}
          {reasons?.hook && (
            <div className="mt-4">
              <h2 className="text-[13.5px] font-semibold">Opening line to steal</h2>
              <p className="mt-1.5 border-l-2 border-[color:var(--signal)] pl-3 text-[13.5px] italic">
                {reasons.hook}
              </p>
            </div>
          )}
        </section>
      )}

      <article className="mt-8 whitespace-pre-wrap text-[14.5px] leading-[1.65]">
        {job.description_md}
      </article>
    </main>
  );
}
