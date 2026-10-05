import type { Adapter, AtsId } from "./types";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { ashby } from "./ashby";
import { workable } from "./workable";
import { smartrecruiters } from "./smartrecruiters";

export const ADAPTERS: Adapter[] = [greenhouse, lever, ashby, workable, smartrecruiters];

export const byId = (id: string): Adapter | undefined =>
  ADAPTERS.find((a) => a.id === id);

/** Turn any posting URL from a search result into { ats, token } or null. */
export function identify(url: string): { ats: AtsId; token: string } | null {
  for (const a of ADAPTERS) {
    const token = a.matchUrl(url);
    if (token) return { ats: a.id, token };
  }
  return null;
}

export * from "./types";
