import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};
export default nextConfig;

// Lets `next dev` see the D1 and AI bindings. The AI binding is remote-only and
// needs `wrangler login`; LOCAL_ONLY=1 skips it so D1 pages work offline.
initOpenNextCloudflareForDev({ remoteBindings: process.env.LOCAL_ONLY !== "1" });
