// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://costvista.com"),
  title: "CostVista",
  description: "Healthcare price transparency made usable.",
  themeColor: "#0b1220",
  icons: {
    // ORDINE: ICO/PNG prima, poi SVG (iOS ignora spesso l'SVG nei tab)
    icon: [
      { url: "/favicon.ico?v=2" },
      { url: "/favicon-96x96.png?v=2", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg?v=2", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/safari-pinned-tab.svg?v=2", color: "#0ea5e9" },
      { rel: "manifest", url: "/site.webmanifest?v=2" },
    ],
  },
  applicationName: "CostVista",
  appleWebApp: {
    title: "CostVista",
    capable: true,
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
