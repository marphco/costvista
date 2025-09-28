// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";

// ✅ Sposta themeColor in viewport
export const viewport: Viewport = {
  themeColor: "#0b1220",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://costvista.com"),
  title: "CostVista",
  description: "Healthcare price transparency made usable.",
  applicationName: "CostVista",
  appleWebApp: {
    title: "CostVista",
    capable: true,
    statusBarStyle: "default",
  },
  icons: {
    // Ordine: ICO/PNG piccoli → PNG grandi → SVG
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" }, // ok per chrome/desktop
    ],
    // ⚠️ iOS Safari preferisce la discovery automatica /apple-touch-icon.png
    // Lasciamo comunque il tag esplicito senza querystring.
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [
      { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#0ea5e9" },
      { rel: "manifest", url: "/site.webmanifest" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
