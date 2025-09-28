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
  // Diciamo a Next dove sta il manifest (quello in /public)
  manifest: "/site.webmanifest",
  // Non dichiariamo icon qui: i browser troveranno i file standard in /public
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
