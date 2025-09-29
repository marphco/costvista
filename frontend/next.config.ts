// // frontend/next.config.ts
// import type { NextConfig } from "next";
// import path from "path";

// const nextConfig: NextConfig = {

// async headers() {
//     return [
//       { source: "/apple-touch-icon.png", headers: [
//         { key: "Cache-Control", value: "public, max-age=31536000, immutable, no-transform" },
//         { key: "Content-Type", value: "image/png" },
//         { key: "X-Content-Type-Options", value: "nosniff" },
//       ]},
//       { source: "/favicon.ico", headers: [
//         { key: "Cache-Control", value: "public, max-age=31536000, immutable, no-transform" },
//         { key: "Content-Type", value: "image/x-icon" },
//         { key: "X-Content-Type-Options", value: "nosniff" },
//       ]},
//     ];
//   },

//   // Imposta esplicitamente la root del workspace (la cartella monorepo)
//   outputFileTracingRoot: path.join(__dirname, ".."),
// };

// export default nextConfig;


module.exports = {
  async headers() {
    return [
      {
        source: "/:all*(ico|png|svg)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/site.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" }
        ]
      }
    ];
  }
};