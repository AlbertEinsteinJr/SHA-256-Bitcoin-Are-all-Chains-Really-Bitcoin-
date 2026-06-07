import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The loop worker and CLI are not part of the Vercel build; only the dashboard
  // + API route handlers + the cron tick deploy here.
  serverExternalPackages: ["@anthropic-ai/sdk"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
