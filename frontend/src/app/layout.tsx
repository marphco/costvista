// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  // risolve il warning: themeColor va qui
  themeColor: "#0b1220",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://costvista.com"),
  title: "CostVista",
  description: "Healthcare price transparency made usable.",
  applicationName: "CostVista",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "CostVista" },
  // lascio la parte 'icons' vuota: mettiamo i <link> a mano nel <head> (vedi sotto)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* Favicons “sicure” per tutti i browser */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/favicon-32x32.png" sizes="32x32" />
        <link rel="icon" type="image/png" href="/favicon-16x16.png" sizes="16x16" />
        {/* iOS Safari: niente querystring, PNG 180x180 */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        {/* opzionali ma ok */}
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#0ea5e9" />
        <link rel="manifest" href="/site.webmanifest" />
        {/* (se vuoi anche l’SVG, aggiungi sotto, ma PNG/ICO restano i primari)
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" /> */}
      </head>
      <body>{children}</body>
    </html>
  );
}
