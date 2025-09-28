// frontend/src/app/layout.tsx
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
  // ⚠️ NIENTE icons/manifest qui: Next userà automaticamente /icon.svg
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* (Opzionale) solo per icona su Home Screen iOS */}
        {/* <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon.png" /> */}
        <meta name="apple-mobile-web-app-title" content="CostVista" />
      </head>
      <body>{children}</body>
    </html>
  );
}
