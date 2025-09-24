// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Costvista",
  description: "Healthcare price transparency made usable.",
  icons: {
    icon: "/assets/favicon.svg", // <- usa la favicon.svg in /public/assets
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
