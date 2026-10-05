import Link from "next/link";
import { all, one } from "@/lib/db";
import { SourcesEditor } from "@/components/SourcesEditor";
import type { SearchParts } from "@/lib/sourceQuery";
import { EMPTY_PARTS } from "@/lib/sourceQuery";

export const dynamic = "force-dynamic";

export interface QueryRow {
  id: string; label: string; channel: string; q: string;
  active: number; last_run: string | null; found: number;
}

interface PartsRow {
  seniority: string; titles: string; must_mention: string; where_terms: string; keep_out: string;
}

const arr = (json: string | undefined): string[] => {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

async function loadParts(): Promise<SearchParts> {
  const row = await one<PartsRow>(`SELECT * FROM search_parts WHERE id = 'default'`);
  if (row) {
    return {
      seniority: arr(row.seniority), titles: arr(row.titles), mustMention: arr(row.must_mention),
      where: arr(row.where_terms), keepOut: arr(row.keep_out),
    };
  }
  const p = await one<{ config_json: string }>(`SELECT config_json FROM profiles WHERE id = 'me'`);
  if (!p) return EMPTY_PARTS;
  try {
    const cfg = JSON.parse(p.config_json);
    return {
      seniority: (cfg.seniority?.want ?? []).slice(0, 4),
      titles: (cfg.titles?.core ?? []).slice(0, 4),
      mustMention: (cfg.mustHave ?? []).slice(0, 2),
      where: (cfg.locations?.allow ?? []).slice(0, 3),
      keepOut: ["indeed", "linkedin", "glassdoor", "ziprecruiter", "dice"],
    };
  } catch {
    return EMPTY_PARTS;
  }
}

export default async function Sources() {
  const [parts, queries] = await Promise.all([
    loadParts(),
    all<QueryRow>(`SELECT * FROM queries ORDER BY channel, label`),
  ]);

  return (
    <main className="mx-auto max-w-[980px] px-5 pb-24 pt-8">
      <Link href="/inbox" className="text-[13px] text-[color:var(--ink2)] hover:underline">
        Back to inbox
      </Link>

      <header className="mt-4">
        <h1 className="text-[30px] font-bold leading-none tracking-[-0.03em]">Sources</h1>
        <p className="mt-2 text-[14px] text-[color:var(--ink2)]">
          Boolean strings the weekly discovery cron sends to Google. Compose from the parts
          below, save the ones worth keeping, and discovery turns the result URLs into
          board tokens in <span className="mono">companies</span> automatically.
        </p>
      </header>

      <SourcesEditor initialParts={parts} initialQueries={queries} />
    </main>
  );
}
