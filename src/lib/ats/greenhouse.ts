import type { Adapter, NormalizedJob } from "./types";
import { getJson, htmlToText, looksRemote } from "./html";

// Greenhouse moved boards to job-boards.greenhouse.io. Both hostnames still
// resolve to the same board token, and the API host stayed put.
const HOSTS = /(?:job-boards|boards)\.greenhouse\.io\/([a-z0-9_-]+)/i;
const EMBED = /boards\.greenhouse\.io\/embed\/job_board\?for=([a-z0-9_-]+)/i;

export const greenhouse: Adapter = {
  id: "greenhouse",
  label: "Greenhouse",

  matchUrl(url) {
    const e = url.match(EMBED);
    if (e) return e[1].toLowerCase();
    const m = url.match(HOSTS);
    if (!m) return null;
    const token = m[1].toLowerCase();
    if (["embed", "jobs", "api"].includes(token)) return null;
    return token;
  },

  boardUrl: (t) => `https://job-boards.greenhouse.io/${t}`,

  async listJobs(token, f = fetch): Promise<NormalizedJob[]> {
    const data = await getJson(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`,
      f,
    );
    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
    return jobs.map((j: any) => {
      const location = j?.location?.name ?? null;
      const dept = j?.departments?.[0]?.name ?? null;
      const description = htmlToText(j?.content);
      return {
        atsJobId: String(j.id),
        title: String(j.title ?? "").trim(),
        location,
        remote: looksRemote(location, j?.title, description.slice(0, 800)),
        dept,
        employment: null,
        url: j.absolute_url ?? `${greenhouse.boardUrl(token)}/jobs/${j.id}`,
        postedAt: j.first_published ?? j.updated_at ?? null,
        descriptionMd: description,
      };
    });
  },
};
