// Cron entry point. Mirrors the DermaFlow pattern: wrap the Next handler and
// bolt scheduled work onto the same worker. Crons call the handler in-process
// rather than fetching the worker's own URL, which needs no SELF_URL and avoids
// Cloudflare refusing a worker that fetches itself.
import handler from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,

  async scheduled(event: ScheduledController, env: any, ctx: ExecutionContext) {
    const auth = env.ADMIN_TOKEN ? { authorization: `Bearer ${env.ADMIN_TOKEN}` } : undefined;
    const hit = async (path: string, body?: unknown) => {
      const req = new Request(`https://cron.internal${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(auth ?? {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const res = await handler.fetch(req, env, ctx);
      if (!res.ok) console.error(`cron ${event.cron} ${path} -> ${res.status}: ${await res.text()}`);
    };

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
