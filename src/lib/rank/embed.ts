import { MODELS } from "./config";
import { all, env, one, run } from "../db";

/**
 * Pass 2. Embeddings live in D1 as JSON while the corpus is small. Swap to
 * Vectorize when the vectors table passes roughly 20k rows.
 */

export async function embedText(text: string): Promise<number[]> {
  const e = await env();
  const res: any = await e.AI.run(MODELS.embed as any, { text: [text.slice(0, 4000)] });
  const v = res?.data?.[0];
  if (!Array.isArray(v)) throw new Error("embedding failed");
  return v;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function getVector(
  ownerType: "job" | "profile",
  ownerId: string,
  hash: string,
  build: () => string,
): Promise<number[]> {
  const row = await one<{ hash: string; vec_json: string }>(
    `SELECT hash, vec_json FROM vectors WHERE owner_type = ? AND owner_id = ?`,
    ownerType, ownerId,
  );
  if (row && row.hash === hash) return JSON.parse(row.vec_json);

  const vec = await embedText(build());
  await run(
    `INSERT INTO vectors (owner_type, owner_id, hash, dim, vec_json)
     VALUES (?,?,?,?,?)
     ON CONFLICT(owner_type, owner_id) DO UPDATE SET
       hash = excluded.hash, dim = excluded.dim, vec_json = excluded.vec_json,
       created_at = datetime('now')`,
    ownerType, ownerId, hash, vec.length, JSON.stringify(vec),
  );
  return vec;
}

export async function pruneVectors(keepDays = 120) {
  await run(
    `DELETE FROM vectors WHERE owner_type = 'job' AND owner_id IN (
       SELECT id FROM jobs WHERE closed_at IS NOT NULL
         AND closed_at < datetime('now', ?))`,
    `-${keepDays} days`,
  );
}
