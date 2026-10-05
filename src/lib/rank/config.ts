export interface ProfileConfig {
  titles: { core: string[]; adjacent: string[]; exclude: string[] };
  seniority: { want: string[]; reject: string[] };
  mustHave: string[];
  niceToHave: string[];
  dealbreakers: string[];
  locations: { allow: string[]; remoteOk: boolean };
  weights: {
    title: number; keywords: number; seniority: number; recency: number;
    semantic: number; judge: number;
  };
  judgeTopN: number;
  semanticTopN: number;
}

export const DEFAULT_WEIGHTS: ProfileConfig["weights"] = {
  title: 0.34, keywords: 0.26, seniority: 0.22, recency: 0.18,
  semantic: 0.25, judge: 0.45,
};

export const MODELS = {
  // Check the current Workers AI catalogue before deploying; model ids move.
  embed: "@cf/baai/bge-base-en-v1.5",
  judge: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  judgeFallback: "@cf/meta/llama-3.1-8b-instruct",
} as const;
