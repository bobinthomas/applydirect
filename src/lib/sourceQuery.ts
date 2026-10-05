export interface SearchParts {
  seniority: string[];
  titles: string[];
  mustMention: string[];
  where: string[];
  keepOut: string[];
}

export interface ChannelDef {
  id: string;
  label: string;
  hint: string;
  site: string;
  useKeepOut?: boolean;
}

/** Only channels the harvester can actually read from, plus one generic lead channel. */
export const CHANNELS: ChannelDef[] = [
  { id: "greenhouse", label: "Greenhouse", hint: "boards + job-boards", site: "(site:job-boards.greenhouse.io OR site:boards.greenhouse.io)" },
  { id: "lever", label: "Lever", hint: "jobs.lever.co", site: "(site:jobs.lever.co OR site:jobs.eu.lever.co)" },
  { id: "ashby", label: "Ashby", hint: "jobs.ashbyhq.com", site: "site:jobs.ashbyhq.com" },
  { id: "workable", label: "Workable", hint: "apply.workable.com", site: "site:apply.workable.com" },
  { id: "smartrecruiters", label: "SmartRecruiters", hint: "jobs.smartrecruiters.com", site: "site:jobs.smartrecruiters.com" },
  {
    id: "careers", label: "Careers pages", hint: "leads only, not harvested",
    site: 'inurl:careers ("apply now" OR "open positions")', useKeepOut: true,
  },
];

export const byChannelId = (id: string) => CHANNELS.find((c) => c.id === id);

function group(items: string[]): string {
  const quoted = items.map((t) => t.trim()).filter(Boolean).map((t) => `"${t}"`);
  if (!quoted.length) return "";
  if (quoted.length === 1) return quoted[0];
  return `(${quoted.join(" OR ")})`;
}

/** Pure. Same function runs client-side for live preview and server-side for defaults. */
export function compileQuery(channel: ChannelDef, parts: SearchParts): string {
  const must = parts.mustMention.map((t) => t.trim()).filter(Boolean).map((t) => `"${t}"`).join(" ");
  const bits = [channel.site, group(parts.seniority), group(parts.titles), must, group(parts.where)];
  if (channel.useKeepOut) {
    bits.push(parts.keepOut.map((s) => s.trim()).filter(Boolean).map((s) => `-${s}`).join(" "));
  }
  return bits.filter(Boolean).join(" ");
}

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "query";
}

export const EMPTY_PARTS: SearchParts = { seniority: [], titles: [], mustMention: [], where: [], keepOut: [] };
