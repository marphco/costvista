// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.costvista.com"),
  title: "CostVista — Price transparency made usable",
  description:
    "CostVista transforms massive healthcare price files into clean comparisons for brokers, HR, and employers.",
  applicationName: "CostVista",
  icons: {
    icon: [
      { url: "/favicon.svg" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    // utile per vecchi Safari/Windows
    shortcut: ["/favicon.svg"],
    // iOS “Add to Home Screen”
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    // metti questa SOLO se il file esiste davvero in /public
    // other: [{ rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#0ea5e9" }],
  },
  openGraph: {
    type: "website",
    url: "https://www.costvista.com/",
    siteName: "CostVista",
    title: "CostVista — Price transparency made usable",
    description:
      "Turn massive machine-readable files into clean, decision-ready comparisons.",
    images: [{ url: "/og-image.jpg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CostVista — Price transparency made usable",
    description:
      "Turn massive machine-readable files into clean, decision-ready comparisons.",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
