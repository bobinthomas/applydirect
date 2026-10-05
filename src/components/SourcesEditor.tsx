"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CHANNELS, byChannelId, compileQuery } from "@/lib/sourceQuery";
import type { SearchParts } from "@/lib/sourceQuery";
import type { QueryRow } from "@/app/sources/page";

const field = "mono w-full rounded-[2px] border border-[color:var(--rule)] bg-white px-2.5 py-1.5 text-[12.5px]";
const label = "text-[12.5px] font-semibold text-[color:var(--ink2)]";

function ChipList({
  items, onChange, placeholder,
}: { items: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="rounded-[2px] border border-[color:var(--rule)] bg-white p-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span key={it} className="mono flex items-center gap-1 rounded-[2px] bg-[color:var(--sunk)] px-2 py-0.5 text-[12px]">
            {it}
            <button onClick={() => onChange(items.filter((x) => x !== it))} className="text-[color:var(--ink2)] hover:text-[color:var(--neg)]" aria-label={`remove ${it}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="mono mt-1.5 w-full border-0 p-0.5 text-[12.5px] outline-none"
        placeholder={placeholder} value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
      />
    </div>
  );
}

export function SourcesEditor({
  initialParts, initialQueries,
}: { initialParts: SearchParts; initialQueries: QueryRow[] }) {
  const router = useRouter();
  const [parts, setParts] = useState(initialParts);
  const [queries, setQueries] = useState(initialQueries);
  const [channelId, setChannelId] = useState(CHANNELS[0].id);
  const [engine, setEngine] = useState<"google" | "duckduckgo">("google");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const channel = byChannelId(channelId)!;
  const preview = useMemo(() => compileQuery(channel, parts), [channel, parts]);

  const searchUrl = (q: string) =>
    engine === "google"
      ? `https://www.google.com/search?q=${encodeURIComponent(q)}`
      : `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;

  const savePartsToServer = async (next: SearchParts) => {
    setParts(next);
    await fetch("/api/parts", {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next),
    });
  };

  const addSource = async () => {
    setBusy("add");
    setMsg(null);
    try {
      const res = await fetch("/api/queries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: `${channel.label} search`, channel: channel.id, q: preview, active: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "failed to save");
      setQueries((qs) => [...qs, { id: body.id, label: `${channel.label} search`, channel: channel.id, q: preview, active: 1, last_run: null, found: 0 }]);
      setMsg(`Saved as a discovery source. It runs on the weekly cron, or POST /api/discover now.`);
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const updateQuery = (id: string, patch: Partial<QueryRow>) =>
    setQueries((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const saveQuery = async (row: QueryRow) => {
    setBusy(row.id);
    try {
      await fetch(`/api/queries/${encodeURIComponent(row.id)}`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: row.label, channel: row.channel, q: row.q, active: !!row.active }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const deleteQuery = async (id: string) => {
    setBusy(id);
    try {
      await fetch(`/api/queries/${encodeURIComponent(id)}`, { method: "DELETE" });
      setQueries((qs) => qs.filter((q) => q.id !== id));
    } finally {
      setBusy(null);
    }
  };

  const runDiscoveryNow = async (queryIds?: string[]) => {
    setBusy("discover");
    setMsg(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(queryIds ? { queryIds } : {}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "discovery failed");
      setMsg(
        body.queries === 0
          ? "Ran, but SEARCH_API_KEY / SEARCH_CX aren't set, so it did nothing."
          : `Ran ${body.queries} quer${body.queries === 1 ? "y" : "ies"}, found ${body.urls} URLs, added ${body.newCompanies} companies.`,
      );
      router.refresh();
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-7 space-y-8">
      <section className="rounded-[3px] border border-[color:var(--rule)] bg-[color:var(--panel)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold">Compose</h2>
          <div className="flex items-center gap-2 text-[12.5px]">
            <button
              onClick={() => setEngine("google")}
              className={"rounded-[2px] border border-[color:var(--rule)] px-2 py-1 " + (engine === "google" ? "bg-[color:var(--ink)] text-white" : "bg-white")}
            >
              Google
            </button>
            <button
              onClick={() => setEngine("duckduckgo")}
              className={"rounded-[2px] border border-[color:var(--rule)] px-2 py-1 " + (engine === "duckduckgo" ? "bg-[color:var(--ink)] text-white" : "bg-white")}
            >
              DuckDuckGo
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Seniority (any of these)</label>
            <div className="mt-1.5">
              <ChipList items={parts.seniority} onChange={(v) => savePartsToServer({ ...parts, seniority: v })} placeholder="Add a level, press Enter" />
            </div>
          </div>
          <div>
            <label className={label}>Role titles (any of these)</label>
            <div className="mt-1.5">
              <ChipList items={parts.titles} onChange={(v) => savePartsToServer({ ...parts, titles: v })} placeholder="Add a title, press Enter" />
            </div>
          </div>
          <div>
            <label className={label}>Must mention (all of these)</label>
            <div className="mt-1.5">
              <ChipList items={parts.mustMention} onChange={(v) => savePartsToServer({ ...parts, mustMention: v })} placeholder="Add a keyword, press Enter" />
            </div>
          </div>
          <div>
            <label className={label}>Where (any of these)</label>
            <div className="mt-1.5">
              <ChipList items={parts.where} onChange={(v) => savePartsToServer({ ...parts, where: v })} placeholder="Remote, Bengaluru…" />
            </div>
          </div>
        </div>

        {channel.useKeepOut && (
          <div className="mt-4">
            <label className={label}>Keep out (none of these — this channel only)</label>
            <div className="mt-1.5">
              <ChipList items={parts.keepOut} onChange={(v) => savePartsToServer({ ...parts, keepOut: v })} placeholder="Add a site to drop" />
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-[color:var(--rule)] pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c.id} onClick={() => setChannelId(c.id)}
                className={"rounded-[2px] border border-[color:var(--rule)] px-2.5 py-1 text-[12.5px] " + (c.id === channelId ? "bg-[color:var(--ink)] text-white" : "bg-white")}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="mono mt-3 rounded-[2px] border border-[color:var(--rule)] bg-white p-3 text-[12.5px] leading-relaxed">
            {preview || <span className="text-[color:var(--ink2)]">Add some parts above to build a query.</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={preview ? searchUrl(preview) : undefined} target="_blank" rel="noopener"
              className={"rounded-[2px] border border-[color:var(--rule)] bg-white px-3 py-1.5 text-[12.5px] " + (!preview ? "pointer-events-none opacity-50" : "")}
            >
              Search
            </a>
            <button
              onClick={() => preview && navigator.clipboard?.writeText(preview)}
              disabled={!preview}
              className="rounded-[2px] border border-[color:var(--rule)] bg-white px-3 py-1.5 text-[12.5px] disabled:opacity-50"
            >
              Copy
            </button>
            <button
              onClick={addSource} disabled={!preview || busy === "add"}
              className="rounded-[2px] border border-[color:var(--signal)] bg-[color:var(--signal)] px-3 py-1.5 text-[12.5px] text-white disabled:opacity-50"
            >
              {busy === "add" ? "Saving…" : "Save as a discovery source"}
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold">Saved sources</h2>
          <button
            onClick={() => runDiscoveryNow()} disabled={busy === "discover"}
            className="rounded-[2px] border border-[color:var(--rule)] bg-white px-3 py-1.5 text-[12.5px] disabled:opacity-50"
          >
            {busy === "discover" ? "Running…" : "Run discovery now"}
          </button>
        </div>
        {msg && <p className="mt-2 text-[13px] text-[color:var(--ink2)]">{msg}</p>}

        <ul className="mt-3 rounded-[3px] border border-[color:var(--rule)] bg-[color:var(--panel)]">
          {queries.length === 0 && (
            <li className="p-4 text-[13.5px] text-[color:var(--ink2)]">
              Nothing saved yet. Compose one above.
            </li>
          )}
          {queries.map((row) => (
            <li key={row.id} className="border-b border-[color:var(--rule)] p-4 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    className={field + " w-auto min-w-[160px] font-semibold"}
                    value={row.label} onChange={(e) => updateQuery(row.id, { label: e.target.value })}
                  />
                  <span className="mono text-[11px] text-[color:var(--ink2)]">{row.channel}</span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-[color:var(--ink2)]">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={!!row.active} onChange={(e) => updateQuery(row.id, { active: e.target.checked ? 1 : 0 })} />
                    active
                  </label>
                  <span>{row.found} found{row.last_run ? ` · last run ${row.last_run}` : " · never run"}</span>
                </div>
              </div>
              <textarea
                className={field + " mt-2"} rows={2}
                value={row.q} onChange={(e) => updateQuery(row.id, { q: e.target.value })}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={searchUrl(row.q)} target="_blank" rel="noopener" className="rounded-[2px] border border-[color:var(--rule)] bg-white px-2.5 py-1 text-[12px]">
                  Search
                </a>
                <button onClick={() => navigator.clipboard?.writeText(row.q)} className="rounded-[2px] border border-[color:var(--rule)] bg-white px-2.5 py-1 text-[12px]">
                  Copy
                </button>
                <button onClick={() => runDiscoveryNow([row.id])} disabled={busy === "discover"} className="rounded-[2px] border border-[color:var(--rule)] bg-white px-2.5 py-1 text-[12px] disabled:opacity-50">
                  Run this one
                </button>
                <button onClick={() => saveQuery(row)} disabled={busy === row.id} className="rounded-[2px] border border-[color:var(--signal)] bg-[color:var(--signal)] px-2.5 py-1 text-[12px] text-white disabled:opacity-50">
                  Save
                </button>
                <button onClick={() => deleteQuery(row.id)} disabled={busy === row.id} className="rounded-[2px] border border-[color:var(--rule)] bg-white px-2.5 py-1 text-[12px] text-[color:var(--neg)] disabled:opacity-50">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
