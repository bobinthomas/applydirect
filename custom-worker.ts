// Cron entry point. Mirrors the DermaFlow pattern: wrap the Next handler and
// bolt scheduled work onto the same worker.
import handler from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,

  async scheduled(event: ScheduledController, env: any, ctx: ExecutionContext) {
    const base = env.SELF_URL || "https://direct-apply.workers.dev";
    const auth = env.ADMIN_TOKEN ? { authorization: `Bearer ${env.ADMIN_TOKEN}` } : undefined;
    const hit = (path: string, body?: unknown) =>
      fetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(auth ?? {}) },
        body: body ? JSON.stringify(body) : undefined,
      });

    switch (event.cron) {
      case "0 2 * * *":   // harvest every board
        ctx.waitUntil(hit("/api/harvest?limit=200"));
        break;
      case "30 2 * * *":  // score whatever came in
        ctx.waitUntil(hit("/api/rank?budget=40"));
        break;
      case "0 3 * * 1":   // Monday: grow the company list
        ctx.waitUntil(hit("/api/discover", {}));
        break;
    }
  },
} satisfies ExportedHandler;
