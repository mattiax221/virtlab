import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only origin checks: without these, Chrome via Cloudflare tunnel gets
  // static HTML but no hydrated React — clicks/drag/add do nothing.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.trycloudflare.com",
    "officials-paying-charged-beaver.trycloudflare.com",
    "motion-tobago-fri-overnight.trycloudflare.com",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
