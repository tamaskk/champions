import { existsSync } from "node:fs";
import path from "node:path";

import type { NextConfig } from "next";

// Monorepo: Next only reads apps/web/.env*, so also load the repo-root .env.
// Variables that are already set (apps/web/.env.local, shell, Vercel) keep their value.
const rootEnv = path.resolve(__dirname, "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  transpilePackages: ["@champion/shared"],
  experimental: {
    serverActions: {
      // Club import files go through a Server Action. Vercel caps request bodies at 4.5MB.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
