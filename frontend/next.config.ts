// frontend/next.config.ts
import type { NextConfig } from "next";
// import path from "path";

const nextConfig: NextConfig = {

// async headers() {
//     return [
//       {
//         source: "/apple-touch-icon.png",
//         headers: [
//           { key: "Cache-Control", value: "public, max-age=31536000, immutable, no-transform" },
//           { key: "X-Content-Type-Options", value: "nosniff" },
//           { key: "Content-Type", value: "image/png" },
//         ],
//       },
//       {
//         // opzionale: tutte le favicon png
//         source: "/:icon(favicon-16x16|favicon-32x32).png",
//         headers: [
//           { key: "Cache-Control", value: "public, max-age=31536000, immutable, no-transform" },
//           { key: "X-Content-Type-Options", value: "nosniff" },
//           { key: "Content-Type", value: "image/png" },
//         ],
//       },
//     ];
//   },

  // Imposta esplicitamente la root del workspace (la cartella monorepo)
  // outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
