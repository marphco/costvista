// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CostVista",
  description: "Healthcare price transparency made usable.",
  // icons: {
  //   icon: "/assets/favicon.svg",
  // },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <meta name="apple-mobile-web-app-title" content="CostVista" />
      <body>{children}</body>
    </html>
  );
}
