import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@meal-planner/shared"],
  experimental: {
    // Recipe import uploads an .xlsx to a server action. Vercel caps request bodies at 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
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
