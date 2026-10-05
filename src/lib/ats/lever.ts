import type { Adapter, NormalizedJob } from "./types";
import { getJson, htmlToText, looksRemote } from "./html";

const HOST = /jobs\.(?:eu\.)?lever\.co\/([a-z0-9_-]+)/i;

export const lever: Adapter = {
  id: "lever",
  label: "Lever",

  matchUrl(url) {
    const m = url.match(HOST);
    return m ? m[1].toLowerCase() : null;
  },

  boardUrl: (t) => `https://jobs.lever.co/${t}`,

  async listJobs(token, f = fetch): Promise<NormalizedJob[]> {
    const data = await getJson(
      `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`,
      f,
    );
    const jobs = Array.isArray(data) ? data : [];
    return jobs.map((j: any) => {
      const cat = j?.categories ?? {};
      // Lever splits the body across descriptionPlain plus a lists array.
      const body = [
        j.descriptionPlain ?? htmlToText(j.description),
        ...(Array.isArray(j.lists)
          ? j.lists.map((l: any) => `\n## ${l.text}\n${htmlToText(l.content)}`)
          : []),
        j.additionalPlain ?? htmlToText(j.additional),
      ]
        .filter(Boolean)
        .join("\n\n");
      return {
        atsJobId: String(j.id),
        title: String(j.text ?? "").trim(),
        location: cat.location ?? null,
        remote: looksRemote(cat.location, cat.workplaceType, j.workplaceType, j.text),
        dept: cat.team ?? cat.department ?? null,
        employment: cat.commitment ?? null,
        url: j.hostedUrl ?? j.applyUrl ?? `${lever.boardUrl(token)}/${j.id}`,
        postedAt: j.createdAt ? new Date(Number(j.createdAt)).toISOString() : null,
        descriptionMd: body,
      };
    });
  },
};
