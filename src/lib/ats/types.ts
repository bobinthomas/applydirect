export type AtsId =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workable"
  | "smartrecruiters";

export interface NormalizedJob {
  atsJobId: string;
  title: string;
  location: string | null;
  remote: boolean;
  dept: string | null;
  employment: string | null;
  url: string;
  postedAt: string | null; // ISO
  descriptionMd: string;
}

export interface Adapter {
  id: AtsId;
  label: string;
  /** Pull a board token out of a public posting URL found in search results. */
  matchUrl(url: string): string | null;
  /** Public board endpoint. No API key anywhere in here by design. */
  listJobs(token: string, fetchImpl?: typeof fetch): Promise<NormalizedJob[]>;
  /** Where a human goes to eyeball the board. */
  boardUrl(token: string): string;
}

export class BoardGone extends Error {
  constructor(public token: string, public status: number) {
    super(`board ${token} returned ${status}`);
  }
}
