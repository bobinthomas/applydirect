const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", rsquo: "\u2019",
  lsquo: "\u2018", ldquo: "\u201c", rdquo: "\u201d", middot: "\u00b7",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/**
 * Job descriptions arrive as HTML from every board. We only need readable text
 * with the list and paragraph structure intact, so no parser dependency.
 */
export function htmlToText(input: string | null | undefined): string {
  if (!input) return "";
  let s = decodeEntities(String(input));
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|h[1-6]|tr|section)>/gi, "\n\n");
  s = s.replace(/<li[^>]*>/gi, "\n- ");
  s = s.replace(/<\/(li|ul|ol)>/gi, "\n");
  s = s.replace(/<h([1-6])[^>]*>/gi, (_, n) => "\n\n" + "#".repeat(Number(n)) + " ");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  s = s.replace(/\u00a0/g, " ");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

export function looksRemote(...bits: (string | null | undefined)[]): boolean {
  const hay = bits.filter(Boolean).join(" ").toLowerCase();
  if (/\bhybrid\b/.test(hay) && !/\bfully remote\b/.test(hay)) return false;
  return /\bremote\b|\bwork from home\b|\banywhere\b|\bdistributed\b/.test(hay);
}

export async function getJson(url: string, f: typeof fetch = fetch): Promise<any> {
  const res = await f(url, {
    headers: {
      accept: "application/json",
      "user-agent": "direct-apply/1.0 (personal job tracker)",
    },
    cf: { cacheTtl: 300, cacheEverything: true },
  } as RequestInit);
  if (!res.ok) {
    const err: any = new Error(`${res.status} ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
