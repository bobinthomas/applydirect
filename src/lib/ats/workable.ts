import type { Adapter, NormalizedJob } from "./types";
import { getJson, htmlToText, looksRemote } from "./html";

const HOST = /apply\.workable\.com\/([a-z0-9_-]+)/i;

export const workable: Adapter = {
  id: "workable",
  label: "Workable",

  matchUrl(url) {
    const m = url.match(HOST);
    if (!m) return null;
    const t = m[1].toLowerCase();
    return ["j", "api"].includes(t) ? null : t;
  },

  boardUrl: (t) => `https://apply.workable.com/${t}/`,

  async listJobs(token, f = fetch): Promise<NormalizedJob[]> {
    const data = await getJson(
      `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(token)}?details=true`,
      f,
    );
    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
    return jobs.map((j: any) => {
      const loc = [j?.location?.city, j?.location?.region, j?.location?.country]
        .filter(Boolean)
        .join(", ") || j.city || null;
      const description = [htmlToText(j.description), htmlToText(j.requirements), htmlToText(j.benefits)]
        .filter(Boolean)
        .join("\n\n");
      return {
        atsJobId: String(j.shortcode ?? j.id),
        title: String(j.title ?? "").trim(),
        location: loc,
        remote: Boolean(j?.location?.workplace === "remote" || j.telecommuting) || looksRemote(loc, j.title),
        dept: j.department ?? null,
        employment: j.employment_type ?? null,
        url: j.url ?? j.application_url ?? `${workable.boardUrl(token)}j/${j.shortcode}`,
        postedAt: j.published_on ?? j.created_at ?? null,
        descriptionMd: description,
      };
    });
  },
};
