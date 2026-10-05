import type { Adapter, NormalizedJob } from "./types";
import { getJson, htmlToText, looksRemote } from "./html";

const HOST = /jobs\.ashbyhq\.com\/([a-zA-Z0-9._-]+)/;

export const ashby: Adapter = {
  id: "ashby",
  label: "Ashby",

  matchUrl(url) {
    const m = url.match(HOST);
    if (!m) return null;
    const t = m[1];
    return ["embed", "api"].includes(t.toLowerCase()) ? null : t;
  },

  boardUrl: (t) => `https://jobs.ashbyhq.com/${t}`,

  async listJobs(token, f = fetch): Promise<NormalizedJob[]> {
    const data = await getJson(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`,
      f,
    );
    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
    return jobs.map((j: any) => {
      const description = j.descriptionPlain ?? htmlToText(j.descriptionHtml);
      return {
        atsJobId: String(j.id),
        title: String(j.title ?? "").trim(),
        location: j.location ?? j?.address?.postalAddress?.addressLocality ?? null,
        remote: Boolean(j.isRemote) || looksRemote(j.location, j.title),
        dept: j.department ?? j.team ?? null,
        employment: j.employmentType ?? null,
        url: j.jobUrl ?? j.applyUrl ?? `${ashby.boardUrl(token)}/${j.id}`,
        postedAt: j.publishedAt ?? j.updatedAt ?? null,
        descriptionMd: description,
      };
    });
  },
};
