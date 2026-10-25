import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // Vercel restores Turbopack's build cache between deploys, and with the Tailwind loader below it once served a
  // stylesheet built from the previous commit (the globals.css change never reached production). Builds are small; no cache.
  experimental: { turbopackFileSystemCacheForBuild: false },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
