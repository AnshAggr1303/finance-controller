import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // This project's own AGENTS.md/CLAUDE.md live at the repo root (they
  // cover backend/frontend/data together) — stop `next dev` from
  // regenerating its per-version notice at frontend/AGENTS.md|CLAUDE.md.
  agentRules: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/:path*",
      },
    ];
  },
};

export default nextConfig;

