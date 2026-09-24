import type { NextConfig } from "next";

// STATIC_EXPORT=1 builds a static front end for the Perplexity preview; the API routes run
// separately via `next start`. On Vercel, leave it unset: pages and API routes deploy together.
const isExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isExport ? { output: "export", distDir: ".next-export", assetPrefix: ".", images: { unoptimized: true } } : {}),
  outputFileTracingIncludes: { "/api/**": ["./public/seed/**"] },
};

export default nextConfig;
