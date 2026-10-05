import type { Adapter, NormalizedJob } from "./types";
import { getJson, htmlToText, looksRemote } from "./html";

const HOST = /jobs\.smartrecruiters\.com\/([a-zA-Z0-9._-]+)/;

/**
 * SmartRecruiters is the one board that does not give descriptions in the list
 * response, so we fetch detail per posting. Kept to a small concurrency and
 * only for postings the caller has not already stored.
 */
export const smartrecruiters: Adapter = {
  id: "smartrecruiters",
  label: "SmartRecruiters",

  matchUrl(url) {
    const m = url.match(HOST);
    if (!m) return null;
    const t = m[1];
    return ["oneclick-ui", "api"].includes(t.toLowerCase()) ? null : t;
  },

  boardUrl: (t) => `https://jobs.smartrecruiters.com/${t}`,

  async listJobs(token, f = fetch): Promise<NormalizedJob[]> {
    const list = await getJson(
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(token)}/postings?limit=100`,
      f,
    );
    const items = Array.isArray(list?.content) ? list.content : [];
    const out: NormalizedJob[] = [];

    for (const j of items) {
      const loc = [j?.location?.city, j?.location?.country].filter(Boolean).join(", ") || null;
      let description = "";
      try {
        const d = await getJson(
          `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(token)}/postings/${j.id}`,
          f,
        );
        const s = d?.jobAd?.sections ?? {};
        description = [s?.jobDescription?.text, s?.qualifications?.text, s?.additionalInformation?.text]
          .map(htmlToText)
          .filter(Boolean)
          .join("\n\n");
      } catch {
        description = String(j.name ?? "");
      }
      out.push({
        atsJobId: String(j.id),
        title: String(j.name ?? "").trim(),
        location: loc,
        remote: Boolean(j?.location?.remote) || looksRemote(loc, j.name),
        dept: j?.department?.label ?? j?.function?.label ?? null,
        employment: j?.typeOfEmployment?.label ?? null,
        url: j.ref ? `${smartrecruiters.boardUrl(token)}/${j.id}` : `${smartrecruiters.boardUrl(token)}/${j.id}`,
        postedAt: j.releasedDate ?? j.createdOn ?? null,
        descriptionMd: description,
      });
    }
    return out;
  },
};
