"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileConfig } from "@/lib/rank/config";

const lines = (s: string) =>
  s.split("\n").map((x) => x.trim()).filter(Boolean);

const field = "mono w-full rounded-[2px] border border-[color:var(--rule)] bg-white px-3 py-2 text-[13px]";
const label = "text-[12.5px] font-semibold text-[color:var(--ink2)]";

export function ProfileForm({ resumeMd, config }: { resumeMd: string; config: ProfileConfig }) {
  const router = useRouter();
  const [resume, setResume] = useState(resumeMd);
  const [titlesCore, setTitlesCore] = useState(config.titles.core.join("\n"));
  const [titlesAdjacent, setTitlesAdjacent] = useState(config.titles.adjacent.join("\n"));
  const [titlesExclude, setTitlesExclude] = useState(config.titles.exclude.join("\n"));
  const [seniorityWant, setSeniorityWant] = useState(config.seniority.want.join("\n"));
  const [seniorityReject, setSeniorityReject] = useState(config.seniority.reject.join("\n"));
  const [mustHave, setMustHave] = useState(config.mustHave.join("\n"));
  const [niceToHave, setNiceToHave] = useState(config.niceToHave.join("\n"));
  const [dealbreakers, setDealbreakers] = useState(config.dealbreakers.join("\n"));
  const [locationsAllow, setLocationsAllow] = useState(config.locations.allow.join("\n"));
  const [remoteOk, setRemoteOk] = useState(config.locations.remoteOk);
  const [weights, setWeights] = useState(config.weights);
  const [judgeTopN, setJudgeTopN] = useState(config.judgeTopN);
  const [semanticTopN, setSemanticTopN] = useState(config.semanticTopN);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setWeight = (k: keyof ProfileConfig["weights"]) => (v: string) =>
    setWeights((w) => ({ ...w, [k]: Number(v) }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(null);
    const nextConfig: ProfileConfig = {
      titles: { core: lines(titlesCore), adjacent: lines(titlesAdjacent), exclude: lines(titlesExclude) },
      seniority: { want: lines(seniorityWant), reject: lines(seniorityReject) },
      mustHave: lines(mustHave),
      niceToHave: lines(niceToHave),
      dealbreakers: lines(dealbreakers),
      locations: { allow: lines(locationsAllow), remoteOk },
      weights,
      judgeTopN,
      semanticTopN,
    };
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "me", resume_md: resume, config: nextConfig }),
      });
      const body: any = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `save failed (${res.status})`);
      setSaved(body.version);
      router.refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-7 space-y-7">
      <section>
        <label className={label}>Resume / profile summary</label>
        <textarea
          className={field + " mt-1.5"} rows={10}
          value={resume} onChange={(e) => setResume(e.target.value)}
        />
      </section>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label className={label}>Core titles (one per line, exact match wins)</label>
          <textarea className={field + " mt-1.5"} rows={8} value={titlesCore} onChange={(e) => setTitlesCore(e.target.value)} />
        </div>
        <div>
          <label className={label}>Adjacent titles</label>
          <textarea className={field + " mt-1.5"} rows={8} value={titlesAdjacent} onChange={(e) => setTitlesAdjacent(e.target.value)} />
        </div>
        <div>
          <label className={label}>Excluded titles (hard filter)</label>
          <textarea className={field + " mt-1.5"} rows={8} value={titlesExclude} onChange={(e) => setTitlesExclude(e.target.value)} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={label}>Seniority wanted</label>
          <textarea className={field + " mt-1.5"} rows={5} value={seniorityWant} onChange={(e) => setSeniorityWant(e.target.value)} />
        </div>
        <div>
          <label className={label}>Seniority rejected (hard filter)</label>
          <textarea className={field + " mt-1.5"} rows={5} value={seniorityReject} onChange={(e) => setSeniorityReject(e.target.value)} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label className={label}>Must-have keywords</label>
          <textarea className={field + " mt-1.5"} rows={8} value={mustHave} onChange={(e) => setMustHave(e.target.value)} />
        </div>
        <div>
          <label className={label}>Nice-to-have keywords</label>
          <textarea className={field + " mt-1.5"} rows={8} value={niceToHave} onChange={(e) => setNiceToHave(e.target.value)} />
        </div>
        <div>
          <label className={label}>Dealbreakers (hard filter)</label>
          <textarea className={field + " mt-1.5"} rows={8} value={dealbreakers} onChange={(e) => setDealbreakers(e.target.value)} />
        </div>
      </section>

      <section>
        <label className={label}>Allowed locations (remote jobs skip this check)</label>
        <textarea className={field + " mt-1.5"} rows={4} value={locationsAllow} onChange={(e) => setLocationsAllow(e.target.value)} />
        <label className="mt-2 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={remoteOk} onChange={(e) => setRemoteOk(e.target.checked)} />
          Remote postings are OK
        </label>
      </section>

      <section>
        <label className={label}>Weights</label>
        <div className="mt-1.5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(Object.keys(weights) as Array<keyof typeof weights>).map((k) => (
            <div key={k}>
              <span className="mono text-[11.5px] text-[color:var(--ink2)]">{k}</span>
              <input
                type="number" step="0.01" className={field + " mt-1"}
                value={weights[k]} onChange={(e) => setWeight(k)(e.target.value)}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-[color:var(--ink2)]">
          title/keywords/seniority/recency blend into the lexical pass. semantic and judge are
          how much each later pass overrides the score before it.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:w-1/2">
        <div>
          <span className="mono text-[11.5px] text-[color:var(--ink2)]">semanticTopN</span>
          <input
            type="number" className={field + " mt-1"}
            value={semanticTopN} onChange={(e) => setSemanticTopN(Number(e.target.value))}
          />
        </div>
        <div>
          <span className="mono text-[11.5px] text-[color:var(--ink2)]">judgeTopN</span>
          <input
            type="number" className={field + " mt-1"}
            value={judgeTopN} onChange={(e) => setJudgeTopN(Number(e.target.value))}
          />
        </div>
      </section>

      <div className="flex items-center gap-3 border-t border-[color:var(--rule)] pt-5">
        <button
          onClick={save} disabled={saving}
          className="rounded-[2px] border border-[color:var(--signal)] bg-[color:var(--signal)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save and re-rank"}
        </button>
        {saved !== null && (
          <span className="text-[13px] text-[color:var(--ink2)]">
            Saved as v{saved}. Every cached score is now stale — run a rank pass to re-score.
          </span>
        )}
        {error && <span className="text-[13px] text-[color:var(--neg)]">{error}</span>}
      </div>
    </div>
  );
}
