// frontend/next.config.ts
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Imposta esplicitamente la root del workspace (la cartella monorepo)
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
