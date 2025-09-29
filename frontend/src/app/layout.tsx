// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CostVista — Price transparency made usable",
  description:
    "CostVista transforms massive healthcare price files into clean comparisons for brokers, HR, and employers.",
icons: {
    // Favicon per i tab (Safari userà uno di questi)
    icon: [
      { url: "/favicon.ico" }, // ICO = sizes:any, super compatibile
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      // facoltativo: { url: "/favicon.png", sizes: "64x64", type: "image/png" },
    ],
    // iOS per "Aggiungi a Home"
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    // opzionale per Safari macOS pinned tab
    other: [{ rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#0ea5e9" }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Icons da /public */}
        <link rel="icon" href="/favicon.ico?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=2" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=2" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=2" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#0ea5e9" />
        <meta name="msapplication-TileColor" content="#0ea5e9" />
        <meta name="theme-color" content="#0a0a0a" />

        {/* Social preview (opzionale ma consigliato) */}
        <meta property="og:site_name" content="CostVista" />
        <meta property="og:title" content="CostVista — Price transparency made usable" />
        <meta property="og:description" content="Turn massive machine-readable files into clean, decision-ready comparisons." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://costvista.com/" />
        <meta property="og:image" content="https://costvista.com/og-image.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="CostVista — Price transparency made usable" />
        <meta name="twitter:description" content="Turn massive machine-readable files into clean, decision-ready comparisons." />
        <meta name="twitter:image" content="https://costvista.com/og-image.jpg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
