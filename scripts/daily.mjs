// The local stand-in for the crons: wait for `npm run dev`, then harvest and
// rank. `--open` also opens the inbox once the server answers.
import { existsSync, readFileSync } from "node:fs";
import { exec } from "node:child_process";

const BASE = "http://localhost:3000";
const open = process.argv.includes("--open");

function adminToken() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  if (!existsSync(".dev.vars")) return undefined;
  const m = readFileSync(".dev.vars", "utf8").match(/^ADMIN_TOKEN=(.*)$/m);
  return m?.[1].trim();
}

async function waitForServer(seconds = 180) {
  for (let i = 0; i < seconds; i++) {
    try {
      const res = await fetch(`${BASE}/api/jobs`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (i === 3) console.log("Waiting for the app to start...");
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Nothing answered at ${BASE}. Start the app first with: npm run dev`);
}

async function post(path) {
  const token = adminToken();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} failed (${res.status}): ${body.error ?? "see the app window"}`);
  return body;
}

function openInbox() {
  const url = `${BASE}/inbox`;
  const cmd = process.platform === "win32" ? `start "" "${url}"`
    : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

try {
  await waitForServer();
  if (open) openInbox();

  console.log("Pulling new jobs from every company board (about a minute)...");
  const h = await post("/api/harvest");
  console.log(`  ${h.ok} boards read, ${h.failed} failed, ${h.inserted} new jobs, ${h.closed} closed.`);
  if (h.companies > 0 && h.ok === 0) console.log("  Every board failed. Check your internet connection.");

  console.log("Ranking new jobs with AI (a few minutes)...");
  const r = await post("/api/rank?budget=30");
  console.log(`  ${r.considered} checked, ${r.filtered} filtered out, ${r.judged} reviewed by AI.`);

  console.log(`\nDone. Refresh ${BASE}/inbox to see today's list.`);
} catch (e) {
  console.error(`\nProblem: ${e.message}`);
  process.exitCode = 1;
}
