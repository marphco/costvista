// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#0B1220",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://costvista.com"),
  title: "CostVista",
  description: "Healthcare price transparency made usable.",
  applicationName: "CostVista",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* FAVICON (PNG espliciti + ICO) — aggiunto ?v=3 per bustare la cache */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=3" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=3" />
        <link rel="icon" href="/favicon.ico?v=3" />
        {/* Apple touch (Safari iOS) */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=3" />
        {/* Manifest (Chrome/Android, Add-to-Home) */}
        <link rel="manifest" href="/manifest.webmanifest?v=3" />
        {/* (Opzionale) mask-icon è solo per Safari macOS pinned tabs */}
        {/* <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#0ea5e9" /> */}
        <meta name="application-name" content="CostVista" />
        <meta name="apple-mobile-web-app-title" content="CostVista" />
      </head>
      <body>{children}</body>
    </html>
  );
}
