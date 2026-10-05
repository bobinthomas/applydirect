import { MODELS } from "./config";
import type { ProfileConfig } from "./config";
import type { JobRow } from "./filters";
import { env } from "../db";

export interface Judgement {
  fit: number;            // 0..100
  verdict: string;        // one line
  matches: string[];      // evidence lifted from the posting
  gaps: string[];         // honest, not softened
  hook: string;           // opening line worth reusing in the application
  model: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    fit: { type: "number" },
    verdict: { type: "string" },
    matches: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    hook: { type: "string" },
  },
  required: ["fit", "verdict", "matches", "gaps", "hook"],
} as const;

const SYSTEM = `You screen job postings for one candidate. You are blunt and specific.
Rules:
- Score fit 0-100. Reserve 80+ for postings the candidate could apply to today with a real chance.
- matches must quote or closely paraphrase requirements the candidate demonstrably meets.
- gaps must be real. Never pad this list to look balanced, and never hide a serious gap.
- hook is one sentence the candidate could open an application with, referencing something specific in this posting.
- If the posting is vague, an agency repost, or clearly a different discipline, score it under 30 and say so.
Return JSON only.`;

function userPrompt(job: JobRow & { company_name?: string }, resume: string, cfg: ProfileConfig, dismissed: string[]) {
  return [
    `CANDIDATE PROFILE`,
    resume.slice(0, 4000),
    ``,
    `TARGET TITLES: ${cfg.titles.core.join(", ")}`,
    `DEALBREAKERS: ${cfg.dealbreakers.join(", ") || "none"}`,
    dismissed.length ? `RECENTLY DISMISSED BY THE CANDIDATE: ${dismissed.slice(0, 8).join(" | ")}` : "",
    ``,
    `POSTING`,
    `Company: ${job.company_name ?? "unknown"}`,
    `Title: ${job.title}`,
    `Location: ${job.location ?? "unspecified"}${job.remote ? " (remote)" : ""}`,
    `Posted: ${job.posted_at ?? "unknown"}`,
    ``,
    job.description_md.slice(0, 7000),
  ].filter(Boolean).join("\n");
}

export async function judge(
  job: JobRow & { company_name?: string },
  resume: string,
  cfg: ProfileConfig,
  dismissed: string[] = [],
): Promise<Judgement | null> {
  const e = await env();
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userPrompt(job, resume, cfg, dismissed) },
  ];

  for (const model of [MODELS.judge, MODELS.judgeFallback]) {
    try {
      const res: any = await e.AI.run(model as any, {
        messages,
        max_tokens: 700,
        temperature: 0.2,
        response_format: { type: "json_schema", json_schema: SCHEMA },
      });
      const parsed = coerce(res);
      if (parsed) return { ...parsed, model };
    } catch {
      // fall through to the next model
    }
  }
  return null;
}

function coerce(res: any): Omit<Judgement, "model"> | null {
  let raw = res?.response ?? res?.result?.response ?? res;
  if (typeof raw === "object" && raw && "fit" in raw) return normalize(raw);
  if (typeof raw !== "string") return null;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1];
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return normalize(JSON.parse(raw.slice(start, end + 1)));
  } catch {
    return null;
  }
}

function normalize(o: any): Omit<Judgement, "model"> {
  const arr = (v: any) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 6) : []);
  return {
    fit: Math.max(0, Math.min(100, Number(o.fit) || 0)),
    verdict: String(o.verdict ?? "").slice(0, 300),
    matches: arr(o.matches),
    gaps: arr(o.gaps),
    hook: String(o.hook ?? "").slice(0, 400),
  };
}
