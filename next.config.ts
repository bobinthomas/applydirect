import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = { eslint: { ignoreDuringBuilds: true } };
export default nextConfig;

// Lets `next dev` see the D1 and AI bindings.
initOpenNextCloudflareForDev();
