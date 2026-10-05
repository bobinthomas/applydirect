import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface Env {
  DB: D1Database;
  AI: Ai;
  SEARCH_API_KEY?: string;
  SEARCH_CX?: string;
  DIGEST_TO?: string;
  RESEND_API_KEY?: string;
  ADMIN_TOKEN?: string;
}

export async function env(): Promise<Env> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as Env;
}

export async function db(): Promise<D1Database> {
  return (await env()).DB;
}

export async function all<T = any>(sql: string, ...bind: unknown[]): Promise<T[]> {
  const d = await db();
  const r = await d.prepare(sql).bind(...bind).all<T>();
  return (r.results ?? []) as T[];
}

export async function one<T = any>(sql: string, ...bind: unknown[]): Promise<T | null> {
  const d = await db();
  return (await d.prepare(sql).bind(...bind).first<T>()) ?? null;
}

export async function run(sql: string, ...bind: unknown[]) {
  const d = await db();
  return d.prepare(sql).bind(...bind).run();
}

export async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Small concurrency limiter. Boards are polite endpoints, so stay modest. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
